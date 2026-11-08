import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';
import { isLocalCenterId, updateLocalCenter, saveCenterExtra } from '@/lib/server/venue-local';

// Edit a venue Center. CSRF-guarded, whitelisted -> PATCH /retreats/centers/{id}.
// Only fields the owner actually changed are forwarded (all optional).
const s = (v: any): string => (typeof v === 'string' ? v.trim() : '');
const clip = (v: any, len: number): string => s(v).slice(0, len);
const strArr = (v: any): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean).slice(0, 30) : [];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'missing venue id' }, { status: 400 });
  const raw = await req.json().catch(() => ({}));

  const body: Record<string, unknown> = {};
  if (typeof raw.name === 'string') {
    const name = clip(raw.name, 120);
    if (name.length < 3) return NextResponse.json({ error: 'Enter a venue name.' }, { status: 400 });
    body.name = name;
  }
  if (typeof raw.city === 'string') body.city = clip(raw.city, 80);
  if (typeof raw.address === 'string') body.address = clip(raw.address, 200);
  if (typeof raw.state === 'string') body.state = clip(raw.state, 60);
  if (typeof raw.country === 'string') body.country = clip(raw.country, 60);
  if (typeof raw.food_type === 'string') body.food_type = clip(raw.food_type, 40);
  if (typeof raw.distinguishing_feature === 'string') body.distinguishing_feature = clip(raw.distinguishing_feature, 500);
  if (typeof raw.website_or_maps_url === 'string') body.website_or_maps_url = clip(raw.website_or_maps_url, 400);
  if (raw.capacity !== undefined) {
    const capacity = Math.floor(Number(raw.capacity));
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 1000) return NextResponse.json({ error: 'Capacity must be between 1 and 1000.' }, { status: 400 });
    body.capacity = capacity;
  }
  if (Array.isArray(raw.amenities)) body.amenities = strArr(raw.amenities);
  if (Array.isArray(raw.room_types)) body.room_types = strArr(raw.room_types);
  if (Array.isArray(raw.photos)) body.photos = raw.photos.map((x: unknown) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean).slice(0, 5);
  if (typeof raw.open_to_partnerships === 'boolean') body.open_to_partnerships = raw.open_to_partnerships;
  if (typeof raw.is_active === 'boolean') body.is_active = raw.is_active;

  if (Object.keys(body).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  // Persist the Google/website link + country to the local extras store too, so
  // they round-trip even for remote (ctr_*) centers whose backend drops them.
  if (typeof body.website_or_maps_url === 'string' || typeof body.country === 'string') {
    await saveCenterExtra(id, {
      ...(typeof body.website_or_maps_url === 'string' ? { websiteOrMapsUrl: body.website_or_maps_url as string } : {}),
      ...(typeof body.country === 'string' ? { country: body.country as string } : {}),
    }).catch(() => {});
  }

  // Locally-stored venues (created via the fallback) are edited in the local store.
  if (isLocalCenterId(id)) {
    const local = await updateLocalCenter(id, body);
    if (!local.ok) return NextResponse.json({ error: local.error || 'Could not update the venue.' }, { status: 502 });
    return NextResponse.json({ ok: true, local: true });
  }

  const up = await backendFetch(`/retreats/centers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail;
    return NextResponse.json({ error: toErrorText(detail, 'Could not update the venue.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, data });
}
