import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { listCoverage, searchLocalities } from '@/lib/server/spaces-coverage';
import { COVERAGE_META, COVERAGE_STATUSES, isCoverageStatus } from '@/lib/coverage';
import { SpEmpty } from '@/components/spaces/ui';
import { CoverageBadge, CoverageError, CoverageHeader } from '@/components/app/admin/coverage/CoverageUI';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Manage localities', robots: { index: false, follow: false } };

type SP = { view?: string; q?: string; pin?: string; state?: string; district?: string; status?: string; page?: string; sort?: string; dir?: string };
type Row = { locality_id: string; locality?: string; pin: string; district?: string; state?: string; status: string | null; stale?: boolean };
const SORTS = ['locality', 'locality_id', 'pin', 'district', 'state', 'status'] as const;
const PAGE = 25;
const PIN6 = /^[1-9][0-9]{5}$/;
const STATUS_ORDER: Record<string, number> = { NOT_STARTED: 1, ONBOARDING: 2, ACTIVE: 3, PAUSED: 4 };

function href(sp: SP, patch: Partial<SP>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) u.set(k, v);
  return `/app/admin/spaces-localities/manage?${u.toString()}`;
}

// Phase 8B.2 Screen 2 — Locality Management.
//  • "Tracked localities": records in spaces_locality_coverage via GET /api/spaces/coverage (server-side filters + pagination).
//  • "Search India Post directory": every official locality via GET /api/spaces/coverage/search (≤50 results), so localities
//    with no record yet (onboarding not started) can be found and opened.
export default async function ManageLocalities({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdminUser();
  const sp = await searchParams;
  const view = sp.view === 'directory' ? 'directory' : 'tracked';
  const q = (sp.q || '').trim().slice(0, 80);
  const pin = (sp.pin || '').trim();
  const state = (sp.state || '').trim().slice(0, 80);
  const district = (sp.district || '').trim().slice(0, 80);
  const status = isCoverageStatus(sp.status) || (view === 'directory' && sp.status === 'NO_RECORD') ? sp.status! : '';
  const page = Math.max(1, Math.min(10000, parseInt(sp.page || '1', 10) || 1));
  const sort = (SORTS as readonly string[]).includes(sp.sort || '') ? sp.sort! : 'pin';
  const dir = sp.dir === 'desc' ? 'desc' : 'asc';
  const pinBad = !!pin && !PIN6.test(pin);

  let rows: Row[] = [];
  let total = 0;
  let error = '';
  let note = '';
  let needQuery = false;
  if (pinBad) error = 'Enter a valid 6-digit Indian PIN code.';
  else if (view === 'tracked') {
    const r = await listCoverage({ pin: pin || (PIN6.test(q) ? q : undefined), q: PIN6.test(q) ? undefined : q || undefined, state, district, status: status || undefined, page, page_size: PAGE });
    if (!r.ok) error = r.error;
    else {
      total = r.data.total;
      rows = r.data.items.map((i) => ({ locality_id: i.locality_id, locality: i.locality, pin: i.pin, district: i.district, state: i.state, status: i.coverage_status, stale: i.reference_status === 'stale' }));
    }
  } else {
    const term = pin || q;
    if (!term || (!PIN6.test(term) && term.length < 3)) needQuery = true;
    else {
      const r = await searchLocalities({ q: term, state, district, limit: 50 });
      if (!r.ok) error = r.error;
      else {
        let all: Row[] = r.data.pins.flatMap((g) => g.localities.map((l) => ({ locality_id: l.locality_id, locality: l.locality, pin: l.pin, district: l.district, state: l.state, status: l.coverage_status })));
        if (pin && q) all = all.filter((x) => (x.locality || '').toLowerCase().startsWith(q.toLowerCase()));
        if (status) all = all.filter((x) => (status === 'NO_RECORD' ? !x.status : x.status === status));
        total = all.length;
        rows = all;
        if (r.data.truncated) note = 'Showing the first 50 directory matches. Add a PIN, state or district, or a longer name, to narrow the search.';
      }
    }
  }

  const key = (x: Row): string | number => (sort === 'status' ? STATUS_ORDER[x.status || ''] || 0 : String((x as any)[sort] || '').toLowerCase());
  rows = [...rows].sort((a, b) => { const ka = key(a), kb = key(b); return (ka < kb ? -1 : ka > kb ? 1 : 0) * (dir === 'asc' ? 1 : -1); });
  if (view === 'directory') rows = rows.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const th = (k: (typeof SORTS)[number], label: string) => (
    <th className="p-3" aria-sort={sort === k ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <Link href={href(sp, { sort: k, dir: sort === k && dir === 'asc' ? 'desc' : 'asc', page: '' })} className="inline-flex items-center gap-1 hover:text-[#E8690C]" data-testid={`sort-${k}`}>
        {label}<span aria-hidden className="text-[10px]">{sort === k ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </Link>
    </th>
  );
  const input = 'min-h-[44px] w-full rounded-xl border border-[#D8CCBA] bg-white px-3 text-sm text-[#1C2A47] placeholder:text-[#8A8378] focus:border-[#F28A1E] focus:outline-none focus:ring-2 focus:ring-[#FDE2C2]';

  return (
    <div className="mx-auto max-w-6xl" data-testid="coverage-manage-page">
      <CoverageHeader tab="manage" crumbs={[{ label: 'Manage localities' }]} title="Manage localities" subtitle="Find a locality by name, PIN, district or state, then open it to review or change its coverage status." />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Which localities" data-testid="coverage-view-toggle">
        {[['tracked', 'Tracked localities'], ['directory', 'Search India Post directory']].map(([v, l]) => (
          <Link key={v} role="tab" aria-selected={view === v} href={href({ q: sp.q, pin: sp.pin, state: sp.state, district: sp.district }, { view: v === 'tracked' ? '' : v })}
            className={`inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-bold ${view === v ? 'bg-[#0F4C4A] text-white' : 'border border-[#D8CCBA] bg-white text-[#1C2A47]'}`} data-testid={`view-${v}`}>{l}</Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-[#6E6A63]">
        {view === 'tracked' ? 'Localities that already have a coverage record.' : 'Every official India Post locality, including those with no coverage record yet (onboarding not started).'}
      </p>

      <form className="sp-card mt-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" data-testid="coverage-filters">
        {view === 'directory' && <input type="hidden" name="view" value="directory" />}
        <label className="lg:col-span-2"><span className="mb-1 block text-xs font-semibold text-[#3B4762]">Locality name starts with{view === 'directory' ? ' (min 3 letters)' : ''}</span>
          <input name="q" defaultValue={q} placeholder="e.g. Baroda House" className={input} data-testid="filter-q" /></label>
        <label><span className="mb-1 block text-xs font-semibold text-[#3B4762]">PIN code</span>
          <input name="pin" defaultValue={pin} inputMode="numeric" maxLength={6} placeholder="6 digits" className={input} data-testid="filter-pin" /></label>
        <label><span className="mb-1 block text-xs font-semibold text-[#3B4762]">District</span>
          <input name="district" defaultValue={district} placeholder="Exact name" className={input} data-testid="filter-district" /></label>
        <label><span className="mb-1 block text-xs font-semibold text-[#3B4762]">State / UT</span>
          <input name="state" defaultValue={state} placeholder="Exact name" className={input} data-testid="filter-state" /></label>
        <label><span className="mb-1 block text-xs font-semibold text-[#3B4762]">Coverage status</span>
          <select name="status" defaultValue={status} className={input} data-testid="filter-status">
            <option value="">Any status</option>
            {COVERAGE_STATUSES.map((s) => <option key={s} value={s}>{COVERAGE_META[s].label}</option>)}
            {view === 'directory' && <option value="NO_RECORD">No record</option>}
          </select></label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-6">
          <button className="min-h-[44px] rounded-xl bg-[#F28A1E] px-5 text-sm font-bold text-white hover:bg-[#E8690C]" data-testid="filter-submit">Apply filters</button>
          <Link href={href({}, { view: view === 'directory' ? 'directory' : '' })} className="inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold text-[#0F4C4A]" data-testid="filter-clear">Clear</Link>
          <span className="text-xs text-[#6E6A63]">District and state must match the India Post spelling, e.g. &quot;Central Delhi&quot;, &quot;Delhi&quot;.</span>
        </div>
      </form>

      <div className="mt-4" aria-live="polite">
        {error ? <CoverageError message={error} /> : needQuery ? (
          <SpEmpty title="Search the directory" testId="coverage-need-query">Enter a 6-digit PIN code or at least 3 letters of a locality name to search all official India Post localities.</SpEmpty>
        ) : rows.length === 0 ? (
          <SpEmpty title={view === 'tracked' ? 'No tracked localities match' : 'No localities match'} testId="coverage-empty"
            action={view === 'tracked' ? <Link href={href({ q: sp.q, pin: sp.pin, state: sp.state, district: sp.district }, { view: 'directory' })} className="inline-flex min-h-[44px] items-center rounded-xl bg-[#0F4C4A] px-4 text-sm font-bold text-white" data-testid="coverage-empty-directory">Search the India Post directory</Link> : undefined}>
            {view === 'tracked' ? 'No locality with these filters has a coverage record yet. Search the directory to find a locality and start tracking it.' : 'Try a different PIN code, name, district or state.'}
          </SpEmpty>
        ) : (
          <>
            <p className="mb-2 text-sm text-[#3B4762]" data-testid="coverage-result-count">{total.toLocaleString('en-IN')} {total === 1 ? 'locality' : 'localities'}{view === 'tracked' && pages > 1 ? ' · sorting applies to this page' : ''}</p>
            {note && <p className="mb-2 text-xs text-[#7A2E05]" data-testid="coverage-truncated">{note}</p>}
            <div className="sp-card relative overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm" data-testid="coverage-table">
                <thead className="bg-[#FCF4E6] text-xs uppercase tracking-wide text-[#3B4762]">
                  <tr>{th('locality', 'Locality')}{th('locality_id', 'Locality ID')}{th('pin', 'PIN')}{th('district', 'District')}{th('state', 'State / UT')}{th('status', 'Status')}<th className="p-3"><span className="sr-only">Action</span></th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.locality_id} className="border-t border-[#EEDFC8] hover:bg-[#FFFAF2]" data-testid={`coverage-row-${r.locality_id}`}>
                      <td className="p-3 font-semibold text-[#1C2A47]">{r.locality || '—'}{r.stale && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">Not in current dataset</span>}</td>
                      <td className="p-3 font-mono text-xs text-[#6E6A63]">{r.locality_id}</td>
                      <td className="p-3 tabular-nums">{r.pin}</td>
                      <td className="p-3">{r.district || '—'}</td>
                      <td className="p-3">{r.state || '—'}</td>
                      <td className="p-3"><CoverageBadge status={r.status} /></td>
                      <td className="p-3 text-right">
                        <Link href={`/app/admin/spaces-localities/locality/${encodeURIComponent(r.locality_id)}`} className="inline-flex min-h-[40px] items-center rounded-lg border border-[#F2B574] px-3 text-xs font-bold text-[#0F4C4A] hover:bg-[#FDE7CC]" data-testid={`coverage-open-${r.locality_id}`}>
                          {r.status ? 'Manage' : 'Open'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <nav className="mt-3 flex items-center justify-between gap-2" aria-label="Pagination" data-testid="coverage-pagination">
                {page > 1 ? <Link href={href(sp, { page: String(page - 1) })} className="inline-flex min-h-[44px] items-center rounded-xl border border-[#D8CCBA] bg-white px-4 text-sm font-semibold" data-testid="page-prev">← Previous</Link> : <span />}
                <span className="text-sm text-[#3B4762]" data-testid="page-indicator">Page {page} of {pages}</span>
                {page < pages ? <Link href={href(sp, { page: String(page + 1) })} className="inline-flex min-h-[44px] items-center rounded-xl border border-[#D8CCBA] bg-white px-4 text-sm font-semibold" data-testid="page-next">Next →</Link> : <span />}
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
