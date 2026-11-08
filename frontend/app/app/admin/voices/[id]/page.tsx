import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { adminGetArticle } from '@/lib/server/voices';
import { STATUS_META, langLabel, type VoicesStatus } from '@/lib/voices-shared';
import AdminVoicesControls from '@/components/app/admin/AdminVoicesControls';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Review article · NOSTOPS Voices', robots: { index: false, follow: false } };

function fmt(ms?: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

export default async function AdminVoicesReview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser();
  const { id } = await params;
  const a = await adminGetArticle(id);
  if (!a) notFound();
  const meta = STATUS_META[a.status as VoicesStatus] || STATUS_META.DRAFT;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/admin/voices" className="text-sm font-bold text-brand-700 hover:underline">← Back to NOSTOPS Voices</Link>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Article */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-line bg-white p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.badge}`}>{meta.label}</span>
              <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold text-ink-soft">{a.type}</span>
              {a.topic && <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold text-ink-soft">{a.topic}</span>}
              <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold text-ink-soft">{langLabel(a.source_language)}</span>
              <span className="text-[11px] text-muted">{a.word_count} words</span>
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">{a.title}</h1>
            <p className="mt-1 text-sm text-muted">By {a.author_name}{a.author_handle ? ` · @${a.author_handle}` : ''}{a.author_city ? ` · ${a.author_city}` : ''}</p>
            {a.status === 'PUBLISHED' && (
              <a href={`/voices/${a.slug}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-bold text-brand-700 hover:underline">View public page ↗</a>
            )}
            <div className="voices-prose mt-5 border-t border-line pt-5 text-[15px] leading-relaxed text-ink-soft" dangerouslySetInnerHTML={{ __html: a.content_html || '<p class="text-muted">No content.</p>' }} />
          </div>

          <div className="mt-5 rounded-2xl border border-line bg-white p-5">
            <h3 className="text-sm font-black uppercase tracking-wider text-ink">Author bio</h3>
            <p className="mt-2 text-sm text-ink-soft">{a.author_bio || <span className="text-muted">No bio on the teacher&apos;s profile yet.</span>}</p>
          </div>
        </div>

        {/* Controls */}
        <aside className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border border-line bg-cream/40 p-5">
            <h3 className="text-sm font-black uppercase tracking-wider text-ink">Editorial actions</h3>
            <div className="mt-4">
              <AdminVoicesControls articleId={a.id} status={a.status} republication={a.available_for_republication} />
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5 text-sm">
            <h3 className="text-sm font-black uppercase tracking-wider text-ink">Details</h3>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-2"><dt className="text-muted">Syndication consent</dt><dd className={a.consent ? 'font-bold text-emerald-700' : 'font-bold text-red-600'}>{a.consent ? 'Acknowledged' : 'Not given'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Consent at</dt><dd className="text-ink-soft">{fmt(a.consent_at)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Submitted</dt><dd className="text-ink-soft">{fmt(a.submitted_at)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Published</dt><dd className="text-ink-soft">{fmt(a.published_at)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Views</dt><dd className="font-bold text-ink">{a.views}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Translations cached</dt><dd className="text-ink-soft">{a.translations.length ? a.translations.map(langLabel).join(', ') : 'None yet'}</dd></div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
