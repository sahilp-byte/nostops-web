import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { backendFetch, getSessionToken } from '@/lib/server/session';

// Live handle-availability check for the onboarding wizard. GET (no CSRF), session-gated.
// Proxies GET /teachers/handle-check/{handle}, which always answers 200 with available true/false.
// ONLY that upstream 200 with available:false is a genuine conflict. Every other failure returns an
// explicit { error: true, error_type } so the wizard never shows a failure as "handle taken".
type ErrorType = 'session_expired' | 'backend_error' | 'timeout';

function fail(error_type: ErrorType) {
  const status = error_type === 'session_expired' ? 401 : error_type === 'timeout' ? 504 : 502;
  return NextResponse.json({ error: true, error_type, available: null }, { status, headers: { 'Cache-Control': 'no-store' } });
}

const isTimeout = (e: unknown) => (e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError';

export async function GET(req: NextRequest) {
  if (!(await getSessionToken())) return fail('session_expired');

  const handle = (req.nextUrl.searchParams.get('handle') || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(handle)) {
    return NextResponse.json({ available: false, invalid: true, reason: 'Use 3+ letters, numbers or hyphens.' });
  }

  // Confirm the session is still valid. A 401 means it expired; an /auth/me outage is a backend
  // error, not an expired session.
  let me: Response;
  try {
    me = await backendFetch('/auth/me');
  } catch (e) {
    return fail(isTimeout(e) ? 'timeout' : 'backend_error');
  }
  if (me.status === 401 || me.status === 403) return fail('session_expired');
  if (!me.ok) return fail('backend_error');

  let up: Response;
  try {
    up = await backendFetch(`/teachers/handle-check/${encodeURIComponent(handle)}`);
  } catch (e) {
    return fail(isTimeout(e) ? 'timeout' : 'backend_error');
  }
  if (up.status === 401 || up.status === 403) return fail('session_expired');
  if (up.status === 504) return fail('timeout');
  if (!up.ok) return fail('backend_error');
  const data = await up.json().catch(() => null);
  if (typeof data?.available !== 'boolean') return fail('backend_error');
  return NextResponse.json(
    { available: data.available, handle: data.handle || handle, reason: data.reason || null, owned: !!data.owned },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
