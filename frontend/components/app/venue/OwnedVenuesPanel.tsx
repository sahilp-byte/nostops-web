import { getMyClaims, getMyOwnedVenues } from '@/lib/server/venue-ownership';
import VenueListingDashboard from '@/components/app/venue/VenueListingDashboard';

// Global Venues owned through an approved claim (any NOSTOPS account — no teacher level needed).
export default async function OwnedVenuesPanel() {
  const [owned, claims] = await Promise.all([getMyOwnedVenues(), getMyClaims()]);
  return <VenueListingDashboard owned={owned} claims={claims} />;
}
