import type { NextRequest } from 'next/server';
import { getPublicFeatured } from '@/lib/server/pulse';
import { buildRss, resolveOrigin } from '@/lib/pulse-rss';

export const dynamic = 'force-dynamic';

// Site-wide RSS of admin-featured public discussions (teaser: title + snippet).
export async function GET(req: NextRequest) {
  const origin = resolveOrigin(req.headers, req.nextUrl.origin);
  const { public_read, threads } = await getPublicFeatured('?limit=40');
  const items = public_read
    ? threads.map((t) => ({
        title: t.official ? `[Official] ${t.title}` : t.title,
        link: `${origin}/teacher-pulse/t/${t.id}`,
        author: t.author_name,
        category: t.category_name,
        date: t.last_activity_at,
        description: t.snippet,
      }))
    : [];
  const xml = buildRss({
    title: 'NOSTOPS Teacher Pulse',
    description: public_read
      ? 'Selected public discussions among yoga teachers. Sign in to read in full and take part.'
      : 'Teacher Pulse discussions are currently private.',
    feedUrl: `${origin}/teacher-pulse/feed.xml`,
    siteUrl: `${origin}/teacher-pulse`,
    items,
  });
  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
