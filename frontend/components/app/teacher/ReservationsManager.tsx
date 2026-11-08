'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// PROMPT 19 — strict cohort attribution + audit trail + host lifecycle actions.
// One booking carries ONE cohort attribution (set only at booking time — never
// retroactively). The host can approve / waitlist / decline a curated cohort,
// mark a seat paid, or cancel (with or without refund). Cancelled/refunded
// bookings clearly show benefits withheld/reversed; a booking is benefit-eligible
// only once confirmed (paid + approved).

export type ResItem = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  bookingType: string;
  groupSize: number;
  status: string;
  cohortStatus?: string;
  cohortFitNote?: string;
  cohortDecisionReason?: string;
  cohortDecisionAt?: string;
  effectiveTotalInr: number;
  hostNetInr: number;
  reservedAt?: string;
  expiresAt?: string;
  paidAt?: string;
  cancelledAt?: string;
  cohort?: string;
  cohortVia?: string;
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmt(d?: string): string {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || ''}` : '';
}

const STATUS: Record<string, { label: string; cls: string }> = {
  reserved: { label: 'Reserved', cls: 'bg-amber-50 text-amber-700' },
  paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700' },
  confirmed: { label: 'Confirmed', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600' },
  expired: { label: 'Expired', cls: 'bg-cream text-muted' },
};

const isPending = (s?: string) => !!s && /pending/i.test(s);
const isApproved = (s?: string) => !!s && /approv/i.test(s);
const isDeclined = (s?: string) => !!s && /declin|reject/i.test(s);
const isWaitlisted = (s?: string) => !!s && /waitlist/i.test(s);

function cohortStatusLabel(s?: string): string {
  if (!s) return '';
  if (s === 'auto_approved') return 'auto-approved';
  if (isApproved(s)) return 'approved';
  if (isDeclined(s)) return 'declined';
  if (isWaitlisted(s)) return 'waitlisted';
  if (isPending(s)) return 'pending review';
  return s.replace(/_/g, ' ');
}

function eligibility(r: ResItem): { label: string; cls: string } {
  const benefit = !!r.cohort;
  if (r.status === 'cancelled') return r.paidAt ? { label: benefit ? 'Benefit reversed' : 'Refunded', cls: 'bg-red-50 text-red-600' } : { label: benefit ? 'Benefit withheld' : 'Cancelled', cls: 'bg-cream text-muted' };
  if (r.status === 'expired') return { label: benefit ? 'Benefit withheld' : 'Expired', cls: 'bg-cream text-muted' };
  if (isDeclined(r.cohortStatus)) return { label: 'Declined', cls: 'bg-cream text-muted' };
  if (isWaitlisted(r.cohortStatus)) return { label: 'Waitlisted', cls: 'bg-amber-50 text-amber-700' };
  if (isPending(r.cohortStatus)) return { label: 'Awaiting decision', cls: 'bg-amber-50 text-amber-700' };
  if (r.status === 'paid' || r.paidAt) return { label: benefit ? 'Benefit eligible' : 'Confirmed & paid', cls: 'bg-emerald-50 text-emerald-700' };
  return { label: 'Pending payment', cls: 'bg-cream text-muted' };
}

const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9@]/g, '');

function Row({ r, retreatId, dup, canDecide }: { r: ResItem; retreatId: string; dup: boolean; canDecide: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [reasonFor, setReasonFor] = useState<'' | 'waitlist' | 'decline'>('');
  const [reason, setReason] = useState('');

  const st = STATUS[r.status] || { label: r.status, cls: 'bg-cream text-muted' };
  const elig = eligibility(r);
  const active = !['cancelled', 'expired'].includes(r.status);
  const isPaid = r.status === 'paid' || !!r.paidAt;

  async function act(action: string, decision?: string, why?: string) {
    setBusy(action + (decision || ''));
    setErr('');
    const res = await postBff(`/bff/retreats/${retreatId}/reservations/${r.id}/lifecycle`, { action, decision, reason: why });
    setBusy('');
    if (!res.ok) { setErr(res.data?.error || 'Could not complete that.'); return; }
    setReasonFor('');
    setReason('');
    router.refresh();
  }

  const audit = [
    r.reservedAt && `Reserved ${fmt(r.reservedAt)}`,
    r.paidAt && `Paid ${fmt(r.paidAt)}`,
    r.cohortDecisionAt && `${cohortStatusLabel(r.cohortStatus)} ${fmt(r.cohortDecisionAt)}${r.cohortDecisionReason ? ` — “${r.cohortDecisionReason}”` : ''}`,
    r.cancelledAt && `Cancelled ${fmt(r.cancelledAt)}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3" data-testid="reservation-row">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-ink">
            {r.name}{r.groupSize > 1 ? ` · group of ${r.groupSize}` : ''}
            {dup && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600" data-testid="reservation-dup" title="Same contact appears on more than one active booking">⚠ possible duplicate</span>}
          </p>
          <p className="truncate text-xs text-muted">{[r.companyName, r.email, r.phone].filter(Boolean).join(' · ') || (r.bookingType === 'group' ? 'Group booking' : 'Individual')}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {r.cohort ? (
              <span className="rounded-full bg-royal-50 px-2 py-0.5 text-[10px] font-bold text-royal" data-testid="reservation-cohort">{r.cohort}{r.cohortVia ? ` · via ${r.cohortVia}` : ''}</span>
            ) : (
              <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-muted">Direct booking</span>
            )}
            {r.cohortStatus && r.cohortStatus !== 'auto_approved' && <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-ink-soft" data-testid="reservation-cohort-status">{cohortStatusLabel(r.cohortStatus)}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
          {elig && <span className={`mt-1 block rounded-full px-2 py-0.5 text-[10px] font-bold ${elig.cls}`} data-testid="reservation-eligibility">{elig.label}</span>}
          {r.effectiveTotalInr > 0 && <p className="mt-1 text-xs text-ink-soft">{inr(r.effectiveTotalInr)}{r.hostNetInr ? ` · you net ${inr(r.hostNetInr)}` : ''}</p>}
        </div>
      </div>

      {audit && <p className="mt-2 text-[11px] leading-relaxed text-muted" data-testid="reservation-audit">🕮 {audit}</p>}

      {/* Actions */}
      {(active || (isPending(r.cohortStatus) && canDecide)) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {isPending(r.cohortStatus) && canDecide && (
            <>
              <button type="button" disabled={!!busy} onClick={() => act('cohort-decision', 'approve')} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50" data-testid="res-approve">{busy === 'cohort-decisionapprove' ? '…' : 'Approve'}</button>
              <button type="button" disabled={!!busy} onClick={() => setReasonFor(reasonFor === 'waitlist' ? '' : 'waitlist')} className="rounded-lg border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700 transition hover:bg-cream disabled:opacity-50" data-testid="res-waitlist">Waitlist</button>
              <button type="button" disabled={!!busy} onClick={() => setReasonFor(reasonFor === 'decline' ? '' : 'decline')} className="rounded-lg border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-red-600 transition hover:bg-cream disabled:opacity-50" data-testid="res-decline">Decline</button>
            </>
          )}
          {r.status === 'reserved' && <button type="button" disabled={!!busy} onClick={() => act('mark-paid')} className="rounded-lg bg-brand px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="res-mark-paid">{busy === 'mark-paid' ? '…' : 'Mark paid'}</button>}
          {active && isPaid && r.effectiveTotalInr > 0 && <button type="button" disabled={!!busy} onClick={() => act('cancel-with-refund')} className="rounded-lg border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-red-600 transition hover:bg-cream disabled:opacity-50" data-testid="res-cancel-refund">{busy === 'cancel-with-refund' ? '…' : 'Cancel + refund'}</button>}
          {active && <button type="button" disabled={!!busy} onClick={() => act('cancel')} className="rounded-lg border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-ink-soft transition hover:border-red-300 hover:text-red-600 disabled:opacity-50" data-testid="res-cancel">{busy === 'cancel' ? '…' : 'Cancel'}</button>}
        </div>
      )}

      {reasonFor && (
        <div className="mt-2 flex items-center gap-2" data-testid="res-reason-box">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={400} placeholder={`Reason (optional) for ${reasonFor}`} className="flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-ink outline-none focus:border-brand" data-testid="res-reason" />
          <button type="button" disabled={!!busy} onClick={() => act('cohort-decision', reasonFor, reason)} className="rounded-lg bg-ink px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50" data-testid="res-reason-confirm">Confirm</button>
        </div>
      )}

      {err && <p className="mt-1.5 text-xs font-semibold text-red-600" data-testid="reservation-error">{err}</p>}
    </div>
  );
}

export default function ReservationsManager({ retreatId, reservations, canDecide }: { retreatId: string; reservations: ResItem[]; canDecide: boolean }) {
  const dupIds = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of reservations) {
      if (['cancelled', 'expired'].includes(r.status)) continue;
      const key = norm(r.phone) || norm(r.email);
      if (key) seen.set(key, (seen.get(key) || 0) + 1);
    }
    const dup = new Set<string>();
    for (const r of reservations) {
      if (['cancelled', 'expired'].includes(r.status)) continue;
      const key = norm(r.phone) || norm(r.email);
      if (key && (seen.get(key) || 0) > 1) dup.add(r.id);
    }
    return dup;
  }, [reservations]);

  return (
    <section data-testid="reservations-manager">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Reservations &amp; attribution ({reservations.length})</h2>
      </div>
      <p className="mb-3 text-[11px] text-muted">Each booking carries one cohort attribution, set only at booking time — never stacked or added afterwards. Cancelled or refunded bookings don&apos;t earn cohort benefits.</p>
      {reservations.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-6 text-center">
          <p className="text-sm font-extrabold text-ink">No reservations yet</p>
          <p className="mt-1 text-sm text-ink-soft">Share your retreat so seekers and organisations can reserve seats.</p>
        </div>
      ) : (
        <div className="space-y-2">{reservations.map((r) => <Row key={r.id} r={r} retreatId={retreatId} dup={dupIds.has(r.id)} canDecide={canDecide} />)}</div>
      )}
    </section>
  );
}
