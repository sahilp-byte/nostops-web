// §12 — assigned teacher's post-delivery feedback on the programme (Council
// quality signal). CSRF-guarded. Never shown to participants.
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
  const rating = Number(body?.rating);
  if (!eventId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Pick a rating from 1 to 5.' }, { status: 400 });
  }
  try {
    const r = await institutionalFetch(`/teacher/events/${encodeURIComponent(eventId)}/feedback`, {
      method: 'POST', actor: institutionalActor(user),
      body: { rating, comment: (body?.comment || '').toString().slice(0, 2000) || null },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Could not save your feedback.') }, { status: r.status });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
