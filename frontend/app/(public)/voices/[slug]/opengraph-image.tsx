import { renderVoicesOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/voices-og';

// Dynamic per-article Open Graph image. Next wires this to og:image on the
// public Voices article page automatically (absolute URL via metadataBase),
// rendering the author's profile photo alongside the article title + URL.
export const runtime = 'nodejs';
export const revalidate = 120;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS Voices article by a NOSTOPS teacher';

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderVoicesOg(slug);
}
