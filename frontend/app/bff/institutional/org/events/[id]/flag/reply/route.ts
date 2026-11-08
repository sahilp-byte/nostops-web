// §14 — organiser replies to a coordinator's at-risk flag. CSRF-guarded;
// forwards the signed-in organiser actor. The engine authorises by org
// membership (authorised event creator) — no role override needed.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, errorMessage } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { institutionalActor, institutionalFetch } from '@/lib/server/institutional';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const message = String(body?.message || '').trim();
  if (!message) return NextResponse.json({ error: 'Write a reply first.' }, { status: 400 });
  try {
    const r = await institutionalFetch(`/events/${encodeURIComponent(id)}/flag/reply`, {
      method: 'POST', actor: institutionalActor(user), body: { message: message.slice(0, 2000) },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Could not send your reply.') }, { status: r.status });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
