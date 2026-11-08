import type { NextRequest } from 'next/server';
import { getFirstPhoto, getPhotoResponse } from '@/lib/server/google-places';
import { isEligiblePlaceId } from '@/lib/server/ai-assisted-venues';

// Same-origin proxy for a Google Places hero photo. The Google key stays server-
// side; the browser only ever sees this URL. Nothing is cached (Google policy):
// the photo name is read fresh and the bytes are streamed with no-store.
// Only the pinned place of an ELIGIBLE (grandfathered or paid) venue is served —
// free venues never show Google photos, and arbitrary name lookups are refused.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('place_id') || '';
  if (!/^[A-Za-z0-9_-]{10,400}$/.test(placeId) || !(await isEligiblePlaceId(placeId))) {
    return new Response('no place', { status: 404 });
  }

  const photo = await getFirstPhoto(placeId);
  if (!photo) return new Response('no photo', { status: 404 });

  const img = await getPhotoResponse(photo.photoName, 1600);
  if (!img || !img.body) return new Response('photo unavailable', { status: 502 });

  return new Response(img.body, {
    headers: {
      'Content-Type': img.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
