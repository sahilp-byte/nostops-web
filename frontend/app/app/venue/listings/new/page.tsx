import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getVenueOwnerState } from '@/lib/server/venue-owner';
import ListingForm from '@/components/app/venue/ListingForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Host a Retreat', robots: { index: false, follow: false } };

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ center?: string; from?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const state = await getVenueOwnerState();
  if (!state.canOwnVenues) redirect('/app/venue');

  const { center, from } = await searchParams;
  const centers = state.centers.map((c) => ({ id: c.id, name: c.name, city: c.city, capacity: c.capacity }));

  // "Relaunch next season" — clone a past retreat's details (dates cleared).
  const source = from ? state.listings.find((l) => l.id === from) : undefined;
  const prefill = source
    ? {
        title: `${source.title} (${new Date().getFullYear() + 1})`.slice(0, 120),
        theme: source.theme || 'general',
        seats: source.seatsTotal ? String(source.seatsTotal) : '',
        price: source.pricePerSeatInr ? String(source.pricePerSeatInr) : '',
        inclusions: source.inclusions.join(', '),
      }
    : undefined;
  const initialCenterId = source?.centerId || center;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/app/venue" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to Venue Studio</Link>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{source ? 'Relaunch your retreat' : 'Host a retreat at your venue'}</h1>
        <p className="mt-1.5 text-ink-soft">{source ? 'We\u2019ve carried over the details from your past retreat. Adjust anything, then pick the new dates and publish.' : 'Publish a retreat you host directly. You can also invite a teacher to co-host from the studio.'}</p>
      </div>
      <ListingForm centers={centers} initialCenterId={initialCenterId} prefill={prefill} />
    </div>
  );
}
