import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getCoverageHistory, getCoverageLocality } from '@/lib/server/spaces-coverage';
import { fmtDateTime } from '@/lib/format';
import { COVERAGE_META, isCoverageStatus } from '@/lib/coverage';
import { SpEmpty } from '@/components/spaces/ui';
import { CoverageBadge, CoverageError, CoverageHeader } from '@/components/app/admin/coverage/CoverageUI';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Coverage history', robots: { index: false, follow: false } };

const label = (s?: string | null) => (isCoverageStatus(s) ? COVERAGE_META[s].label : 'No record');
const ACTION: Record<string, string> = { coverage_created: 'Record created', status_changed: 'Status changed', note_added: 'Note added' };

// Phase 8B.2 Screen 4 — Coverage History (read-only; GET /api/spaces/coverage/locality/{lid}/history).
// Shows exactly what the backend recorded: the record's append-only history[] in chronological order,
// plus the insert-only audit log entries. Nothing is reconstructed here.
export default async function CoverageHistory({ params, searchParams }: { params: Promise<{ lid: string }>; searchParams: Promise<{ order?: string }> }) {
  await requireAdminUser();
  const { lid: raw } = await params;
  const { order } = await searchParams;
  const newest = order === 'newest';
  const lid = decodeURIComponent(raw).slice(0, 120);
  const [h, l] = await Promise.all([getCoverageHistory(lid), getCoverageLocality(lid)]);
  const name = (l.ok && l.data.reference?.locality) || lid;
  const detail = `/app/admin/spaces-localities/locality/${encodeURIComponent(lid)}`;
  const crumbs = [{ label: 'Manage localities', href: '/app/admin/spaces-localities/manage' }, { label: name, href: detail }, { label: 'History' }];

  // Backend returns newest first; chronological = oldest first.
  const entries = h.ok ? (newest ? h.data.history : [...h.data.history].reverse()) : [];
  const audit = h.ok ? (newest ? h.data.audit : [...h.data.audit].reverse()) : [];

  return (
    <div className="mx-auto max-w-5xl" data-testid="coverage-history-page">
      <CoverageHeader crumbs={crumbs} title={`Coverage history · ${name}`} subtitle={<span className="font-mono text-sm">{lid}</span>}
        aside={<Link href={detail} className="inline-flex min-h-[44px] items-center rounded-xl border border-[#F2B574] bg-white px-4 text-sm font-bold text-[#0F4C4A] hover:bg-[#FDE7CC]" data-testid="history-back">← Locality</Link>} />

      {!h.ok ? (!l.ok && l.status === 404
        ? <SpEmpty title="Locality not found" testId="locality-not-found">This identifier is not in the India Post directory and has no coverage record.</SpEmpty>
        : h.status === 404
        ? <SpEmpty title="No coverage history yet" testId="history-empty">This locality has no coverage record, so nothing has been recorded. Start tracking it from the locality page.</SpEmpty>
        : <CoverageError message={h.error} />) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[#3B4762]" data-testid="history-count">{entries.length} status {entries.length === 1 ? 'entry' : 'entries'} · read-only</p>
            <div className="flex gap-2" aria-label="Order">
              {[['', 'Oldest first'], ['newest', 'Newest first']].map(([v, lbl]) => (
                <Link key={v} href={v ? '?order=newest' : '?'} aria-current={(v === 'newest') === newest ? 'true' : undefined}
                  className={`inline-flex min-h-[40px] items-center rounded-full px-3 text-xs font-bold ${(v === 'newest') === newest ? 'bg-[#0F4C4A] text-white' : 'border border-[#D8CCBA] bg-white text-[#1C2A47]'}`} data-testid={`history-order-${v || 'oldest'}`}>{lbl}</Link>
              ))}
            </div>
          </div>
          <ol className="relative space-y-3 border-l-2 border-[#EEDFC8] pl-5" data-testid="history-list">
            {entries.map((e, i) => (
              <li key={`${e.at}-${i}`} className="sp-card relative p-4" data-testid={`history-entry-${i}`}>
                <span className="absolute -left-[29px] top-5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#F28A1E]" aria-hidden />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <CoverageBadge status={e.from} /><span aria-hidden className="text-[#6E6A63]">→</span><span className="sr-only">to</span><CoverageBadge status={e.to} />
                  <span className="ml-auto text-xs text-[#6E6A63]" data-testid={`history-at-${i}`}><time dateTime={e.at}>{fmtDateTime(e.at)}</time></span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#1C2A47]"><span className="font-semibold">Reason:</span> {e.reason}</p>
                <p className="mt-1 text-xs text-[#3B4762]">By <span className="font-semibold" data-testid={`history-by-${i}`}>{e.by_name}</span></p>
              </li>
            ))}
          </ol>

          <details className="sp-card mt-6 p-4" data-testid="history-audit">
            <summary className="cursor-pointer text-sm font-bold text-[#0F4C4A]">Audit log ({audit.length} entries)</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-[#FCF4E6] text-xs uppercase text-[#3B4762]"><tr><th className="p-2">When</th><th className="p-2">Action</th><th className="p-2">Change</th><th className="p-2">Administrator</th><th className="p-2">Reason</th></tr></thead>
                <tbody>{audit.map((a, i) => (
                  <tr key={i} className="border-t border-[#EEDFC8]">
                    <td className="p-2 text-xs">{fmtDateTime(a.at)}</td><td className="p-2">{ACTION[a.action] || a.action}</td>
                    <td className="p-2 text-xs">{a.to ? `${label(a.from)} → ${label(a.to)}` : '—'}</td>
                    <td className="p-2">{a.actor}{a.actor_role ? <span className="text-xs text-[#6E6A63]"> · {a.actor_role}</span> : null}</td>
                    <td className="p-2 text-xs">{a.reason || '—'}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
