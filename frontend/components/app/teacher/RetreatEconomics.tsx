import { inr } from '@/lib/format';
import { computeTeacherEconomics, type RetreatEconomicsInput } from '@/lib/economics';

// PROMPT 22 — the teacher's PRIVATE economic view. Participant revenue, platform
// fee, venue cost, cohort benefit and estimated profit — visible only to the host.
// A venue owner's confidential terms and a participant's data are never shown here.
export default function RetreatEconomics({ input }: { input: RetreatEconomicsInput }) {
  const e = computeTeacherEconomics(input);
  const marginPct = e.participantRevenueCollected > 0 ? Math.round((e.teacherEarningsCollected / e.participantRevenueCollected) * 100) : null;

  return (
    <section data-testid="retreat-economics">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Your economics</h2>
        <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-muted">🔒 Private to you</span>
      </div>

      <div className="rounded-2xl border border-brand/20 bg-brand-50/40 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-brand-700">Your earnings (collected)</p>
            <p className="mt-1 text-2xl font-black text-ink" data-testid="econ-earnings">₹{inr(e.teacherEarningsCollected)}</p>
            <p className="mt-0.5 text-[11px] text-muted">{marginPct != null ? `${marginPct}% of collected revenue` : 'After platform fee & venue cost'}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-muted">Participant revenue</p>
            <p className="mt-1 text-2xl font-black text-ink">₹{inr(e.participantRevenueCollected)}</p>
            <p className="mt-0.5 text-[11px] text-muted">₹{inr(e.participantRevenuePending)} pending payment</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-muted">Est. profit at full house</p>
            <p className="mt-1 text-2xl font-black text-emerald-700">₹{inr(e.projectedFullHouseTeacherNet)}</p>
            <p className="mt-0.5 text-[11px] text-muted">of ₹{inr(e.projectedFullHouseGross)} gross</p>
          </div>
        </div>

        <dl className="mt-4 space-y-1.5 border-t border-brand/15 pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-ink-soft">Participant revenue collected</dt><dd className="font-bold text-ink">₹{inr(e.participantRevenueCollected)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-soft">NOSTOPS platform fee ({input.platformFeePct}%)</dt><dd className="font-semibold text-muted">− ₹{inr(e.platformFeeCollected)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-soft">Your venue cost</dt><dd className="font-semibold text-muted">− ₹{inr(e.venueCostCollected)}</dd></div>
          <div className="flex justify-between border-t border-brand/15 pt-1.5"><dt className="font-black text-ink">Your net earnings</dt><dd className="font-black text-brand-700">₹{inr(e.teacherEarningsCollected)}</dd></div>
        </dl>

        {e.cohortCount > 0 && (
          <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs text-ink-soft" data-testid="econ-cohort">
            {e.cohortCount} cohort {e.cohortCount === 1 ? 'booking carries' : 'bookings carry'} a benefit you honour directly — shown transparently to seekers, never stacked with other discounts.
          </p>
        )}
      </div>
    </section>
  );
}
