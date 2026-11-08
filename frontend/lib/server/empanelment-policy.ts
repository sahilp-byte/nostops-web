import 'server-only';
import { backendFetch } from '@/lib/server/session';
import { localAdminFetch } from '@/lib/server/local-admin';
import type { User } from '@/lib/roles';

// Empanelment Policy V2 — server-only client. The website server reads the
// teacher's OWN main-backend facts with their session (1:1 bookings, premium 1:1
// sessions, published reviews) and the local policy engine evaluates them. The
// browser never supplies evidence; only ids / statuses / ratings are forwarded.

export type Requirement = { key: string; label: string; value: number; target: number | string; met: boolean; of?: number };
export type MeritEvaluation = {
  policy_version: string;
  merit_met: boolean;
  requirements: Requirement[];
  excluded: Record<string, number>;
  free_sessions_counted?: number;
  learners_with_completed_session: number;
};
export type MyPolicyCase = {
  case_id: string;
  path: 'FREE' | 'FAST_TRACK';
  status: string;
  status_label: string;
  opened_at?: string | null;
  interaction_held_on?: string | null;
  outcome?: string | null;
  note?: string | null;
  decided_at?: string | null;
  decided_by?: string | null;
  activated_at?: string | null;
} | null;
export type MyStanding = { evaluation: MeritEvaluation; observedAt: string; case: MyPolicyCase } | null;
export type TeacherRef = { teacherId?: string | null; handle?: string | null; name?: string | null };

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

async function readJson(path: string): Promise<any> {
  try {
    const r = await backendFetch(path);
    return r.ok ? await r.json() : {};
  } catch {
    return {};
  }
}

const list = (v: any): any[] => (Array.isArray(v) ? v : []);

// A paid 1:1 booking counts only when the MAIN BACKEND recorded the captured
// payment (payment id + paid time, or the escrow release). A mock / test-card
// premium payment is never a real payment. Refunds always disqualify.
const bookingPaymentVerified = (b: any) => !!((b.razorpay_payment_id && b.paid_at) || b.release_txn_id);
const bookingRefunded = (b: any) => !!(b.refunded_at || b.refund_id || b.refund_status || /refund/i.test(String(b.status || '')));
const premiumPaymentVerified = (s: any) =>
  s.payment?.status === 'paid' && !/mock|test/i.test(String(s.payment?.method || '')) && !/^mock_/i.test(String(s.payment?.txn_id || ''));

export async function collectMyEvidence(user: User, self: TeacherRef) {
  const me = String(user.user_id || '');
  const mine = (x: any) => (!!me && x?.teacher_user_id === me) || (!!self.teacherId && x?.teacher_id === self.teacherId);
  const [oo, ps, rv] = await Promise.all([
    readJson('/one-on-one/my-bookings'),
    readJson('/premium-sessions/my'),
    self.handle ? readJson(`/public-reviews/${encodeURIComponent(self.handle)}`) : Promise.resolve({}),
  ]);
  const sessions = [
    ...list(oo?.bookings).filter((b) => mine(b) && b.booking_id).map((b) => ({
      ref: `oob:${b.booking_id}`, kind: 'one_on_one', status: String(b.status || ''),
      payment_verified: bookingPaymentVerified(b), refunded: bookingRefunded(b), amount_inr: num(b.amount_inr),
      learner_user_id: b.student_user_id || null,
    })),
    ...list(ps?.sessions).filter((s) => mine(s) && s.session_id).map((s) => ({
      ref: `ps:${s.session_id}`, kind: 'one_on_one', status: String(s.status || ''),
      payment_verified: premiumPaymentVerified(s), refunded: /refund/i.test(`${s.status || ''} ${s.payment?.status || ''}`),
      amount_inr: num(s.amount), learner_user_id: s.student_user_id || null,
    })),
  ];
  const reviews = list(rv?.reviews).filter((r) => r.review_id).map((r) => ({
    ref: String(r.review_id), reviewer_user_id: r.reviewer_user_id || null,
    rating: typeof r.rating === 'number' ? r.rating : null, status: String(r.status || ''), created_at: r.created_at || null,
  }));
  return { teacher_id: self.teacherId || null, handle: self.handle || null, name: self.name || null, sessions, reviews };
}

/** Re-evaluate the signed-in teacher's free path from fresh main-backend facts. */
export async function getMyStanding(user: User, self: TeacherRef): Promise<MyStanding> {
  try {
    const evidence = await collectMyEvidence(user, self);
    const r = await localAdminFetch('/api/empanelment-policy/me/evidence', user, { method: 'POST', body: JSON.stringify(evidence) });
    if (!r.ok) return null;
    const d = await r.json();
    return { evaluation: d.evaluation, observedAt: d.observed_at, case: d.case ?? null };
  } catch {
    return null;
  }
}

// ── Reviewer side (Council gurus + admins) ──────────────────────────────────
export type PolicyEntry = { reviewer_name?: string; reviewer_role?: string; recorded_at?: string; decided_at?: string };
export type PolicyCase = {
  case_id: string;
  path: 'FREE' | 'FAST_TRACK';
  status: string;
  status_label: string;
  name?: string | null;
  handle?: string | null;
  teacher_id?: string | null;
  request_id?: string;
  main_backend_update?: string;
  created_at: string;
  interactions: Array<PolicyEntry & { held_on: string; format: string; summary: string }>;
  decisions: Array<PolicyEntry & { outcome: string; note: string; resulting_status: string; previous_status: string; reason?: string | null; reason_label?: string | null }>;
  activation?: (PolicyEntry & { activated_at: string; note?: string | null }) | null;
  current_evidence?: { evaluation: MeritEvaluation | null; observed_at: string | null };
  audit: Array<{ event: string; at: string; actor?: string; actor_role?: string; detail?: string }>;
};

export async function getPolicyCases(user: User): Promise<{ cases: PolicyCase[]; openCount: number } | null> {
  try {
    const r = await localAdminFetch('/api/empanelment-policy/cases', user);
    if (!r.ok) return null;
    const d = await r.json();
    return { cases: list(d?.cases), openCount: num(d?.open_count) };
  } catch {
    return null;
  }
}

/** Fast-Track request id → the policy case recorded for it (Council / admin queues). */
export async function getFastTrackPolicyMap(user: User): Promise<Record<string, { status: string; label: string }>> {
  const q = await getPolicyCases(user);
  const out: Record<string, { status: string; label: string }> = {};
  for (const c of q?.cases || []) {
    if (c.path === 'FAST_TRACK' && c.request_id && (c.status === 'APPROVED' || c.status === 'ACTIVATED') && !out[c.request_id]) {
      out[c.request_id] = { status: c.status, label: c.status_label };
    }
  }
  return out;
}

export const GRANT_BLOCKED =
  'Empanelled can only be switched on from Admin → Empanelment Decisions: it needs a recorded Council interaction, an explicit approval, and your check of that approval (Empanelment Policy V2).';

// ── Activation (ADMIN only) — the only main-backend write in the policy flow ──
const QA_FIXTURE = /^tn_qa_/; // made-up QA teachers never reach the main backend
const ACT_ERRORS: Record<string, string> = {
  approval_required: 'There is no recorded Council approval to activate.',
  already_activated: 'This approval is already activated.',
  explicit_confirmation_required: 'Please confirm that you checked the recorded approval.',
  admin_only: 'Only a NOSTOPS admin can activate Empanelled status.',
  case_not_found: 'This case no longer exists.',
};

async function reportResult(user: User, caseId: string, applied: boolean, detail?: string): Promise<void> {
  await localAdminFetch(`/api/empanelment-policy/cases/${encodeURIComponent(caseId)}/main-backend-result`, user, {
    method: 'POST',
    body: JSON.stringify({ applied, detail: (detail || '').slice(0, 300) }),
  }).catch(() => undefined);
}

export async function activateApproval(user: User, caseId: string, note: string): Promise<{ ok: boolean; status: number; message: string }> {
  const r = await localAdminFetch(`/api/empanelment-policy/cases/${encodeURIComponent(caseId)}/activate`, user, {
    method: 'POST',
    body: JSON.stringify({ confirm_checked_approval: true, note: note || null }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, status: r.status, message: ACT_ERRORS[String(d?.detail || '')] || 'This approval cannot be activated.' };

  if (QA_FIXTURE.test(String(d.teacher_id || ''))) {
    await reportResult(user, caseId, false, 'QA fixture: the main record was not touched');
    return { ok: true, status: 200, message: 'Activation recorded (QA test case, so the main record was not touched).' };
  }
  let applied = false;
  let detail = '';
  try {
    const up = d.path === 'FAST_TRACK'
      ? await backendFetch(`/empanelment/fast-track/${encodeURIComponent(d.request_id)}/decide`, {
        method: 'POST', body: JSON.stringify({ outcome: 'approved', notes: String(d.approval_note || '').slice(0, 1000) }),
      })
      : await backendFetch(`/admin/empanelment/${encodeURIComponent(d.teacher_id)}`, {
        method: 'POST', body: JSON.stringify({ is_empanelled: true, reason: `NOSTOPS Empanelment Policy V2 · case ${caseId}` }),
      });
    const data = await up.json().catch(() => ({}));
    applied = up.ok && data?.success !== false;
    detail = applied ? '' : String(data?.detail || up.status);
    if (up.status === 423) {
      await reportResult(user, caseId, false, 'financial safety audit lock: not sent');
      return { ok: false, status: 423, message: 'The activation is recorded. Sending it to the main backend is paused during the financial safety audit, because it releases the reviewer’s fee. Use “Try again” after the lock is lifted.' };
    }
  } catch {
    detail = 'main backend unreachable';
  }
  await reportResult(user, caseId, applied, detail);
  return applied
    ? { ok: true, status: 200, message: 'Activated: the teacher is now Empanelled.' }
    : { ok: false, status: 502, message: 'The activation is recorded, but the main record could not be updated yet. Use “Try again”.' };
}

// ── Fast-Track decisions ──────────────────────────────────────────────────────
const FT_ERRORS: Record<string, string> = {
  council_interaction_required: 'Approval needs the priority interview to have taken place: tick "The interview took place" and summarise it (at least 15 characters).',
  interview_not_scheduled: 'Approval needs a scheduled priority interview first.',
  interview_not_held_yet: 'The interview time has not passed yet. Record the decision after the interview.',
  already_decided: 'A decision for this request is already recorded.',
  explicit_confirmation_required: 'Please tick the confirmation box to record this decision.',
  council_or_admin_only: 'Only Council gurus and admins can record empanelment decisions.',
  documented_reason_required: 'Before the interview, "Not approved" needs a documented reason from the list.',
  unknown_reason: 'Please choose a reason from the list.',
};

export type FastTrackCheck =
  | { ok: true; caseId: string; forward: { outcome: 'rejected'; notes: string } | null }
  | { ok: false; status: number; error: string };

/** Policy gate for a Fast-Track decision. Payment alone never passes: approval
 *  needs the interview to have happened. An approval is NOT forwarded (an admin
 *  activates it); a "not approved" is forwarded to close the paid request. */
export async function checkFastTrackDecision(user: User, requestId: string, raw: any): Promise<FastTrackCheck> {
  const outcome = raw?.outcome === 'approved' ? 'approved' : raw?.outcome === 'rejected' ? 'rejected' : null;
  if (!outcome) return { ok: false, status: 400, error: 'Choose Approve or Not approved.' };
  const note = typeof raw?.notes === 'string' ? raw.notes.trim().slice(0, 1000) : '';
  if (note.length < 15) return { ok: false, status: 400, error: 'Please write a decision note of at least 15 characters. The teacher sees it.' };
  if (raw?.confirm !== true) return { ok: false, status: 400, error: FT_ERRORS.explicit_confirmation_required };

  // Facts come from the main backend, never from the browser.
  const q = await readJson('/empanelment/fast-track/queue');
  const item = list(q?.active).find((r) => r?.request_id === requestId);
  if (!item) return { ok: false, status: 404, error: 'This Fast-Track request is not in the active queue.' };

  const r = await localAdminFetch(`/api/empanelment-policy/fast-track/${encodeURIComponent(requestId)}/decision`, user, {
    method: 'POST',
    body: JSON.stringify({
      outcome: outcome === 'approved' ? 'APPROVE' : 'DECLINE',
      note,
      confirm: true,
      reason: typeof raw?.reason === 'string' && raw.reason ? raw.reason.slice(0, 40) : null,
      interview_completed: raw?.interview_completed === true,
      interaction_summary: typeof raw?.interaction_summary === 'string' ? raw.interaction_summary.trim().slice(0, 1000) : '',
      request_status: String(item.status || ''),
      interview_scheduled_at: item.interview?.scheduled_at || null,
      teacher_id: item.teacher_id || null,
      teacher_name: item.teacher_name || null,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, status: r.status, error: FT_ERRORS[String(d?.detail || '')] || 'This decision does not meet the empanelment policy.' };
  return { ok: true, caseId: String(d.case_id), forward: d.forward_to_main_backend ? { outcome: 'rejected', notes: note } : null };
}

export async function reportFastTrackResult(user: User, caseId: string, applied: boolean, detail?: string): Promise<void> {
  await reportResult(user, caseId, applied, detail);
}

// ── Read-only compliance view of already-empanelled teachers (ADMIN) ─────────
export type ComplianceRow = {
  teacherId: string;
  name: string;
  badge: string | null;
  handle: string | null;
  lastEmpanelmentChange: string | null;
  category: 'POLICY_V2' | 'MEETS_CRITERIA' | 'INSUFFICIENT_EVIDENCE' | 'COUNCIL_REVIEW';
  approval: 'LEGACY' | 'POLICY_V2';
  items: Record<string, { value: number | null; target?: number | string; met: boolean | null; of?: number }> | null;
  note: string;
};

export async function getComplianceReport(user: User): Promise<{ rows: ComplianceRow[]; totals: Record<string, number> } | null> {
  try {
    const empanelled: any[] = [];
    for (let skip = 0; skip < 1000; skip += 200) {
      const page = list((await readJson(`/admin/empanelment/teachers?limit=200&skip=${skip}`))?.teachers);
      empanelled.push(...page.filter((t) => t?.is_empanelled === true && t?.teacher_id));
      if (page.length < 200) break;
    }
    const dir = new Map(list((await readJson('/teachers/directory?limit=200'))?.teachers).map((t) => [t.teacher_id, t]));
    const reviews = await Promise.all(empanelled.map(async (t) => {
      const handle = dir.get(t.teacher_id)?.handle;
      if (!handle) return null;
      const rv = await readJson(`/public-reviews/${encodeURIComponent(handle)}`);
      return Array.isArray(rv?.reviews)
        ? rv.reviews.filter((r: any) => r?.review_id).map((r: any) => ({
          ref: String(r.review_id), reviewer_user_id: r.reviewer_user_id || null,
          rating: typeof r.rating === 'number' ? r.rating : null, status: String(r.status || ''), created_at: r.created_at || null,
        }))
        : null;
    }));
    const r = await localAdminFetch('/api/empanelment-policy/compliance/evaluate', user, {
      method: 'POST',
      // Session records per teacher are not exposed to the website by the main backend.
      body: JSON.stringify({ teachers: empanelled.map((t, i) => ({ teacher_id: t.teacher_id, reviews: reviews[i], sessions: null })) }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const byId = new Map(list(d?.teachers).map((x) => [x.teacher_id, x]));
    const rows: ComplianceRow[] = empanelled.map((t) => {
      const x = byId.get(t.teacher_id) || {};
      const dt = dir.get(t.teacher_id);
      return {
        teacherId: t.teacher_id, name: String(t.name || 'Teacher'), badge: t.badge || dt?.badge_primary || null,
        handle: dt?.handle || null, lastEmpanelmentChange: dt?.empanelment_updated_at || null,
        category: x.category, approval: x.approval, items: x.items ?? null, note: String(x.note || ''),
      };
    });
    return { rows, totals: d?.totals || {} };
  } catch {
    return null;
  }
}
