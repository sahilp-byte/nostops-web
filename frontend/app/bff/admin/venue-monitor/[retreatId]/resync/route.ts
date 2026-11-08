import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';

// Re-sync one venue's Google Places enrichment (PHASE 15). CSRF-guarded + admin-only.
//   POST /api/venue-enrichment/admin/retreats/{retreat_id}/resync
export async function POST(req: NextRequest, { params }: { params: Promise<{ retreatId: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { retreatId } = await params;
  if (!retreatId) return NextResponse.json({ ok: false, error: 'Unknown venue.' }, { status: 400 });

  let up: Response;
  try {
    up = await backendFetch(`/venue-enrichment/admin/retreats/${encodeURIComponent(retreatId)}/resync`, { method: 'POST', body: JSON.stringify({}) });
  } catch {
    return NextResponse.json({ ok: false, error: 'Venue service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok || data?.success === false) {
    return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'Could not re-sync the venue.') }, { status: up.status || 502 });
  }

  revalidatePath('/app/admin/venue-monitor');
  return NextResponse.json({ ok: true });
}
