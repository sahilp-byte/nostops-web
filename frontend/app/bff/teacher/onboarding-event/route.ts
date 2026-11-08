import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { backendFetch, getSessionToken } from '@/lib/server/session';
import { isPreviewRequest } from '@/lib/server/preview-isolation';

// Onboarding funnel events, sent SERVER-side to POST /api/v1/events with the teacher's session
// (the backend accepts onboarding events only from an authenticated session or an HMAC header).
// Only the event types the live backend accepts are mapped; anything else is dropped here.
// teacher_id is sent as null: the backend attributes the event to the signed-in account, so a
// teacher is one subject across every event (a teacher id exists only after registration).
// The same event_id is reused on retries (the backend de-duplicates by event_id).
const EVENT_TYPES: Record<string, string> = {
  teacher_registration_completed: 'ONBOARDING_REGISTERED',
  onboarding_resumed: 'ONBOARDING_RESUMED',
  profile_creation_succeeded: 'ONBOARDING_PROFILE_CREATED',
  profile_creation_failed: 'ONBOARDING_PROFILE_FAILED',
};
const ERROR_TYPES = new Set(['session_expired', 'backend_error', 'timeout', 'preview_read_only', 'network']);
const STEPS = new Set(['register', 'profile', 'avatar']);

export async function POST(req: NextRequest) {
  if (!(await getSessionToken())) return NextResponse.json({ ok: false, accepted: false, error_type: 'session_expired' });
  if (badOrigin(req)) return NextResponse.json({ ok: false, error: 'invalid origin' }, { status: 403 });
  const raw = await req.json().catch(() => ({}));
  const event_type = EVENT_TYPES[String(raw?.event || '')];
  const event_id = String(raw?.event_id || '');
  if (!event_type || !/^[A-Za-z0-9_-]{8,64}$/.test(event_id)) return NextResponse.json({ ok: false, accepted: false, error: 'unknown event' }, { status: 400 });

  const metadata: Record<string, unknown> = {};
  const screen = Number(raw?.screen);
  if (Number.isInteger(screen) && screen >= 1 && screen <= 5) metadata.screen = screen;
  if (ERROR_TYPES.has(String(raw?.error_type))) metadata.error_type = String(raw.error_type);
  if (STEPS.has(String(raw?.step))) metadata.step = String(raw.step);

  const body = {
    event_type,
    event_id,
    teacher_id: null,
    source: (await isPreviewRequest()) ? 'preview' : 'web',
    metadata,
  };
  try {
    const up = await backendFetch('/v1/events', { method: 'POST', body: JSON.stringify(body) });
    const data = await up.json().catch(() => ({}));
    return NextResponse.json({ ok: up.ok, accepted: up.ok && data?.accepted !== false });
  } catch {
    return NextResponse.json({ ok: false, accepted: false, error_type: 'network' }, { status: 502 });
  }
}
