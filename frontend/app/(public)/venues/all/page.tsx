import type { Metadata } from 'next';
import Link from 'next/link';
import { normalizeJsonLd, pageMetadata } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { getVenues, venuePath, type PublicVenue } from '@/lib/server/venues';
import { getPublicRetreats } from '@/lib/server/retreats';
import { getVerifiedMatcher } from '@/lib/server/venue-submissions-local';
import VenueExplorer from '@/components/venues/VenueExplorer';
import { withGoogleCovers } from '@/lib/server/ai-assisted-venues';

export const revalidate = 900;

const PATH = '/venues/all';
const CANONICAL_URL = canonical(PATH);
const HOME_URL = canonical('/');
const VENUES_URL = canonical('/venues');

export async function generateMetadata(): Promise<Metadata> {
  const venues = await getVenues();
  const n = venues.length;
  const description = n > 0
    ? `Browse all ${n} yoga & retreat venues on NOSTOPS — search by city, country and suitability. 20 venues per page.`
    : 'Browse all yoga & retreat venues on NOSTOPS — search by city, country and suitability.';
  return pageMetadata({ title: 'All Yoga & Retreat Venues', description, path: '/venues/all' });
}

export default async function AllVenuesPage() {
  const [venues, { retreats }] = await Promise.all([getVenues(), getPublicRetreats()]);
  const isVerified = await getVerifiedMatcher().catch(() => (() => false));
  const verifiedIds = venues
    .filter((v) => isVerified({ id: v.id, venuePartnerId: v.id, name: v.name, city: v.city }))
    .map((v) => v.id);

  // Real retreat counts per venue — grounded in published records (never invented).
  const countByVenue: Record<string, number> = {};
  for (const r of retreats) if (r.venuePartnerId) countByVenue[r.venuePartnerId] = (countByVenue[r.venuePartnerId] || 0) + 1;

  const jsonld = normalizeJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': CANONICAL_URL,
      url: CANONICAL_URL,
      name: 'All Yoga & Retreat Venues · NOSTOPS',
      description: 'The full NOSTOPS venue directory — discoverable to teachers, retreat creators and organisations.',
      isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: HOME_URL },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: venues.length,
        itemListElement: venues.map((v: PublicVenue, i) => ({ '@type': 'ListItem', position: i + 1, url: canonical(venuePath(v)), name: v.name })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
        { '@type': 'ListItem', position: 2, name: 'Venues', item: VENUES_URL },
        { '@type': 'ListItem', position: 3, name: 'All venues', item: CANONICAL_URL },
      ],
    },
  ]);

  return (
    <>
      <JsonLd data={jsonld} />

      <nav aria-label="Breadcrumb" className="container-x pt-6">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <li><Link href="/" className="hover:text-brand-700">Home</Link></li>
          <li aria-hidden>/</li>
          <li><Link href="/venues" className="hover:text-brand-700">Venues</Link></li>
          <li aria-hidden>/</li>
          <li className="font-semibold text-ink-soft" aria-current="page">All venues</li>
        </ol>
      </nav>

      <header className="container-x mt-6">
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">All Yoga &amp; Retreat Venues</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Every venue on NOSTOPS, across India and beyond. Search by place or suitability
          {venues.length > 0 ? ` — ${venues.length} venues, 20 per page.` : '.'}
        </p>
      </header>

      <section className="container-x mb-16 mt-8" aria-label="All venues">
        {venues.length > 0 ? (
          <VenueExplorer venues={await withGoogleCovers(venues)} retreatCounts={countByVenue} verifiedIds={verifiedIds} pageSize={20} />
        ) : (
          <div className="rounded-2xl border border-line bg-white p-10 text-center">
            <span aria-hidden className="text-4xl">🏡</span>
            <p className="mt-3 text-lg font-bold text-ink">Venues are being added.</p>
            <p className="mt-1 text-ink-soft">Be the first — <Link href="/venues/submit" className="font-bold text-brand-700 hover:underline">list your venue for free</Link>.</p>
          </div>
        )}
      </section>
    </>
  );
}
