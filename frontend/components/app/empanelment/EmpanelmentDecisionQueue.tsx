'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import type { PolicyCase } from '@/lib/server/empanelment-policy';
import { DECLINE_REASONS } from '@/lib/empanelment-policy';

// Policy V2 — Council gurus and admins record (1) the completed Council
// interaction, then (2) the explicit final decision; (3) ONLY an admin activates
// an approval after checking it. Approve needs step 1 and the server re-checks
// the free-path items. "Not approved" before step 1 needs a documented reason.
const STATUS_STYLE: Record<string, string> = {
  AWAITING_COUNCIL_INTERACTION: 'bg-amber-50 text-amber-800 ring-amber-300',
  AWAITING_DECISION: 'bg-blue-50 text-blue-800 ring-blue-200',
  APPROVED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  ACTIVATED: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  NOT_APPROVED: 'bg-rose-50 text-rose-800 ring-rose-200',
};
const FORMATS = [
  { v: 'video_call', l: 'Video call' },
  { v: 'phone', l: 'Phone call' },
  { v: 'in_person', l: 'In person' },
];
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—');
// The Council works on India time: "today" is the IST date, not the UTC date.
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

function Confirm({ id, checked, onChange, text }: { id: string; checked: boolean; onChange: (v: boolean) => void; text: string }) {
  return (
    <label className="mt-2 flex min-h-[44px] cursor-pointer items-start gap-3 py-1 text-sm text-ink-soft">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" data-testid={id} />
      <span>{text}</span>
    </label>
  );
}

function useSubmit(url: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  async function send(body: Record<string, unknown>, okText: string) {
    setBusy(true);
    setErr(null);
    const r = await postBff(url, body);
    setBusy(false);
    if (r.ok) { setDone(r.data?.message || okText); router.refresh(); } else setErr(r.data?.error || 'Could not save.');
  }
  return { busy, err, done, send };
}

function Feedback({ s, id }: { s: ReturnType<typeof useSubmit>; id: string }) {
  return (
    <>
      {s.err && <p className="mt-2 text-sm font-semibold text-red-600" role="alert" data-testid={`ep-error-${id}`}>{s.err}</p>}
      {s.done && <p className="mt-2 text-sm font-semibold text-brand-700" role="status" data-testid={`ep-done-${id}`}>{s.done}</p>}
    </>
  );
}

function InteractionForm({ c }: { c: PolicyCase }) {
  const [heldOn, setHeldOn] = useState(today());
  const [format, setFormat] = useState('video_call');
  const [summary, setSummary] = useState('');
  const [confirm, setConfirm] = useState(false);
  const s = useSubmit(`/bff/empanelment/cases/${c.case_id}/interaction`);
  const valid = !!heldOn && summary.trim().length >= 15 && confirm;
  return (
    <div className="mt-4 rounded-xl border border-line bg-cream/50 p-4" data-testid={`ep-interaction-form-${c.case_id}`}>
      <p className="text-xs font-black uppercase tracking-wider text-ink">Step 1 · Record the Council interaction</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs font-bold text-ink-soft">Held on
          <input type="date" max={today()} value={heldOn} onChange={(e) => setHeldOn(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-lg border border-line bg-white px-3 text-sm text-ink" data-testid={`ep-held-on-${c.case_id}`} />
        </label>
        <label className="text-xs font-bold text-ink-soft">How
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-lg border border-line bg-white px-3 text-sm text-ink" data-testid={`ep-format-${c.case_id}`}>
            {FORMATS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
          </select>
        </label>
      </div>
      <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={1000} placeholder="What did you discuss? (internal, at least 15 characters)" className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" data-testid={`ep-summary-${c.case_id}`} />
      <Confirm id={`ep-interaction-confirm-${c.case_id}`} checked={confirm} onChange={setConfirm} text="I took part in this interaction myself and it is complete." />
      <Feedback s={s} id={`interaction-${c.case_id}`} />
      <button type="button" disabled={!valid || s.busy} onClick={() => s.send({ held_on: heldOn, format, summary: summary.trim(), confirm }, 'Interaction recorded.')} className="mt-2 min-h-[44px] rounded-xl bg-brand px-5 text-sm font-bold text-white disabled:opacity-50" data-testid={`ep-interaction-submit-${c.case_id}`}>
        {s.busy ? 'Saving…' : 'Record interaction'}
      </button>
    </div>
  );
}

export function ReasonSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="mt-2 block text-xs font-bold text-ink-soft">Documented reason (needed before the interaction)
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-lg border border-line bg-white px-3 text-sm text-ink" data-testid={id}>
        <option value="">Choose a reason…</option>
        {DECLINE_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
      </select>
      <span className="mt-1 block text-[11px] font-normal text-muted">Incomplete progress is not a reason: a teacher who has not met the items yet simply keeps going.</span>
    </label>
  );
}

function DecisionForm({ c }: { c: PolicyCase }) {
  const canApprove = c.status === 'AWAITING_DECISION';
  const beforeInteraction = c.status === 'AWAITING_COUNCIL_INTERACTION';
  const [outcome, setOutcome] = useState<'APPROVE' | 'DECLINE' | ''>('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const s = useSubmit(`/bff/empanelment/cases/${c.case_id}/decision`);
  const needsReason = outcome === 'DECLINE' && beforeInteraction;
  const valid = !!outcome && note.trim().length >= 15 && confirm && (outcome !== 'APPROVE' || canApprove) && (!needsReason || !!reason);
  const btn = (active: boolean) => `min-h-[44px] rounded-xl border px-4 text-sm font-bold ${active ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-soft'} disabled:opacity-40`;
  return (
    <div className="mt-4 rounded-xl border border-line bg-cream/50 p-4" data-testid={`ep-decision-form-${c.case_id}`}>
      <p className="text-xs font-black uppercase tracking-wider text-ink">Step 2 · Final decision</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={!canApprove} onClick={() => setOutcome('APPROVE')} className={btn(outcome === 'APPROVE')} data-testid={`ep-approve-${c.case_id}`}>✓ Approve empanelment</button>
        <button type="button" onClick={() => setOutcome('DECLINE')} className={btn(outcome === 'DECLINE')} data-testid={`ep-decline-${c.case_id}`}>Not approved</button>
      </div>
      {!canApprove && <p className="mt-1 text-xs text-muted">Approval opens after the Council interaction is recorded.</p>}
      {needsReason && <ReasonSelect id={`ep-reason-${c.case_id}`} value={reason} onChange={setReason} />}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="Decision note — the teacher sees this (at least 15 characters)" className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" data-testid={`ep-note-${c.case_id}`} />
      <Confirm id={`ep-decision-confirm-${c.case_id}`} checked={confirm} onChange={setConfirm} text="I am making this decision myself. It will be recorded with my name and the time." />
      <Feedback s={s} id={c.case_id} />
      <button type="button" disabled={!valid || s.busy} onClick={() => s.send({ outcome, note: note.trim(), confirm, reason: needsReason ? reason : null }, 'Decision recorded.')} className="mt-2 min-h-[44px] rounded-xl bg-brand px-5 text-sm font-bold text-white disabled:opacity-50" data-testid={`ep-decision-submit-${c.case_id}`}>
        {s.busy ? 'Saving…' : 'Record decision'}
      </button>
    </div>
  );
}

function ActivationForm({ c }: { c: PolicyCase }) {
  const approval = [...c.decisions].reverse().find((d) => d.outcome === 'APPROVE');
  const retry = c.status === 'ACTIVATED';
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState('');
  const s = useSubmit(`/bff/empanelment/cases/${c.case_id}/activate`);
  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4" data-testid={`ep-activation-form-${c.case_id}`}>
      <p className="text-xs font-black uppercase tracking-wider text-ink">Step 3 · Admin activation</p>
      <p className="mt-1 text-xs text-ink-soft">
        Activation switches Empanelled on in the main record. It does not change the Council&apos;s decision and is recorded with your name.
      </p>
      {approval && (
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-ink" data-testid={`ep-approval-record-${c.case_id}`}>
          Recorded approval: {approval.reviewer_name} ({approval.reviewer_role}) · {fmt(approval.decided_at)} — “{approval.note}”
        </p>
      )}
      {!retry && (
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Activation note (optional, internal)" className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" data-testid={`ep-activation-note-${c.case_id}`} />
      )}
      <Confirm id={`ep-activation-confirm-${c.case_id}`} checked={checked} onChange={setChecked} text="I checked the recorded Council interaction and approval above." />
      <Feedback s={s} id={`activation-${c.case_id}`} />
      <button type="button" disabled={!checked || s.busy} onClick={() => s.send({ confirm_checked_approval: checked, note: note.trim() }, 'Activated.')} className="mt-2 min-h-[44px] rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-50" data-testid={`ep-activate-${c.case_id}`}>
        {s.busy ? 'Activating…' : retry ? 'Try again · update the main record' : 'Activate Empanelled'}
      </button>
    </div>
  );
}

function CaseCard({ c, viewerRole }: { c: PolicyCase; viewerRole: 'admin' | 'council' }) {
  const ev = c.current_evidence?.evaluation;
  const open = c.status === 'AWAITING_COUNCIL_INTERACTION' || c.status === 'AWAITING_DECISION';
  const isAdmin = viewerRole === 'admin';
  const needsMainUpdate = c.status === 'ACTIVATED' && c.main_backend_update !== 'APPLIED';
  return (
    <li className="rounded-2xl border border-line bg-white p-5" data-testid={`ep-case-${c.case_id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-black text-ink">{c.name || c.handle || 'Teacher'}</p>
          <p className="text-xs text-muted">{[c.handle, c.path === 'FREE' ? 'Free path' : 'Fast-Track', `opened ${fmt(c.created_at)}`].filter(Boolean).join(' · ')}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${STATUS_STYLE[c.status] || STATUS_STYLE.AWAITING_DECISION}`} data-testid={`ep-status-${c.case_id}`}>{c.status_label}</span>
      </div>

      {ev && (
        <div className="mt-3">
          <p className="text-[11px] font-black uppercase tracking-wider text-ink-soft">Free-path items (checked {fmt(c.current_evidence?.observed_at)})</p>
          <ul className="mt-1 grid grid-cols-1 gap-1 p-0 text-xs sm:grid-cols-2">
            {ev.requirements.map((r) => (
              <li key={r.key} className={r.met ? 'text-emerald-800' : 'text-rose-700'}>
                {r.met ? '✓' : '✗'} {r.label}: {r.key === 'majority_positive' ? `${r.value} of ${r.of}` : `${r.value} / ${r.target}`}
              </li>
            ))}
          </ul>
          {!!ev.free_sessions_counted && <p className="mt-1 text-[11px] text-muted">{ev.free_sessions_counted} of the counted sessions were free sessions (free sessions count; paid-only is not policy).</p>}
        </div>
      )}

      {c.interactions.length > 0 && (
        <div className="mt-3 space-y-1 text-xs text-ink-soft">
          {c.interactions.map((i, n) => (
            <p key={n}>🤝 Council interaction ({i.format.replace('_', ' ')}) on {i.held_on?.slice(0, 10)} — {i.summary} <span className="text-muted">· {i.reviewer_name} ({i.reviewer_role})</span></p>
          ))}
        </div>
      )}
      {c.decisions.length > 0 && (
        <div className="mt-2 space-y-1 text-xs text-ink-soft">
          {c.decisions.map((d, n) => (
            <p key={n}>⚖️ {d.outcome === 'APPROVE' ? 'Approved' : 'Not approved'}{d.reason_label ? ` (${d.reason_label})` : ''} · {fmt(d.decided_at)} · {d.reviewer_name} ({d.reviewer_role}) — “{d.note}”</p>
          ))}
        </div>
      )}
      {c.activation && (
        <p className="mt-2 text-xs text-ink-soft" data-testid={`ep-activation-line-${c.case_id}`}>
          🔓 Activated · {fmt(c.activation.activated_at)} · {c.activation.reviewer_name} ({c.activation.reviewer_role}) · main record: {(c.main_backend_update || '—').toLowerCase()}
        </p>
      )}
      {c.path === 'FAST_TRACK' && c.status === 'NOT_APPROVED' && (
        <p className="mt-2 text-xs text-muted">Decided in the Fast-Track interview queue · main record update: {(c.main_backend_update || '—').toLowerCase()}</p>
      )}
      {c.status === 'APPROVED' && !isAdmin && (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Next: a NOSTOPS admin checks this approval and activates Empanelled.</p>
      )}

      {c.path === 'FREE' && c.status === 'AWAITING_COUNCIL_INTERACTION' && <InteractionForm c={c} />}
      {c.path === 'FREE' && open && <DecisionForm c={c} />}
      {isAdmin && (c.status === 'APPROVED' || needsMainUpdate) && <ActivationForm c={c} />}
    </li>
  );
}

export default function EmpanelmentDecisionQueue({ cases, viewerRole }: { cases: PolicyCase[]; viewerRole: 'admin' | 'council' }) {
  if (cases.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-ink-soft" data-testid="ep-empty">
        No empanelment requests yet. Teachers appear here once they meet every free-path item and ask for the Council interaction.
      </p>
    );
  }
  return <ul className="space-y-4 p-0" data-testid="ep-list">{cases.map((c) => <CaseCard key={c.case_id} c={c} viewerRole={viewerRole} />)}</ul>;
}
