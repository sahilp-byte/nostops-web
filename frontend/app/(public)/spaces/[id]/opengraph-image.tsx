import { renderSpaceOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/space-og';

// Per-Space Open Graph image (WhatsApp / social previews). Approved Spaces only; public data only.
export const runtime = 'nodejs';
export const revalidate = 900;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS Space';

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderSpaceOg(id);
}
