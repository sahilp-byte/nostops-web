import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getAdminDashboard } from '@/lib/server/admin-dashboard';
import { inr } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Platform Reports', robots: { index: false, follow: false } };

function Bars({ data, tone = '#0D9488' }: { data: { label: string; value: number }[]; tone?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2" style={{ height: 96 }}>
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-bold tabular-nums text-ink-soft">{d.value}</span>
          <div className="w-full rounded-t" style={{ height: `${Math.max(4, Math.round((d.value / max) * 72))}px`, backgroundColor: tone + '33', borderTop: `3px solid ${tone}` }} />
          <span className="text-[10px] font-semibold text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default async function AdminReportsPage() {
  await requireAdminUser();
  const d = await getAdminDashboard();

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Money &amp; Growth</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Platform Reports</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Consolidated platform performance across growth, engagement and revenue. All figures are computed live by the
        backend metric engine.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black tabular-nums text-brand-700">₹{inr(d.financials.thisMonthRevenueInr)}</p><p className="text-xs font-semibold text-muted">Revenue · this month</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black tabular-nums text-ink">₹{inr(d.financials.pipelineValueInr)}</p><p className="text-xs font-semibold text-muted">Pipeline value</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black tabular-nums text-ink">{d.growth.signups30d}</p><p className="text-xs font-semibold text-muted">Signups · 30d</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black tabular-nums text-ink">{d.growth.growthPctMom}%</p><p className="text-xs font-semibold text-muted">MoM growth</p></div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-base font-extrabold text-ink">Signups · 6 months</h2>
          <div className="mt-4">{d.growth.signups6m.length > 0 ? <Bars data={d.growth.signups6m} tone="#8B5CF6" /> : <p className="text-sm text-muted">No data.</p>}</div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-base font-extrabold text-ink">Daily active users · 7 days</h2>
          <div className="mt-4">{d.growth.dau.length > 0 ? <Bars data={d.growth.dau} tone="#0D9488" /> : <p className="text-sm text-muted">No data.</p>}</div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total users', value: d.platform.totalUsers },
          { label: 'Teachers', value: d.platform.totalTeachers },
          { label: 'Empanelled', value: d.platform.empanelledTeachers },
          { label: 'Bookings', value: d.platform.totalBookings },
          { label: 'Active employees', value: d.platform.activeEmployees },
          { label: 'Cities', value: d.platform.citiesActive },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-white p-4"><p className="text-xl font-black tabular-nums text-ink">{s.value}</p><p className="text-xs font-semibold text-muted">{s.label}</p></div>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted">Downloadable exports are being finalised with the backend team and will appear here once the export contract is confirmed.</p>
    </div>
  );
}
