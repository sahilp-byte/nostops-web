import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';

// Teacher intro-video decision proxy. CSRF-guarded + admin-only.
//   POST /api/admin/video-intro/{teacher_id}/approve
//   POST /api/admin/video-intro/{teacher_id}/reject   { reason }
export async function POST(req: NextRequest, { params }: { params: Promise<{ teacherId: string; action: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { teacherId, action } = await params;
  if (!teacherId || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ ok: false, error: 'Unsupported action.' }, { status: 400 });
  }

  const raw = await req.json().catch(() => ({}));
  let body: Record<string, unknown> = {};
  if (action === 'reject') {
    const reason = typeof raw?.reason === 'string' ? raw.reason.trim() : '';
    if (reason.length < 5) return NextResponse.json({ ok: false, error: 'A short reason is required.' }, { status: 400 });
    body = { reason: reason.slice(0, 500) };
  }

  let up: Response;
  try {
    up = await backendFetch(`/admin/video-intro/${encodeURIComponent(teacherId)}/${action}`, { method: 'POST', body: JSON.stringify(body) });
  } catch {
    return NextResponse.json({ ok: false, error: 'Video review service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok || data?.ok === false || data?.success === false) {
    return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'Could not complete the action.') }, { status: up.status || 502 });
  }

  revalidatePath('/app/admin/video-reviews');
  revalidatePath('/app/admin');
  return NextResponse.json({ ok: true });
}
