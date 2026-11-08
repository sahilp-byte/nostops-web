// PROMPT 24 — retreat cancellation & refund policy.
// The backend can't persist a per-retreat custom policy, so the platform applies
// ONE fair, standard tiered policy everywhere. The refund percentages here mirror
// what the backend's own refund calculator applies, so what a participant is shown
// matches what they'd actually receive.

export type RefundTier = { minDaysBefore: number; refundPct: number; label: string };

export const CANCELLATION_TIERS: RefundTier[] = [
  { minDaysBefore: 30, refundPct: 100, label: '30 or more days before' },
  { minDaysBefore: 15, refundPct: 50, label: '15 to 29 days before' },
  { minDaysBefore: 0, refundPct: 0, label: 'Under 15 days before' },
];

export const POLICY_NAME = 'NOSTOPS Cooperative Cancellation Policy';
export const HOST_CANCELLATION_NOTE =
  'If the teacher or the venue cancels the retreat, every participant receives a full 100% refund.';
export const PARTICIPANT_NOTE =
  'Refunds are based on how far ahead of the start date you cancel. Platform payment charges may be deducted where applicable.';

export function refundPctForDays(daysBefore: number): number {
  if (!Number.isFinite(daysBefore)) return 0;
  for (const t of CANCELLATION_TIERS) if (daysBefore >= t.minDaysBefore) return t.refundPct;
  return 0;
}

// Days between now and the retreat start (accepts YYYY-MM-DD or full ISO).
export function daysUntil(startISO?: string): number | null {
  if (!startISO) return null;
  const iso = startISO.length <= 10 ? `${startISO}T00:00:00` : startISO;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((t - Date.now()) / 86400000);
}

export function refundFor(daysBefore: number, pricePaidInr: number): { pct: number; refundInr: number; retainedInr: number } {
  const pct = refundPctForDays(daysBefore);
  const refundInr = Math.round((Math.max(0, pricePaidInr) * pct) / 100);
  return { pct, refundInr, retainedInr: Math.max(0, Math.round(pricePaidInr) - refundInr) };
}

export function currentTierLabel(daysBefore: number | null): string | null {
  if (daysBefore == null) return null;
  const pct = refundPctForDays(daysBefore);
  return `${pct}% refund if you cancel today`;
}
