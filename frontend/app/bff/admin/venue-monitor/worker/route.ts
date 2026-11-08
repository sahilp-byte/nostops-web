import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';

// Run the venue enrichment worker (PHASE 15). CSRF-guarded + admin-only.
//   POST /api/venue-enrichment/admin/worker/run
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  let up: Response;
  try {
    up = await backendFetch('/venue-enrichment/admin/worker/run', { method: 'POST', body: JSON.stringify({}) });
  } catch {
    return NextResponse.json({ ok: false, error: 'Venue service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok || data?.success === false) {
    return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'Could not start the worker.') }, { status: up.status || 502 });
  }

  revalidatePath('/app/admin/venue-monitor');
  return NextResponse.json({ ok: true });
}
