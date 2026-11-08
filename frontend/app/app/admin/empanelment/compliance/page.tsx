import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getComplianceReport, type ComplianceRow } from '@/lib/server/empanelment-policy';
import { MIN_AVG_RATING, MIN_GENUINE_REVIEWS, MIN_SUCCESSFUL_SESSIONS } from '@/lib/empanelment-policy';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Empanelment Compliance', robots: { index: false, follow: false } };

// READ-ONLY compliance view of already-empanelled teachers against Policy V2.
// Nothing on this page suspends, revokes, downgrades or re-empanels anyone, and
// legacy approvals are kept exactly as they are.
const CATEGORY: Record<string, { label: string; cls: string }> = {
  POLICY_V2: { label: 'Approved under Policy V2', cls: 'bg-emerald-100 text-emerald-900' },
  MEETS_CRITERIA: { label: 'Meets the new criteria', cls: 'bg-emerald-50 text-emerald-800' },
  INSUFFICIENT_EVIDENCE: { label: 'Insufficient evidence', cls: 'bg-amber-50 text-amber-800' },
  COUNCIL_REVIEW: { label: 'Needs individual Council review', cls: 'bg-rose-50 text-rose-800' },
};
const ORDER = ['COUNCIL_REVIEW', 'INSUFFICIENT_EVIDENCE', 'MEETS_CRITERIA', 'POLICY_V2'];
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'not recorded');

function Items({ r }: { r: ComplianceRow }) {
  const it = r.items || {};
  const s = it.successful_sessions;
  const g = it.genuine_reviews;
  const a = it.avg_rating;
  const m = it.majority_positive;
  if (!r.items) return null;
  return (
    <p className="mt-1 text-xs text-ink-soft">
      Sessions: {s?.value == null ? 'not available' : `${s.value} of ${MIN_SUCCESSFUL_SESSIONS}`} · Reviews: {g?.value ?? 0} of {MIN_GENUINE_REVIEWS}
      {s?.value == null ? ' (not checked against completed sessions)' : ''} · Average: {Number(a?.value ?? 0).toFixed(1)}★ of {MIN_AVG_RATING}★ · Positive: {m?.value ?? 0} of {m?.of ?? 0}
    </p>
  );
}

export default async function EmpanelmentCompliancePage() {
  const user = await requireAdminUser();
  const report = await getComplianceReport(user);
  const rows = (report?.rows || []).slice().sort((x, y) => ORDER.indexOf(x.category) - ORDER.indexOf(y.category));
  return (
    <div className="mx-auto max-w-4xl pb-24" data-testid="compliance-screen">
      <Link href="/app/admin/empanelment" className="text-xs font-bold text-brand-700">← Empanelment</Link>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Empanelment Compliance</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        How the teachers who are already empanelled compare with Empanelment Policy V2.
      </p>
      <p className="mt-3 rounded-xl border border-line bg-cream/60 px-4 py-3 text-sm text-ink-soft" data-testid="compliance-read-only">
        🔒 Read-only. Nothing here suspends, revokes, downgrades or re-empanels anyone. Legacy approvals stay exactly as they are;
        any follow-up is an individual Council decision.
      </p>
      {!report ? (
        <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700" role="alert">
          The compliance report could not be built right now. Please refresh in a moment.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="compliance-totals">
            {ORDER.map((k) => (
              <div key={k} className="rounded-2xl border border-line bg-white p-4">
                <p className="text-2xl font-black tabular-nums text-ink" data-testid={`compliance-total-${k}`}>{report.totals[k] || 0}</p>
                <p className="mt-0.5 text-xs font-semibold text-muted">{CATEGORY[k].label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            {rows.length} empanelled teachers. Per-teacher session records are not exposed to the website by the main backend, so
            no legacy teacher can be shown to meet every item yet.
          </p>
          <ul className="mt-4 space-y-3 p-0" data-testid="compliance-list">
            {rows.map((r) => (
              <li key={r.teacherId} className="rounded-2xl border border-line bg-white p-4" data-testid={`compliance-row-${r.teacherId}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-ink">{r.name}</p>
                    <p className="text-xs text-muted">
                      {[r.badge, r.approval === 'POLICY_V2' ? 'Policy V2 approval' : 'Legacy approval', `last empanelment change: ${fmtDate(r.lastEmpanelmentChange)}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${CATEGORY[r.category]?.cls || ''}`}>{CATEGORY[r.category]?.label || r.category}</span>
                </div>
                <Items r={r} />
                <p className="mt-1 text-xs text-muted">{r.note}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
