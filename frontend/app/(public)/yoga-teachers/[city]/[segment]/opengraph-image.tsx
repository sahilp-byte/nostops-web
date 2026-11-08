import { renderSegmentOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/parampara-og';

export const runtime = 'nodejs';
export const revalidate = 600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS yoga teachers by city & tradition';

export default async function OgImage({ params }: { params: Promise<{ city: string; segment: string }> }) {
  const { city, segment } = await params;
  return renderSegmentOg(city, segment);
}
