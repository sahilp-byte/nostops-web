// Shared helpers for the BFF auth Route Handlers. Server-only.
// These endpoints live under /bff/* (NOT /api/*) because the platform ingress
// routes /api/* straight to FastAPI — a Next Route Handler there would be
// shadowed. The BFF forwards to the real backend server-side and converts the
// returned bearer token into an httpOnly cookie. The token is never returned
// to the browser.
import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_BASE } from '@/lib/api';
import { SESSION_COOKIE, cookieOptions } from '@/lib/server/session';
import { CSRF_COOKIE, CSRF_HEADER, ACTIVITY_COOKIE } from '@/lib/session-cookie';
import { refuseFinancialCall } from '@/lib/server/financial-lock';
import { previewWriteRefusal } from '@/lib/server/preview-isolation';

const TIMEOUT_MS = 10000;

function backendUrl(path: string): string {
  const p = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
  return `${BACKEND_BASE}${p}`;
}

/** CSRF defense for state-changing BFF routes, using a double-submit token.
 *  Middleware issues a non-httpOnly `nostops_csrf` cookie; the client echoes it
 *  in the `x-csrf-token` header (lib/auth-client::sendBff). A cross-site
 *  attacker cannot read the victim's cookie, so cannot forge a matching header.
 *  Fails closed when either is absent or unequal. This is proxy-agnostic —
 *  unlike an Origin/Host check, which the platform ingress rewrites to an
 *  internal cluster host. The session cookie is SameSite=None (cross-site
 *  preview embedding), so this double-submit token is the primary CSRF defense.
 *  Returns true when the request must be rejected (403). */
export function badOrigin(req: NextRequest): boolean {
  const cookie = req.cookies.get(CSRF_COOKIE)?.value ?? '';
  const header = req.headers.get(CSRF_HEADER) ?? '';
  if (cookie.length < 16 || header.length !== cookie.length) return true;
  let diff = 0;
  for (let i = 0; i < cookie.length; i++) diff |= cookie.charCodeAt(i) ^ header.charCodeAt(i);
  return diff !== 0;
}

/** Unauthenticated forward to the backend (login/register/otp/session/reset). */
export async function forward(path: string, body: unknown, timeoutMs: number = TIMEOUT_MS): Promise<Response> {
  const text = JSON.stringify(body ?? {});
  const refused = refuseFinancialCall('POST', path, text);
  if (refused) return refused;
  // Payments Prompt 2D — preview never writes to the real main backend (sign-in/out only).
  const previewRefused = await previewWriteRefusal('POST', path);
  if (previewRefused) return previewRefused;
  return fetch(backendUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: text,
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function readJson(res: Response): Promise<any> {
  return res.json().catch(() => null);
}

/** Coerce ANY backend error value (string | FastAPI 422 array | object |
 *  nullish) into a safe, user-facing string. Guarantees the UI never renders
 *  "[object Object]". FastAPI validation payloads (arrays of { loc, msg, type })
 *  are formatted as "field: message; field: message". */
export function toErrorText(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value.trim() || fallback;
  if (Array.isArray(value)) {
    const msgs = value
      .map((item) => {
        if (typeof item === 'string') return item;
        const msg = typeof (item as { msg?: unknown })?.msg === 'string' ? (item as { msg: string }).msg : '';
        const rawLoc = (item as { loc?: unknown })?.loc;
        const loc = Array.isArray(rawLoc) ? rawLoc.filter((s) => s !== 'body') : [];
        const field = loc.length ? String(loc[loc.length - 1]) : '';
        return field && msg ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean);
    if (msgs.length) return msgs.join('; ');
  }
  if (value && typeof value === 'object' && typeof (value as { msg?: unknown }).msg === 'string') {
    return (value as { msg: string }).msg;
  }
  return fallback;
}

/** Extract a safe, user-facing error string from a backend response body.
 *  Reads detail/message/error and formats FastAPI validation payloads so the
 *  UI never renders "[object Object]". Never leaks stack traces. */
export function errorMessage(data: any, fallback: string): string {
  if (!data) return fallback;
  return toErrorText(data.detail ?? data.message ?? data.error, fallback);
}

export function withSession<T extends NextResponse>(resp: T, token: string): T {
  resp.cookies.set(SESSION_COOKIE, token, cookieOptions());
  resp.cookies.set(ACTIVITY_COOKIE, String(Date.now()), cookieOptions());
  return resp;
}

export { NextResponse };
