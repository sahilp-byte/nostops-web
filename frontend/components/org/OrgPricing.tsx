// Pricing & durations block for the three cohort pages (/for-organisations/*).
// Cohort-specific: each page shows only its own rate, plan table and estimator.
// Figures come from the shared lib/org/pricing source.
import type { CohortKey } from '@/lib/org/cohort-copy';
import { COHORT_RATES, PHASES, SESSIONS_PER_MONTH, SESSIONS_PER_WEEK, inrRate } from '@/lib/org/pricing';
import CohortPricing from '@/components/org/CohortPricing';

export default function OrgPricing({ cohort, audienceWord }: { cohort: CohortKey; audienceWord: string }) {
  const c = COHORT_RATES[cohort];
  return (
    <section className="bg-white" data-testid="org-pricing">
      <div className="container-x py-12 sm:py-16">
        <div className="max-w-2xl">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-accent-600">Pricing &amp; durations</span>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">Clear, per-participant pricing</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft" data-testid="org-pricing-intro">
            <span className="font-bold text-ink">{inrRate(c.rate)} per {c.person} per session</span>, {SESSIONS_PER_WEEK} sessions a week
            ({SESSIONS_PER_MONTH} a month), on-site at {audienceWord}. {c.note}
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PHASES.map((p) => (
            <div key={p.phase} className="rounded-2xl border border-line bg-cream/50 p-5">
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-ink-soft">{p.tag}</span>
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-brand-700">{p.phase}</p>
              <p className="mt-1 text-base font-extrabold text-ink">{p.title}</p>
              <p className="mt-1 text-sm text-ink-soft">{p.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <CohortPricing cohort={cohort} />
        </div>
      </div>
    </section>
  );
}
