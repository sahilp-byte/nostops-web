import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getBroadcastHistory } from '@/lib/server/admin-broadcast';
import BroadcastComposer from '@/components/app/admin/BroadcastComposer';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Broadcast', robots: { index: false, follow: false } };

export default async function AdminBroadcastPage() {
  await requireAdminUser();
  const history = await getBroadcastHistory();

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Platform</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Broadcast</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Send an in-app announcement to everyone or a specific audience. Use sparingly — recipients get a notification
        immediately.
      </p>

      <div className="mt-6">
        <BroadcastComposer />
      </div>

      <h2 className="mt-8 text-lg font-black text-ink">Recent broadcasts</h2>
      {history.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No broadcasts sent yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {history.map((h, i) => (
            <div key={`${h.title}-${i}`} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-ink">{h.title}</p>
                <span className="shrink-0 text-xs text-muted">{h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ''}</span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">{h.body}</p>
              <p className="mt-2 text-xs font-semibold text-brand-700">Delivered to {h.deliveredTo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
