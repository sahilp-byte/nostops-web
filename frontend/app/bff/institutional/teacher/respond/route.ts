// §12 — assigned teacher ACCEPTS or DECLINES a proposed programme. CSRF-guarded.
// A decline triggers automatic re-assignment on the engine side.
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
  const action = String(body?.action || '').trim().toUpperCase();
  if (!eventId || (action !== 'ACCEPT' && action !== 'DECLINE')) {
    return NextResponse.json({ error: 'Missing event or action.' }, { status: 400 });
  }
  try {
    const r = await institutionalFetch(`/teacher/events/${encodeURIComponent(eventId)}/respond`, {
      method: 'POST', actor: institutionalActor(user),
      body: { action, reason: (body?.reason || '').toString().slice(0, 500) || null },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Could not submit your response.') }, { status: r.status });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
