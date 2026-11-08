import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { setGooglePlaceLocal } from '@/lib/server/venue-submissions-local';

// Admin confirms (or clears) the exact Google place for a PAID venue so its
// listing can show Google photos & reviews. Free venues are refused upstream.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const placeId = typeof body?.place_id === 'string' ? body.place_id.trim().slice(0, 300) : '';
  if (placeId && !/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) {
    return NextResponse.json({ error: 'That doesn\u2019t look like a Google Place ID (e.g. ChIJ…).' }, { status: 400 });
  }
  const r = await setGooglePlaceLocal(id, placeId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 502 });
  return NextResponse.json({ ok: true });
}
