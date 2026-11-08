import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { adminListArticles } from '@/lib/server/voices';
import { STATUS_META, langLabel, type VoicesStatus } from '@/lib/voices-shared';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'NOSTOPS Voices', robots: { index: false, follow: false } };

function fmt(ms?: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

const TABS: Array<{ key: string; label: string }> = [
  { key: 'SUBMITTED', label: 'In review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'REJECTED', label: 'Not accepted' },
  { key: 'ALL', label: 'All' },
];

export default async function AdminVoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminUser();
  const { status } = await searchParams;
  const active = status && TABS.some((t) => t.key === status) ? status : 'SUBMITTED';
  const { rows, counts } = await adminListArticles(active === 'ALL' ? undefined : active);

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-black uppercase tracking-wider text-brand-700">Editorial</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">NOSTOPS Voices</h1>
      <p className="mt-1 text-sm text-muted">Review, approve, publish and syndicate teacher articles.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const n = t.key === 'ALL' ? undefined : counts[t.key];
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={`/app/admin/voices?status=${t.key}`}
              data-testid={`voices-tab-${t.key}`}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${isActive ? 'bg-brand text-white' : 'border border-line bg-white text-ink-soft hover:border-brand'}`}
            >
              {t.label}{typeof n === 'number' ? ` · ${n}` : ''}
            </Link>
          );
        })}
      </div>

      <div className="mt-5">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-cream/40 p-8 text-center text-sm text-muted">No articles in this state.</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream/60 text-[11px] font-black uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Article</th>
                  <th className="px-4 py-3">Author</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Republish</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((a) => {
                  const meta = STATUS_META[a.status as VoicesStatus] || STATUS_META.DRAFT;
                  return (
                    <tr key={a.id} data-testid="voices-admin-row" className="hover:bg-cream/30">
                      <td className="px-4 py-3">
                        <Link href={`/app/admin/voices/${a.id}`} className="font-bold text-brand-700 hover:underline">{a.title}</Link>
                        <span className="block text-xs text-muted">{langLabel(a.source_language)}{a.topic ? ` · ${a.topic}` : ''} · {a.word_count} words</span>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{a.author_name || '—'}</td>
                      <td className="px-4 py-3 text-ink-soft">{a.type}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.badge}`}>{meta.label}</span></td>
                      <td className="px-4 py-3">
                        {a.available_for_republication
                          ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">ON</span>
                          : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">OFF</span>}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{fmt(a.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
