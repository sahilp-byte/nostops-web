// §14 — City Coordinator resolves (clears) an at-risk flag once handled.
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
  const actor = { ...institutionalActor(user), role: role === 'admin' ? 'admin' : 'coordinator' };
  try {
    const r = await institutionalFetch(`/coordinator/events/${encodeURIComponent(id)}/flag/resolve`, { method: 'POST', actor });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Could not resolve this flag.') }, { status: r.status });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
