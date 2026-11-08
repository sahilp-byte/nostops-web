// Shared vocabulary for the Organisation Enquiry ("Request a proposal") flow —
// the public form, the BFF validation and the admin pipeline all read these, so
// labels and allowed values can never drift. Must stay in sync with
// backend/org_enquiries.py (Literal enums there are the authoritative check).
import type { CohortKey } from '@/lib/org/cohort-copy';

export const ENQUIRY_REPLY_SLA = 'within 2 working days';

export const ENQ_COHORTS: { key: CohortKey; label: string; icon: string }[] = [
  { key: 'COMPANY', label: 'Company', icon: '🏢' },
  { key: 'EDUCATIONAL_INSTITUTION', label: 'Educational Institution', icon: '🎓' },
  { key: 'STARTUP_NETWORK', label: 'Startup & Networking Group', icon: '👥' },
];

export type InterestKey = 'MIND' | 'BODY' | 'SPECIAL_NEEDS';

// One-line definitions of the three Council programme pillars.
export const INTERESTS: { key: InterestKey; label: string; icon: string; desc: string }[] = [
  { key: 'MIND', label: 'Mind', icon: '🧠', desc: 'Breath, focus and meditation practices for calmer minds, clearer thinking and stress resilience.' },
  { key: 'BODY', label: 'Body', icon: '🧘', desc: 'Posture, mobility and strength practices that counter long hours of sitting and build physical well-being.' },
  { key: 'SPECIAL_NEEDS', label: 'Special Needs', icon: '🤝', desc: 'Gentle, accessible Yoga — seated, adaptable and calming practices so everyone can take part at their own pace.' },
];

// Group-size bands mirror the published pricing tiers (lib/org/pricing.ts:
// 15–28 and 29–40 participants). Smaller or larger groups get their own band.
export const PARTICIPANTS: { key: string; label: string }[] = [
  { key: 'UNDER_15', label: 'Fewer than 15' },
  { key: '15_28', label: '15–28' },
  { key: '29_40', label: '29–40' },
  { key: '41_PLUS', label: 'More than 40' },
];

// Display-only labels for enquiries submitted before the bands were aligned
// to the pricing tiers (never offered in the form any more).
export const PARTICIPANT_LABELS: { key: string; label: string }[] = [
  ...PARTICIPANTS,
  { key: 'UNDER_18', label: 'Under 18' },
  { key: '18_28', label: '18–28' },
  { key: '41_100', label: '41–100' },
  { key: '100_PLUS', label: '100+' },
];

export const DURATIONS: { key: string; label: string }[] = [
  { key: '1_MONTH', label: '1-month starter' },
  { key: '3_MONTHS', label: '3-month pilot' },
  { key: '6_MONTHS', label: '6 months' },
  { key: '12_MONTHS', label: '12 months' },
  { key: 'NOT_SURE', label: 'Not sure yet' },
];

export const START_PERIODS: { key: string; label: string }[] = [
  { key: 'THIS_MONTH', label: 'This month' },
  { key: 'NEXT_MONTH', label: 'Next month' },
  { key: 'IN_2_3_MONTHS', label: 'In 2–3 months' },
  { key: 'LATER', label: 'Later this year' },
  { key: 'NOT_SURE', label: 'Not sure yet' },
];

export const STAGES: { key: string; label: string; tone: string }[] = [
  { key: 'NEW', label: 'New', tone: 'bg-accent-50 text-accent-600' },
  { key: 'CONTACTED', label: 'Contacted', tone: 'bg-brand-50 text-brand-700' },
  { key: 'QUALIFIED', label: 'Qualified', tone: 'bg-brand-50 text-brand-700' },
  { key: 'PROPOSAL_SENT', label: 'Proposal sent', tone: 'bg-amber-50 text-amber-700' },
  { key: 'NEGOTIATION', label: 'Negotiation', tone: 'bg-amber-50 text-amber-700' },
  { key: 'WON', label: 'Won', tone: 'bg-emerald-50 text-emerald-700' },
  { key: 'LOST', label: 'Lost', tone: 'bg-cream text-ink-soft' },
];

export const labelOf = (list: { key: string; label: string }[], key?: string | null): string =>
  list.find((x) => x.key === key)?.label || key || '—';
