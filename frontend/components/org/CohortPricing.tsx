// Cohort-specific pricing: the sliding estimator, the per-participant plan table
// and the teacher-share lines, used by the cohort showcase pages (OrgPricing).
// Figures: lib/org/pricing. Prompt 3C: every row is the list rate; the suspended
// group-size discounts appear only with the UNAPPROVED label.
import type { CohortKey } from '@/lib/org/cohort-copy';
import { COHORT_RATES, FEE_STORY, MONTH_STEPS, REVENUE, SESSIONS_PER_MONTH, SESSIONS_PER_WEEK, TEACHER_SHARE_SCOPE, estimate, inr, inrRate } from '@/lib/org/pricing';
import PricingEstimator from '@/components/org/PricingEstimator';
import UnapprovedBands from '@/components/org/UnapprovedBands';

const mo = (m: number) => `${m} month${m === 1 ? '' : 's'}`;

export default function CohortPricing({ cohort }: { cohort: CohortKey }) {
  const c = COHORT_RATES[cohort];
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid={`cohort-pricing-${cohort}`}>
      <PricingEstimator cohort={cohort} />

      <div className="rounded-2xl border border-line bg-white p-6">
        <h3 className="text-base font-extrabold text-ink">Plans per participant</h3>
        <p className="mt-1 text-sm text-muted">
          List rate: {inrRate(c.rate)} per {c.person} per session · {SESSIONS_PER_WEEK} sessions a week ({SESSIONS_PER_MONTH} a month)
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[260px] text-sm" data-testid="org-rate-table">
            <thead className="bg-cream text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-bold">Duration</th>
                <th className="px-2 py-2 text-center font-bold">Sessions</th>
                <th className="px-3 py-2 text-right font-bold">Per participant (list rate)</th>
              </tr>
            </thead>
            <tbody>
              {MONTH_STEPS.map((m) => (
                <tr key={m} className="border-t border-line">
                  <td className="px-3 py-2 font-semibold text-ink">{mo(m)}</td>
                  <td className="px-2 py-2 text-center text-ink-soft">{SESSIONS_PER_MONTH * m}</td>
                  <td className="px-3 py-2 text-right font-black text-ink">{inr(estimate(cohort, m, 0).perPerson)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {c.unapprovedBands && <UnapprovedBands />}
        <p className="mt-3 text-xs text-muted" data-testid="cohort-fee-story">
          {c.note} Prices are per participant for the whole duration. {FEE_STORY}
        </p>

        <div className="mt-4 space-y-1.5" data-testid="teacher-share">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Teacher share</p>
          {REVENUE.map((r) => (
            <div key={r.term} className="flex items-center justify-between rounded-lg bg-cream px-3 py-1.5 text-sm">
              <span className="font-semibold text-ink">{r.term}</span>
              <span className="font-black text-brand-700">{r.teacher}% to teacher</span>
            </div>
          ))}
          <p className="text-xs text-muted" data-testid="teacher-share-scope">{TEACHER_SHARE_SCOPE}</p>
        </div>
      </div>
    </div>
  );
}
