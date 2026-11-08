import type { Metadata } from 'next';
import Link from 'next/link';
import { getVenues, type PublicVenue } from '@/lib/server/venues';
import { parseVenueIds } from '@/lib/venue-url';
import SavedVenuesList from '@/components/venues/SavedVenuesList';
import SharedShortlist from '@/components/venues/SharedShortlist';

// Reads ?ids= (a shared shortlist link), so render on demand.
export const dynamic = 'force-dynamic';

// Visitor-specific shortlist — keep it out of search indexes.
export const metadata: Metadata = {
  title: 'Saved Venues',
  description: 'The venues you have shortlisted on NOSTOPS.',
  robots: { index: false, follow: true },
};

export default async function SavedVenuesPage({ searchParams }: { searchParams: Promise<{ ids?: string | string[] }> }) {
  const sharedIds = parseVenueIds((await searchParams).ids, 20);
  const venues = await getVenues();
  const byId = new Map(venues.map((v) => [v.id, v]));
  const shared = sharedIds.map((id) => byId.get(id)).filter(Boolean) as PublicVenue[];
  const isShared = sharedIds.length > 0;
  return (
    <>
      <nav aria-label="Breadcrumb" className="container-x pt-6">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <li><Link href="/" className="hover:text-brand-700">Home</Link></li>
          <li aria-hidden>/</li>
          <li><Link href="/venues" className="hover:text-brand-700">Venues</Link></li>
          <li aria-hidden>/</li>
          <li className="font-semibold text-ink-soft" aria-current="page">{isShared ? 'Shared shortlist' : 'Saved'}</li>
        </ol>
      </nav>

      <header className="container-x mt-6">
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{isShared ? 'Shared Venue Shortlist' : 'Saved Venues'}</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          {isShared
            ? 'A shortlist of yoga venues someone wanted you to see.'
            : <>Your shortlist, kept on this device. Revisit spaces you&rsquo;re considering for a class, workshop or retreat.</>}
        </p>
      </header>

      <section className="container-x mb-16 mt-8" aria-label={isShared ? 'Shared venues' : 'Saved venues'}>
        {isShared ? <SharedShortlist venues={shared} /> : <SavedVenuesList venues={venues} />}
      </section>
    </>
  );
}
