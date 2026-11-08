import { renderSiteOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/site-og';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Yoga Retreats in India · NOSTOPS';

export default function TwitterImage() {
  return renderSiteOg({
    eyebrow: 'YOGA RETREATS',
    title: 'Yoga Retreats in India',
    sub: 'Hosted by empanelled teachers you can trust',
    tag: 'Explore',
    footer: 'nostops.org/retreats',
  });
}
