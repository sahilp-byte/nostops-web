import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePulseParticipant, getPulseCategories, getPulseThreads } from '@/lib/server/pulse';
import ThreadCard from '@/components/app/pulse/ThreadCard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Topic · Teacher Pulse', robots: { index: false, follow: false } };

export default async function PulseCategoryPage({
  params, searchParams,
}: { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string }> }) {
  const { actor, config } = await requirePulseParticipant();
  const { slug } = await params;
  const { sort } = await searchParams;
  const activeSort = sort === 'new' ? 'new' : 'active';

  const [{ categories }, { threads }] = await Promise.all([
    getPulseCategories(actor),
    getPulseThreads(actor, `?category=${encodeURIComponent(slug)}&sort=${activeSort}&limit=50`),
  ]);
  const cat = categories.find((c) => c.slug === slug);
  const canPost = (config.status === 'ACTIVE' || config.status === 'CLOSING_SOON') && config.allow_new_threads;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/pulse" className="text-xs font-bold uppercase tracking-wider text-brand-700">← Teacher Pulse</Link>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">{cat?.name || 'Topic'}</h1>
          {cat?.description && <p className="mt-1 text-ink-soft">{cat.description}</p>}
        </div>
        {canPost && <Link href={`/app/pulse/new?category=${slug}`} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">Start a discussion</Link>}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">Sort</span>
        <Link href={`/app/pulse/c/${slug}?sort=active`} className={`rounded-full px-3 py-1 text-xs font-bold ${activeSort === 'active' ? 'bg-brand text-white' : 'border border-line bg-white text-ink-soft'}`}>Most active</Link>
        <Link href={`/app/pulse/c/${slug}?sort=new`} className={`rounded-full px-3 py-1 text-xs font-bold ${activeSort === 'new' ? 'bg-brand text-white' : 'border border-line bg-white text-ink-soft'}`}>Newest</Link>
      </div>

      <div className="space-y-3">
        {threads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
            <p className="text-sm font-semibold text-ink">No discussions in this topic yet.</p>
            {canPost && <Link href={`/app/pulse/new?category=${slug}`} className="mt-4 inline-flex rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">Start one</Link>}
          </div>
        ) : (
          threads.map((t) => <ThreadCard key={t.id} thread={t} />)
        )}
      </div>
    </div>
  );
}
