// §14 — City Coordinator flags an institutional event as at-risk. Verifies
// coordinator eligibility server-side, then forwards a coordinator/admin actor
// to the isolated engine (X-Pulse-User is server-built, not spoofable).
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, errorMessage } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { getCoordinatorMe } from '@/lib/server/coordinator';
import { normalizeRole } from '@/lib/roles';
import { institutionalActor, institutionalFetch } from '@/lib/server/institutional';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const role = normalizeRole(user.role);
  const me = await getCoordinatorMe();
  if (!me.coordinator && role !== 'admin') return NextResponse.json({ error: 'Coordinator access required.' }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = String(body?.reason || '').trim().toUpperCase();
  if (!reason) return NextResponse.json({ error: 'Pick a reason.' }, { status: 400 });
  const actor = { ...institutionalActor(user), role: role === 'admin' ? 'admin' : 'coordinator' };
  try {
    const r = await institutionalFetch(`/coordinator/events/${encodeURIComponent(id)}/flag`, {
      method: 'POST', actor, body: { reason, note: String(body?.note || '').slice(0, 1000) },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Could not flag this event.') }, { status: r.status });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
