import sharp from 'sharp';
import { getPublicSpace } from '@/lib/server/spaces';
import { getObject } from '@/lib/server/object-storage';
import { renderPhotoOg } from '@/lib/server/photo-og';
import { SPACE_MODELS, SPACE_TYPES } from '@/lib/spaces';

// Share card for an APPROVED Space (1200x630 JPEG): its first photo full-bleed with NOSTOPS branding,
// name, locality, PIN and participation model. Public fields only — no owner details. Unapproved or
// unknown Spaces get the generic branded card (getPublicSpace returns approved Spaces only).
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/jpeg';

const clamp = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Space photos are same-origin /bff/media/retreats/... paths (Emergent Object Storage); read them directly.
async function photoDataUri(url?: string | null): Promise<string | null> {
  const m = /^\/bff\/media\/(retreats\/[^?#]+)$/.exec(url || '');
  if (!m || m[1].includes('..')) return null;
  try {
    const obj = await getObject(`nostops/${m[1]}`);
    if (!obj) return null;
    const jpg = await sharp(Buffer.from(obj.body)).resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function renderSpaceOg(id: string): Promise<Response> {
  const s = await getPublicSpace(id).catch(() => null);
  if (!s) return renderPhotoOg({ photoCandidates: [], title: 'Yoga spaces near you', sub: 'Community halls, studios and local spaces, checked by NOSTOPS', footer: 'nostops.org/spaces' });
  const loc = s.location || ({} as NonNullable<typeof s.location>);
  const facts = [SPACE_TYPES[s.space_type || ''], s.capacity ? `Up to ${s.capacity} people` : ''].filter(Boolean).join('   ·   ');
  return renderPhotoOg({
    photoDataUri: await photoDataUri(s.photos?.[0]),
    photoCandidates: [],
    eyebrow: [loc.locality, loc.district].filter(Boolean).join(', ').toUpperCase() + (loc.pin ? `  ·  PIN ${loc.pin}` : ''),
    title: clamp(s.name || 'NOSTOPS Space', 60),
    sub: facts || undefined,
    tag: SPACE_MODELS[s.model || '']?.label || 'NOSTOPS Space',
    tagAccent: true,
    footer: 'Checked by NOSTOPS  ·  nostops.org/spaces',
  });
}
