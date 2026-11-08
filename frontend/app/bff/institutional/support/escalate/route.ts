// §16 — human-escalation submit (exceptions/complaints/teacher/venue/commercial/
// quality). CSRF-guarded; forwards the signed-in actor to the engine.
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
  const message = String(body?.message || '').trim();
  if (message.length < 3) return NextResponse.json({ error: 'Please describe the issue.' }, { status: 400 });
  try {
    const r = await institutionalFetch('/support/escalate', {
      method: 'POST', actor: institutionalActor(user),
      body: { category: body?.category || 'OTHER', message: message.slice(0, 2000), event_id: body?.event_id || null },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Could not send your request.') }, { status: r.status });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
