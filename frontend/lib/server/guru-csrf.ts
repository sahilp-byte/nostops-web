// Stateless CSRF for the global "Ask AI Guru" widget.
//
// The platform's standard double-submit CSRF relies on a `nostops_csrf` cookie
// that is NOT issued on public/marketing pages (and cookie access is blocked in
// embedded preview iframes). Ask AI Guru must work on EVERY page, so it uses a
// self-contained, stateless signed token instead: GET /bff/guru/token returns an
// HMAC(exp) token; the client echoes it in `x-guru-csrf` on the chat POST.
//
// Why this is safe: the token is signed with the server-only PULSE_SHARED_SECRET,
// so a cross-site attacker cannot forge one, and they cannot read the token from
// our GET endpoint either (no CORS headers → the response body is unreadable
// cross-origin). The chat endpoint is read-only (no state change), so this is
// ample CSRF protection for it.
import crypto from 'crypto';

const SECRET = process.env.PULSE_SHARED_SECRET || 'nostops-guru-dev-secret';
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export function issueGuruToken(): string {
  const exp = String(Date.now() + TTL_MS);
  const sig = crypto.createHmac('sha256', SECRET).update(exp).digest('hex');
  return `${exp}.${sig}`;
}

export function verifyGuruToken(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false;
  const expect = crypto.createHmac('sha256', SECRET).update(exp).digest('hex');
  if (sig.length !== expect.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expect, 'hex'));
  } catch {
    return false;
  }
}
