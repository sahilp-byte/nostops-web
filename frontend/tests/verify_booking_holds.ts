// Payments Prompt 2C — no hold (1:1 slot, retreat seat, retreat group, group-batch place, paid
// event place) is created unless the buyer's billing country routes to "India → Cashfree, INR".
// Runs the REAL BFF route handlers in Node with the REAL local routing policy
// (backend/payment_routing.py at PULSE_API_URL). Every other network call is intercepted and
// recorded, so nothing reaches the main backend, a provider or the engine.
// Run: node tests/verify_booking_holds.ts   (needs the local backend running)
import { readFileSync } from 'node:fs';
import { register as registerHook } from 'node:module';

registerHook('./alias-hooks.mjs', import.meta.url);
registerHook('./server-only-hook.mjs', import.meta.url);
registerHook('./next-headers-hook.mjs', import.meta.url);

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^(PULSE_SHARED_SECRET|PULSE_API_URL|BACKEND_URL)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { NextRequest } = await import('next/server');
const oneOnOne = await import('../app/bff/one-on-one/bookings/route.ts');
const reserve = await import('../app/bff/retreats/[id]/reserve/route.ts');
const groupBook = await import('../app/bff/retreats/[id]/group-book/route.ts');
const invite = await import('../app/bff/booking-invite/[token]/[action]/route.ts');
const participantRegister = await import('../app/bff/institutional/participant/register/route.ts');
const pricing = await import('../lib/pricing.ts');

let failures = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) console.log(`  \u2713 ${name}`);
  else {
    failures++;
    console.error(`  \u2717 ${name}${got !== undefined ? ` (got ${JSON.stringify(got)})` : ''}`);
  }
}

// ── network: the routing policy is real; everything else is recorded and answered locally ──
type Call = { url: string; method: string; headers: Record<string, string>; body: any };
const realFetch = globalThis.fetch;
let policyMode: 'real' | 'down' | 'tampered' = 'real';
let policyCalls = 0;
let calls: Call[] = [];
let engineReply: { status: number; body: unknown } = { status: 200, body: { ok: true, registration: { registration_id: 'REG-QA' } } };
(globalThis as any).fetch = async (url: string, init: RequestInit = {}) => {
  const u = String(url);
  if (u.includes('/api/payment-routing/decide')) {
    policyCalls++;
    if (policyMode === 'down') throw new TypeError('fetch failed (policy unreachable, mock)');
    if (policyMode === 'tampered') return new Response(JSON.stringify({ allowed: true, provider: 'paypal', currency: 'USD', billing_country: 'US' }), { status: 200 });
    return realFetch(u, init);
  }
  const headers: Record<string, string> = {};
  new Headers(init.headers).forEach((v, k) => { headers[k] = v; });
  let body: any = null;
  try { body = typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch { body = init.body; }
  calls.push({ url: u, method: String(init.method || 'GET'), headers, body });
  if (u.endsWith('/api/auth/me')) return new Response(JSON.stringify({ user: { user_id: 'u_qa_p2c', email: 'qa.p2c@example.com', name: 'QA P2C' } }), { status: 200 });
  // Prompt 2D — the seat/group hold reads the retreat first (an upcoming one here).
  if (u.endsWith('/api/retreats/rt_qa_p2c') && String(init.method || 'GET') === 'GET') {
    return new Response(JSON.stringify({ retreat_id: 'rt_qa_p2c', start_date: '2031-01-15', seats_remaining: 5 }), { status: 200 });
  }
  if (u.includes('/api/teachers/public/')) return new Response(JSON.stringify({ teacher: { teacher_id: 't_qa_p2c', name: 'QA Teacher' } }), { status: 200 });
  if (u.includes('/api/institutional/participant/register')) return new Response(JSON.stringify(engineReply.body), { status: engineReply.status });
  return new Response(JSON.stringify({ detail: 'test: no network beyond the routing policy' }), { status: 599 });
};

const CSRF = 'p2cfixturecsrftoken0123456789abcd';
const PREVIEW_HOST = 'qa-p2c.preview.emergentagent.com';
const PROD_HOST = 'www.nostops.org'; // only used with the intercepted network above
(globalThis as any).__qaCookies = { nostops_session: 'qa_session_p2c', nostops_participant: 'qa_participant_p2c' };

function req(path: string, body: unknown, host = PREVIEW_HOST, raw?: string) {
  // What next/headers reports to backendFetch (Prompt 2D preview write guard).
  (globalThis as any).__qaRequestHeaders = { host: 'localhost:3000', 'x-forwarded-host': host };
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `nostops_csrf=${CSRF}`, 'x-csrf-token': CSRF, 'x-forwarded-host': host },
    body: raw ?? JSON.stringify(body),
  });
}

type Hold = {
  name: string;
  base: Record<string, unknown>;
  call: (b: unknown, host?: string) => Promise<Response>;
  upstream: string;
  previewGuarded: boolean; // the preview payment guard stops it before the main backend
};
const HOLDS: Hold[] = [
  {
    name: '1:1 session booking (holds the slot)',
    base: { teacher_handle: 'qa-teacher', slot_iso: '2031-01-15T10:00:00.000Z', learner_name: 'QA P2C', learner_phone: '+910000000000', note: 'Online session' },
    call: (b, host) => oneOnOne.POST(req('/bff/one-on-one/bookings', b, host)),
    upstream: '/api/one-on-one/bookings',
    previewGuarded: true,
  },
  {
    name: 'retreat seat hold',
    base: { name: 'QA P2C', email: 'qa.p2c@example.com', phone: '+910000000000' },
    call: (b, host) => reserve.POST(req('/bff/retreats/rt_qa_p2c/reserve', b, host), { params: Promise.resolve({ id: 'rt_qa_p2c' }) }),
    upstream: '/api/retreats/rt_qa_p2c/reserve',
    previewGuarded: true,
  },
  {
    name: 'retreat group hold (host-paid)',
    base: { group_size: 7, organisation_name: 'QA P2C group', organisation_type: 'friends_family', contact_name: 'QA P2C', contact_email: 'qa.p2c@example.com', contact_phone: '+910000000000' },
    call: (b, host) => groupBook.POST(req('/bff/retreats/rt_qa_p2c/group-book', b, host), { params: Promise.resolve({ id: 'rt_qa_p2c' }) }),
    upstream: '/api/retreats/rt_qa_p2c/group-book',
    previewGuarded: false,
  },
  {
    name: 'group batch enrolment (invite link)',
    base: { name: 'QA P2C', email: 'qa.p2c@example.com' },
    call: (b, host) => invite.POST(req('/bff/booking-invite/tokqa1234/register', b, host), { params: Promise.resolve({ token: 'tokqa1234', action: 'register' }) }),
    upstream: '/api/bookings/invite/tokqa1234/register',
    previewGuarded: false,
  },
];

const CASES: { label: string; extra: Record<string, unknown>; status: number; reason: string }[] = [
  { label: 'missing billing country', extra: {}, status: 400, reason: 'billing_country_required' },
  { label: 'empty billing country', extra: { billing_country: '  ' }, status: 400, reason: 'billing_country_required' },
  { label: 'country name instead of code', extra: { billing_country: 'India' }, status: 400, reason: 'billing_country_invalid' },
  { label: 'unknown code', extra: { billing_country: 'XX' }, status: 400, reason: 'billing_country_invalid' },
  { label: 'numeric country', extra: { billing_country: 91 }, status: 400, reason: 'billing_country_invalid' },
  { label: 'country as a list', extra: { billing_country: ['IN'] }, status: 400, reason: 'billing_country_invalid' },
  { label: 'outside India (US)', extra: { billing_country: 'US' }, status: 422, reason: 'international_not_offered' },
  { label: 'outside India (GB) claiming INR + Cashfree', extra: { billing_country: 'GB', currency: 'INR', provider: 'cashfree' }, status: 422, reason: 'provider_conflict' },
  { label: 'outside India (US) claiming USD + PayPal', extra: { billing_country: 'US', currency: 'USD', provider: 'paypal' }, status: 422, reason: 'international_not_offered' },
  { label: 'country PayPal does not serve (RU)', extra: { billing_country: 'RU' }, status: 422, reason: 'provider_not_supported_in_country' },
  { label: 'India + USD', extra: { billing_country: 'IN', currency: 'USD' }, status: 422, reason: 'currency_not_supported' },
  { label: 'India + PayPal', extra: { billing_country: 'IN', provider: 'paypal' }, status: 422, reason: 'provider_conflict' },
];

console.log('BOOKING HOLDS (real BFF handlers, real routing policy, network intercepted):');
for (const h of HOLDS) {
  console.log(`\n${h.name}:`);
  for (const c of CASES) {
    calls = [];
    policyCalls = 0;
    for (const host of [PREVIEW_HOST, PROD_HOST]) {
      const res = await h.call({ ...h.base, ...c.extra }, host);
      const d: any = await res.json().catch(() => null);
      const ok = res.status === c.status && d?.reason === c.reason && d?.routing_refused === true && d?.hold_refused === true
        && String(d?.error || '').includes('Nothing has been reserved');
      check(`${c.label} → ${c.status} ${c.reason} (${host === PROD_HOST ? 'production host' : 'preview'})`, ok, [res.status, d?.reason, d?.hold_refused]);
    }
    check(`${c.label}: no sign-in lookup, no hold, no order — nothing sent anywhere`, calls.length === 0 && policyCalls === 2, calls.map((x) => x.url));
  }

  // Bypass attempts with bodies the form never sends.
  for (const raw of ['not json', 'null', '[]', '"IN"']) {
    calls = [];
    const r = await (h.name.startsWith('1:1')
      ? oneOnOne.POST(req('/bff/one-on-one/bookings', null, PROD_HOST, raw))
      : h.name.startsWith('retreat seat')
        ? reserve.POST(req('/bff/retreats/rt_qa_p2c/reserve', null, PROD_HOST, raw), { params: Promise.resolve({ id: 'rt_qa_p2c' }) })
        : h.name.startsWith('retreat group')
          ? groupBook.POST(req('/bff/retreats/rt_qa_p2c/group-book', null, PROD_HOST, raw), { params: Promise.resolve({ id: 'rt_qa_p2c' }) })
          : invite.POST(req('/bff/booking-invite/tokqa1234/register', null, PROD_HOST, raw), { params: Promise.resolve({ token: 'tokqa1234', action: 'register' }) }));
    const d: any = await r.json().catch(() => null);
    check(`body ${raw} → 400 billing_country_required, nothing sent`, r.status === 400 && d?.reason === 'billing_country_required' && calls.length === 0, [r.status, d?.reason, calls.length]);
  }

  // India, preview: the preview payment guard stops on-platform-paid holds; since Prompt 2D the
  // preview write guard stops the host-paid ones too — nothing reaches the main backend.
  calls = [];
  const prev = await h.call({ ...h.base, billing_country: 'IN' }, PREVIEW_HOST);
  const prevData: any = await prev.json().catch(() => null);
  const prevHold = calls.filter((x) => x.url.endsWith(h.upstream));
  if (h.previewGuarded) {
    check('India in preview → passes the country check, then the preview guard stops it (503), no hold', prev.status === 503 && prevData?.payments_disabled === true && calls.length === 0, [prev.status, calls.map((x) => x.url)]);
  } else {
    check('India in preview → passes the country check, then the preview write guard stops it (423), no hold sent', prev.status === 423 && String(prevData?.error || '').startsWith('Preview mode') && prevHold.length === 0 && calls.every((x) => x.method === 'GET'), [prev.status, calls.map((x) => `${x.method} ${x.url}`)]);
  }

  // India on a production host: exactly one hold request, carrying the country header; the
  // routing fields are not passed on and the booking details (incl. group size) are unchanged.
  calls = [];
  await h.call({ ...h.base, billing_country: 'in', currency: 'INR', provider: 'cashfree' }, PROD_HOST);
  const hold = calls.filter((x) => x.url.endsWith(h.upstream));
  check('India (production host) → exactly one hold request upstream', hold.length === 1, calls.map((x) => x.url));
  if (hold[0]) {
    check('…sent with X-Billing-Country: IN', hold[0].headers['x-billing-country'] === 'IN', hold[0].headers['x-billing-country']);
    check('…routing fields not passed on', !('billing_country' in (hold[0].body || {})) && !('currency' in (hold[0].body || {})) && !('provider' in (hold[0].body || {})), Object.keys(hold[0].body || {}));
    if (h.name.startsWith('retreat group')) {
      check('…group size and details unchanged (discount is computed upstream from these)', hold[0].body.group_size === 7 && hold[0].body.organisation_name === 'QA P2C group', hold[0].body);
    }
  }

  policyMode = 'down';
  calls = [];
  const down = await h.call({ ...h.base, billing_country: 'IN' }, PROD_HOST);
  const downData: any = await down.json().catch(() => null);
  check('routing policy unreachable → 503, fail closed, nothing held', down.status === 503 && downData?.hold_refused === true && calls.length === 0, [down.status, calls.length]);
  policyMode = 'tampered';
  calls = [];
  const bad = await h.call({ ...h.base, billing_country: 'US' }, PROD_HOST);
  check('a non-Cashfree policy answer never becomes a hold → 503', bad.status === 503 && calls.length === 0, bad.status);
  policyMode = 'real';
}

console.log('\nPaid event registration (engine decides; the BFF passes the country on safely):');
{
  const call = (b: unknown, raw?: string) => participantRegister.POST(req('/bff/institutional/participant/register', b, PREVIEW_HOST, raw));
  const base = { event_slug: 'qa-p2c-paid', name: 'QA P2C', phone: '+910000000000' };
  const sent = async (bc: unknown) => {
    calls = [];
    await call(bc === undefined ? base : { ...base, billing_country: bc });
    const c = calls.find((x) => x.url.includes('/api/institutional/participant/register'));
    return c?.body;
  };
  check('IN is passed on as IN', (await sent('IN'))?.billing_country === 'IN');
  check('["IN"] is passed on as text that is never valid', (await sent(['IN']))?.billing_country === '["IN"]');
  check('91 is passed on as "91" (invalid)', (await sent(91))?.billing_country === '91');
  check('an over-long value is cut to 8 characters', (await sent('INDIAINDIA'))?.billing_country === 'INDIAIND');
  check('no country → nothing added (a free event needs none)', !('billing_country' in ((await sent(undefined)) || {})));
  engineReply = {
    status: 422,
    body: { detail: { error: 'International payment for this item is not available yet. Nothing has been reserved.', reason: 'international_not_offered', routing_refused: true, hold_refused: true } },
  };
  const r = await call({ ...base, billing_country: 'US' });
  const d: any = await r.json().catch(() => null);
  check('an engine refusal reaches the browser with its reason (422 international_not_offered)', r.status === 422 && d?.reason === 'international_not_offered' && d?.hold_refused === true && d?.routing_refused === true, [r.status, d]);
  engineReply = { status: 200, body: { ok: true } };
}

console.log('\nPrices unchanged; group tiers are reference only (Prompt 3C):');
{
  const tiers = [{ min_seats: 5, discount_pct: 10 }, { min_seats: 10, discount_pct: 15 }];
  // Unapproved tiers passed by an old caller are ignored: no group price is worked out from them.
  const g5 = pricing.resolveBooking({ standardInr: 12000, groupSize: 5, groupTiers: tiers, minGroupSize: 5 } as any);
  // Only a verified per-retreat group rate is used (none exists today).
  const v10 = pricing.resolveBooking({ standardInr: 12000, groupSize: 10, minGroupSize: 5, verifiedGroupPerSeatInr: 10200 });
  const v4 = pricing.resolveBooking({ standardInr: 12000, groupSize: 4, minGroupSize: 5, verifiedGroupPerSeatInr: 10200 });
  // Prompt 3C: a host-listed early-bird offer is ignored (old callers' extra field has no effect).
  const eb = pricing.resolveBooking({ standardInr: 12000, groupSize: 1, earlyBird: { amount: 10000, until: '2026-12-31' } } as any);
  check('unapproved tiers ignored → listed ₹12,000/seat, ₹60,000', g5.applied === 'standard' && g5.perSeatInr === 12000 && g5.totalInr === 60000 && g5.candidates.length === 1, [g5.applied, g5.perSeatInr, g5.totalInr]);
  check('verified group rate → ₹10,200/seat, ₹1,02,000', v10.applied === 'group' && v10.perSeatInr === 10200 && v10.totalInr === 102000, [v10.applied, v10.perSeatInr, v10.totalInr]);
  check('4 seats (below the minimum) → listed price even with a verified rate', v4.applied === 'standard' && v4.perSeatInr === 12000, [v4.applied, v4.perSeatInr]);
  check('early-bird offer ignored → listed price ₹12,000', eb.applied === 'standard' && eb.perSeatInr === 12000, [eb.applied, eb.perSeatInr]);
}

console.log(failures ? `\n\u2717 BOOKING HOLDS FAILED (${failures})` : '\n\u2713 BOOKING HOLDS PASSED');
process.exit(failures ? 1 : 0);
