'use client';

import { useState } from 'react';
import { postBff } from '@/lib/auth-client';
import { ReasonSelect } from '@/components/app/empanelment/EmpanelmentDecisionQueue';

// Policy V2 — the ONE Fast-Track decision form (Council interview queue + admin
// pipeline). Approval needs: the priority interview took place (= the Council
// interaction), a short summary of it, a decision note the teacher sees, and an
// explicit confirmation; an admin then activates it. "Not approved" before the
// interview needs a documented reason. The server re-checks everything; payment
// alone can never approve.
/** Mirrors the server gate: Approve needs a scheduled interview whose time has passed. */
export const interviewHeld = (status: string, scheduledAt?: string | null) =>
  status === 'interview_scheduled' && !!scheduledAt && Date.parse(scheduledAt) <= Date.now();

export default function FastTrackDecisionForm({
  url,
  teacher,
  interviewHeld,
  onDone,
  onCancel,
}: {
  url: string;
  teacher: string;
  /** The priority interview is scheduled and its time has passed (main-backend facts). */
  interviewHeld: boolean;
  onDone: (msg: string, ok: boolean) => void;
  onCancel: () => void;
}) {
  const [outcome, setOutcome] = useState<'approved' | 'rejected' | ''>('');
  const [held, setHeld] = useState(false);
  const [summary, setSummary] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const approving = outcome === 'approved';
  const declining = outcome === 'rejected';
  const needsReason = declining && !held;
  const valid = !!outcome && notes.trim().length >= 15 && confirm
    && (!approving || (held && summary.trim().length >= 15))
    && (!needsReason || !!reason);

  async function submit() {
    if (!valid) return;
    setErr(null);
    setBusy(true);
    const r = await postBff(url, {
      outcome, notes: notes.trim(), interview_completed: held, interaction_summary: summary.trim(), confirm,
      reason: needsReason ? reason : null,
    });
    setBusy(false);
    if (r.ok && r.data?.ok !== false) {
      onDone(approving ? `${teacher} approved after the interview ✓ An admin activates Empanelled after checking it.` : `Decision recorded for ${teacher}`, true);
    } else setErr(r.data?.error || 'Could not record the decision.');
  }

  const pill = (active: boolean, color: string) =>
    `flex-1 min-h-[44px] rounded-lg border px-3 py-2 text-xs font-bold ${active ? '' : 'border-line bg-white text-ink-soft'}`
    + (active ? ` ${color}` : '');

  return (
    <div className="mt-3 rounded-xl border border-line bg-cream/60 p-3" data-testid="ft-decision-form">
      <p className="text-xs font-extrabold text-ink">Record decision · {teacher}</p>
      <p className="mt-1 text-[11px] text-muted">Payment buys a priority review only. Approve only on merit, after the interview. A NOSTOPS admin activates an approval.</p>
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={!interviewHeld} onClick={() => setOutcome('approved')} className={`${pill(approving, 'border-brand bg-brand-50 text-brand-700')} disabled:opacity-40`} data-testid="ft-outcome-approve">✓ Approve after interview</button>
        <button type="button" onClick={() => setOutcome('rejected')} className={pill(declining, 'border-red-400 bg-red-50 text-red-700')} data-testid="ft-outcome-reject">✕ Not approved</button>
      </div>
      {!interviewHeld && <p className="mt-1 text-[11px] text-muted" data-testid="ft-approve-locked">Approval opens once the scheduled interview has taken place.</p>}

      {(approving || (declining && interviewHeld)) && (
        <label className="mt-3 flex min-h-[44px] cursor-pointer items-start gap-3 py-1 text-xs text-ink-soft">
          <input type="checkbox" checked={held} onChange={(e) => setHeld(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" data-testid="ft-interview-held" />
          <span>The priority interview took place. It counts as this teacher&apos;s Council interaction.</span>
        </label>
      )}
      {approving && (
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} maxLength={1000} placeholder="What did the interview cover? (at least 15 characters)" className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" data-testid="ft-interview-summary" />
      )}
      {needsReason && <ReasonSelect id="ft-decline-reason" value={reason} onChange={setReason} />}

      <label className="mt-3 block text-[11px] font-bold text-muted">Decision note — the teacher sees this (at least 15 characters)</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" data-testid="ft-decision-note" />

      <label className="mt-2 flex min-h-[44px] cursor-pointer items-start gap-3 py-1 text-xs text-ink-soft">
        <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" data-testid="ft-decision-confirm" />
        <span>I am making this decision myself, on merit. It will be recorded with my name and the time.</span>
      </label>

      {err && <p className="mt-2 text-xs font-semibold text-red-600" role="alert" data-testid="ft-decision-error">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className="min-h-[44px] flex-1 rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft">Cancel</button>
        <button type="button" onClick={submit} disabled={busy || !valid} className="min-h-[44px] flex-1 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-50" data-testid="ft-decision-submit">
          {busy ? 'Saving…' : 'Submit decision'}
        </button>
      </div>
    </div>
  );
}
