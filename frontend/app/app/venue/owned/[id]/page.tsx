import type { Metadata } from 'next';
import Link from 'next/link';
import { getOwnedVenue, venueAccess } from '@/lib/server/venue-ownership';
import NotEligible from '@/components/app/venue/VenueNotEligible';
import VenueProfileDashboard from '@/components/app/venue/VenueProfileDashboard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit your venue', robots: { index: false, follow: false } };

export default async function OwnedVenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await venueAccess()).eligible) return <NotEligible />;
  const venue = await getOwnedVenue(id);
  if (!venue) {
    return (
      <div className="mx-auto max-w-2xl" data-testid="owned-venue-unavailable">
        <Link href="/app/venue" className="text-sm font-bold text-brand-700 hover:underline">‹ Venue Studio</Link>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">You can’t edit this venue</h1>
        <p className="mt-2 text-sm text-ink-soft">Only the approved owner of a venue can edit it. If you have claimed this venue, an admin is still reviewing your claim — you’ll see its status in Venue Studio and get an email once it’s decided.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm font-bold text-ink-soft"><Link href="/app/venue" className="text-brand-700 hover:underline">Venue Studio</Link> › <Link href="/app/venue" className="text-brand-700 hover:underline">My Venues</Link> › Profile &amp; Settings</p>
      <header className="mt-3 rounded-2xl border border-line bg-gradient-to-r from-cream via-white to-emerald-50/60 p-5 sm:p-6">
        <h1 className="font-serif text-3xl font-black tracking-tight text-brand-700">Venue Profile &amp; Settings</h1>
        <p className="mt-1 text-ink-soft">Update the profile, contact details and listing preferences for <strong>{venue.name}</strong>.</p>
        <p className="mt-1 text-xs text-muted">Last updated {venue.updated_at ? new Date(venue.updated_at).toLocaleDateString('en-GB') : '—'} · Status: {venue.status}</p>
      </header>
      <div className="mt-5"><VenueProfileDashboard venue={venue} /></div>
    </div>
  );
}
