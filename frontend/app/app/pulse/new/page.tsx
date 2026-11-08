import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requirePulseParticipant, getPulseCategories } from '@/lib/server/pulse';
import NewThreadForm from '@/components/app/pulse/NewThreadForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Start a discussion · Teacher Pulse', robots: { index: false, follow: false } };

export default async function NewThreadPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { actor, config } = await requirePulseParticipant();
  const canPost = (config.status === 'ACTIVE' || config.status === 'CLOSING_SOON') && config.allow_new_threads;
  if (!canPost) redirect('/app/pulse');

  const { category } = await searchParams;
  const { categories } = await getPulseCategories(actor);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Teacher Pulse</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Start a discussion</h1>
        </div>
        <Link href="/app/pulse" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">Back</Link>
      </div>
      <NewThreadForm categories={categories} defaultSlug={category} />
    </div>
  );
}
