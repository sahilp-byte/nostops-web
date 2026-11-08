'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { COVERAGE_META, COVERAGE_STATUSES, REASON_MAX, REASON_MIN, type CoverageStatus } from '@/lib/coverage';

// Phase 8B.2 Screen 3 — change (or, with no record yet, start) a locality's coverage status.
// Choose status → mandatory reason → confirm → submit to the existing backend API; the backend writes the audit history.
export default function CoverageStatusForm({ lid, pin, current, version, locality }: { lid: string; pin: string; current: CoverageStatus | null; version: number | null; locality: string }) {
  const router = useRouter();
  const [next, setNext] = useState<CoverageStatus | null>(null);
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const r = reason.trim();
  const reasonOk = r.length >= REASON_MIN && r.length <= REASON_MAX;

  async function save() {
    if (!next || !reasonOk) return;
    setBusy(true); setMsg(null);
    const res = current
      ? await postBff(`/bff/admin/spaces-coverage/locality/${encodeURIComponent(lid)}/status`, { status: next, reason: r, expected_version: version })
      : await postBff('/bff/admin/spaces-coverage', { pin, locality_id: lid, status: next, reason: r });
    setBusy(false);
    if (!res.ok) { setStep('edit'); if (res.status === 409) router.refresh(); return setMsg({ ok: false, t: res.data?.error || 'Could not save the change. Please try again.' }); }
    setMsg({ ok: true, t: current ? `Status changed to ${COVERAGE_META[next].label}. The change is recorded in the coverage history.` : `Tracking started with status ${COVERAGE_META[next].label}. The change is recorded in the coverage history.` });
    setNext(null); setReason(''); setStep('edit');
    router.refresh();
  }

  return (
    <section className="sp-card p-5" data-testid="coverage-status-form">
      <h2 className="text-[20px]">{current ? 'Change coverage status' : 'Start tracking this locality'}</h2>
      <p className="mt-1 text-sm text-[#3B4762]">{current ? 'Choose the new status and explain why. You will confirm before anything is saved.' : 'This locality has no coverage record yet. Choose its first status and explain why to create the record.'}</p>

      {step === 'edit' ? (
        <>
          <fieldset className="mt-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-[#6E6A63]">New status</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup">
              {COVERAGE_STATUSES.map((s) => {
                const isCur = s === current;
                const sel = s === next;
                return (
                  <button key={s} type="button" role="radio" aria-checked={sel} disabled={isCur || busy} onClick={() => { setNext(s); setMsg(null); }}
                    className={`flex min-h-[56px] items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${sel ? 'border-[#F28A1E] bg-[#FFF3E3]' : 'border-[#EEDFC8] bg-white hover:border-[#F2B574]'}`}
                    data-testid={`status-option-${s}`}>
                    <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${COVERAGE_META[s].dot}`} aria-hidden />
                    <span><span className="block text-sm font-bold text-[#1C2A47]">{COVERAGE_META[s].label}{isCur ? ' · current' : ''}</span><span className="block text-xs text-[#6E6A63]">{COVERAGE_META[s].hint}</span></span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#6E6A63]">Reason (required)</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={REASON_MAX} disabled={busy}
              placeholder={`Why is this change being made? At least ${REASON_MIN} characters.`}
              className="mt-1 block w-full rounded-xl border border-[#D8CCBA] bg-white p-3 text-sm focus:border-[#F28A1E] focus:outline-none focus:ring-2 focus:ring-[#FDE2C2]" data-testid="status-reason" />
            <span className={`mt-1 block text-xs ${r.length && !reasonOk ? 'text-[#8A2A22]' : 'text-[#6E6A63]'}`} data-testid="status-reason-hint">
              {r.length < REASON_MIN ? `${REASON_MIN - r.length} more character${REASON_MIN - r.length === 1 ? '' : 's'} needed` : `${r.length}/${REASON_MAX}`}
            </span>
          </label>
          <button type="button" disabled={!next || !reasonOk || busy} onClick={() => setStep('confirm')}
            className="mt-3 min-h-[44px] rounded-xl bg-[#F28A1E] px-5 text-sm font-bold text-white hover:bg-[#E8690C] disabled:cursor-not-allowed disabled:opacity-50" data-testid="status-review">Review change</button>
        </>
      ) : (
        <div className="mt-4 rounded-xl border-2 border-[#F2B574] bg-[#FFF3E3] p-4" role="alertdialog" aria-labelledby="cov-confirm-title" data-testid="status-confirm">
          <p id="cov-confirm-title" className="text-[15px] font-bold text-[#1C2A47]">Confirm the status change for {locality}</p>
          <p className="mt-2 text-sm text-[#1C2A47]" data-testid="status-confirm-summary">
            {current ? COVERAGE_META[current].label : 'No record'} <span aria-hidden>→</span><span className="sr-only">to</span> <strong>{next ? COVERAGE_META[next].label : ''}</strong>
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[#3B4762]"><span className="font-semibold">Reason:</span> {r}</p>
          <p className="mt-2 text-xs text-[#6E6A63]">This is recorded permanently in the coverage history with your name and the time.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={save} className="min-h-[44px] rounded-xl bg-[#0F4C4A] px-5 text-sm font-bold text-white disabled:opacity-50" data-testid="status-confirm-save">{busy ? 'Saving…' : 'Confirm and save'}</button>
            <button type="button" disabled={busy} onClick={() => setStep('edit')} className="min-h-[44px] rounded-xl border border-[#D8CCBA] bg-white px-4 text-sm font-semibold text-[#1C2A47]" data-testid="status-confirm-back">Go back</button>
          </div>
        </div>
      )}
      {msg && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${msg.ok ? 'bg-[#E3F4D6] text-[#16632C]' : 'bg-[#FDECEA] text-[#8A2A22]'}`} data-testid="status-msg">{msg.t}</p>}
    </section>
  );
}
