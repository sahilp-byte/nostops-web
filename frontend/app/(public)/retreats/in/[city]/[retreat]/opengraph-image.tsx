import { renderRetreatOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/retreat-og';
import { retreatIdFromParam } from '@/lib/retreat-url';

// Dynamic per-retreat Open Graph image. Next wires this to og:image on the
// retreat detail page automatically (absolute URL via metadataBase).
export const runtime = 'nodejs';
export const revalidate = 300;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS yoga retreat';

export default async function OgImage({ params }: { params: Promise<{ city: string; retreat: string }> }) {
  const { retreat } = await params;
  return renderRetreatOg(retreatIdFromParam(retreat));
}
