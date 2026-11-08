import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external.js';
import { isPaymentTestHost } from '@/lib/payment-mode';

// Payments Prompt 2F — signed test tag (see backend/test_tag.py). A test run sends
// `x-nostops-test-tag`; the BFF passes it on to the LOCAL backend only when the signature is
// valid, the tag has not expired and the request came in through a preview / local host. The
// backend checks the tag again, plus its own environment, so a deployed site ignores it.
// While a request is tagged, the backend keeps its emails in a test outbox and its errors in a
// separate test log. The tag is never sent to the main backend or to any other service.
export const TEST_TAG_HEADER = 'x-nostops-test-tag';
const MAX_LIFETIME_S = 24 * 3600;
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');

type HeaderGetter = { get(name: string): string | null | undefined };

function key(): Buffer | null {
  const secret = process.env.PULSE_SHARED_SECRET || '';
  return secret ? createHmac('sha256', secret).update('nostops-test-tag/v1').digest() : null;
}

export function verifyTestTag(tag: string | null | undefined, nowS = Date.now() / 1000): boolean {
  const k = key();
  const parts = String(tag || '').trim().split('.');
  if (!k || parts.length !== 4 || parts[0] !== 'v1' || !/^[A-Za-z0-9_-]{3,48}$/.test(parts[1])) return false;
  if (!/^\d{1,12}$/.test(parts[2]) || !/^[0-9a-f]{64}$/.test(parts[3])) return false;
  const good = createHmac('sha256', k).update(parts.slice(0, 3).join('.')).digest('hex');
  if (!timingSafeEqual(Buffer.from(good), Buffer.from(parts[3]))) return false;
  const left = Number(parts[2]) - nowS;
  return left > 0 && left <= MAX_LIFETIME_S;
}

/** The tag to pass on for a request with these headers, or null. */
export function testTagFrom(h: HeaderGetter | null | undefined): string | null {
  const tag = h?.get(TEST_TAG_HEADER);
  if (!h || !tag) return null;
  const hosts = [h.get('host'), h.get('x-forwarded-host')].filter((x): x is string => !!x);
  if (!hosts.length || !hosts.every((x) => isPaymentTestHost(x))) return null;
  return verifyTestTag(tag) ? tag.trim() : null;
}

// The incoming request's headers, read WITHOUT next/headers' headers(): that call would turn a
// cached (ISR) page into a dynamic one. Outside a request (build, revalidation) there are none.
function currentRequestHeaders(): HeaderGetter | null {
  try {
    const store = workUnitAsyncStorage.getStore() as { type?: string; headers?: HeaderGetter } | undefined;
    return store?.type === 'request' && store.headers ? store.headers : null;
  } catch {
    return null;
  }
}

/** Added to every call to the local backend: the current request's verified test tag, if any. */
export function testTagHeaders(h: HeaderGetter | null = currentRequestHeaders()): Record<string, string> {
  const tag = testTagFrom(h);
  return tag ? { [TEST_TAG_HEADER]: tag } : {};
}

/** For the BFF's own emails: asks the backend whether this email must stay in the test outbox.
 *  The backend decides from its OWN environment (Prompt 2G): a signed test request's email (any
 *  address), or — on a preview, tagged or not — an email to a recognised test address, is kept
 *  in the outbox; a deployed site answers 404 and the email is sent as before.
 *  Returns true when the email must not be sent for real.
 *  Takes the route's own request headers, so it never depends on the request store. */
export async function divertTestEmail(
  h: HeaderGetter,
  email: { to: string; subject: string; html: string; source: string },
): Promise<boolean> {
  const tag = testTagHeaders(h);
  try {
    const r = await fetch(`${BASE}/api/test-sink/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pulse-Secret': process.env.PULSE_SHARED_SECRET || '', ...tag },
      body: JSON.stringify(email),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (r.status === 200) return true; // kept in the test outbox
    if (r.status === 404 && !tag[TEST_TAG_HEADER]) return false; // not held: send as usual
  } catch {
    /* backend unreachable: fall through to the fail-safe below */
  }
  // Fail-safe: a test request's email, or one to a test address, is never sent for real.
  return !!tag[TEST_TAG_HEADER] || isTestAddress(email.to);
}

// Prompt 2G — recognised test / synthetic addresses. The SAME rules as backend/test_tag.py
// (test_address_reason; an offline test checks they match). Used here only as the fail-safe
// when the backend cannot be asked.
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'];
const RESERVED_TLDS = ['example', 'test', 'invalid', 'localhost', 'local'];
const PROVIDER_TEST_DOMAINS = ['resend.dev'];
const PROJECT_TEST_DOMAINS = ['nostopsqa.com'];
const PROJECT_DEMO_DOMAIN = 'nostops.com';
const PROJECT_DEMO_LOCAL = /^(?:[a-z0-9_-]+\.demo|qa[._-][a-z0-9._-]+)$/;
const PROJECT_QA_INBOXES = ['nostops.web.qa.seeker@gmail.com'];
const ADDRESS = /^([^@\s]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/;

const under = (domain: string, parents: string[]) => parents.some((p) => domain === p || domain.endsWith(`.${p}`));

export function isTestAddress(address: string | null | undefined): boolean {
  const m = ADDRESS.exec(String(address || '').trim().toLowerCase());
  if (!m) return false;
  const [, local, domain] = m;
  return (
    under(domain, RESERVED_DOMAINS) ||
    RESERVED_TLDS.includes(domain.split('.').pop() || '') ||
    under(domain, PROVIDER_TEST_DOMAINS) ||
    under(domain, PROJECT_TEST_DOMAINS) ||
    (domain === PROJECT_DEMO_DOMAIN && PROJECT_DEMO_LOCAL.test(local.split('+', 1)[0])) ||
    PROJECT_QA_INBOXES.includes(`${local}@${domain}`)
  );
}
