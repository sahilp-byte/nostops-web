import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getLeadershipDashboard } from '@/lib/server/admin-leadership';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Leadership', robots: { index: false, follow: false } };

const COLOR: Record<string, string> = { red: 'text-red-700', green: 'text-emerald-700', amber: 'text-amber-700', yellow: 'text-amber-700', gray: 'text-ink' };

export default async function AdminLeadershipPage() {
  await requireAdminUser();
  const d = await getLeadershipDashboard();

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Operations</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Leadership Dashboard</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Workplace wellness leadership signals — Wellbeing Energy Index (WEI), Burnout Risk Signal (BRS) and consistency —
        for {d.company}.
      </p>

      {d.autoInsight && (
        <div className="mt-6 rounded-2xl border border-brand/20 bg-brand-50/50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Auto insight</p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{d.autoInsight}</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Wellbeing Energy Index</p>
          <p className={`mt-1 text-4xl font-black tabular-nums ${COLOR[d.wei.color] || 'text-ink'}`}>{d.wei.score}</p>
          <p className="mt-1 text-xs font-semibold text-ink-soft">{d.wei.verdict} · {d.wei.delta >= 0 ? '▲' : '▼'} {Math.abs(d.wei.delta)} vs prev</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Burnout Risk Signal</p>
          <p className={`mt-1 text-4xl font-black tabular-nums ${COLOR[d.brs.color] || 'text-ink'}`}>{d.brs.raw}</p>
          <p className="mt-1 text-xs font-semibold text-ink-soft">{d.brs.label} (was {d.brs.previousLabel})</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Consistency</p>
          <p className="mt-1 text-4xl font-black tabular-nums text-ink">{d.cr.percentage}%</p>
          <p className="mt-1 text-xs font-semibold text-ink-soft">{d.cr.consistentUsers}/{d.cr.totalParticipants} consistent</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black tabular-nums text-ink">{d.totalEmployees}</p><p className="text-xs font-semibold text-muted">Employees</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black tabular-nums text-ink">{d.totalBookings}</p><p className="text-xs font-semibold text-muted">Bookings</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black tabular-nums text-ink">{d.percentile}th</p><p className="text-xs font-semibold text-muted">Percentile</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black tabular-nums capitalize text-ink">{d.wei.zone || '—'}</p><p className="text-xs font-semibold text-muted">WEI zone</p></div>
      </div>
    </div>
  );
}
