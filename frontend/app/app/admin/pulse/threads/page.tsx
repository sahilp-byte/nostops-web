import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getSessionUser } from '@/lib/server/session';
import { getAdminThreads, getPulseCategories, actorFrom } from '@/lib/server/pulse';
import ThreadsAdmin from '@/components/app/admin/pulse/ThreadsAdmin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Pulse Discussions', robots: { index: false, follow: false } };

export default async function AdminPulseThreadsPage({ searchParams }: { searchParams: Promise<{ status?: string; category?: string; q?: string }> }) {
  await requireAdminUser();
  const user = await getSessionUser();
  const actor = actorFrom(user!);
  const { status = 'ALL', category = '', q = '' } = await searchParams;

  const qs = [`status=${encodeURIComponent(status)}`, category && `category=${encodeURIComponent(category)}`, q && `q=${encodeURIComponent(q)}`].filter(Boolean).join('&');
  const [{ threads }, { categories }] = await Promise.all([
    getAdminThreads(actor, `?${qs}&limit=100`),
    getPulseCategories(actor),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href="/app/admin/pulse" className="text-xs font-bold uppercase tracking-wider text-brand-700">← Teacher Pulse</Link>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Discussions</h1>
      </div>
      <ThreadsAdmin threads={threads} categories={categories} status={status} category={category} q={q} />
    </div>
  );
}
