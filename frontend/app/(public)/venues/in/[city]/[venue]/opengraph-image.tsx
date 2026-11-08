import { renderVenueOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/venue-og';
import { getVenueByPath } from '@/lib/server/venues';

// Dynamic per-venue Open Graph image for the clean /venues/in/{city}/{venue} URL.
export const runtime = 'nodejs';
export const revalidate = 900;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS yoga retreat venue';

export default async function OgImage({ params }: { params: Promise<{ city: string; venue: string }> }) {
  const { city, venue } = await params;
  const v = await getVenueByPath(city, venue);
  return renderVenueOg(v?.id ?? '');
}
