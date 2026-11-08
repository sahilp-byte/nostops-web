import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { requirePulseParticipant, getPulseCategories, getPulseThreads } from '@/lib/server/pulse';
import ThreadCard from '@/components/app/pulse/ThreadCard';
import StatusBanner from '@/components/app/pulse/StatusBanner';
import AcceptInvite from '@/components/app/pulse/AcceptInvite';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Teacher Pulse', robots: { index: false, follow: false } };

export default async function PulseHomePage() {
  const { actor, config, isAdmin } = await requirePulseParticipant();

  if (config.status === 'PRE_LAUNCH' && !isAdmin) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-white p-8 text-center">
        <span className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-3xl">🌱</span>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">Teacher Pulse is launching soon</h1>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">A conversation among yoga teachers is about to begin. Check back shortly.</p>
      </div>
    );
  }

  const [{ categories }, { threads }] = await Promise.all([
    getPulseCategories(actor),
    getPulseThreads(actor, '?sort=active&limit=20'),
  ]);
  const canPost = (config.status === 'ACTIVE' || config.status === 'CLOSING_SOON') && config.allow_new_threads;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Suspense fallback={null}><AcceptInvite /></Suspense>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Teacher Pulse</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Teachers speaking with teachers</h1>
          <p className="mt-1 max-w-xl text-ink-soft">A conversation about the profession, the market and the future of Yoga. Listen, learn and share.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/pulse/invite" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">Invite a teacher</Link>
          {canPost && <Link href="/app/pulse/new" data-testid="pulse-start" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">Start a discussion</Link>}
        </div>
      </div>

      <StatusBanner status={config.status} closeDate={config.close_date} />

      {/* Categories */}
      <div>
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted">Topics</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {categories.map((c) => (
            <Link key={c.slug} href={`/app/pulse/c/${c.slug}`} data-testid="pulse-category" className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 transition hover:border-brand/40">
              <span className="min-w-0">
                <span className="block text-sm font-extrabold text-ink">{c.name}</span>
                {c.description && <span className="block truncate text-xs text-muted">{c.description}</span>}
              </span>
              <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">{c.thread_count}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent discussions */}
      <div>
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted">Recent discussions</h2>
        <div className="mt-3 space-y-3">
          {threads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
              <p className="text-sm font-semibold text-ink">No discussions yet.</p>
              <p className="mt-1 text-sm text-muted">Be the first to start a conversation — invite a fellow teacher and share what&apos;s on your mind.</p>
              {canPost && <Link href="/app/pulse/new" className="mt-4 inline-flex rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">Start the first discussion</Link>}
            </div>
          ) : (
            threads.map((t) => <ThreadCard key={t.id} thread={t} />)
          )}
        </div>
      </div>
    </div>
  );
}
