import 'server-only';
import { headers } from 'next/headers';
import { isPaymentTestHost, isPreviewSuffix } from '@/lib/payment-mode';

// Payments Prompt 2D — preview is VIEW-ONLY for the real main backend (pro-learn-connect-1).
// Founder decision: "preview can view, not save". Every server-side call that would create or
// change a record there is refused HERE, before anything is sent, when the browser came in
// through a preview / local / unknown host. Reads (GET/HEAD/OPTIONS) and signing in/out are
// allowed. Production hosts (www.nostops.org, *.emergent.host) are untouched. Fail closed: no
// request context or no host information → treated as preview. Nothing is ever redirected.
export const PREVIEW_READ_ONLY_MESSAGE =
  'Preview mode: saving is turned off in this preview, so nothing was sent to the live NOSTOPS system. This works on the live site.';
export const PREVIEW_READ_ONLY_HEADER = 'X-Nostops-Preview-Read-Only';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** The only upstream writes that may leave preview: signing in / out (exact paths, no variants). */
export const PREVIEW_SIGN_IN_PATHS: ReadonlySet<string> = new Set([
  '/api/auth/login',
  '/api/auth/login-by-role',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/auth/otp/lookup', // read-only pre-flight "does this number have an account?" (POST upstream)
  '/api/auth/otp/start',
  '/api/auth/otp/verify',
  '/api/admin/totp/verify',
]);

/** Owner decision (Prompt 3, June 2026): only these exact upstream writes may also leave preview —
 *  the teacher's own onboarding draft and the onboarding analytics events (sent with
 *  source="preview"). Every other write stays refused. Exact "METHOD /path", no variants. */
export const PREVIEW_ALLOWED_WRITES: ReadonlySet<string> = new Set([
  'PUT /api/teachers/me/onboarding-draft',
  'POST /api/teachers/me/onboarding-draft/complete',
  'POST /api/v1/events',
]);

/** True when the current request came in through a preview / local / unknown host (fail closed). */
export async function isPreviewRequest(): Promise<boolean> {
  try {
    return isPreviewOrigin(await headers());
  } catch {
    return true;
  }
}

function upstreamPath(path: string): string {
  return path.startsWith('/api') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Same host rule as the preview payment guard: preview suffix, local or missing host. */
export function isPreviewOrigin(h: Headers): boolean {
  const host = h.get('host');
  const fwd = h.get('x-forwarded-host');
  return isPaymentTestHost(fwd || host) || isPreviewSuffix(host) || isPreviewSuffix(fwd);
}

export async function previewWriteRefusal(method: string | undefined, path: string): Promise<Response | null> {
  if (READ_METHODS.has(String(method || 'GET').toUpperCase())) return null;
  if (PREVIEW_SIGN_IN_PATHS.has(upstreamPath(path))) return null;
  if (PREVIEW_ALLOWED_WRITES.has(`${String(method).toUpperCase()} ${upstreamPath(path)}`)) return null;
  let preview = true;
  try {
    preview = isPreviewOrigin(await headers());
  } catch {
    preview = true; // outside a request: can't tell where it came from → fail closed
  }
  if (!preview) return null;
  return Response.json(
    { error: PREVIEW_READ_ONLY_MESSAGE, detail: PREVIEW_READ_ONLY_MESSAGE, preview_read_only: true },
    { status: 423, headers: { [PREVIEW_READ_ONLY_HEADER]: '1', 'Cache-Control': 'no-store' } },
  );
}
