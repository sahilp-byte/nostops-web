import { renderSpaceOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/space-og';

// Per-Space Twitter/X image (same share card as the Open Graph image).
export const runtime = 'nodejs';
export const revalidate = 900;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS Space';

export default async function TwitterImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderSpaceOg(id);
}
