import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { localAdminFetch } from '@/lib/server/local-admin';
import { activateApproval } from '@/lib/server/empanelment-policy';

// Policy V2 — a Council guru or admin records the Council interaction, then the
// explicit final decision; ONLY an admin activates an approval. Role from the
// httpOnly session; CSRF double-submit; the backend re-checks the role, the
// allowed status move, reasons and (for approval) the merit items.
const CASE_ID = /^epc_[a-f0-9]{12}$/;
const ACTIONS = new Set(['interaction', 'decision', 'activate']);
const ERRORS: Record<string, string> = {
  explicit_confirmation_required: 'Please tick the confirmation box.',
  case_not_found: 'This case no longer exists.',
  case_closed: 'A final decision has already been recorded for this case.',
  interaction_already_recorded: 'The Council interaction is already recorded.',
  council_interaction_required: 'Record the completed Council interaction before approving.',
  merit_requirements_not_met: 'The free-path items are no longer all met, so this cannot be approved.',
  interaction_date_in_future: 'The interaction date cannot be in the future.',
  documented_reason_required: 'Before the Council interaction, "Not approved" needs a documented reason from the list.',
  unknown_reason: 'Please choose a reason from the list.',
  council_or_admin_only: 'Only Council gurus and admins can do this.',
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string; action: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const role = normalizeRole(user.role);
  if (role !== 'admin' && role !== 'council') return NextResponse.json({ error: ERRORS.council_or_admin_only }, { status: 403 });

  const { caseId, action } = await params;
  if (!ACTIONS.has(action)) return NextResponse.json({ error: 'Unknown action.' }, { status: 404 });
  if (action === 'activate' && role !== 'admin') {
    return NextResponse.json({ error: 'Only a NOSTOPS admin can activate Empanelled status.' }, { status: 403 });
  }
  if (!CASE_ID.test(caseId)) return NextResponse.json({ error: ERRORS.case_not_found }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const text = (v: unknown) => String(v ?? '').trim().slice(0, 1000);

  if (action === 'activate') {
    if (b?.confirm_checked_approval !== true) {
      return NextResponse.json({ error: 'Please confirm that you checked the recorded approval.' }, { status: 400 });
    }
    const res = await activateApproval(user, caseId, text(b?.note).slice(0, 500));
    revalidatePath('/app/admin/empanelment/decisions');
    revalidatePath('/app/admin/empanelment');
    return NextResponse.json(res.ok ? { ok: true, message: res.message } : { error: res.message }, { status: res.ok ? 200 : res.status });
  }

  const payload = action === 'interaction'
    ? { held_on: String(b?.held_on || ''), format: String(b?.format || ''), summary: text(b?.summary), confirm: b?.confirm === true }
    : { outcome: String(b?.outcome || ''), note: text(b?.note), confirm: b?.confirm === true, reason: typeof b?.reason === 'string' && b.reason ? b.reason.slice(0, 40) : null };
  const written = action === 'interaction' ? (payload as { summary: string }).summary : (payload as { note: string }).note;
  if (String(written).length < 15) return NextResponse.json({ error: 'Please write at least 15 characters.' }, { status: 400 });

  const up = await localAdminFetch(`/api/empanelment-policy/cases/${caseId}/${action}`, user, { method: 'POST', body: JSON.stringify(payload) });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : '';
    return NextResponse.json({ error: ERRORS[detail] || 'Please check the form and try again.' }, { status: up.status || 502 });
  }
  revalidatePath('/app/admin/empanelment/decisions');
  revalidatePath('/app/council/empanelment-decisions');
  return NextResponse.json({ ok: true, status: data?.status ?? null });
}
