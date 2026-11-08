import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { growthFetch } from '@/lib/server/venue-growth';
import VenuePartnerOverview, { type OverviewData } from '@/components/admin/VenuePartnerOverview';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Venue Partners', robots: { index: false, follow: false } };

export default async function AdminVenuePartnersPage() {
  await requireAdminUser();
  const data = await growthFetch('/admin/overview').then((r) => (r.ok ? r.json() : null)).catch(() => null);

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-black uppercase tracking-wider text-brand-700">Venue Partner Growth</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Venue Partners</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Every venue with a toolkit: whether its widget is live, its partner badge, its invitation counts, posters and the
        monthly activity email. Counts are anonymous.
      </p>
      {data ? (
        <VenuePartnerOverview initial={data as OverviewData} />
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-cream/40 p-8 text-center text-sm text-muted">The overview is unavailable right now.</div>
      )}
    </div>
  );
}
