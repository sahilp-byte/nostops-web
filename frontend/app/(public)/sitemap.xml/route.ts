import { buildSitemap } from '@/lib/server/sitemap-manifest';

export const dynamic = 'force-dynamic';

// Generated ENTIRELY from the one route manifest (lib/server/sitemap-manifest.ts).
// Any route family that failed to load is named in X-Sitemap-Skipped (and logged),
// so a partial sitemap is visible to monitoring instead of silently shrinking.
export async function GET() {
  const { xml, skipped, counts } = await buildSitemap();
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Sitemap-Skipped': skipped.join(',') || 'none',
      'X-Sitemap-Counts': Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(','),
    },
  });
}
