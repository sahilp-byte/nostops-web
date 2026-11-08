import 'server-only';
import type { VenueEnrichment, VenueReview, VenuePhoto } from './retreats';

// Server-only Google Places API (New) client for venue/retreat hero photos.
// The API key NEVER reaches the browser. Per Google Maps Platform policy we may
// persist a place_id, but we must NOT cache photo bytes / photoUri / photo
// resource names — those are fetched fresh on every request (see BFF proxy).
// Attribution from authorAttributions[] must always be displayed with the photo.
const KEY = process.env.GOOGLE_MAPS_PLATFORM_API_KEY || '';
const BASE = 'https://places.googleapis.com/v1';
const TIMEOUT = 8000;

export type Attribution = { displayName: string; uri?: string };
export type HeroPhoto = { placeId: string; attributions: Attribution[] };

function enabled(): boolean {
  return !!KEY;
}

async function gfetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { ...(init.headers || {}), 'X-Goog-Api-Key': KEY },
  });
}

function cityTokens(city?: string, state?: string): string[] {
  return [city, state]
    .filter(Boolean)
    .flatMap((s) => String(s).toLowerCase().split(/[^a-z]+/))
    .filter((t) => t.length > 3);
}

// place_id is explicitly cacheable per Google policy.
const idCache = new Map<string, { id: string | null; exp: number }>();
const TTL_OK = 6 * 60 * 60 * 1000; // 6h
const TTL_MISS = 30 * 60 * 1000; // 30m

export type PlaceCandidate = { id: string; name?: string; address?: string };

/** Admin lookup: up to 5 Google places for a free-text query, so the admin can
 *  pick the exact business (never auto-chosen). */
export async function searchPlaces(query: string): Promise<PlaceCandidate[]> {
  const q = query.trim().replace(/\s+/g, ' ').slice(0, 200);
  if (!enabled() || !q) return [];
  try {
    const r = await gfetch(`${BASE}/places:searchText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress' },
      body: JSON.stringify({ textQuery: q, pageSize: 5 }),
    });
    if (!r.ok) return [];
    const d: { places?: Array<{ id?: string; displayName?: { text?: string }; formattedAddress?: string }> } = await r.json();
    return (d.places || [])
      .filter((p) => typeof p.id === 'string' && !!p.id)
      .map((p) => ({ id: p.id as string, name: p.displayName?.text, address: p.formattedAddress }));
  } catch {
    return [];
  }
}

export async function resolvePlaceId(name: string, city?: string, state?: string): Promise<string | null> {
  if (!enabled() || !name) return null;
  const q = `${name} ${city || ''} ${state || ''}`.trim().replace(/\s+/g, ' ');
  const ck = q.toLowerCase();
  const now = Date.now();
  const hit = idCache.get(ck);
  if (hit && hit.exp > now) return hit.id;
  try {
    const r = await gfetch(`${BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
      },
      body: JSON.stringify({ textQuery: q, pageSize: 3 }),
    });
    if (!r.ok) {
      idCache.set(ck, { id: null, exp: now + TTL_MISS });
      return null;
    }
    const d: { places?: Array<{ id: string; formattedAddress?: string }> } = await r.json();
    const places = d.places || [];
    // Verify the candidate's address matches the city/state so we never show a
    // wrong business as the hero (Google warns against trusting the first hit).
    const toks = cityTokens(city, state);
    const match =
      places.find((p) => {
        const addr = String(p.formattedAddress || '').toLowerCase();
        return toks.length === 0 || toks.some((t) => addr.includes(t));
      }) || (toks.length === 0 ? places[0] : null);
    const id = match?.id || null;
    idCache.set(ck, { id, exp: now + (id ? TTL_OK : TTL_MISS) });
    return id;
  } catch {
    idCache.set(ck, { id: null, exp: now + TTL_MISS });
    return null;
  }
}

export async function getFirstPhoto(
  placeId: string,
): Promise<{ photoName: string; attributions: Attribution[] } | null> {
  if (!enabled() || !placeId) return null;
  try {
    const r = await gfetch(`${BASE}/places/${encodeURIComponent(placeId)}`, {
      method: 'GET',
      headers: { 'X-Goog-FieldMask': 'photos.name,photos.authorAttributions' },
    });
    if (!r.ok) return null;
    const d: { photos?: Array<{ name?: string; authorAttributions?: Attribution[] }> } = await r.json();
    const photo = (d.photos || [])[0];
    if (!photo?.name) return null;
    const attributions = (photo.authorAttributions || []).map((a) => ({ displayName: a.displayName, uri: a.uri }));
    return { photoName: photo.name, attributions };
  } catch {
    return null;
  }
}

/** Fetch the live photo bytes. Photo resource names can expire, so this is only
 *  ever called with a freshly-read name and the result is streamed, never stored. */
export async function getPhotoResponse(photoName: string, maxWidthPx = 1600): Promise<Response | null> {
  if (!enabled() || !photoName) return null;
  try {
    const meta = await gfetch(`${BASE}/${photoName}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`, {
      method: 'GET',
    });
    if (!meta.ok) return null;
    const m: { photoUri?: string } = await meta.json();
    if (!m.photoUri) return null;
    const img = await fetch(m.photoUri, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT) });
    if (!img.ok || !img.body) return null;
    return img;
  } catch {
    return null;
  }
}

// ── Place Details (New): photos + reviews + rating for a PINNED place_id. ─────
// Used by the paid AI-assisted venue profiles when there is no retreat-connected
// backend enrichment. Cached briefly (metadata only — photo BYTES are always
// fetched fresh via the proxy) to keep Places billing sane.
const detailsCache = new Map<string, { data: VenueEnrichment | null; exp: number }>();
const TTL_DETAILS = 30 * 60 * 1000; // 30m

export async function getPlaceDetails(placeId: string): Promise<VenueEnrichment | null> {
  if (!enabled() || !placeId) return null;
  const now = Date.now();
  const hit = detailsCache.get(placeId);
  if (hit && hit.exp > now) return hit.data;
  try {
    const r = await gfetch(`${BASE}/places/${encodeURIComponent(placeId)}`, {
      method: 'GET',
      headers: {
        'X-Goog-FieldMask':
          'id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri,websiteUri,internationalPhoneNumber,photos.name,photos.authorAttributions,reviews.rating,reviews.text,reviews.originalText,reviews.relativePublishTimeDescription,reviews.authorAttribution',
      },
    });
    if (!r.ok) {
      detailsCache.set(placeId, { data: null, exp: now + TTL_MISS });
      return null;
    }
    const d: any = await r.json();
    const reviews: VenueReview[] = (Array.isArray(d.reviews) ? d.reviews : [])
      .map((rv: any) => ({
        author: rv.authorAttribution?.displayName,
        authorPhoto: rv.authorAttribution?.photoUri,
        rating: typeof rv.rating === 'number' ? rv.rating : undefined,
        text: (rv.text?.text ?? rv.originalText?.text) || undefined,
        relativeTime: rv.relativePublishTimeDescription,
      }))
      .filter((x: VenueReview) => x.text || x.author);
    const photos: VenuePhoto[] = (Array.isArray(d.photos) ? d.photos : [])
      .map((p: any) => ({ name: p.name, attribution: p.authorAttributions?.[0]?.displayName }))
      .filter((p: VenuePhoto) => typeof p.name === 'string' && !!p.name)
      .slice(0, 12);
    const data: VenueEnrichment = {
      name: d.displayName?.text,
      address: d.formattedAddress,
      rating: typeof d.rating === 'number' ? d.rating : undefined,
      reviewCount: typeof d.userRatingCount === 'number' ? d.userRatingCount : undefined,
      mapsUri: d.googleMapsUri,
      websiteUri: d.websiteUri,
      phone: d.internationalPhoneNumber,
      reviews,
      photos,
    };
    detailsCache.set(placeId, { data, exp: now + TTL_DETAILS });
    return data;
  } catch {
    detailsCache.set(placeId, { data: null, exp: now + TTL_MISS });
    return null;
  }
}

// Caches only the resolved place_id + attribution text (never photo bytes).
const heroCache = new Map<string, { hero: HeroPhoto | null; exp: number }>();

/** Resolve the first confident place (that actually has a photo) from an ordered
 *  candidate list. Returns null when disabled or nothing matches — callers then
 *  fall back to their existing cover image / gradient. */
export async function resolveHero(
  candidates: { name?: string; city?: string; state?: string }[],
): Promise<HeroPhoto | null> {
  if (!enabled()) return null;
  const list = candidates.slice(0, 6);
  const sig = list.map((c) => `${c.name || ''}|${c.city || ''}`).join('~').toLowerCase();
  const now = Date.now();
  const hit = heroCache.get(sig);
  if (hit && hit.exp > now) return hit.hero;

  let result: HeroPhoto | null = null;
  for (const c of list) {
    if (!c.name) continue;
    const id = await resolvePlaceId(c.name, c.city, c.state);
    if (!id) continue;
    const photo = await getFirstPhoto(id);
    if (photo) {
      result = { placeId: id, attributions: photo.attributions };
      break;
    }
  }
  heroCache.set(sig, { hero: result, exp: now + (result ? 60 * 60 * 1000 : 10 * 60 * 1000) });
  return result;
}
