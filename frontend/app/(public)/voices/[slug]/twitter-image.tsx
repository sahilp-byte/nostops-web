import { renderVoicesOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/voices-og';

// Dynamic per-article Twitter/X card image (same rich author-photo card as the
// Open Graph image). Next wires this to twitter:image automatically.
export const runtime = 'nodejs';
export const revalidate = 120;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS Voices article by a NOSTOPS teacher';

export default async function TwitterImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderVoicesOg(slug);
}
