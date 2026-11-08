import { renderEventOg } from '@/lib/server/event-og';

// Stable same-origin URL for an event's share card (used as the JSON-LD image).
// Re-renders the SAME next/og image as the event page's opengraph-image, which
// lives at an unpredictable hashed URL. Public event data only.
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderEventOg(slug);
}
