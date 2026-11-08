// Organisation pricing — the single source for the cohort pricing block
// (OrgPricing / CohortPricing), the cohort FAQs (lib/org/cohort-copy), the
// sliding estimator, the event wizard's suggested fee and the admin proposal emails.
// Model: a LIST RATE per participant, per session · 2 sessions a week (8 a month).
//
// Prompt 3C (founder option A): the 15–28 and 29–40 participant discounts were never approved,
// so they are SUSPENDED everywhere. Every figure is the list rate (₹300 / ₹175) for any group
// size and length, and the two bands are shown only with UNAPPROVED_LABEL. Canonical rule:
// backend/pricing_rules.py RATE_CARD["discounts_suspended"] (backend/tests/test_p3c_pricing_rules.py).
import type { CohortKey } from '@/lib/org/cohort-copy';

export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
// Shows paise only when the amount has them.
export const inrRate = (n: number) =>
  `₹${n.toLocaleString('en-IN', Number.isInteger(n) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const SESSIONS_PER_WEEK = 2;
export const SESSIONS_PER_MONTH = 8;
export const MONTH_STEPS = [1, 3, 6, 12] as const;
export type Months = (typeof MONTH_STEPS)[number];
export const ESTIMATOR_RANGE = { min: 5, max: 100 };

// Word for word the backend's pricing_rules.UNAPPROVED_BANNER.
export const UNAPPROVED_LABEL = 'UNAPPROVED — NOT A CONFIRMED PRICE — BOOKING UNAVAILABLE.';

export type CohortRate = { rate: number; person: string; people: string; note: string; unapprovedBands: boolean };

export const COHORT_RATES: Record<CohortKey, CohortRate> = {
  EDUCATIONAL_INSTITUTION: {
    rate: 175,
    person: 'student or faculty member',
    people: 'students & faculty',
    note: 'An exclusive campus rate for students and faculty only. It is a flat rate (already our lowest), so no further discounts apply.',
    unapprovedBands: false,
  },
  COMPANY: {
    rate: 300,
    person: 'employee',
    people: 'employees',
    note: 'The list rate applies to every group size and programme length.',
    unapprovedBands: true,
  },
  STARTUP_NETWORK: {
    rate: 300,
    person: 'member',
    people: 'members',
    note: 'The list rate applies to every group size and programme length.',
    unapprovedBands: true,
  },
};

// The participant bands the suspended discounts were written for (companies and startup /
// networking groups). They change no price and are shown only next to UNAPPROVED_LABEL; the
// unapproved percentages are kept, for the record only, in backend/pricing_rules.py.
export const UNAPPROVED_BANDS = [
  { tier: 'Tier 1', min: 15, max: 28 },
  { tier: 'Tier 2', min: 29, max: 40 },
] as const;
export const UNAPPROVED_BANDS_TEXT = `Group-size discounts for ${UNAPPROVED_BANDS.map((b) => `${b.min}–${b.max}`).join(' and ')} participants: ${UNAPPROVED_LABEL}`;

// One pricing story, shared word for word by the cohort pages and proposals.
export const FEE_STORY =
  'When you create a programme, you set the fee each participant pays per session (the event wizard suggests the list rate), and each participant pays it online when they register.';

/** List-rate estimate: rate × sessions (× participants for the total). No discount applies. */
export function estimate(cohort: CohortKey, months: Months, participants: number) {
  const rate = COHORT_RATES[cohort].rate;
  const sessions = SESSIONS_PER_MONTH * months;
  const perPerson = rate * sessions;
  return { sessions, rate, perPerson, perPersonMonthly: perPerson / months, total: perPerson * participants };
}

// Teacher revenue share — ONLY eligible 3-, 6- and 12-month institutional programmes
// (backend/pricing_rules.py CONTRACT_REVENUE_SHARE). No other length or product carries it.
export const TEACHER_SHARE_SCOPE = 'Only on eligible 3-, 6- and 12-month institutional programmes. No share is published for any other programme length.';
// The approved wording for teacher pages and FAQs (founder decision, Prompt 3C round 2). It never
// promises a payout amount and never applies to retreats, one-to-one sessions or other work.
export const TEACHER_SHARE_SENTENCE = 'For eligible institutional programmes, teachers receive 70% for 3-month engagements, 80% for 6-month engagements, and 85% for 12-month engagements, subject to the applicable programme terms.';
export const TEACHER_SHARE_OTHER_WORK = 'Retreats, one-to-one sessions and other work have their own terms.';
export const REVENUE = [
  { term: '3-month institutional programme', teacher: 70, note: 'Prove the fit' },
  { term: '6-month institutional programme', teacher: 80, note: 'Deepen the practice' },
  { term: '12-month institutional programme', teacher: 85, note: 'Longest commitment' },
];

export const PHASES = [
  { phase: 'Starter · 1 month', title: 'First Month', desc: `${SESSIONS_PER_WEEK} sessions/week · ${SESSIONS_PER_MONTH} sessions · 30–60 min each`, tag: 'Begin' },
  { phase: 'Phase I · 3 months', title: 'Structured Pilot', desc: `${SESSIONS_PER_WEEK} sessions/week · ${SESSIONS_PER_MONTH * 3} sessions · 30–60 min each`, tag: 'Prove the fit' },
  { phase: 'Phase II · 6 months', title: 'Wellness Engagement', desc: `${SESSIONS_PER_WEEK} sessions/week · ${SESSIONS_PER_MONTH * 6} sessions · build a steady habit`, tag: 'Deepen' },
  { phase: 'Phase III · 12 months', title: 'Culture Partnership', desc: `${SESSIONS_PER_WEEK} sessions/week · ${SESSIONS_PER_MONTH * 12} sessions · year-round practice`, tag: 'Embed' },
];
