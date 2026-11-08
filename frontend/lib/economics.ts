// PROMPT 22 & 23 — retreat economics + per-transaction settlement math.
// All figures are derived from backend-authoritative numbers (revenue aggregate
// + per-reservation price / venue cost + platform fee %). We NEVER invent money
// movement; we only project it into role-scoped, auditable views.

export type RetreatEconomicsInput = {
  priceInr: number;
  venueCostPerSeatInr: number;
  platformFeePct: number;
  seatsTotal: number;
  seatsFilled: number;
  paidInr: number; // backend revenue.paid_inr (collected)
  pendingInr: number; // backend revenue.pending_inr (reserved, not yet paid)
  cohortCount: number; // active cohort-attributed bookings
};

export type TeacherEconomics = {
  participantRevenueCollected: number;
  participantRevenuePending: number;
  platformFeeCollected: number;
  venueCostCollected: number;
  teacherEarningsCollected: number;
  cohortCount: number;
  projectedFullHouseGross: number;
  projectedFullHouseTeacherNet: number;
};

const r0 = (n: number) => Math.max(0, Math.round(n));

export function computeTeacherEconomics(i: RetreatEconomicsInput): TeacherEconomics {
  const platformFeeCollected = r0((i.paidInr * (i.platformFeePct || 0)) / 100);
  const venueCostCollected = r0(i.venueCostPerSeatInr * i.seatsFilled);
  const teacherEarningsCollected = r0(i.paidInr - platformFeeCollected - venueCostCollected);

  const fullGross = r0(i.priceInr * i.seatsTotal);
  const fullPlatform = r0((fullGross * (i.platformFeePct || 0)) / 100);
  const fullVenue = r0(i.venueCostPerSeatInr * i.seatsTotal);
  const projectedFullHouseTeacherNet = r0(fullGross - fullPlatform - fullVenue);

  return {
    participantRevenueCollected: r0(i.paidInr),
    participantRevenuePending: r0(i.pendingInr),
    platformFeeCollected,
    venueCostCollected,
    teacherEarningsCollected,
    cohortCount: i.cohortCount,
    projectedFullHouseGross: fullGross,
    projectedFullHouseTeacherNet,
  };
}

// ---- Per-transaction settlement line (PROMPT 23) ----
export type SettlementReservation = {
  id: string;
  name: string;
  status: string;
  groupSize: number;
  perSeatInr: number;
  venueCostPerSeatInr: number;
  effectiveTotalInr: number;
  cohort?: string;
  cohortVia?: string;
  reservedAt?: string;
  paidAt?: string;
  cancelledAt?: string;
};

export type LedgerLine = {
  id: string;
  name: string;
  seats: number;
  status: string;
  settled: boolean; // money actually collected (paid, not cancelled)
  refunded: boolean; // was paid then cancelled
  participantInr: number;
  platformFeeInr: number;
  venueInr: number;
  teacherNetInr: number;
  cohort?: string;
  cohortVia?: string;
  reservedAt?: string;
  paidAt?: string;
  cancelledAt?: string;
};

export function ledgerLine(res: SettlementReservation, platformFeePct: number): LedgerLine {
  const seats = res.groupSize > 0 ? res.groupSize : 1;
  const participantInr = res.effectiveTotalInr > 0 ? r0(res.effectiveTotalInr) : r0(res.perSeatInr * seats);
  const platformFeeInr = r0((participantInr * (platformFeePct || 0)) / 100);
  const venueInr = r0(res.venueCostPerSeatInr * seats);
  const teacherNetInr = r0(participantInr - platformFeeInr - venueInr);
  const isPaid = res.status === 'paid' || res.status === 'confirmed' || !!res.paidAt;
  const isCancelled = res.status === 'cancelled' || res.status === 'expired' || !!res.cancelledAt;
  return {
    id: res.id,
    name: res.name,
    seats,
    status: res.status,
    settled: isPaid && !isCancelled,
    refunded: !!res.paidAt && isCancelled,
    participantInr,
    platformFeeInr,
    venueInr,
    teacherNetInr,
    cohort: res.cohort,
    cohortVia: res.cohortVia,
    reservedAt: res.reservedAt,
    paidAt: res.paidAt,
    cancelledAt: res.cancelledAt,
  };
}

export type LedgerTotals = {
  participantInr: number;
  platformFeeInr: number;
  venueInr: number;
  teacherNetInr: number;
  refundedInr: number;
};

// Totals reconcile only over SETTLED (money-collected) lines; refunds are
// reported separately so the ledger balances against what was actually moved.
export function ledgerTotals(lines: LedgerLine[]): LedgerTotals {
  const t: LedgerTotals = { participantInr: 0, platformFeeInr: 0, venueInr: 0, teacherNetInr: 0, refundedInr: 0 };
  for (const l of lines) {
    if (l.settled) {
      t.participantInr += l.participantInr;
      t.platformFeeInr += l.platformFeeInr;
      t.venueInr += l.venueInr;
      t.teacherNetInr += l.teacherNetInr;
    } else if (l.refunded) {
      t.refundedInr += l.participantInr;
    }
  }
  return t;
}
