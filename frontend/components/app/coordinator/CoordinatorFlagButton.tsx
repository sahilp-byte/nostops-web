'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

export type FlagSummary = {
  reason: string;
  reason_label: string;
  note?: string | null;
  flagged_at?: string | null;
  flagged_by_name?: string | null;
  reference?: string | null;
  replies?: { by_name?: string | null; by_role?: string | null; message: string; created_at?: string | null }[];
} | null;

const REASONS: { value: string; label: string }[] = [
  { value: 'VENUE_PROBLEM', label: 'Venue problem' },
  { value: 'TEACHER_AT_RISK', label: 'Teacher at risk / no-show' },
  { value: 'LOW_TURNOUT', label: 'Low turnout risk' },
  { value: 'SAFETY_CONCERN', label: 'Safety concern' },
  { value: 'OTHER', label: 'Other' },
];

// §14 — Coordinator Alerts: flag an event at-risk (notifies organiser + NOSTOPS,
// lands in the Admin inbox) and resolve it once handled. No participant data.
export default function CoordinatorFlagButton({ eventId, flag }: { eventId: string; flag: FlagSummary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('VENUE_PROBLEM');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    setBusy(true);
    const res = await postBff(`/bff/institutional/coordinator/events/${encodeURIComponent(eventId)}/flag`, { reason, note });
    setBusy(false);
    if (!res.ok) { setErr(res.data?.error || 'Could not flag this event.'); return; }
    setOpen(false);
    setNote('');
    router.refresh();
  }

  async function resolve() {
    setErr('');
    setBusy(true);
    const res = await postBff(`/bff/institutional/coordinator/events/${encodeURIComponent(eventId)}/flag/resolve`);
    setBusy(false);
    if (!res.ok) { setErr(res.data?.error || 'Could not resolve this flag.'); return; }
    router.refresh();
  }

  if (flag) {
    return (
      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3" data-testid={`flag-active-${eventId}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">⚠️ {flag.reason_label}</span>
          {flag.flagged_by_name && <span className="text-[11px] text-amber-800/80">Flagged by {flag.flagged_by_name}</span>}
          <button type="button" disabled={busy} onClick={resolve} data-testid={`flag-resolve-${eventId}`}
            className="ml-auto rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50">
            {busy ? '…' : 'Resolve'}
          </button>
        </div>
        {flag.note && <p className="mt-1.5 whitespace-pre-wrap text-xs text-amber-900/90">{flag.note}</p>}
        {(flag.replies?.length ?? 0) > 0 && (
          <div className="mt-2 space-y-1.5" data-testid={`flag-replies-${eventId}`}>
            {flag.replies!.map((r, i) => (
              <div key={i} className="rounded-lg bg-white/70 px-3 py-2">
                <p className="text-[11px] font-bold text-ink-soft">{r.by_role === 'admin' ? 'NOSTOPS' : (r.by_name || 'Organiser')} replied{r.created_at ? ` · ${r.created_at.slice(0, 10)}` : ''}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{r.message}</p>
              </div>
            ))}
          </div>
        )}
        {err && <p className="mt-1 text-[11px] font-semibold text-red-600">{err}</p>}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} data-testid={`flag-open-${eventId}`}
        className="mt-2 inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-50">
        ⚠️ Flag at-risk
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-line bg-cream/40 p-3" data-testid={`flag-form-${eventId}`}>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted">Reason</label>
      <select value={reason} onChange={(e) => setReason(e.target.value)} data-testid={`flag-reason-${eventId}`}
        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink">
        {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <label className="mt-2 block text-[11px] font-bold uppercase tracking-wider text-muted">Note (optional)</label>
      <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} rows={3}
        placeholder="What's the risk? The organiser and NOSTOPS care team will be notified. Don't include participant details."
        data-testid={`flag-note-${eventId}`}
        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted" />
      {err && <p className="mt-1 text-[11px] font-semibold text-red-600">{err}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button type="button" disabled={busy} onClick={submit} data-testid={`flag-submit-${eventId}`}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-50">
          {busy ? 'Flagging…' : 'Flag event'}
        </button>
        <button type="button" disabled={busy} onClick={() => { setOpen(false); setErr(''); }}
          className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">
          Cancel
        </button>
      </div>
    </div>
  );
}
