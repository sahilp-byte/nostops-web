import { renderPhotoOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/photo-og';
import { venuePhotoCandidates, rotate } from '@/lib/server/og-photos';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'List your venue on NOSTOPS';

export default async function OgImage() {
  const photoCandidates = rotate(await venuePhotoCandidates(), 1);
  return renderPhotoOg({
    photoCandidates,
    eyebrow: 'LIST YOUR VENUE',
    title: 'Your Space. Their Practice.',
    sub: 'List free — reach yoga teachers, retreat creators & organisations.',
    tag: 'Free',
    tagAccent: true,
    footer: 'nostops.org/list-your-venue',
  });
}
