'use client';

// Sliding cost estimator for one cohort page: duration (1 / 3 / 6 / 12 months)
// × participants (5–100). Prompt 3C: the list rate applies at every size and
// length (the group-size discounts are suspended). Every figure comes from
// lib/org/pricing, and the formula is shown in full so the price is never a black box.
import { useState } from 'react';
import type { CohortKey } from '@/lib/org/cohort-copy';
import { COHORT_RATES, ESTIMATOR_RANGE, FEE_STORY, MONTH_STEPS, SESSIONS_PER_WEEK, estimate, inr, inrRate } from '@/lib/org/pricing';
import UnapprovedBands from '@/components/org/UnapprovedBands';

const monthsLabel = (m: number) => `${m} month${m === 1 ? '' : 's'}`;

export default function PricingEstimator({ cohort }: { cohort: CohortKey }) {
  const c = COHORT_RATES[cohort];
  const [step, setStep] = useState(1); // index into MONTH_STEPS → 3 months
  const [people, setPeople] = useState(20);
  const months = MONTH_STEPS[step];
  const e = estimate(cohort, months, people);

  return (
    <div className="rounded-2xl bg-brand p-6 text-white" data-testid="org-estimator">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-white">Estimate your programme</p>
        {!c.unapprovedBands && (
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold" data-testid="est-exclusive">
            🎓 Exclusive · students &amp; faculty only
          </span>
        )}
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <label htmlFor={`est-duration-${cohort}`} className="text-sm font-semibold text-white/85">Duration</label>
          <span className="text-sm font-black" data-testid="est-duration-value">{monthsLabel(months)}</span>
        </div>
        <input
          id={`est-duration-${cohort}`}
          type="range"
          min={0}
          max={MONTH_STEPS.length - 1}
          step={1}
          value={step}
          onChange={(ev) => setStep(Number(ev.target.value))}
          aria-valuetext={monthsLabel(months)}
          className="mt-2 w-full accent-white"
          data-testid="est-duration"
        />
        <div className="mt-1 flex justify-between text-[11px] font-bold">
          {MONTH_STEPS.map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => setStep(i)}
              className={`py-1 ${i === step ? 'text-white' : 'text-white/60 hover:text-white'}`}
              data-testid={`est-duration-${m}`}
            >
              {m} mo
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <label htmlFor={`est-people-${cohort}`} className="text-sm font-semibold text-white/85">Participants</label>
          <span className="text-sm font-black" data-testid="est-participants-value">{people} {c.people}</span>
        </div>
        <input
          id={`est-people-${cohort}`}
          type="range"
          min={ESTIMATOR_RANGE.min}
          max={ESTIMATOR_RANGE.max}
          step={1}
          value={people}
          onChange={(ev) => setPeople(Number(ev.target.value))}
          aria-valuetext={`${people} participants`}
          className="mt-2 w-full accent-white"
          data-testid="est-participants"
        />
        <div className="mt-1 flex justify-between text-[11px] font-bold text-white/60">
          <span>{ESTIMATOR_RANGE.min}</span>
          <span>{ESTIMATOR_RANGE.max}</span>
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-white/10 p-4">
        <p className="text-xs font-semibold text-white/80">Estimated total at the list rate · {people} {c.people} · {monthsLabel(months)}</p>
        <p className="mt-1 text-4xl font-black tracking-tight" data-testid="est-total">{inr(e.total)}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div><p className="text-lg font-black" data-testid="est-per-person">{inr(e.perPerson)}</p><p className="text-xs text-white/80">/person total</p></div>
          <div><p className="text-lg font-black">{inr(e.perPersonMonthly)}</p><p className="text-xs text-white/80">/person/mo</p></div>
          <div><p className="text-lg font-black" data-testid="est-rate">{inrRate(e.rate)}</p><p className="text-xs text-white/80">/person/session</p></div>
        </div>
        <p className="mt-3 text-xs text-white/85" data-testid="est-formula">
          {inrRate(c.rate)} × {e.sessions} sessions ({SESSIONS_PER_WEEK} a week) × {people} participants = {inr(e.total)}
        </p>
      </div>

      {c.unapprovedBands && <UnapprovedBands tone="dark" />}
      <p className="mt-3 text-xs text-white/80" data-testid="est-fee-story">
        An estimate at the NOSTOPS list rate, not a quote or a booking. {FEE_STORY}
      </p>
      <a href="#enquire" className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-white px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-cream" data-testid="org-pricing-cta">
        Request a proposal →
      </a>
    </div>
  );
}
