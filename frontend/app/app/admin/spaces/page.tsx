import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getAdminSpaces } from '@/lib/server/spaces';
import { SPACE_MODELS, SPACE_STATUS } from '@/lib/spaces';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Spaces Verification', robots: { index: false, follow: false } };

const TABS = ['submitted', 'changes_requested', 'approved', 'unlisted', 'rejected', 'draft', 'all'];

// S5 — Admin Spaces verification queue (Phase 3).
export default async function AdminSpacesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminUser();
  const { status: raw } = await searchParams;
  const status = TABS.includes(raw || '') ? (raw as string) : 'submitted';
  const data = await getAdminSpaces(status);

  return (
    <div className="mx-auto max-w-5xl" data-testid="admin-spaces-page">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · NOSTOPS Spaces</p>
      <h1 className="mt-1 text-[36px] leading-tight">Spaces verification</h1>
      <p className="mt-2 text-ink-soft">Check each Space&apos;s details and private documents, optionally record a site visit, then approve, reject or ask for changes.</p>

      <div className="mt-5 flex flex-wrap gap-2" data-testid="admin-spaces-tabs">
        {TABS.map((t) => (
          <Link key={t} href={`/app/admin/spaces?status=${t}`} className={`inline-flex min-h-[40px] items-center rounded-full px-4 py-2 text-xs font-bold leading-none ${t === status ? 'bg-brand text-white' : 'border border-line bg-white text-ink'}`} data-testid={`admin-spaces-tab-${t}`}>
            {t === 'all' ? 'All' : SPACE_STATUS[t].label}{t !== 'all' && data ? ` (${data.counts[t] ?? 0})` : ''}
          </Link>
        ))}
      </div>

      {!data ? (
        <p className="mt-6 rounded-2xl border border-line bg-white p-6 text-sm text-ink-soft">The queue couldn&apos;t be loaded. Please try again.</p>
      ) : data.items.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-ink-soft" data-testid="admin-spaces-empty">Nothing here right now.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm" data-testid="admin-spaces-table">
            <thead className="bg-cream text-xs uppercase tracking-wider text-muted">
              <tr><th className="p-3">Space</th><th className="p-3">Locality</th><th className="p-3">Model</th><th className="p-3">Owner</th><th className="p-3">Status</th><th className="p-3">Submitted</th></tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id} className="border-t border-line" data-testid="admin-space-row">
                  <td className="p-3 font-bold"><Link href={`/app/admin/spaces/${s.id}`} className="text-brand-700 underline">{s.name || 'Untitled'}</Link></td>
                  <td className="p-3">{s.location ? `${s.location.locality}, ${s.location.district} ${s.location.pin}` : '—'}</td>
                  <td className="p-3">{SPACE_MODELS[s.model || '']?.label || '—'}</td>
                  <td className="p-3">{s.owner_name}<br /><span className="text-xs text-muted">{s.owner_email}</span></td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${(SPACE_STATUS[s.status] || SPACE_STATUS.draft).tone}`}>{(SPACE_STATUS[s.status] || SPACE_STATUS.draft).label}</span></td>
                  <td className="p-3">{s.submitted_at ? fmtDate(s.submitted_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
