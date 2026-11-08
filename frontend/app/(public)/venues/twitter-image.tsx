import { renderSiteOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/site-og';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Yoga & Retreat Venues · NOSTOPS';

export default function TwitterImage() {
  return renderSiteOg({
    eyebrow: 'YOGA & RETREAT VENUES',
    title: 'Venues for Yoga & Retreats',
    sub: 'Spaces for authentic practice across India',
    tag: 'Explore',
    footer: 'nostops.org/venues',
  });
}
