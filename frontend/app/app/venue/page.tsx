import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { displayName } from '@/lib/roles';
import { getVenueOwnerState } from '@/lib/server/venue-owner';
import VenueOwnerHome from '@/components/app/venue/VenueOwnerHome';
import OwnedVenuesPanel from '@/components/app/venue/OwnedVenuesPanel';
import { venueAccess } from '@/lib/server/venue-ownership';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Venue Studio', robots: { index: false, follow: false } };

export default async function VenueStudioPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const [state, access] = await Promise.all([getVenueOwnerState(), venueAccess()]);
  return (
    <>
      {/* Global Venue claiming/management is for empanelled teachers and Council Gurus only (owner decision). */}
      {access.eligible && <OwnedVenuesPanel />}
      <VenueOwnerHome state={state} ownerName={displayName(user)} />
    </>
  );
}
