import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { canonical } from '@/lib/site';
import { getVenue, getVenues, getVenueByPath, venuePath, venueCitySlug, venueNameSlug, buildVenueMetadata } from '@/lib/server/venues';
import VenueProfile from '@/components/venues/VenueProfile';

export const revalidate = 900;

type Params = { params: Promise<{ venue_id: string }> };

const STATIC_CAP = 50;
export async function generateStaticParams() {
  const venues = await getVenues({ limit: 100 });
  return venues.slice(0, STATIC_CAP).map((v) => ({ venue_id: v.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { venue_id } = await params;
  const v = await getVenue(venue_id);
  if (!v) return { title: 'Venue · NOSTOPS', alternates: { canonical: canonical(`/venues/${venue_id}`) } };
  // Canonical always points at the clean city-nested URL, even when reached via
  // the legacy /venues/{id} path, so search engines consolidate on one URL.
  return buildVenueMetadata(v, canonical(venuePath(v)));
}

export default async function VenueProfilePage({ params }: Params) {
  const { venue_id } = await params;
  // Phase 4: the legacy /venues/{id} URL 308s to the clean city-nested URL —
  // only when that URL resolves back to this same venue (no slug collision).
  const v = await getVenue(venue_id);
  if (v) {
    const path = venuePath(v);
    if (path !== `/venues/${venue_id}`) {
      const byPath = await getVenueByPath(venueCitySlug(v), venueNameSlug(v));
      if (byPath?.id === v.id) permanentRedirect(path);
    }
  }
  return <VenueProfile venueId={venue_id} />;
}
