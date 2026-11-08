import { renderPhotoOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/photo-og';
import { venuePhotoCandidates } from '@/lib/server/og-photos';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Yoga & Retreat Venues · NOSTOPS';

export default async function OgImage() {
  const photoCandidates = await venuePhotoCandidates();
  return renderPhotoOg({
    photoCandidates,
    eyebrow: 'YOGA & RETREAT VENUES',
    title: 'Venues for Yoga & Retreats',
    sub: 'Spaces for authentic practice across India',
    tag: 'Explore',
    footer: 'nostops.org/venues',
  });
}
