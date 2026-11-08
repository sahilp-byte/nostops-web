import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/server/session';
import { getVenue } from '@/lib/server/venues';
import ClaimVenueForm from '@/components/app/venue/ClaimVenueForm';
import { getMyClaims, getMyOwnedVenues, CLAIM_STATUS_LABEL, venueAccess } from '@/lib/server/venue-ownership';
import NotEligible from '@/components/app/venue/VenueNotEligible';

const OPEN_STATUSES = new Set(['submitted', 'verification_pending', 'under_review', 'disputed']);

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Claim this venue', robots: { index: false, follow: false } };

export default async function ClaimVenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/app/venue/claim/${id}`)}`);
  const venue = await getVenue(id);
  if (!venue) notFound();
  const access = await venueAccess();
  if (!access.eligible) return <NotEligible venueName={venue.name} />;
  const [owned, claims] = await Promise.all([getMyOwnedVenues(), getMyClaims()]);
  const isOwner = owned.some((v) => v.id === venue.id);
  const openClaim = claims.find((c) => c.venue_id === venue.id && OPEN_STATUSES.has(c.status));
  if (isOwner || openClaim) {
    return (
      <div className="mx-auto max-w-2xl" data-testid="claim-existing-status">
        <Link href="/app/venue" className="text-sm font-bold text-brand-700 hover:underline">‹ Venue Studio</Link>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">{venue.name}</h1>
        {isOwner ? (
          <>
            <p className="mt-2 text-sm text-ink-soft">You already manage this venue.</p>
            <Link href={`/app/venue/owned/${venue.id}`} className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-orange-700 px-4 text-sm font-bold text-white hover:bg-orange-800" data-testid="claim-go-edit">Edit your venue</Link>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">You already have a claim for this venue: <strong>{CLAIM_STATUS_LABEL[openClaim!.status] || openClaim!.status}</strong>. We’ll email you once an admin decides.</p>
        )}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app/venue" className="text-sm font-bold text-brand-700 hover:underline">‹ Venue Studio</Link>
      <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">Claim {venue.name}</h1>
      <p className="mt-1 text-sm text-ink-soft">{[venue.city, venue.country].filter(Boolean).join(', ')}. Tell us how you are connected to this venue.</p>
      <div className="mt-5"><ClaimVenueForm venueId={venue.id} venueName={venue.name} /></div>
    </div>
  );
}
