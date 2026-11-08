import { headers } from 'next/headers';
import { buildRobotsTxt } from '@/lib/seo-feeds';
import { isPreviewSuffix } from '@/lib/payment-mode';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Website-owned robots.txt (does NOT inherit backend rules). Host-aware:
  // preview hosts block all crawling; production advertises the www sitemap.
  const h = await headers();
  const preview = isPreviewSuffix(h.get('x-forwarded-host')) || isPreviewSuffix(h.get('host'));
  return new Response(buildRobotsTxt({ preview }), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
