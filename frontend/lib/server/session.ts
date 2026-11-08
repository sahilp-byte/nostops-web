// Server-only BFF session module.
// Importing `next/headers` guarantees this file is never bundled into client
// JS: any client component importing it fails to compile. The raw FastAPI
// bearer token lives ONLY here (read from an httpOnly cookie) and is attached
// as `Authorization: Bearer` when calling the backend. It is NEVER returned to
// the browser. Reuses the single server-only BACKEND_BASE from lib/api.ts —
// no second API client / base URL is introduced.
import { cache } from 'react';
import { cookies } from 'next/headers';
import { BACKEND_BASE } from '@/lib/api';
import type { User } from '@/lib/roles';
import { SESSION_COOKIE } from '@/lib/session-cookie';
import { refuseFinancialCall } from '@/lib/server/financial-lock';
import { previewWriteRefusal } from '@/lib/server/preview-isolation';

export { SESSION_COOKIE };
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 30; // 30 days (backend TTL unknown; conservative)
const TIMEOUT_MS = 10000;

export function cookieOptions(maxAge: number = DEFAULT_MAX_AGE) {
  return {
    httpOnly: true,
    // SameSite=None + Secure + Partitioned (CHIPS) so the session survives when
    // the app is opened in an embedded/cross-site context (Emergent mobile
    // webview / platform preview iframe), where unpartitioned third-party
    // cookies are dropped. CSRF is still enforced via the double-submit token.
    // Runtime is always HTTPS.
    secure: true,
    sameSite: 'none' as const,
    partitioned: true,
    path: '/',
    maxAge,
  };
}

function buildUrl(path: string): string {
  const p = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
  return `${BACKEND_BASE}${p}`;
}

/** Read the bearer token from the httpOnly cookie (server context only). */
export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** Authenticated server->backend fetch. Attaches the bearer token from the
 *  cookie. Never call this from a Client Component. */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  // FINANCIAL SAFETY AUDIT — money actions / state-changing reads never leave this server.
  const refused = refuseFinancialCall(init.method || 'GET', path, init.body);
  if (refused) return refused;
  // Payments Prompt 2D — preview never writes to the real main backend (sign-in/out only).
  const previewRefused = await previewWriteRefusal(init.method, path);
  if (previewRefused) return previewRefused;
  const token = await getSessionToken();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(buildUrl(path), {
    ...init,
    headers,
    cache: 'no-store',
    signal: init.signal ?? AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** Resolve the current user via /auth/me. Returns null when unauthenticated or
 *  when the session is invalid/expired (backend 401). The mobile backend does
 *  not use a client refresh token, so an expired session simply resolves null
 *  and the caller redirects to /login. */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    const res = await backendFetch('/auth/me');
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const user: User | null = (data?.user ?? data) || null;
    return user && (user.user_id || user.email) ? user : null;
  } catch {
    return null;
  }
});
