import { renderEventOg, OG_SIZE, OG_CONTENT_TYPE, OG_ALT } from '@/lib/server/event-og';

// Per-event Open Graph card; Next wires it to og:image on the event page.
export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = OG_ALT;

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderEventOg(slug);
}
