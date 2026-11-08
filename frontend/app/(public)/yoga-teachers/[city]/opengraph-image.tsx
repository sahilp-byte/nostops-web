import { renderCityOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/city-og';

// Dynamic per-city Open Graph image for /yoga-teachers/{city}. Next wires this
// to og:image on the city directory page automatically.
export const runtime = 'nodejs';
export const revalidate = 600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS yoga teachers by city';

export default async function OgImage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  return renderCityOg(city);
}
