import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';
import { createLocalCenter, saveCenterExtra } from '@/lib/server/venue-local';
import { mirrorMyVenues } from '@/lib/server/venue-submissions-local';

// Create a venue Center (PROMPT 7/8). CSRF-guarded, whitelisted -> POST
// /retreats/centers. Backend owns owner-eligibility (403 for non-owners).
const s = (v: any): string => (typeof v === 'string' ? v.trim() : '');
const clip = (v: any, len: number): string => s(v).slice(0, len);
const strArr = (v: any): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean).slice(0, 30) : [];

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const raw = await req.json().catch(() => ({}));

  const name = clip(raw.name, 120);
  const city = clip(raw.city, 80);
  const capacity = Math.floor(Number(raw.capacity));
  if (name.length < 3) return NextResponse.json({ error: 'Enter a venue name.' }, { status: 400 });
  if (city.length < 2) return NextResponse.json({ error: 'Enter the venue city.' }, { status: 400 });
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 1000) {
    return NextResponse.json({ error: 'Capacity must be between 1 and 1000.' }, { status: 400 });
  }

  const body: Record<string, unknown> = { name, city, capacity, open_to_partnerships: raw.open_to_partnerships !== false };
  const address = clip(raw.address, 200);
  if (address) body.address = address;
  const state = clip(raw.state, 60);
  if (state) body.state = state;
  const pincode = clip(raw.pincode, 12);
  if (pincode) body.pincode = pincode;
  const food = clip(raw.food_type, 40);
  if (food) body.food_type = food;
  const feature = clip(raw.distinguishing_feature, 500);
  if (feature) body.distinguishing_feature = feature;
  const amenities = strArr(raw.amenities);
  if (amenities.length) body.amenities = amenities;
  const roomTypes = strArr(raw.room_types);
  if (roomTypes.length) body.room_types = roomTypes;
  const mapsUrl = clip(raw.website_or_maps_url, 400);
  if (mapsUrl) body.website_or_maps_url = mapsUrl;
  const country = clip(raw.country, 60);
  if (country) body.country = country;
  const photos = strArr(raw.photos).slice(0, 5);
  if (photos.length) body.photos = photos;

  const up = await backendFetch('/retreats/centers', { method: 'POST', body: JSON.stringify(body) });
  const data = await up.json().catch(() => ({}));
  if (up.ok) {
    const id = (data as any)?.center_id || (data as any)?.center?.center_id || (data as any)?.id;
    await mirrorNew(id, body);
    if (id) await saveCenterExtra(String(id), { websiteOrMapsUrl: mapsUrl, country }).catch(() => {});
    return NextResponse.json({ ok: true, data });
  }

  // The remote endpoint is currently 500ing for every eligible owner. Rather
  // than dead-ending the teacher, fall back to the local venue-centers store so
  // the venue is created and appears in their studio. (Remote-first: when the
  // backend endpoint is fixed, the successful path above resumes automatically.)
  if (up.status >= 500 || up.status === 404) {
    const local = await createLocalCenter(body);
    if (local.ok) {
      await mirrorNew(local.center?.id, body);
      if (local.center?.id) await saveCenterExtra(local.center.id, { websiteOrMapsUrl: mapsUrl, country }).catch(() => {});
      return NextResponse.json({ ok: true, data: { center_id: local.center?.id, ...local.center }, local: true });
    }
  }

  const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail;
  return NextResponse.json({ error: toErrorText(detail, 'Could not create the venue.') }, { status: up.status || 502 });
}

// Immediately mirror a newly-created venue into the local admin review store so
// admins see it in the Venue Submissions console right away (no studio re-open
// needed). Best-effort; never blocks the create response.
async function mirrorNew(id: unknown, body: Record<string, unknown>): Promise<void> {
  const cid = typeof id === 'string' && id.trim() ? id.trim() : '';
  if (!cid) return;
  await mirrorMyVenues([
    {
      center_id: cid,
      name: String(body.name || ''),
      city: String(body.city || ''),
      state: String(body.state || ''),
      address: String(body.address || ''),
      capacity: typeof body.capacity === 'number' ? body.capacity : undefined,
      amenities: Array.isArray(body.amenities) ? (body.amenities as string[]) : [],
      room_types: Array.isArray(body.room_types) ? (body.room_types as string[]) : [],
      food_type: String(body.food_type || ''),
      distinguishing_feature: String(body.distinguishing_feature || ''),
      open_to_partnerships: body.open_to_partnerships !== false,
    },
  ]).catch(() => {});
}
