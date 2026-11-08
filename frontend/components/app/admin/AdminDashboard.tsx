import Link from 'next/link';
import type { AdminDashboard } from '@/lib/server/admin-dashboard';
import { inr } from '@/lib/format';

// Presentational Admin Dashboard (PHASE 1). Every figure comes from the backend
// admin-stats payload (see lib/server/admin-dashboard.ts). No client JS needed.

function MiniBars({ data, tone = '#0D9488' }: { data: { label: string; value: number }[]; tone?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height: 64 }}>
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t"
            style={{ height: `${Math.max(4, Math.round((d.value / max) * 56))}px`, backgroundColor: tone + '33', borderTop: `3px solid ${tone}` }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="text-[9px] font-semibold text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, tone = 'text-ink' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className={`text-2xl font-black tabular-nums ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function AdminDashboard({ data, adminName }: { data: AdminDashboard; adminName: string }) {
  const ops = data.operations;
  const trendUp = data.growth.trend === 'up';

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Operations Console</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Welcome, {adminName}</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Live platform health and the operational queues that need your attention. Every figure is computed by the
            backend against the current database state.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
              data.systemHealth.status.toLowerCase() === 'operational' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" /> {data.systemHealth.status}
          </span>
          <span className="text-[11px] text-muted">
            {data.systemHealth.incidents24h} incidents · 24h{data.refresh.lastUpdatedAt ? ` · updated ${timeAgo(data.refresh.lastUpdatedAt)}` : ''}
          </span>
        </div>
      </div>

      {/* Operations Queue */}
      <h2 className="mt-8 text-sm font-bold uppercase tracking-wider text-muted">Operations Queue</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ops.queue.map((q) => {
          const body = (
            <>
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl text-lg" style={{ backgroundColor: q.color + '1a' }}>
                  {q.emoji}
                </span>
                <span className="text-3xl font-black tabular-nums" style={{ color: q.color }}>
                  {q.count}
                </span>
              </div>
              <p className="mt-3 text-sm font-bold text-ink">{q.label}</p>
              <p className="mt-0.5 text-xs font-semibold text-muted">{q.href ? 'Open queue →' : 'Rolling out shortly'}</p>
            </>
          );
          return q.href ? (
            <Link
              key={q.id}
              href={q.href}
              data-testid={`queue-card-${q.id}`}
              className="rounded-2xl border border-line bg-white p-5 transition hover:border-brand hover:shadow-sm"
            >
              {body}
            </Link>
          ) : (
            <div key={q.id} data-testid={`queue-card-${q.id}`} className="rounded-2xl border border-line bg-white p-5 opacity-90">
              {body}
            </div>
          );
        })}
      </div>

      {/* KYC operational KPIs */}
      <h2 className="mt-8 text-sm font-bold uppercase tracking-wider text-muted">Verification KPIs</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Pending KYC" value={ops.pendingKyc} tone={ops.pendingKyc > 0 ? 'text-accent-600' : 'text-ink'} />
        <Stat label="KYC approval rate" value={`${ops.kycApprovalRatePct}%`} tone="text-brand-700" />
        <Stat label="Avg processing" value={`${ops.avgKycProcessingHours}h`} />
        <Stat label="Empanelled teachers" value={data.platform.empanelledTeachers} tone="text-brand-700" />
      </div>

      {/* Platform snapshot */}
      <h2 className="mt-8 text-sm font-bold uppercase tracking-wider text-muted">Platform snapshot</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total users" value={data.platform.totalUsers} />
        <Stat label="Yoga teachers" value={data.platform.totalTeachers} />
        <Stat label="Active employees" value={data.platform.activeEmployees} />
        <Stat label="Total bookings" value={data.platform.totalBookings} />
        <Stat label="Active bookings" value={data.platform.activeBookings} tone="text-brand-700" />
        <Stat label="Cities active" value={data.platform.citiesActive} />
      </div>

      {/* Growth + Financials */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-ink">Growth</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {trendUp ? '▲' : '▼'} {data.growth.growthPctMom}% MoM
            </span>
          </div>
          <div className="mt-3 flex gap-6">
            <div>
              <p className="text-2xl font-black tabular-nums text-ink">{data.growth.signups7d}</p>
              <p className="text-xs font-semibold text-muted">Signups · 7 days</p>
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums text-ink">{data.growth.signups30d}</p>
              <p className="text-xs font-semibold text-muted">Signups · 30 days</p>
            </div>
          </div>
          {data.growth.signups6m.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Signups · 6 months</p>
              <MiniBars data={data.growth.signups6m} tone="#8B5CF6" />
            </div>
          )}
          {data.growth.dau.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Daily active users · 7 days</p>
              <MiniBars data={data.growth.dau} tone="#0D9488" />
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          <h3 className="text-base font-extrabold text-ink">Financials</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-cream p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">This month revenue</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-brand-700">₹{inr(data.financials.thisMonthRevenueInr)}</p>
            </div>
            <div className="rounded-xl bg-cream p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Pipeline value</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-ink">₹{inr(data.financials.pipelineValueInr)}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-6">
            <div>
              <p className="text-2xl font-black tabular-nums text-ink">{data.engagement.activeToday}</p>
              <p className="text-xs font-semibold text-muted">Active today</p>
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums text-ink">{data.engagement.activeNow}</p>
              <p className="text-xs font-semibold text-muted">Active right now</p>
            </div>
          </div>
        </div>
      </div>

      {data.refresh.note && <p className="mt-6 text-center text-xs text-muted">{data.refresh.note}</p>}
    </div>
  );
}
