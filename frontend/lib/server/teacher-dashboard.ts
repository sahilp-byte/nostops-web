// PROMPT 35 — Teacher Group Dashboard data layer (server-only, private).
// Rolls up the teacher's own retreats into one operational view: cohorts,
// invitations, confirmed/pending bookings, cohort conversion, early signups,
// and PRIVATE economics (earnings, venue costs, estimated profit). Every number
// is derived from backend-authoritative endpoints already used elsewhere; no
// money movement is invented. This is authed + noindex — nothing here is public.
import { getMyHostedRetreats, getHostedRetreat, getRetreatCohort, getRetreatInvites } from '@/lib/server/retreat-host';
import { computeTeacherEconomics } from '@/lib/economics';

const EARLY_DAYS = 30; // a booking made ≥30 days before start counts as an "early signup"

function daysBefore(startISO?: string, whenISO?: string): number | null {
  if (!startISO || !whenISO) return null;
  const s = Date.parse(startISO);
  const w = Date.parse(whenISO);
  if (Number.isNaN(s) || Number.isNaN(w)) return null;
  return Math.round((s - w) / 86_400_000);
}

export type DashRetreat = {
  id: string;
  title: string;
  status: string;
  startDate?: string;
  endDate?: string;
  venueName?: string;
  venueCity?: string;
  seatsTotal: number;
  seatsFilled: number;
  seatsRemaining: number;
  priceInr: number;
  confirmed: number;
  pending: number;
  cohortConfirmed: number;
  cohortSeatsTotal: number;
  invitedPeople: number;
  earlySignups: number;
  teacherEarnings: number;
  venueCost: number;
  projectedProfit: number;
  hasCohort: boolean;
};

export type GroupDashboard = {
  eligible: boolean;
  hostType: string | null;
  retreatsTotal: number;
  activeCount: number;
  retreats: DashRetreat[];
  totals: {
    cohortsCount: number;
    invitationsAdded: number;
    invitationsInvited: number;
    invitationsAccepted: number;
    bookingsConfirmed: number;
    bookingsPending: number;
    cohortConfirmed: number;
    cohortSeats: number;
    cohortConversionPct: number | null;
    earlySignups: number;
    participantRevenueCollected: number;
    platformFeeCollected: number;
    teacherEarningsCollected: number;
    venueCostsCollected: number;
    estimatedProfitFullHouse: number;
  };
};

export async function getTeacherGroupDashboard(): Promise<GroupDashboard> {
  const { eligible, hostType, retreats } = await getMyHostedRetreats();

  // Pull live detail for non-draft retreats (drafts have no bookings/economics),
  // newest first, capped so a prolific host never fans out unbounded requests.
  const selected = retreats
    .filter((r) => r.status !== 'draft')
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
    .slice(0, 15);

  const rows = await Promise.all(
    selected.map(async (r) => {
      const [bundle, cohort, invites] = await Promise.all([
        getHostedRetreat(r.id),
        getRetreatCohort(r.id),
        getRetreatInvites(r.id),
      ]);

      const detail = bundle?.retreat;
      const priceInr = detail?.priceInr ?? r.priceInr;
      const venueCostPerSeatInr = detail?.venueCostPerSeatInr ?? 0;
      const platformFeePct = detail?.platformFeePct ?? r.platformFeePct;
      const seatsTotal = detail?.seatsTotal ?? r.seatsTotal;
      const seatsFilled = detail?.seatsFilled ?? r.seatsFilled;
      const confirmed = bundle?.counts.paid ?? 0;
      const pending = bundle?.counts.reserved ?? 0;
      const paidInr = bundle?.revenue.paidInr ?? 0;
      const pendingInr = bundle?.revenue.pendingInr ?? 0;
      const cohortConfirmed = cohort?.confirmedCount ?? 0;

      // Early signups: non-cancelled reservations reserved ≥ EARLY_DAYS before start.
      const earlySignups = (bundle?.reservations || []).reduce((acc, res) => {
        if (res.status === 'cancelled' || res.status === 'expired') return acc;
        const d = daysBefore(detail?.startDate || r.startDate, res.reservedAt);
        return acc + (d !== null && d >= EARLY_DAYS ? (res.groupSize > 0 ? res.groupSize : 1) : 0);
      }, 0);

      const invitedPeople = invites.filter((i) => i.status === 'invited' || i.status === 'accepted' || i.status === 'booked').length;

      const econ = computeTeacherEconomics({
        priceInr,
        venueCostPerSeatInr,
        platformFeePct,
        seatsTotal,
        seatsFilled,
        paidInr,
        pendingInr,
        cohortCount: cohortConfirmed,
      });

      const row: DashRetreat = {
        id: r.id,
        title: r.title,
        status: r.status,
        startDate: r.startDate,
        endDate: r.endDate,
        venueName: r.venueName,
        venueCity: r.venueCity,
        seatsTotal,
        seatsFilled,
        seatsRemaining: Math.max(0, seatsTotal - seatsFilled),
        priceInr,
        confirmed,
        pending,
        cohortConfirmed,
        cohortSeatsTotal: cohort?.seatsTotal ?? seatsTotal,
        invitedPeople,
        earlySignups,
        teacherEarnings: econ.teacherEarningsCollected,
        venueCost: econ.venueCostCollected,
        projectedProfit: econ.projectedFullHouseTeacherNet,
        hasCohort: cohortConfirmed > 0 || invites.length > 0,
      };

      const inviteBreak = {
        added: invites.filter((i) => i.status === 'added').length,
        invited: invites.filter((i) => i.status === 'invited').length,
        accepted: invites.filter((i) => i.status === 'accepted' || i.status === 'booked').length,
      };

      return { row, econ, inviteBreak };
    }),
  );

  const t = {
    cohortsCount: 0,
    invitationsAdded: 0,
    invitationsInvited: 0,
    invitationsAccepted: 0,
    bookingsConfirmed: 0,
    bookingsPending: 0,
    cohortConfirmed: 0,
    cohortSeats: 0,
    cohortConversionPct: null as number | null,
    earlySignups: 0,
    participantRevenueCollected: 0,
    platformFeeCollected: 0,
    teacherEarningsCollected: 0,
    venueCostsCollected: 0,
    estimatedProfitFullHouse: 0,
  };
  for (const { row, econ, inviteBreak } of rows) {
    if (row.hasCohort) t.cohortsCount += 1;
    t.invitationsAdded += inviteBreak.added;
    t.invitationsInvited += inviteBreak.invited;
    t.invitationsAccepted += inviteBreak.accepted;
    t.bookingsConfirmed += row.confirmed;
    t.bookingsPending += row.pending;
    t.cohortConfirmed += row.cohortConfirmed;
    t.cohortSeats += row.cohortConfirmed;
    t.earlySignups += row.earlySignups;
    t.participantRevenueCollected += econ.participantRevenueCollected;
    t.platformFeeCollected += econ.platformFeeCollected;
    t.teacherEarningsCollected += econ.teacherEarningsCollected;
    t.venueCostsCollected += econ.venueCostCollected;
    t.estimatedProfitFullHouse += econ.projectedFullHouseTeacherNet;
  }
  const invitedTotal = t.invitationsInvited + t.invitationsAccepted;
  t.cohortConversionPct = invitedTotal > 0 ? Math.round((t.invitationsAccepted / invitedTotal) * 100) : null;

  return {
    eligible,
    hostType,
    retreatsTotal: retreats.length,
    activeCount: retreats.filter((r) => !['completed', 'cancelled', 'draft'].includes(r.status)).length,
    retreats: rows.map((x) => x.row),
    totals: t,
  };
}
