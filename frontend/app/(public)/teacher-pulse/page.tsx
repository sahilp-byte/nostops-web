import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { PULSE_ROLES, getPublicConfig, getPublicFeatured } from '@/lib/server/pulse';
import { timeAgo } from '@/lib/pulse-ui';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Teacher Pulse — Teachers speaking with teachers',
  description: 'Teacher Pulse is a conversation among yoga teachers about the profession, the market and the future of Yoga. Invite a fellow teacher and share what you see.',
  alternates: {
    canonical: 'https://www.nostops.org/teacher-pulse',
    types: { 'application/rss+xml': '/teacher-pulse/feed.xml' },
  },
  openGraph: {
    type: 'website',
    siteName: 'NOSTOPS',
    url: 'https://www.nostops.org/teacher-pulse',
    title: 'Teacher Pulse — Teachers speaking with teachers',
    description: 'A conversation among yoga teachers about the profession, the market and the future of Yoga.',
    images: [{ url: '/brand/og-card.png', width: 1200, height: 630, alt: 'NOSTOPS' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Teacher Pulse — Teachers speaking with teachers',
    description: 'A conversation among yoga teachers about the profession, the market and the future of Yoga.',
    images: ['/brand/og-card.png'],
  },
};

const LINES = ['Invite a fellow teacher.', 'Start a conversation.', 'Listen.', 'Learn.', 'Share.'];

export default async function TeacherPulseLanding() {
  const [user, publicCfg] = await Promise.all([
    getSessionUser().catch(() => null),
    getPublicConfig(),
  ]);
  const isParticipant = !!user && PULSE_ROLES.has(normalizeRole(user.role));
  const featured = publicCfg.public_read ? (await getPublicFeatured('?limit=12')).threads : [];

  return (
    <main>
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: 'Teacher Pulse', path: '/teacher-pulse' }]} />
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-50 to-cream">
        <div className="container-x py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700">🌿 A NOSTOPS community initiative</span>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-ink sm:text-5xl">Teacher Pulse</h1>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
              Yoga is taught one teacher at a time. But what are teachers experiencing today?
            </p>
            <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-ink-soft">
              Teacher Pulse is a conversation among yoga teachers about the profession, the market and the future of Yoga.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              {LINES.map((l) => <span key={l} className="text-sm font-bold text-brand-700">{l}</span>)}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {isParticipant ? (
                <Link href="/app/pulse" data-testid="pulse-enter" className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">Enter Teacher Pulse →</Link>
              ) : (
                <>
                  <Link href="/login?next=/app/pulse" className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">Sign in to join</Link>
                  <Link href="/join?next=/app/pulse" className="rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-ink-soft transition hover:bg-cream">New here? Join as a teacher</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* What it is */}
      <section className="container-x py-14">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: '🧑\u200d🏫', t: 'For teachers, by teachers', d: 'A safe peer space for identifiable NOSTOPS teachers — not anonymous commenters.' },
            { icon: '💬', t: 'Real conversations', d: 'Teaching, livelihood, pricing, studios, online, corporate, retreats, recognition and more.' },
            { icon: '👂', t: 'We listen', d: 'A three-month experiment to understand what matters most to yoga teachers today.' },
          ].map((c) => (
            <div key={c.t} className="rounded-2xl border border-line bg-white p-5">
              <span className="text-2xl" aria-hidden="true">{c.icon}</span>
              <h3 className="mt-2 text-base font-extrabold text-ink">{c.t}</h3>
              <p className="mt-1 text-sm text-ink-soft">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Public discussions (only when admin has made discussions public) */}
      {publicCfg.public_read && featured.length > 0 && (
        <section className="container-x pb-4">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-xl font-black tracking-tight text-ink">From the conversation</h2>
                <p className="mt-1 text-sm text-ink-soft">A public glimpse of what teachers are discussing. Sign in to read in full and take part.</p>
              </div>
              <a href="/teacher-pulse/feed.xml" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream" data-testid="pulse-rss-link">
                <span aria-hidden="true">📡</span> Subscribe (RSS)
              </a>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {featured.map((t) => (
                <Link key={t.id} href={`/teacher-pulse/t/${t.id}`} data-testid="public-thread-card" className="block rounded-2xl border border-line bg-white p-4 transition hover:border-brand/40 hover:shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {t.official && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">Official</span>}
                    {t.category_name && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{t.category_name}</span>}
                  </div>
                  <h3 className="mt-1 line-clamp-2 text-[15px] font-extrabold leading-snug text-ink">{t.title}</h3>
                  <p className="clamp-2 mt-1 text-sm text-ink-soft">{t.snippet}</p>
                  <p className="mt-2 text-xs text-muted">{t.author_name} · {t.author_persona} · {timeAgo(t.last_activity_at)} · {t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Promise band */}
      <section className="bg-ink">
        <div className="container-x py-12 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-white/60">The NOSTOPS promise</p>
          <p className="mx-auto mt-2 max-w-2xl text-lg font-bold leading-relaxed text-white">
            Your knowledge is not a commodity. You are a custodian of a living tradition.
          </p>
          {!isParticipant && (
            <Link href="/join?next=/app/pulse" className="mt-6 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-bold text-ink transition hover:bg-cream">Join the conversation</Link>
          )}
        </div>
      </section>
    </main>
  );
}
