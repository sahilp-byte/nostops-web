import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getSessionUser } from '@/lib/server/session';
import { getAdminThread, actorFrom } from '@/lib/server/pulse';
import ThreadModeration from '@/components/app/admin/pulse/ThreadModeration';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Moderate Discussion', robots: { index: false, follow: false } };

export default async function AdminPulseThreadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser();
  const user = await getSessionUser();
  const { id } = await params;
  const data = await getAdminThread(actorFrom(user!), id);
  if (!data || !data.thread) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/app/admin/pulse/threads" className="text-xs font-bold uppercase tracking-wider text-brand-700">← All discussions</Link>
      <ThreadModeration thread={data.thread} posts={data.posts} reports={data.reports} />
    </div>
  );
}
