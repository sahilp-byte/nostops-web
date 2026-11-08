import { renderSiteOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/site-og';

// Contextual branded card for the teacher progression explainer (/levels).
export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Yoga Teacher Levels on NOSTOPS';

export default function OgImage() {
  return renderSiteOg({
    eyebrow: 'THE PROGRESSION PATH',
    title: 'Yoga Teacher Levels',
    sub: 'Yoga Shikshak · Yoga Pracharak · Yoga Guru — merit-based, not gatekeeping',
    tag: 'Levels',
    footer: 'nostops.org/levels',
  });
}
