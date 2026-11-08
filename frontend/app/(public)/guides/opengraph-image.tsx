import { renderSiteOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/site-og';

// Branded share card for the Guides hub (/guides).
export const runtime = 'nodejs';
export const revalidate = 86400;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'NOSTOPS Guides';

export default function OgImage() {
  return renderSiteOg({
    eyebrow: 'NOSTOPS GUIDES',
    title: 'Yoga, explained — clearly and honestly',
    sub: 'Choosing a teacher · Paramparā · retreats · yoga for organisations',
    tag: 'Guides',
    footer: 'nostops.org/guides',
  });
}
