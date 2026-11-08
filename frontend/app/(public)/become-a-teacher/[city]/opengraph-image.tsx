import { renderBecomeTeacherCityOg } from '@/lib/server/city-context-og';
import { OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/parampara-og';

// Dynamic per-city Open Graph image for /become-a-teacher/{city}. Overrides the
// generic recruitment card with a city-named branded card + live counts.
export const runtime = 'nodejs';
export const revalidate = 300;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Become a NOSTOPS yoga teacher by city';

export default async function OgImage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  return renderBecomeTeacherCityOg(city);
}
