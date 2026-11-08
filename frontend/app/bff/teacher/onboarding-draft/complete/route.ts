import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch, getSessionToken } from '@/lib/server/session';

// Mark the signed-in teacher's onboarding draft completed (POST /teachers/me/onboarding-draft/complete).
// Called only after every required Screen 5 step succeeded. It does not publish or change any
// teacher record; it only flips the draft's completed flag on the backend.
export async function POST(req: NextRequest) {
  if (!(await getSessionToken())) {
    return NextResponse.json({ ok: false, error_type: 'session_expired', error: 'Your session has expired.' }, { status: 401 });
  }
  if (badOrigin(req)) return NextResponse.json({ ok: false, error: 'invalid origin' }, { status: 403 });
  let up: Response;
  try {
    up = await backendFetch('/teachers/me/onboarding-draft/complete', { method: 'POST', body: '{}' });
  } catch {
    return NextResponse.json({ ok: false, error_type: 'backend_error', error: 'Could not reach the server.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    const error_type = up.status === 401 ? 'session_expired' : up.status === 423 ? 'preview_read_only' : 'backend_error';
    return NextResponse.json({ ok: false, error_type, error: toErrorText(data?.detail, 'Could not mark the draft completed.') }, { status: up.status });
  }
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store, private' } });
}
