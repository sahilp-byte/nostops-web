import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/server/admin-guard';
import { setGoogleGrantLocal } from '@/lib/server/venue-submissions-local';

// Admin switches Google photos & reviews ON for one venue (by confirming its
// exact Google Place ID), or OFF with an empty place id. No purchase involved.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const placeId = typeof body?.place_id === 'string' ? body.place_id.trim().slice(0, 300) : '';
  if (placeId && !/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) {
    return NextResponse.json({ error: 'That doesn\u2019t look like a Google Place ID (e.g. ChIJ…).' }, { status: 400 });
  }
  const r = await setGoogleGrantLocal(id, placeId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 502 });
  // Public venue pages are cached (ISR) — refresh them so the change shows now.
  revalidatePath('/venues', 'layout');
  return NextResponse.json({ ok: true });
}
