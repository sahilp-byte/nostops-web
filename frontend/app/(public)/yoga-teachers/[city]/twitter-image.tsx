import { renderCityOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/city-og';

// Dynamic per-city Twitter/X image (same branded card as OG).
export const runtime = 'nodejs';
export const revalidate = 600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS yoga teachers by city';

export default async function TwitterImage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  return renderCityOg(city);
}
