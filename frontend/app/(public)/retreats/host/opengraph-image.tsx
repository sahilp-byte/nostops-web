import { renderPhotoOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/photo-og';
import { retreatPhotoCandidates, rotate } from '@/lib/server/og-photos';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Host a Yoga Retreat on NOSTOPS';

export default async function OgImage() {
  const photoCandidates = rotate(await retreatPhotoCandidates(), 3);
  return renderPhotoOg({
    photoCandidates,
    eyebrow: 'HOST A RETREAT',
    title: 'Your Teaching. A Deeper Journey.',
    sub: 'Lead a teacher-led yoga retreat at a trusted venue — free to publish.',
    tag: 'For teachers',
    footer: 'nostops.org/retreats/host',
  });
}
