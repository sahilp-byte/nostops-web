import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicThreadTeaser, PULSE_ROLES } from '@/lib/server/pulse';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { timeAgo, initials, avatarColor } from '@/lib/pulse-ui';
import AuthorName from '@/components/app/pulse/AuthorName';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'A Teacher Pulse discussion', robots: { index: false, follow: false } };

// Public, read-only TEASER of a featured discussion. Shows title + snippet only;
// reading in full and replying require signing in. 404s unless discussions are
// public (admin toggle) and this thread is admin-featured.
export default async function PublicThreadTeaser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, user] = await Promise.all([
    getPublicThreadTeaser(id).catch(() => null),
    getSessionUser().catch(() => null),
  ]);
  if (!data || !data.thread) notFound();

  const t = data.thread;
  const isParticipant = !!user && PULSE_ROLES.has(normalizeRole(user.role));
  const appUrl = `/app/pulse/t/${t.id}`;

  return (
    <main className="bg-cream/40">
      <div className="container-x max-w-3xl py-10 sm:py-14">
        <Link href="/teacher-pulse" className="text-xs font-bold uppercase tracking-wider text-brand-700">← Teacher Pulse</Link>

        <article className="mt-4 rounded-2xl border border-line bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            {t.official && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">Official · NOSTOPS</span>}
            {t.category_name && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{t.category_name}</span>}
          </div>
          <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight text-ink sm:text-3xl">{t.title}</h1>
          <div className="mt-2 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-black text-white" style={{ backgroundColor: avatarColor(t.author_name) }} aria-hidden="true">{initials(t.author_name)}</span>
            <div className="text-xs text-muted">
              <AuthorName name={t.author_name} handle={t.author_handle} isPublic={t.author_public} /> · {t.author_persona} · {timeAgo(t.last_activity_at)} · {t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}
            </div>
          </div>

          <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{t.snippet}</p>

          {/* Login wall */}
          <div className="mt-6 rounded-xl border border-brand/25 bg-gradient-to-br from-brand-50 to-cream p-5 text-center">
            <p className="text-sm font-bold text-ink">This is a conversation among yoga teachers.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">Sign in to read the full discussion and reply. Teacher Pulse is a space of teachers speaking with teachers.</p>
            {isParticipant ? (
              <Link href={appUrl} data-testid="public-open-full" className="mt-4 inline-flex rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Open the full discussion →</Link>
            ) : (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <Link href={`/login?next=${encodeURIComponent(appUrl)}`} className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Sign in to read &amp; reply</Link>
                <Link href={`/join?next=${encodeURIComponent(appUrl)}`} className="rounded-xl border border-line bg-white px-6 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">Join as a teacher</Link>
              </div>
            )}
          </div>
        </article>
      </div>
    </main>
  );
}
