// PROMPT 17 — Group booking economics & a single, explicit PRICING HIERARCHY.
// Prompt 3C (founder option B): the listed price (the main backend's per-seat price) is the price.
// Early-bird, limited-time and teacher-cohort offers read from a retreat's description are
// unverified, so they are never offered, applied or turned into a saving.
// Prompt 3C (founder decision, group tiers): the 5 / 10 / 15% group tiers are UNAPPROVED reference
// tiers. No group price, saving or payable total is ever worked out from them. A group rate is a
// candidate only when an authoritative, verified pricing rule for that retreat supplies it
// (`verifiedGroupPerSeatInr`); no such rule exists today, so no caller passes one.
// Pure functions.

export type BenefitKey = 'standard' | 'group';

export type GroupTier = { min_seats: number; discount_pct: number };

export type ResolveInput = {
  standardInr: number;
  groupSize?: number;
  minGroupSize?: number;
  verifiedGroupPerSeatInr?: number; // from a verified per-retreat rule only (none exists today)
};

export type Candidate = { key: BenefitKey; label: string; perSeatInr: number; eligible: boolean; detail?: string };

export type ResolvedPricing = {
  applied: BenefitKey;
  appliedLabel: string;
  perSeatInr: number;
  standardInr: number;
  discountPerSeatInr: number;
  groupSize: number;
  totalInr: number;
  candidates: Candidate[];
  note: string;
};

const LABELS: Record<BenefitKey, string> = {
  standard: 'Listed price',
  group: 'Group',
};

export function resolveBooking(input: ResolveInput): ResolvedPricing {
  const standard = Math.max(0, Math.round(input.standardInr || 0));
  const groupSize = Math.max(1, Math.floor(input.groupSize || 1));
  const minGroup = input.minGroupSize ?? 5;

  const verified = typeof input.verifiedGroupPerSeatInr === 'number' && input.verifiedGroupPerSeatInr > 0;
  const candidates: Candidate[] = [{ key: 'standard', label: LABELS.standard, perSeatInr: standard, eligible: true }];
  if (verified) {
    const groupPerSeat = Math.round(input.verifiedGroupPerSeatInr as number);
    candidates.push({
      key: 'group', label: LABELS.group, perSeatInr: groupPerSeat,
      eligible: groupSize >= minGroup && groupPerSeat < standard,
      detail: groupSize >= minGroup ? `${groupSize} seats` : `from ${minGroup} seats`,
    });
  }

  const group = candidates[1];
  const winner = group && group.eligible ? group : candidates[0];
  const perSeat = winner.perSeatInr;
  const note = winner.key === 'standard' ? 'Listed price — no group rate applies.' : `${winner.label} applied.`;

  return {
    applied: winner.key,
    appliedLabel: winner.label,
    perSeatInr: perSeat,
    standardInr: standard,
    discountPerSeatInr: Math.max(0, standard - perSeat),
    groupSize,
    totalInr: perSeat * groupSize,
    candidates,
    note,
  };
}

// Default retreat group tiers (backend seeds the same 5/10/15% ladder). UNAPPROVED reference
// tiers: displayed only through components/retreats/GroupTiersReference.tsx, never priced.
export const DEFAULT_GROUP_TIERS: GroupTier[] = [
  { min_seats: 5, discount_pct: 5 },
  { min_seats: 10, discount_pct: 10 },
  { min_seats: 20, discount_pct: 15 },
];
export const DEFAULT_MIN_GROUP = 5;

// ─── InstaKYC teacher verification fee — SINGLE SOURCE OF TRUTH ───────────────
// One-time fee a teacher pays to run InstaKYC (Aadhaar + PAN + bank) and unlock
// their earning tools. This is the ALL-IN amount CHARGED via Cashfree (GST
// inclusive): the payment order AND every teacher-facing display derive from it,
// so this ONE value governs the entire InstaKYC pricing lifecycle. Repricing
// InstaKYC = editing this constant only. Historical orders keep their own stored
// amount (the backend records each order's amount); this governs NEW orders only.
export const INSTAKYC_PRICE_INR = 279; // ₹279 total, incl. 18% GST — sent to the gateway as-is (rupees)
export const INSTAKYC_GST_PCT = 18;
// GST-inclusive split for the paywall (base + GST = total), exact to the paisa — Prompt 3 rule R3
// (backend/pricing_rules.py, checked by backend/tests/test_p3_pricing_parity.py): base = total ÷ 1.18
// to the nearest paisa, GST = the rest. ₹279 = ₹236.44 + ₹42.56 (the total is unchanged).
const INSTAKYC_PRICE_PAISE = INSTAKYC_PRICE_INR * 100;
const INSTAKYC_BASE_PAISE = Math.round((INSTAKYC_PRICE_PAISE * 100) / (100 + INSTAKYC_GST_PCT));
export const INSTAKYC_BASE_INR = INSTAKYC_BASE_PAISE / 100;
export const INSTAKYC_GST_INR = (INSTAKYC_PRICE_PAISE - INSTAKYC_BASE_PAISE) / 100;
// Canonical "₹279" label (en-IN grouping, no space) — the platform currency style. Paise are shown
// only when the amount has them (₹236.44).
export const instaKycPriceLabel = (n: number = INSTAKYC_PRICE_INR): string =>
  `₹${n.toLocaleString('en-IN', Number.isInteger(n) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
