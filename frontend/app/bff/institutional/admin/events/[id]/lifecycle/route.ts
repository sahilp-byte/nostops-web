// §13 — Admin lifecycle override (ARCHIVED | EVERGREEN) for a published/completed
// institutional event. Admin-only + CSRF via requireAdmin; forwards the signed-in
// admin actor to the isolated institutional engine.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { errorMessage } from '@/lib/server/bff';
import { institutionalActor, institutionalFetch } from '@/lib/server/institutional';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const lifecycle = String(body?.lifecycle || '').trim().toUpperCase();
  if (lifecycle !== 'ARCHIVED' && lifecycle !== 'EVERGREEN') {
    return NextResponse.json({ error: 'Choose Archive or Evergreen.' }, { status: 400 });
  }
  try {
    const r = await institutionalFetch(`/admin/events/${encodeURIComponent(id)}/lifecycle`, {
      method: 'PATCH', actor: institutionalActor(guard.user), body: { lifecycle },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Could not update.') }, { status: r.status });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
