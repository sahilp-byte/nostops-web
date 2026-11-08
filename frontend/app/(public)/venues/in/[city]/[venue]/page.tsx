import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { canonical } from '@/lib/site';
import { getVenues, getVenueByPath, venueCitySlug, venueNameSlug, venuePath, buildVenueMetadata } from '@/lib/server/venues';
import VenueProfile from '@/components/venues/VenueProfile';

export const revalidate = 900;

type Params = { params: Promise<{ city: string; venue: string }> };

const STATIC_CAP = 50;
export async function generateStaticParams() {
  const venues = await getVenues({ limit: 100 });
  return venues
    .filter((v) => venueCitySlug(v) && venueNameSlug(v))
    .slice(0, STATIC_CAP)
    .map((v) => ({ city: venueCitySlug(v), venue: venueNameSlug(v) }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { city, venue } = await params;
  const v = await getVenueByPath(city, venue);
  if (!v) return { title: 'Venue · NOSTOPS', alternates: { canonical: canonical(`/venues/in/${city}/${venue}`) } };
  return buildVenueMetadata(v, canonical(venuePath(v)));
}

export default async function VenueProfilePage({ params }: Params) {
  const { city, venue } = await params;
  const v = await getVenueByPath(city, venue);
  if (!v) notFound();
  return <VenueProfile venueId={v.id} />;
}
