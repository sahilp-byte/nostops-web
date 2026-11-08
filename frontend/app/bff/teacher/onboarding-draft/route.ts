import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch, getSessionToken } from '@/lib/server/session';

// The signed-in teacher's server-side onboarding draft (live backend):
//   GET /teachers/me/onboarding-draft  → { ok, exists, draft }
//   PUT /teachers/me/onboarding-draft  { screens, last_completed_screen, draft_photo?, expected_version }
// PUT uses optimistic concurrency: expected_version must equal the current version, else 409
// stale_draft. Failures come back as { ok:false, error_type } so the wizard never loses input:
// session_expired | stale | preview_read_only | timeout | backend_error.
type ErrorType = 'session_expired' | 'stale' | 'preview_read_only' | 'timeout' | 'backend_error';
const NO_STORE = { 'Cache-Control': 'no-store, private' };
const MAX_PHOTO_CHARS = 1_400_000; // ≈ 1 MB image as a base64 data URL (backend limit: 1 MB)

function fail(error_type: ErrorType, status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error_type, error, ...extra }, { status, headers: NO_STORE });
}
const isTimeout = (e: unknown) => (e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError';

async function call(path: string, init?: RequestInit): Promise<Response | NextResponse> {
  try {
    return await backendFetch(path, init);
  } catch (e) {
    return isTimeout(e)
      ? fail('timeout', 504, 'The server took too long to answer.')
      : fail('backend_error', 502, 'Could not reach the server.');
  }
}

function mapError(up: Response, data: any): NextResponse {
  if (up.status === 401 || up.status === 403) return fail('session_expired', 401, 'Your session has expired. Please sign in again.');
  if (up.status === 423 || data?.preview_read_only) return fail('preview_read_only', 423, 'Saving is disabled in preview.');
  if (up.status === 409) {
    return fail('stale', 409, data?.detail?.message || 'Your draft was updated elsewhere. Reload before saving.', {
      current_version: data?.detail?.current_version ?? null,
    });
  }
  return fail('backend_error', up.status >= 500 ? 502 : up.status, toErrorText(data?.detail, 'Could not save your draft.'));
}

export async function GET() {
  if (!(await getSessionToken())) return fail('session_expired', 401, 'Your session has expired. Please sign in again.');
  const up = await call('/teachers/me/onboarding-draft');
  if (up instanceof NextResponse) return up;
  const data = await up.json().catch(() => null);
  if (!up.ok || !data) return mapError(up, data);
  return NextResponse.json({ ok: true, exists: !!data.exists, draft: data.draft || null }, { headers: NO_STORE });
}

export async function PUT(req: NextRequest) {
  // Session first: with no session cookie the CSRF cookie is usually gone too, and the teacher
  // must see "sign in again", not a generic error. The CSRF check still guards every real write.
  if (!(await getSessionToken())) return fail('session_expired', 401, 'Your session has expired. Please sign in again.');
  if (badOrigin(req)) return NextResponse.json({ ok: false, error: 'invalid origin' }, { status: 403 });
  const raw = await req.json().catch(() => ({}));
  const screen = Number(raw?.last_completed_screen);
  const version = raw?.expected_version;
  const body: Record<string, unknown> = {
    screens: raw?.screens && typeof raw.screens === 'object' && !Array.isArray(raw.screens) ? raw.screens : {},
    last_completed_screen: Number.isInteger(screen) && screen >= 0 && screen <= 5 ? screen : 0,
    expected_version: Number.isInteger(version) && version >= 0 ? version : null,
  };
  const photo = raw?.draft_photo;
  if (typeof photo === 'string' && photo.startsWith('data:image/') && photo.length <= MAX_PHOTO_CHARS) body.draft_photo = photo;

  const up = await call('/teachers/me/onboarding-draft', { method: 'PUT', body: JSON.stringify(body) });
  if (up instanceof NextResponse) return up;
  const data = await up.json().catch(() => null);
  if (!up.ok || !data?.draft) return mapError(up, data);
  const d = data.draft;
  // No photo echo: the browser already has it.
  return NextResponse.json(
    { ok: true, draft: { version: d.version, updated_at: d.updated_at, last_completed_screen: d.last_completed_screen, has_photo: !!d.has_photo } },
    { headers: NO_STORE },
  );
}
