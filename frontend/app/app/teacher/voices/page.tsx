import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getMyAuthorIdentity, getAuthorFlag, listMyArticles } from '@/lib/server/voices';
import { STATUS_META, langLabel, type VoicesStatus } from '@/lib/voices-shared';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Write for NOSTOPS', robots: { index: false, follow: false } };

function fmt(ms?: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function NotEnabled() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-white p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-2xl">✍️</div>
      <h1 className="mt-4 text-xl font-black text-ink">Write for NOSTOPS</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        NOSTOPS Voices is our editorial home for teachers. Publishing is enabled by a NOSTOPS administrator.
        Once you&apos;re enabled as a NOSTOPS Author, you&apos;ll be able to write and submit articles here.
      </p>
    </div>
  );
}

export default async function TeacherVoicesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'teacher') redirect('/app');

  const me = await getMyAuthorIdentity();
  const isAuthor = me?.teacherId ? await getAuthorFlag(me.teacherId) : false;
  if (!me || !isAuthor) return <div className="mx-auto max-w-5xl px-1 py-2"><NotEnabled /></div>;

  const rows = await listMyArticles(me.teacherId);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-brand-700">NOSTOPS Voices</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Write for NOSTOPS</h1>
          <p className="mt-1 text-sm text-muted">Perspectives, knowledge and reflections from the teachers of NOSTOPS.</p>
        </div>
        <Link href="/app/teacher/voices/new" data-testid="voices-new" className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">
          + New article
        </Link>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-ink">My NOSTOPS Articles</h2>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-cream/40 p-8 text-center text-sm text-muted">
            You haven&apos;t written anything yet. Tap <strong>New article</strong> to share your first perspective.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream/60 text-[11px] font-black uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Article</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Published</th>
                  <th className="px-4 py-3 text-right">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((a) => {
                  const meta = STATUS_META[a.status as VoicesStatus] || STATUS_META.DRAFT;
                  const editable = a.status === 'DRAFT' || a.status === 'REJECTED';
                  return (
                    <tr key={a.id} data-testid="voices-row" className="hover:bg-cream/30">
                      <td className="px-4 py-3">
                        {editable ? (
                          <Link href={`/app/teacher/voices/${a.id}`} className="font-bold text-brand-700 hover:underline">{a.title}</Link>
                        ) : a.status === 'PUBLISHED' ? (
                          <a href={`/voices/${a.slug}`} target="_blank" rel="noreferrer" className="font-bold text-ink hover:underline">{a.title}</a>
                        ) : (
                          <span className="font-bold text-ink">{a.title}</span>
                        )}
                        <span className="block text-xs text-muted">{langLabel(a.source_language)}{a.topic ? ` · ${a.topic}` : ''}</span>
                        {a.status === 'REJECTED' && a.rejection_reason && (
                          <span className="mt-1 block text-xs text-red-600">Editor note: {a.rejection_reason}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{a.type}</td>
                      <td className="px-4 py-3 text-ink-soft">{fmt(a.submitted_at)}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.badge}`}>{meta.label}</span></td>
                      <td className="px-4 py-3 text-ink-soft">{fmt(a.published_at)}</td>
                      <td className="px-4 py-3 text-right font-bold text-ink">{a.views}</td>
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
