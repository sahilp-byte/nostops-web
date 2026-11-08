import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';

// Admin force-close proxy (PHASE 6). CSRF-guarded + admin-only.
//   POST /api/bookings/{booking_id}/force-close   (no body)
export async function POST(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { bookingId } = await params;
  if (!bookingId) return NextResponse.json({ ok: false, error: 'Unknown booking.' }, { status: 400 });

  let up: Response;
  try {
    up = await backendFetch(`/bookings/${encodeURIComponent(bookingId)}/force-close`, { method: 'POST', body: JSON.stringify({}) });
  } catch {
    return NextResponse.json({ ok: false, error: 'Booking service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok || data?.success === false) {
    return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'Could not force-close the batch.') }, { status: up.status || 502 });
  }

  revalidatePath('/app/admin/bookings');
  return NextResponse.json({ ok: true });
}
