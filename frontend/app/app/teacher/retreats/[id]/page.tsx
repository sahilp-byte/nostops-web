import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole, displayName } from '@/lib/roles';
import { getHostedRetreat, getRetreatInvites, getRetreatCohort, getHostEligibility } from '@/lib/server/retreat-host';
import { getBindableVenues } from '@/lib/server/venues';
import { draftFromRetreat } from '@/lib/retreat-duplicate';
import DuplicateRetreatButton from '@/components/app/teacher/DuplicateRetreatButton';
import EditRetreatForm from '@/components/app/teacher/EditRetreatForm';
import RetreatShare from '@/components/app/teacher/RetreatShare';
import CohortManager from '@/components/app/teacher/CohortManager';
import InviteManager from '@/components/app/teacher/InviteManager';
import ReservationsManager from '@/components/app/teacher/ReservationsManager';
import RetreatEconomics from '@/components/app/teacher/RetreatEconomics';
import SettlementLedger from '@/components/app/teacher/SettlementLedger';
import MinimumCohort from '@/components/app/teacher/MinimumCohort';
import CapacityAlert from '@/components/app/teacher/CapacityAlert';
import RaiseCapacity from '@/components/app/teacher/RaiseCapacity';
import { capacityStatus } from '@/lib/capacity-alert';
import { parseRetreatContent } from '@/lib/retreat-content';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Manage Retreat', robots: { index: false, follow: false } };

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmt(d?: string): string {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || ''} ${m[1]}` : '';
}

export default async function ManageRetreatPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const elig = await getHostEligibility();
  if (normalizeRole(user.role) !== 'teacher' && !elig.eligible) redirect('/app');
  const canDecide = elig.hostType === 'council_guru' || normalizeRole(user.role) === 'admin';

  const { id } = await params;
  const bundle = await getHostedRetreat(id, (user.user_id as string) || null);
  if (!bundle) notFound();

  const { retreat: r, editLock, reservations, counts, revenue } = bundle;
  // Eligible listed venues for the edit picker — reuses the existing directory.
  const eligibleVenues = (await getBindableVenues({ limit: 100 }).catch(() => [])).map((v) => ({
    id: v.id, name: v.name, city: v.city ?? '', state: v.state ?? '', lat: v.lat ?? null, lng: v.lng ?? null,
    capacity: typeof v.capacity === 'number' && v.capacity > 0 ? v.capacity : null,
  }));
  const isPublic = ['published', 'filling', 'sold_out'].includes(r.status);

  // PROMPT 18 — invitation system: guest list + aggregate cohort funnel.
  const [invites, cohort] = await Promise.all([getRetreatInvites(id), getRetreatCohort(id)]);
  const activeRes = reservations.filter((res) => !['cancelled', 'expired'].includes(res.status));
  const phoneStages: Record<string, 'booked' | 'paid'> = {};
  for (const res of activeRes) {
    const key = (res.phone || '').replace(/\D/g, '').slice(-10);
    if (key.length < 10) continue;
    const stage: 'booked' | 'paid' = res.paidAt || res.status === 'paid' || res.status === 'confirmed' ? 'paid' : 'booked';
    if (phoneStages[key] !== 'paid') phoneStages[key] = stage;
  }
  const funnel = {
    invited: invites.filter((i) => i.status === 'invited' || i.invitedAt).length,
    booked: activeRes.length,
    paid: counts.paid,
    confirmed: cohort?.confirmedCount ?? 0,
    seatsTotal: cohort?.seatsTotal ?? r.seatsTotal,
  };
  const mcInfo = parseRetreatContent(r.description).minCohortInfo;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/app/teacher/retreats" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to retreats</Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-accent-600">{r.status.replace(/_/g, ' ')}</span>
          {r.theme && r.theme !== 'general' && <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-semibold text-ink-soft capitalize">{r.theme.replace(/-/g, ' ')}</span>}
        </div>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">{r.title}</h1>
        <p className="mt-1 text-ink-soft">
          {[fmt(r.startDate), fmt(r.endDate)].filter(Boolean).join(' – ') || 'Dates TBD'}
          {(r.venueName || r.venueCity) ? ` · ${[r.venueName, r.venueCity, r.state].filter(Boolean).join(', ')}` : ''}
        </p>
        <div className="mt-3"><DuplicateRetreatButton draft={draftFromRetreat(r)} title={r.title} /></div>
      </header>

      {/* Share */}
      <RetreatShare retreatId={id} title={r.title} isPublic={['published', 'filling', 'sold_out'].includes(r.status)} />

      {/* PROMPT 12/13 — teacher-led cohorts (private groups per retreat, self-serve links) */}
      <CohortManager
        retreatId={id}
        retreatTitle={r.title}
        via={displayName(user)}
        isPublic={['published', 'filling', 'sold_out'].includes(r.status)}
        members={reservations.filter((res) => res.cohort).map((res) => ({ cohort: res.cohort as string, name: res.name, status: res.status }))}
      />

      {/* PROMPT 18 — group booking invitation system + aggregate cohort funnel */}
      <InviteManager
        retreatId={id}
        retreatTitle={r.title}
        isPublic={isPublic}
        invites={invites}
        phoneStages={phoneStages}
        funnel={funnel}
      />

      {/* Capacity alert — warn when bookings approach the venue's operational limit */}
      {!['draft', 'completed', 'cancelled'].includes(r.status) && capacityStatus(r.seatsFilled, r.seatsTotal).alert && (
        <div className="space-y-2">
          <CapacityAlert status={capacityStatus(r.seatsFilled, r.seatsTotal)} />
          <RaiseCapacity retreatId={r.id} seatsTotal={r.seatsTotal} seatsFilled={r.seatsFilled} locked={editLock.locked} paidCount={editLock.paidCount} />
        </div>
      )}

      {/* Revenue + seats summary */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted">Seats</p><p className="mt-1 text-xl font-black text-ink">{r.seatsFilled}/{r.seatsTotal}</p><p className="text-xs text-muted">{r.seatsRemaining} left</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted">Paid</p><p className="mt-1 text-xl font-black text-emerald-700">{inr(revenue.paidInr)}</p><p className="text-xs text-muted">{counts.paid} confirmed</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted">Pending</p><p className="mt-1 text-xl font-black text-amber-700">{inr(revenue.pendingInr)}</p><p className="text-xs text-muted">{counts.reserved} reserved</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-muted">Price</p><p className="mt-1 text-xl font-black text-ink">{inr(r.priceInr)}</p><p className="text-xs text-muted">per seat</p></div>
      </section>

      {/* PROMPT 20 — Minimum Confirmed Cohort safeguard */}
      <MinimumCohort confirmedCount={cohort?.confirmedCount ?? 0} seatsTotal={cohort?.seatsTotal ?? r.seatsTotal} info={mcInfo} variant="host" />

      {/* PROMPT 22 — the host's private economic view */}
      <RetreatEconomics
        input={{
          priceInr: r.priceInr,
          venueCostPerSeatInr: r.venueCostPerSeatInr,
          platformFeePct: r.platformFeePct,
          seatsTotal: r.seatsTotal,
          seatsFilled: r.seatsFilled,
          paidInr: revenue.paidInr,
          pendingInr: revenue.pendingInr,
          cohortCount: activeRes.filter((res) => res.cohort).length,
        }}
      />

      {/* PROMPT 23 — auditable settlement ledger (participant → platform / venue / you) */}
      <SettlementLedger
        platformFeePct={r.platformFeePct}
        reservations={reservations.map((res) => ({
          id: res.id,
          name: res.name,
          status: res.status,
          groupSize: res.groupSize,
          perSeatInr: res.perSeatInr || r.priceInr,
          venueCostPerSeatInr: res.venueCostPerSeatInr || r.venueCostPerSeatInr,
          effectiveTotalInr: res.effectiveTotalInr,
          cohort: res.cohort,
          cohortVia: res.cohortVia,
          reservedAt: res.reservedAt,
          paidAt: res.paidAt,
          cancelledAt: res.cancelledAt,
        }))}
      />

      {/* PROMPT 19 — reservations, attribution audit trail & lifecycle actions */}
      <ReservationsManager retreatId={id} reservations={reservations} canDecide={canDecide} />

      {/* Edit */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Edit details</h2>
        <EditRetreatForm retreat={r} editLock={editLock} eligibleVenues={eligibleVenues} />
      </section>
    </div>
  );
}
