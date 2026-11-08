import { renderEventOg, OG_SIZE, OG_CONTENT_TYPE, OG_ALT } from '@/lib/server/event-og';

// A shared Register link previews exactly like its event page.
export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = OG_ALT;

export default async function TwitterImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderEventOg(slug);
}
