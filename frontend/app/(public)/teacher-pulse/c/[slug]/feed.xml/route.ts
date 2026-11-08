import type { NextRequest } from 'next/server';
import { getPublicFeatured, getPulseCategories, PUBLIC_ACTOR } from '@/lib/server/pulse';
import { buildRss, resolveOrigin } from '@/lib/pulse-rss';

export const dynamic = 'force-dynamic';

// Per-topic RSS of admin-featured public discussions in one category.
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const origin = resolveOrigin(req.headers, req.nextUrl.origin);
  const { slug } = await ctx.params;
  const [{ public_read, threads }, { categories }] = await Promise.all([
    getPublicFeatured(`?category=${encodeURIComponent(slug)}&limit=40`),
    getPulseCategories(PUBLIC_ACTOR),
  ]);
  const cat = categories.find((c) => c.slug === slug);
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
    title: `NOSTOPS Teacher Pulse — ${cat?.name || slug}`,
    description: public_read
      ? `Selected public discussions in ${cat?.name || slug}. Sign in to read in full and take part.`
      : 'Teacher Pulse discussions are currently private.',
    feedUrl: `${origin}/teacher-pulse/c/${slug}/feed.xml`,
    siteUrl: `${origin}/teacher-pulse`,
    items,
  });
  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
