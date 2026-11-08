import Link from 'next/link';
import type { User } from '@/lib/roles';
import { displayName } from '@/lib/roles';
import { getOrgOverview, getOrgBookings, type OrgBooking } from '@/lib/server/org';
import BatchShare from '@/components/app/org/BatchShare';
import { ROI_CALCULATOR_ENABLED } from '@/lib/org/roi';

const STATUS: Record<string, { label: string; cls: string }> = {
  inviting: { label: 'Inviting', cls: 'bg-brand-50 text-brand-700' },
  confirmed: { label: 'Confirmed', cls: 'bg-blue-50 text-blue-600' },
  active: { label: 'Active', cls: 'bg-brand-50 text-brand-700' },
  completed: { label: 'Completed', cls: 'bg-cream text-muted' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600' },
  draft: { label: 'Draft', cls: 'bg-amber-50 text-amber-700' },
};

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-2xl font-black text-ink">{value}</p>
      <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

function BatchRow({ b }: { b: OrgBooking }) {
  const st = STATUS[b.status] || { label: b.status, cls: 'bg-cream text-muted' };
  const pct = b.capacity > 0 ? Math.min((b.registered / b.capacity) * 100, 100) : 0;
  return (
    <article className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-ink">{b.companyName}</p>
          <p className="truncate text-xs text-muted">{b.courseTitle}{b.venueCity ? ` · ${b.venueCity}` : ''}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{b.registered}/{b.capacity} enrolled</span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-cream">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {b.inviteToken && b.status === 'inviting' && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <BatchShare token={b.inviteToken} companyName={b.companyName} venue={b.venue} capacity={b.capacity} compact />
          <a href={`/booking-invite/${b.inviteToken}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-700 hover:underline">Preview invite →</a>
        </div>
      )}
      <Link href={`/app/org/bookings/${b.id}`} className="mt-3 block text-xs font-bold text-brand-700 hover:underline">Manage batch &amp; participants →</Link>
    </article>
  );
}

export default async function OrgHome({ user }: { user: User }) {
  const [ov, bookings] = await Promise.all([getOrgOverview(), getOrgBookings()]);
  const name = displayName(user);
  const active = bookings.filter((b) => b.status === 'inviting' || b.status === 'confirmed' || b.status === 'active');
  const shown = (active.length ? active : bookings).slice(0, 8);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-700">Organisation · Command Center</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-ink sm:text-3xl">Welcome, {name} 🏢</h1>
          <p className="mt-1 text-sm text-muted">Yoga · One Team · Three Cohorts</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ROI_CALCULATOR_ENABLED && (
            <Link href="/app/org/roi" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">ROI calculator</Link>
          )}
          <Link href="/app/org/events/new" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">✨ Create a Programme</Link>
        </div>
      </div>

      {/* Create a Programme — institutional Event Creator */}
      <Link href="/app/org/events/new" className="flex items-center gap-3 rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/10 to-cream p-4 transition hover:border-brand">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/10 text-xl">✨</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-ink">Create a Council-curated Programme</span>
          <span className="block text-xs text-muted">Pick a Mind / Body / Special Needs programme, configure your event and publish — in minutes.</span>
        </span>
        <span aria-hidden="true" className="text-brand-700">→</span>
      </Link>

      {/* KPIs */}
      {ov && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Active pilots" value={String(ov.activePilots)} />
          <Kpi label="Sessions planned" value={String(ov.sessionsPlanned)} />
          <Kpi label="Enrolled" value={ov.totalRegistered.toLocaleString('en-IN')} />
          <Kpi label="Engagement" value={`${Math.round(ov.engagementRate)}%`} />
        </div>
      )}

      {/* ROI teaser (hidden until the ROI figures are agreed) */}
      {ROI_CALCULATOR_ENABLED && (
        <Link href="/app/org/roi" className="flex items-center gap-3 rounded-2xl border border-brand/20 bg-brand-50/40 p-4 transition hover:border-brand">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/10 text-xl">📈</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold text-ink">See your wellness ROI</span>
            <span className="block text-xs text-muted">Estimate investment, program structure and impact for your team size.</span>
          </span>
          <span aria-hidden="true" className="text-brand-700">→</span>
        </Link>
      )}

      {/* Batches */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold tracking-tight text-ink">Your batches</h2>
          {ov && <span className="text-sm text-muted">{ov.totalBookings} total</span>}
        </div>
        {shown.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white p-8 text-center">
            <span className="text-3xl">🧘</span>
            <p className="mt-2 text-base font-extrabold text-ink">No batches yet</p>
            <p className="mt-1 text-sm text-ink-soft">New programmes are created from a Council-curated Mind, Body or Special Needs programme.</p>
            <Link href="/app/org/events/new" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600" data-testid="orghome-create-programme">Create a Programme →</Link>
          </div>
        ) : (
          <div className="space-y-3">{shown.map((b) => <BatchRow key={b.id} b={b} />)}</div>
        )}
      </section>
    </div>
  );
}
