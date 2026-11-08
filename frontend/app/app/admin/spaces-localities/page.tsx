import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getLocalityMeta } from '@/lib/server/spaces-localities';
import { getCoverageSummary } from '@/lib/server/spaces-coverage';
import { COVERAGE_META, COVERAGE_STATUSES } from '@/lib/coverage';
import { fmtDateTime } from '@/lib/format';
import { SpStat, SpSection } from '@/components/spaces/ui';
import { CoverageHeader, CoverageError } from '@/components/app/admin/coverage/CoverageUI';
import PinLookupTester from '@/components/spaces/PinLookupTester';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Spaces Localities', robots: { index: false, follow: false } };

const n = (v: number | undefined | null) => (typeof v === 'number' ? v.toLocaleString('en-IN') : '—');

// Phase 8B.2 Screen 1 — Locality Coverage Overview. Every figure comes from the backend:
// geography totals from /api/spaces/localities/meta, coverage counts from /api/spaces/coverage/summary.
export default async function SpacesLocalitiesOverview() {
  await requireAdminUser();
  const [m, s] = await Promise.all([getLocalityMeta(), getCoverageSummary()]);
  const sum = s.ok ? s.data : null;
  const total = m?.localities ?? 0;
  const untracked = sum && total ? Math.max(total - sum.total_records, 0) : null;
  const pct = (x: number) => (total ? (x / total) * 100 : 0);
  const active = sum?.by_status.ACTIVE ?? 0;

  return (
    <div className="mx-auto max-w-6xl" data-testid="spaces-localities-page">
      <CoverageHeader tab="overview" title="Locality coverage" subtitle="Where NOSTOPS Spaces is active across India. Each India Post locality has its own coverage status; only Active localities count as covered."
        aside={<Link href="/app/admin/spaces-localities/manage" className="inline-flex min-h-[44px] items-center rounded-xl bg-[#F28A1E] px-4 text-sm font-bold text-white hover:bg-[#E8690C]" data-testid="coverage-go-manage">Manage localities</Link>} />

      {!m || !m.ready ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="localities-not-ready">
          {m?.error ? `The dataset failed to load: ${m.error}` : 'The locality dataset is still loading. Refresh in a minute.'}
        </p>
      ) : null}

      <h2 className="text-lg">India Post reference data</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="localities-stats">
        <SpStat icon="pin" value={n(m?.localities)} label="Localities" testId="stat-localities" />
        <SpStat icon="tag" value={n(m?.pins)} label="PIN codes" testId="stat-pins" />
        <SpStat icon="layers" value="—" label="Districts · not provided by the current API" tone="lavender" testId="stat-districts" />
        <SpStat icon="building" value={n(m?.states)} label="States / UTs" testId="stat-states" />
      </div>
      {m?.version ? (
        <p className="mt-2 text-xs text-[#6E6A63]" data-testid="localities-source">
          Source: {m.source} · version {m.version}{m.loaded_at ? ` · loaded ${fmtDateTime(m.loaded_at)}` : ''}
        </p>
      ) : null}

      <h2 className="mt-8 text-lg">Coverage status</h2>
      {!sum ? <div className="mt-3"><CoverageError message={s.ok ? '' : s.error} testId="coverage-summary-error" /></div> : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="coverage-status-cards">
            {COVERAGE_STATUSES.map((k) => (
              <Link key={k} href={`/app/admin/spaces-localities/manage?status=${k}`} className="sp-card block p-4 transition hover:border-[#F2B574]" data-testid={`status-card-${k}`}>
                <span className="flex items-center gap-2 text-sm font-bold text-[#1C2A47]"><span className={`h-2.5 w-2.5 rounded-full ${COVERAGE_META[k].dot}`} aria-hidden />{COVERAGE_META[k].label}</span>
                <span className="mt-2 block text-[28px] font-bold leading-none text-[#1C2A47] tabular-nums" data-testid={`status-count-${k}`}>{n(sum.by_status[k])}</span>
                <span className="mt-1 block text-xs text-[#6E6A63]">{COVERAGE_META[k].hint}</span>
              </Link>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#6E6A63]" data-testid="coverage-untracked">
            {n(sum.total_records)} {sum.total_records === 1 ? 'locality has' : 'localities have'} a coverage record. {untracked !== null ? `${n(untracked)} have no record yet (shown as "No record" — onboarding not started).` : ''}
          </p>

          <SpSection title="Activation progress" icon="chart" className="mt-6" testId="coverage-progress">
            <p className="text-[15px] text-[#1C2A47]"><span className="text-[28px] font-bold tabular-nums" data-testid="coverage-active-count">{n(active)}</span> of {n(total)} localities are Active
              <span className="ml-2 font-semibold text-[#16632C]" data-testid="coverage-active-pct">({pct(active).toFixed(active && pct(active) < 0.01 ? 4 : 2)}%)</span></p>
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-[#F1ECE3]" role="img" aria-label={`${n(active)} of ${n(total)} localities active`}>
              {COVERAGE_STATUSES.map((k) => sum.by_status[k] ? <span key={k} className={`${COVERAGE_META[k].bar} h-full min-w-[3px]`} style={{ width: `${pct(sum.by_status[k])}%` }} /> : null)}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#3B4762]">
              {COVERAGE_STATUSES.map((k) => <li key={k} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${COVERAGE_META[k].dot}`} aria-hidden />{COVERAGE_META[k].label} {n(sum.by_status[k])}</li>)}
              <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#F1ECE3] ring-1 ring-[#D8CCBA]" aria-hidden />No record {n(untracked)}</li>
            </ul>
          </SpSection>

          <h2 className="mt-8 text-lg">Platform totals (unique, live)</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="coverage-platform-totals">
            <SpStat icon="home" value={n(sum.platform_totals.spaces.approved)} label="Approved Spaces" testId="total-spaces" />
            <SpStat icon="handshake" value={n(sum.platform_totals.partners)} label="Active Community Partners" tone="green" testId="total-partners" />
            <SpStat icon="users" value={n(sum.platform_totals.teachers.verified_eligible)} label="Verified teachers with confirmed localities" tone="lavender" testId="total-teachers" />
          </div>
        </>
      )}

      <details className="sp-card mt-8 p-5" data-testid="pin-lookup-details">
        <summary className="cursor-pointer text-[15px] font-bold text-[#0F4C4A]">Try the PIN lookup</summary>
        <p className="mt-2 text-sm text-[#3B4762]">This is the same picker Space owners use when they list a Space.</p>
        <div className="mt-4"><PinLookupTester /></div>
      </details>
    </div>
  );
}
