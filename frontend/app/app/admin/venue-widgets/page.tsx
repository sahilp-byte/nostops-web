import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { growthFetch } from '@/lib/server/venue-growth';
import VenueWidgetSettings, { type WidgetSettingsInitial } from '@/components/admin/VenueWidgetSettings';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Venue Widgets', robots: { index: false, follow: false } };

export default async function AdminVenueWidgetsPage() {
  await requireAdminUser();
  const [cfg, hist] = await Promise.all([
    growthFetch('/config').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    growthFetch('/config/history').then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-black uppercase tracking-wider text-brand-700">Venue Partner Growth</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Venue Widgets</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        One shared design for every venue&apos;s website widget. Publishing a change updates every installed widget straight away —
        venue owners never need to change their embed code. Venue details are never stored here.
      </p>
      {cfg ? (
        <VenueWidgetSettings initial={{ ...(cfg as WidgetSettingsInitial), history: hist?.history || [] }} />
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-cream/40 p-8 text-center text-sm text-muted">Widget settings are unavailable right now.</div>
      )}
    </div>
  );
}
