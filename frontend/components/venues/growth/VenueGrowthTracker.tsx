'use client';

import { useEffect } from 'react';
import { trackVenueGrowth } from '@/lib/venue-growth-client';

// Counts a profile view for the venue that invited this visitor (only if they came
// through that venue's own NOSTOPS link; the backend checks the code belongs to it).
export default function VenueGrowthTracker({ venueId }: { venueId: string }) {
  useEffect(() => {
    trackVenueGrowth('profile_view', venueId);
  }, [venueId]);
  return null;
}
