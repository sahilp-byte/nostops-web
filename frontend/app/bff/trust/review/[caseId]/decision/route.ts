import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { localAdminFetch } from '@/lib/server/local-admin';
import { normalizeRole } from '@/lib/roles';
import { TRUST_WITHDRAWN_TAG } from '@/lib/api';

// B4.8 — record ONE reviewer decision (CONFIRM / SUSPEND / REVOKE) on a trust
// review case. Admins and Council gurus only; role from the httpOnly session;
// CSRF double-submit. The backend re-checks the role and validates the reason +
// explicit confirmation. Nothing here is automatic. On success the public site is
// refreshed so a withdrawn empanelment disappears from every page.
const CASE_ID = /^trc_[a-f0-9]{12}$/;
const ERRORS: Record<string, string> = {
  explicit_confirmation_required: 'Please tick the confirmation box to record this decision.',
  case_not_found: 'This review case no longer exists.',
  admin_or_council_only: 'Only admins and Council gurus can record review decisions.',
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const role = normalizeRole(user.role);
  if (role !== 'admin' && role !== 'council') {
    return NextResponse.json({ error: ERRORS.admin_or_council_only }, { status: 403 });
  }
  const { caseId } = await params;
  if (!CASE_ID.test(caseId)) return NextResponse.json({ error: ERRORS.case_not_found }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const payload = {
    action: String(body?.action || ''),
    reason: String(body?.reason || '').trim().slice(0, 1000),
    confirm: body?.confirm === true,
  };
  if (payload.reason.length < 15) {
    return NextResponse.json({ error: 'Please give a reason of at least 15 characters.' }, { status: 400 });
  }

  const up = await localAdminFetch(`/api/trust/review/cases/${caseId}/decision`, user, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : '';
    return NextResponse.json({ error: ERRORS[detail] || 'Could not record the decision. Please check the form and try again.' }, { status: up.status || 502 });
  }

  // Update the website: withdrawn empanelment disappears from public pages.
  revalidateTag(TRUST_WITHDRAWN_TAG, { expire: 0 });
  revalidatePath('/teachers');
  revalidatePath('/teachers/[handle]', 'page');
  revalidatePath('/');
  revalidatePath('/app/admin/trust-review');
  revalidatePath('/app/council/trust-review');
  return NextResponse.json({ ok: true, status: data?.status ?? null });
}
