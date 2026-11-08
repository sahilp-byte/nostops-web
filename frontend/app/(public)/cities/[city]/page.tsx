import { permanentRedirect } from 'next/navigation';

// The canonical City Yoga Community page now lives at /yoga-teachers/{city}.
// This legacy /cities/{city} route issues a permanent (308) redirect so old
// links, bookmarks and previously-indexed URLs flow to the new canonical URL
// with no duplicate content. Rendered on demand (force-dynamic): a statically
// generated shell 500s in production when the shared layout makes an uncached
// fetch at request time ("Page changed from static to dynamic at runtime").
export const dynamic = 'force-dynamic';

export default async function LegacyCityRedirect({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  permanentRedirect(`/yoga-teachers/${city}`);
}
