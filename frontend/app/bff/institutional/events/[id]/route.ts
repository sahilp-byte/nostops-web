// Institutional engine — Event update (DRAFT edits). CSRF-guarded.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, errorMessage } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { institutionalActor, institutionalFetch } from '@/lib/server/institutional';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const r = await institutionalFetch(`/events/${encodeURIComponent(id)}`, { method: 'PATCH', actor: institutionalActor(user), body });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Could not update event.') }, { status: r.status });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
