import { renderSiteOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/site-og';
import { getGuide } from '@/lib/guides';

// Per-guide branded share card (/guides/{slug}).
export const runtime = 'nodejs';
export const revalidate = 86400;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS Guide';

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = getGuide(slug);
  return renderSiteOg({
    eyebrow: 'NOSTOPS GUIDE',
    title: g?.title || 'NOSTOPS Guides',
    sub: g?.topic,
    tag: 'Guide',
    footer: `nostops.org/guides${g ? `/${g.slug}` : ''}`,
  });
}
