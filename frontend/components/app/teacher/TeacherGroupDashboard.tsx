import Link from 'next/link';
import { inr } from '@/lib/format';
import { fmtRange } from '@/lib/server/retreats';
import type { GroupDashboard, DashRetreat } from '@/lib/server/teacher-dashboard';

function Stat({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'brand' | 'accent' }) {
  const border = tone === 'brand' ? 'border-brand/20 bg-brand-50/50' : tone === 'accent' ? 'border-accent/30 bg-accent/5' : 'border-line bg-white';
  const val = tone === 'brand' ? 'text-brand-700' : tone === 'accent' ? 'text-accent-600' : 'text-ink';
  return (
    <div className={`rounded-2xl border p-5 ${border}`}>
      <p className="text-[11px] font-black uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-black ${val}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

function statusChip(status: string) {
  const map: Record<string, string> = {
    published: 'bg-brand-50 text-brand-700',
    filling: 'bg-amber-50 text-amber-700',
    sold_out: 'bg-ink/10 text-ink-soft',
    completed: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-red-50 text-red-600',
  };
  return map[status] || 'bg-cream text-muted';
}

function RetreatRow({ r }: { r: DashRetreat }) {
  const pct = r.seatsTotal > 0 ? Math.min(100, Math.round((r.seatsFilled / r.seatsTotal) * 100)) : 0;
  return (
    <Link href={`/app/teacher/retreats/${r.id}`} className="block rounded-2xl border border-line bg-white p-4 transition hover:border-brand hover:shadow-sm" data-testid="dash-retreat-row">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-black text-ink">{r.title}</p>
          <p className="mt-0.5 text-xs text-muted">{fmtRange(r.startDate, r.endDate)}{(r.venueName || r.venueCity) ? ` · ${[r.venueName, r.venueCity].filter(Boolean).join(', ')}` : ''}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${statusChip(r.status)}`}>{r.status.replace(/_/g, ' ')}</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
        <span className="shrink-0 text-[11px] font-bold text-ink-soft">{r.seatsFilled}/{r.seatsTotal}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
        <span className="text-muted">Confirmed <span className="font-black text-ink">{r.confirmed}</span></span>
        <span className="text-muted">Pending <span className="font-black text-ink">{r.pending}</span></span>
        <span className="text-muted">Cohort <span className="font-black text-ink">{r.cohortConfirmed}</span></span>
        <span className="text-muted">Early <span className="font-black text-ink">{r.earlySignups}</span></span>
        <span className="text-muted">Earnings <span className="font-black text-brand-700">₹{inr(r.teacherEarnings)}</span></span>
        <span className="text-muted">Venue cost <span className="font-black text-ink">₹{inr(r.venueCost)}</span></span>
        <span className="col-span-2 text-muted">Est. profit (full) <span className="font-black text-accent-600">₹{inr(r.projectedProfit)}</span></span>
      </div>
    </Link>
  );
}

export default function TeacherGroupDashboard({ data, hostName }: { data: GroupDashboard; hostName: string }) {
  const t = data.totals;
  const hasData = data.retreats.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8" data-testid="teacher-group-dashboard">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/app/teacher/retreats" className="text-sm font-bold text-brand-700 hover:underline">‹ Your retreats</Link>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">Group dashboard</h1>
          <p className="mt-1 max-w-xl text-ink-soft">Cohorts, invitations, bookings and your private economics across all your retreats, {hostName.split(' ')[0]}.</p>
        </div>
        <Link href="/app/teacher/retreats/new" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600">+ Host a retreat</Link>
      </header>

      {!hasData ? (
        <div className="rounded-2xl border border-line bg-white p-10 text-center">
          <span className="text-3xl">🧘</span>
          <p className="mt-2 text-base font-extrabold text-ink">No live retreats yet</p>
          <p className="mt-1 text-sm text-ink-soft">Once you publish a retreat and seats start booking, your cohorts, invitations and earnings roll up here.</p>
          <Link href="/app/teacher/retreats/new" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Host a retreat →</Link>
        </div>
      ) : (
        <>
          {/* Bookings + profit headline */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Confirmed bookings" value={String(t.bookingsConfirmed)} sub={`${data.activeCount} live retreat${data.activeCount === 1 ? '' : 's'}`} tone="brand" />
            <Stat label="Pending bookings" value={String(t.bookingsPending)} sub="Reserved, awaiting payment" />
            <Stat label="Cohort seats" value={String(t.cohortSeats)} sub={`${t.cohortsCount} cohort${t.cohortsCount === 1 ? '' : 's'} running`} />
            <Stat label="Est. profit (full house)" value={`₹${inr(t.estimatedProfitFullHouse)}`} sub="Your net if every seat fills" tone="accent" />
          </section>

          {/* Private economics */}
          <section className="rounded-2xl border border-brand/20 bg-brand-50/40 p-6" data-testid="dash-economics">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-ink">Your economics</h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-brand-700">🔒 Private</span>
            </div>
            <p className="mt-1 text-xs text-muted">Collected so far across your retreats. Seekers only ever see the seat price — never these numbers.</p>
            <dl className="mt-4 grid gap-y-2 text-sm">
              <div className="flex items-center justify-between"><dt className="text-ink-soft">Participant revenue collected</dt><dd className="font-black text-ink">₹{inr(t.participantRevenueCollected)}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-ink-soft">− NOSTOPS platform fee</dt><dd className="font-semibold text-muted">−₹{inr(t.platformFeeCollected)}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-ink-soft">− Venue costs</dt><dd className="font-semibold text-muted">−₹{inr(t.venueCostsCollected)}</dd></div>
              <div className="mt-1 flex items-center justify-between border-t border-brand/20 pt-2"><dt className="font-black text-ink">= Your earnings (collected)</dt><dd className="text-lg font-black text-brand-700">₹{inr(t.teacherEarningsCollected)}</dd></div>
            </dl>
          </section>

          {/* Cohort + invitations + conversion */}
          <section>
            <h2 className="text-xl font-black tracking-tight text-ink">Cohorts, invitations & conversion</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="People invited" value={String(t.invitationsInvited + t.invitationsAccepted)} sub={`${t.invitationsAdded} added, not yet invited`} />
              <Stat label="Joined from invites" value={String(t.invitationsAccepted)} sub="Accepted & booked" tone="brand" />
              <Stat label="Cohort conversion" value={t.cohortConversionPct === null ? '—' : `${t.cohortConversionPct}%`} sub="Invited → booked" />
              <Stat label="Early signups" value={String(t.earlySignups)} sub="Booked 30+ days ahead" tone="accent" />
            </div>
            <div className="mt-4 rounded-2xl border border-line bg-cream/50 p-4 text-sm text-ink-soft" data-testid="teacher-cohort-benefit">
              <p className="font-black text-ink">Your cohort benefit</p>
              <p className="mt-1">Your students who book as a cohort fill seats early and predictably — {t.cohortSeats} cohort seat{t.cohortSeats === 1 ? '' : 's'} so far. Early, group-led demand protects your minimum cohort and grows your net without discounting to strangers.</p>
            </div>
          </section>

          {/* Per-retreat breakdown */}
          <section>
            <h2 className="text-xl font-black tracking-tight text-ink">My retreats</h2>
            <p className="mt-1 text-sm text-muted">{data.retreatsTotal} hosted{data.hostType ? ` · ${data.hostType.replace(/_/g, ' ')}` : ''}</p>
            <div className="mt-4 space-y-3">
              {data.retreats.map((r) => <RetreatRow key={r.id} r={r} />)}
            </div>
          </section>

          <p className="rounded-xl bg-cream/60 px-4 py-3 text-xs text-muted">🔒 This dashboard is private to you. Your earnings, venue costs and profit are never shown to participants or venue owners.</p>
        </>
      )}
    </div>
  );
}
