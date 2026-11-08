import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch, getSessionUser } from '@/lib/server/session';
import { festiveFetch } from '@/lib/server/festive-kyc';
import { requireAdmin } from '@/lib/server/admin-guard';

// Admin KYC decision proxy (PHASE 2). CSRF-guarded + STRICTLY admin-only.
// action ∈ {approve, reject}. Reject requires a reason (≥10 chars).
//   POST /api/admin/kyc/{teacher_id}/approve
//   POST /api/admin/kyc/{teacher_id}/reject   { reason }
export async function POST(req: NextRequest, { params }: { params: Promise<{ teacherId: string; action: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { teacherId, action } = await params;
  if (!teacherId) return NextResponse.json({ ok: false, error: 'Unknown teacher.' }, { status: 400 });
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ ok: false, error: 'Unsupported action.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  let payload: Record<string, unknown> = {};
  if (action === 'reject') {
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 10) return NextResponse.json({ ok: false, error: 'A reason of at least 10 characters is required.' }, { status: 400 });
    payload = { reason: reason.slice(0, 500) };
  }

  let up: Response;
  try {
    up = await backendFetch(`/admin/kyc/${encodeURIComponent(teacherId)}/${action}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'KYC service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok || data?.success === false) {
    return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'Could not complete the action.') }, { status: up.status || 502 });
  }

  revalidatePath('/app/admin/kyc');
  revalidatePath('/app/admin');
  // Festive InstaKYC audit: record the decision on a campaign claim, if this teacher has one.
  try {
    const user = await getSessionUser();
    if (user) await festiveFetch('/admin/kyc-event', user, { method: 'POST', body: JSON.stringify({ teacher_id: teacherId, action }) });
  } catch {
    /* audit is best-effort; the KYC decision itself already succeeded */
  }
  return NextResponse.json({ ok: true });
}
