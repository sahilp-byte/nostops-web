import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getVenueMonitor } from '@/lib/server/admin-venue-monitor';
import VenueMonitor from '@/components/app/admin/VenueMonitor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Venue Monitor', robots: { index: false, follow: false } };

export default async function AdminVenueMonitorPage() {
  await requireAdminUser();
  const data = await getVenueMonitor();
  const t = data.totals;

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Platform</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Venue Monitor</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Health of Google Places venue enrichment across connected retreats. Re-sync a venue or run the enrichment worker
        on demand.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black tabular-nums text-brand-700">{t.connected}</p><p className="text-xs font-semibold text-muted">Connected</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black tabular-nums text-ink">{t.disconnected}</p><p className="text-xs font-semibold text-muted">Disconnected</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black tabular-nums text-emerald-700">{t.successfulSyncs30d}</p><p className="text-xs font-semibold text-muted">Syncs · 30d</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className={`text-2xl font-black tabular-nums ${t.failedSyncs30d > 0 ? 'text-red-700' : 'text-ink'}`}>{t.failedSyncs30d}</p><p className="text-xs font-semibold text-muted">Failed · 30d</p></div>
      </div>

      <div className="mt-6">
        <VenueMonitor rows={data.rows} />
      </div>
    </div>
  );
}
