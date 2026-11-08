import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getVideoQueue } from '@/lib/server/admin-video';
import VideoReviewQueue from '@/components/app/admin/VideoReviewQueue';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Video Reviews', robots: { index: false, follow: false } };

export default async function AdminVideoReviewsPage() {
  await requireAdminUser();
  const items = await getVideoQueue();

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Operations</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Video Reviews</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Watch each teacher&apos;s intro video and approve it to publish on their public profile, or reject with a reason
        so they can re-record.
      </p>
      <div className="mt-4 rounded-2xl border border-line bg-white p-4">
        <p className="text-2xl font-black tabular-nums text-ink">{items.length}</p>
        <p className="text-xs font-semibold text-muted">Awaiting review</p>
      </div>
      <div className="mt-6">
        <VideoReviewQueue items={items} />
      </div>
    </div>
  );
}
