import { renderPhotoOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/photo-og';
import { venuePhotoCandidates } from '@/lib/server/og-photos';

// About page share card — a WARM real venue photo (Ganga/Rishikesh sunrise)
// behind the NOSTOPS story, matching the venue/retreat photo cards. Falls back
// through other live venue scenery, then the branded card, if none load.
export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'About NOSTOPS — A Teacher-First Yoga Cooperative';

export default async function OgImage() {
  const photoCandidates = await venuePhotoCandidates();
  return renderPhotoOg({
    photoCandidates,
    eyebrow: 'ABOUT NOSTOPS',
    title: 'A Teacher-First Yoga Cooperative',
    sub: 'Honouring the teacher. Preserving the tradition. Serving the world.',
    tag: 'Our Story',
    footer: 'nostops.org/about',
  });
}
