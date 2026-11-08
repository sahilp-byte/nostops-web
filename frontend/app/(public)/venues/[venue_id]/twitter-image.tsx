import { renderVenueOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/venue-og';

// Dynamic per-venue Twitter/X image (same branded card as OG).
export const runtime = 'nodejs';
export const revalidate = 900;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS yoga retreat venue';

export default async function TwitterImage({ params }: { params: Promise<{ venue_id: string }> }) {
  const { venue_id } = await params;
  return renderVenueOg(venue_id);
}
