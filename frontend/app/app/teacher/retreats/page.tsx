import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { getMyHostedRetreats, type HostedRetreat } from '@/lib/server/retreat-host';
import DraftsLink from '@/components/app/teacher/DraftsLink';
import CapacityAlert from '@/components/app/teacher/CapacityAlert';
import { capacityStatus } from '@/lib/capacity-alert';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Host Retreats', robots: { index: false, follow: false } };

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(d?: string): string {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || ''} ${m[1]}`;
}
function fmtRange(s?: string, e?: string): string {
  const a = fmt(s); const b = fmt(e);
  return a && b ? (a === b ? a : `${a} – ${b}`) : a || b || 'Dates TBD';
}

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-cream text-muted' },
  published: { label: 'Published', cls: 'bg-brand-50 text-brand-700' },
  filling: { label: 'Filling fast', cls: 'bg-amber-50 text-amber-700' },
  sold_out: { label: 'Sold out', cls: 'bg-ink/10 text-ink-soft' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600' },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700' },
};

function RetreatCard({ r }: { r: HostedRetreat }) {
  const st = STATUS[r.status] || { label: r.status, cls: 'bg-cream text-muted' };
  const pct = r.seatsTotal > 0 ? Math.min(100, Math.round((r.seatsFilled / r.seatsTotal) * 100)) : 0;
  const cap = capacityStatus(r.seatsFilled, r.seatsTotal);
  const isLive = !['completed', 'cancelled', 'draft'].includes(r.status);
  const capBadge = isLive && cap.alert
    ? cap.level === 'over'
      ? { label: 'Over capacity', cls: 'bg-red-50 text-red-600' }
      : cap.level === 'full'
        ? { label: 'At capacity', cls: 'bg-amber-100 text-amber-900' }
        : { label: `${cap.seatsRemaining} left`, cls: 'bg-amber-50 text-amber-700' }
    : null;
  return (
    <Link href={`/app/teacher/retreats/${r.id}`} className="block rounded-2xl border border-line bg-white p-4 transition hover:border-brand hover:shadow-sm" data-testid="retreat-row">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold text-ink">{r.title}</p>
          <p className="mt-0.5 text-sm text-ink-soft">{fmtRange(r.startDate, r.endDate)}{(r.venueName || r.venueCity) ? ` · ${[r.venueName, r.venueCity].filter(Boolean).join(', ')}` : ''}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
          {capBadge && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${capBadge.cls}`} data-testid="capacity-badge">{capBadge.label}</span>}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream">
          <div className={`h-full rounded-full ${cap.level === 'over' ? 'bg-red-500' : cap.alert ? 'bg-amber-500' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-xs font-bold text-ink-soft">{r.seatsFilled}/{r.seatsTotal} seats</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted">{inr(r.priceInr)} / seat</span>
        <span className="font-bold text-brand-700">Manage →</span>
      </div>
    </Link>
  );
}

export default async function HostRetreatsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const { eligible, hostType, retreats } = await getMyHostedRetreats();

  if (!eligible && retreats.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to dashboard</Link>
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <span className="text-3xl">🏔️</span>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">Host your retreat</h1>
          <p className="mx-auto mt-2 max-w-md text-ink-soft">
            Create and host a retreat around your teaching, your students and an experience you believe in.
          </p>
          <p className="mx-auto mt-3 max-w-md rounded-xl bg-cream/70 px-4 py-3 text-sm text-ink-soft">
            Hosting opens up for <span className="font-bold text-ink">Level 2 (Yoga Pracharak)</span> and{' '}
            <span className="font-bold text-ink">Level 3 (Yoga Guru)</span> teachers and Council Gurus. As a{' '}
            <span className="font-bold text-ink">Level 1 (Yoga Shikshak)</span>, complete your empanelment to grow into it.
          </p>
          <Link href="/app/teacher/empanelment" className="mt-5 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">See your path to hosting →</Link>
        </div>
      </div>
    );
  }

  const active = retreats.filter((r) => !['completed', 'cancelled'].includes(r.status));
  const done = retreats.filter((r) => ['completed', 'cancelled'].includes(r.status));
  const capacityAlerts = active
    .filter((r) => r.status !== 'draft')
    .map((r) => ({ r, cap: capacityStatus(r.seatsFilled, r.seatsTotal) }))
    .filter((x) => x.cap.alert)
    .sort((a, b) => a.cap.seatsRemaining - b.cap.seatsRemaining);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to dashboard</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Your retreats</h1>
          <p className="mt-1 max-w-md text-ink-soft">
            Create and host a retreat around your teaching, your students and an experience you believe in.
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {retreats.length} {retreats.length === 1 ? 'retreat' : 'retreats'} hosted
            {hostType ? ` · ${hostType.replace(/_/g, ' ')}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DraftsLink />
          <Link href="/app/teacher/dashboard" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-cream" data-testid="group-dashboard-link">Group dashboard</Link>
          <Link href="/app/teacher/retreats/new" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600" data-testid="retreat-new-cta">+ Host a retreat</Link>
        </div>
      </div>

      {retreats.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <span className="text-3xl">🧘</span>
          <p className="mt-2 text-base font-extrabold text-ink">No retreats yet</p>
          <p className="mt-1 text-sm text-ink-soft">Create your first retreat listing and start filling seats.</p>
          <Link href="/app/teacher/retreats/new" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Host a retreat →</Link>
        </div>
      ) : (
        <>
          {capacityAlerts.length > 0 && (
            <section className="space-y-2" data-testid="capacity-alerts">
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-700">Needs your attention</h2>
              {capacityAlerts.map(({ r, cap }) => (
                <CapacityAlert key={r.id} status={cap} title={r.title} href={`/app/teacher/retreats/${r.id}`} />
              ))}
            </section>
          )}
          {active.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Live &amp; upcoming</h2>
              <div className="space-y-3">{active.map((r) => <RetreatCard key={r.id} r={r} />)}</div>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Completed &amp; cancelled</h2>
              <div className="space-y-3">{done.map((r) => <RetreatCard key={r.id} r={r} />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
