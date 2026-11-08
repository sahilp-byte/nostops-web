// §12 — assigned teacher marks attendance for their event. CSRF-guarded.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, errorMessage } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { institutionalActor, institutionalFetch } from '@/lib/server/institutional';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const eventId = String(body?.event_id || '').trim();
  if (!eventId) return NextResponse.json({ error: 'Missing event.' }, { status: 400 });
  try {
    const r = await institutionalFetch(`/teacher/events/${encodeURIComponent(eventId)}/attendance`, {
      method: 'POST', actor: institutionalActor(user), body: { entries: body?.entries || [] },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Could not save attendance.') }, { status: r.status });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
