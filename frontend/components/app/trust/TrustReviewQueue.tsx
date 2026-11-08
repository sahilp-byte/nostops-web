'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// B4.8 — the Council / admin review queue for teachers the main backend lists as
// EMPANELLED without a passed identity check. Every case stays "Pending review"
// until a person records an explicit, reasoned decision. Shows status flags only —
// never identity documents or contact details.
type Decision = { decision_id: string; action: string; resulting_status: string; previous_status: string; reason: string; decided_at: string; reviewer_name?: string; reviewer_role?: string };
type Case = {
  case_id: string;
  handle?: string;
  name?: string;
  city?: string;
  country?: string;
  exception?: string;
  status: string;
  status_label: string;
  snapshot: { id_check?: string; empanelled_on_main_backend?: boolean; empanelment_path?: string | null; empanelment_updated_at?: string | null; empanelment_certificate_on_record?: boolean; level_badge?: string | null };
  decisions: Decision[];
  created_at?: string;
};

const STATUS_STYLE: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-50 text-amber-800 ring-amber-300',
  CONFIRMED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  SUSPENDED: 'bg-orange-50 text-orange-800 ring-orange-300',
  REVOKED: 'bg-rose-50 text-rose-800 ring-rose-200',
};

const ACTIONS = [
  { key: 'CONFIRM', label: 'Confirm empanelment', hint: 'Keeps "Empanelled". "✓ Verified" still needs a passed ID check.' },
  { key: 'SUSPEND', label: 'Suspend empanelment', hint: 'Hides "Empanelled" on the website until a new decision.' },
  { key: 'REVOKE', label: 'Revoke empanelment', hint: 'Removes "Empanelled" from the website.' },
] as const;

// Mirrors trust_review.STATUS_LABELS so the card updates the moment a decision is
// recorded (the refreshed server list then confirms it).
const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Pending Council review',
  CONFIRMED: 'Empanelment confirmed by review (identity check still required for ✓ Verified)',
  SUSPENDED: 'Empanelment suspended pending review',
  REVOKED: 'Empanelment revoked after review',
};

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—');

function DecisionForm({ c, onDecided }: { c: Case; onDecided: (status: string) => void }) {
  const router = useRouter();
  const [action, setAction] = useState<string>('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const ready = !!action && reason.trim().length >= 15 && confirm && !busy;

  async function submit() {
    setErr('');
    setBusy(true);
    const { ok, data } = await postBff<{ ok?: boolean; status?: string; error?: string }>(
      `/bff/trust/review/${c.case_id}/decision`,
      { action, reason: reason.trim(), confirm },
    );
    setBusy(false);
    if (!ok) {
      setErr(data?.error || 'Could not record the decision.');
      return;
    }
    setDone(`Decision recorded — status is now ${String(data?.status || '').replace('_', ' ').toLowerCase()}.`);
    if (data?.status) onDecided(String(data.status));
    setAction('');
    setReason('');
    setConfirm(false);
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-cream/40 p-4" data-testid={`trust-decision-form-${c.case_id}`}>
      <p className="text-xs font-black uppercase tracking-wider text-ink">{c.decisions.length > 0 ? 'Record a new decision' : 'Record a decision'}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Decision">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            type="button"
            role="radio"
            aria-checked={action === a.key}
            onClick={() => setAction(a.key)}
            data-testid={`trust-action-${a.key.toLowerCase()}-${c.case_id}`}
            className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-sm font-bold transition ${action === a.key ? 'border-brand bg-white text-brand-700 ring-2 ring-brand/30' : 'border-line bg-white text-ink-soft hover:border-brand/40'}`}
          >
            {a.label}
            <span className="mt-0.5 block text-[11px] font-medium text-muted">{a.hint}</span>
          </button>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-bold text-ink-soft">Reviewer note — the teacher will see this note *</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="What did you review, and why this decision? Write it for the teacher (at least 15 characters)"
          data-testid={`trust-reason-${c.case_id}`}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        />
      </label>
      <label className="mt-2 flex min-h-[44px] cursor-pointer items-start gap-3 py-1 text-sm text-ink-soft">
        <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" data-testid={`trust-confirm-${c.case_id}`} />
        I have reviewed this case myself and confirm this decision. It will be recorded with my name and the time.
      </label>
      {err && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700" role="alert">{err}</p>}
      {done && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800" role="status" data-testid={`trust-done-${c.case_id}`}>{done}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={!ready}
        data-testid={`trust-submit-${c.case_id}`}
        className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Recording…' : 'Record decision'}
      </button>
    </div>
  );
}

export default function TrustReviewQueue({ cases }: { cases: Case[] }) {
  const [latest, setLatest] = useState<Record<string, string>>({});
  if (cases.length === 0) {
    return <p className="rounded-2xl border border-line bg-white p-5 text-sm font-semibold text-emerald-700">✓ No teachers are waiting for a trust review.</p>;
  }
  return (
    <ul className="space-y-4 p-0" data-testid="trust-review-list">
      {cases.map((c) => (
        <li key={c.case_id} className="rounded-2xl border border-line bg-white p-5" data-testid={`trust-case-${c.case_id}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-black text-ink">
                {c.name || c.handle || 'Teacher'}
                {c.exception === 'QA_FIXTURE' && (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-[10px] font-bold uppercase text-slate-700 ring-1 ring-slate-300">QA test case</span>
                )}
              </p>
              <p className="text-xs text-muted">{[c.handle ? `@${c.handle}` : null, c.city, c.country].filter(Boolean).join(' · ')}</p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${STATUS_STYLE[latest[c.case_id] || c.status] || STATUS_STYLE.PENDING_REVIEW}`} data-testid={`trust-status-${c.case_id}`}>
              {latest[c.case_id] ? STATUS_LABELS[latest[c.case_id]] || c.status_label : c.status_label}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg bg-rose-50 px-3 py-2"><dt className="font-bold text-rose-800">ID check</dt><dd className="text-rose-900">{c.snapshot.id_check === 'PASSED' ? 'Passed' : 'Not passed'}</dd></div>
            <div className="rounded-lg bg-cream px-3 py-2"><dt className="font-bold text-ink-soft">Main-backend record</dt><dd className="text-ink">{c.snapshot.empanelled_on_main_backend ? 'Empanelled' : 'Not empanelled'}</dd></div>
            <div className="rounded-lg bg-cream px-3 py-2"><dt className="font-bold text-ink-soft">Path / certificate</dt><dd className="text-ink">{c.snapshot.empanelment_path || 'unknown'} · {c.snapshot.empanelment_certificate_on_record ? 'cert on record' : 'no cert'}</dd></div>
            <div className="rounded-lg bg-cream px-3 py-2"><dt className="font-bold text-ink-soft">Level</dt><dd className="text-ink">{c.snapshot.level_badge || '—'}</dd></div>
          </dl>
          <p className="mt-2 text-[11px] text-muted">Case opened {fmt(c.created_at)} · empanelment updated {fmt(c.snapshot.empanelment_updated_at)}</p>

          {c.decisions.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-black uppercase tracking-wider text-ink">Decision history</p>
              <ol className="mt-1 space-y-1.5 p-0">
                {[...c.decisions].reverse().map((d) => (
                  <li key={d.decision_id} className="rounded-lg border border-line px-3 py-2 text-xs text-ink-soft">
                    <span className="font-bold text-ink">{d.action}</span> · {d.previous_status.replace('_', ' ').toLowerCase()} → {d.resulting_status.toLowerCase()} · {fmt(d.decided_at)} · {d.reviewer_name || 'Reviewer'} ({d.reviewer_role})
                    <span className="mt-0.5 block italic">“{d.reason}”</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <DecisionForm c={c} onDecided={(s) => setLatest((m) => ({ ...m, [c.case_id]: s }))} />
        </li>
      ))}
    </ul>
  );
}
