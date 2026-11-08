import { renderPhotoOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/photo-og';
import { retreatPhotoCandidates, rotate } from '@/lib/server/og-photos';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Yoga Retreats in India · NOSTOPS';

export default async function OgImage() {
  const photoCandidates = rotate(await retreatPhotoCandidates(), 4);
  return renderPhotoOg({
    photoCandidates,
    eyebrow: 'YOGA RETREATS',
    title: 'Yoga Retreats in India',
    sub: 'Hosted by empanelled teachers you can trust',
    tag: 'Explore',
    footer: 'nostops.org/retreats',
  });
}
