import { inr } from '@/lib/format';
import {
  CANCELLATION_TIERS,
  HOST_CANCELLATION_NOTE,
  PARTICIPANT_NOTE,
  POLICY_NAME,
  daysUntil,
  refundFor,
} from '@/lib/cancellation';

// PROMPT 24 — presentational (server-safe) cancellation & refund policy.
// Shown on the retreat page, at checkout, and on confirmation. When a start date
// and a price are supplied it also shows the live refund the participant would
// get if they cancelled today, using the same tiers the backend applies.
export default function CancellationPolicy({
  startDate,
  pricePaidInr,
  hostNote,
  compact,
}: {
  startDate?: string;
  pricePaidInr?: number;
  hostNote?: string;
  compact?: boolean;
}) {
  const days = daysUntil(startDate);
  const live = days != null && typeof pricePaidInr === 'number' ? refundFor(days, pricePaidInr) : null;

  return (
    <div className={`rounded-2xl border border-line bg-white ${compact ? 'p-4' : 'p-5'}`} data-testid="cancellation-policy">
      <div className="flex items-center gap-2">
        <span aria-hidden>↩️</span>
        <p className={`font-black tracking-tight text-ink ${compact ? 'text-sm' : 'text-base'}`}>{POLICY_NAME}</p>
      </div>

      <ul className="mt-3 space-y-1.5 p-0">
        {CANCELLATION_TIERS.map((t) => (
          <li key={t.minDaysBefore} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-ink-soft">Cancel {t.label.toLowerCase()}</span>
            <span className={`font-bold ${t.refundPct >= 100 ? 'text-emerald-700' : t.refundPct > 0 ? 'text-amber-700' : 'text-red-600'}`}>
              {t.refundPct === 100 ? 'Full refund' : t.refundPct === 0 ? 'No refund' : `${t.refundPct}% refund`}
            </span>
          </li>
        ))}
      </ul>

      {live && (
        <div className="mt-3 rounded-xl bg-cream/70 px-3.5 py-2.5 text-sm" data-testid="cancellation-live">
          <span className="text-ink-soft">If you cancel today </span>
          <span className="font-bold text-ink">({days} {days === 1 ? 'day' : 'days'} before)</span>
          <span className="text-ink-soft">, you&apos;d receive </span>
          <span className="font-black text-brand-700">₹{inr(live.refundInr)}</span>
          <span className="text-ink-soft"> back{live.retainedInr > 0 ? ` (₹${inr(live.retainedInr)} retained)` : ''}.</span>
        </div>
      )}

      <p className="mt-3 text-xs font-semibold text-emerald-700">{HOST_CANCELLATION_NOTE}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{PARTICIPANT_NOTE}</p>
      {hostNote && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-muted">Host&apos;s note</p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{hostNote}</p>
        </div>
      )}
    </div>
  );
}
