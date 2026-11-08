// §10 — Admin organisation verification (approved manual exception). Admin-only +
// CSRF via requireAdmin; forwards the signed-in admin actor to the engine. Only a
// VERIFIED organisation's PUBLIC events become search-indexable.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { errorMessage } from '@/lib/server/bff';
import { institutionalActor, institutionalFetch } from '@/lib/server/institutional';

export const runtime = 'nodejs';

const ALLOWED = ['VERIFIED', 'UNVERIFIED', 'VERIFICATION_PENDING', 'EXCEPTION_MANUAL_REVIEW'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const trust_state = String(body?.trust_state || '').trim().toUpperCase();
  if (!ALLOWED.includes(trust_state)) {
    return NextResponse.json({ error: 'Invalid trust state.' }, { status: 400 });
  }
  try {
    const r = await institutionalFetch(`/admin/organisations/${encodeURIComponent(id)}/trust`, {
      method: 'PATCH', actor: institutionalActor(guard.user),
      body: { trust_state, note: typeof body?.note === 'string' ? body.note : undefined },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Could not update.') }, { status: r.status });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
