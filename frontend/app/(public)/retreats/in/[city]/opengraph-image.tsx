import { renderRetreatsCityOg } from '@/lib/server/city-context-og';
import { OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/parampara-og';

// Dynamic per-city Open Graph image for /retreats/in/{city}. Overrides the
// generic /retreats card with a city-named branded card.
export const runtime = 'nodejs';
export const revalidate = 900;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Yoga retreats by city · NOSTOPS';

export default async function OgImage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  return renderRetreatsCityOg(city);
}
