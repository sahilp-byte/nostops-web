import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import { venuePath, getVenue, type PublicVenue } from './venues';
import { getFirstPhoto, type HeroPhoto } from './google-places';

// ─────────────────────────────────────────────────────────────────────────────
// WHO MAY SHOW GOOGLE PHOTOS & REVIEWS — paid AI-assisted venues only.
//
// Google Places content (photos + reviews + rating) on a venue listing is part
// of the PAID, one-time, per-venue AI-assisted onboarding. A venue qualifies
// when EITHER:
//   1. it is one of the GRANDFATHERED listings below — venues that were already
//      showing Google content before payments were tied to a venue. They are
//      treated as admin-confirmed and keep their pinned Google Place ID; or
//   2. its listing has an active AI-onboarding purchase (local
//      ai_onboarding_entitlements, keyed by the venue listing id). Its Google
//      Place ID is confirmed by an admin from the venue review screen.
// Free listings never trigger a Google lookup; they show the owner's photos.
// ─────────────────────────────────────────────────────────────────────────────
type Entry = { placeId: string; paths: string[]; names: string[] };

// Matched by the public venue path (/venues/in/<city>/<venue>) OR the
// lower-cased venue name, so it is robust to either route shape. These cover
// the 4 live listings (Villa Lumina and Vila Girasoles share one Google place).
const GRANDFATHERED_VENUES: Entry[] = [
  {
    // Pinakoti Lodge — Pinakates, Thessaly (Greece)
    placeId: 'ChIJ2-NtfmwRpxQR23HBNr_vDPw',
    paths: ['/venues/in/pinakates/pinakoti-lodge'],
    names: ['pinakoti lodge'],
  },
  {
    // Villa Lumina on Maremma coast in Tuscany (Google listing: "Villa Lumina" /
    // "Vila Girasoles") — Campiglia Marittima, Tuscany (Italy)
    placeId: 'ChIJ1WVN61fgKRMRd5a7p8IqpCE',
    paths: ['/venues/in/campiglia-marittima-maremma-coast/villa-lumina-on-maremma-coast-in-tuscany-italy'],
    names: ['villa lumina on maremma coast in tuscany, italy', 'villa lumina', 'vila girasoles'],
  },
  {
    // Nirvana Yoga School — Tapovan, Rishikesh, Uttarakhand (India)
    placeId: 'ChIJwb0mawgXCTkRPOnJacGoUys',
    paths: ['/venues/in/rishikesh/nirvana-yoga-school'],
    names: ['nirvana yoga school'],
  },
];

/** Pinned Google Place ID for a grandfathered (admin-confirmed) venue, or null. */
export function grandfatheredPlaceId(v: Pick<PublicVenue, 'id' | 'name' | 'city' | 'state'>): string | null {
  const path = venuePath(v as PublicVenue).toLowerCase();
  const name = (v.name || '').trim().toLowerCase();
  for (const e of GRANDFATHERED_VENUES) {
    if (e.paths.some((p) => p.toLowerCase() === path)) return e.placeId;
    if (e.names.includes(name)) return e.placeId;
  }
  return null;
}

// Paid listings (server-only read of the local AI-onboarding store), cached briefly.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
type PaidVenue = { submissionId: string; placeId: string | null };
let paidCache: { at: number; list: PaidVenue[] } | null = null;

async function getPaidVenues(): Promise<PaidVenue[]> {
  if (paidCache && Date.now() - paidCache.at < 60_000) return paidCache.list;
  if (!SECRET) return [];
  try {
    const r = await fetch(`${BASE}/api/ai-onboarding/entitlements`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return paidCache?.list ?? [];
    const d = await r.json().catch(() => null);
    const list: PaidVenue[] = (Array.isArray(d?.venues) ? d.venues : [])
      .map((x: Record<string, unknown>) => ({ submissionId: String(x.submission_id || ''), placeId: typeof x.place_id === 'string' && x.place_id ? x.place_id : null }))
      .filter((x: PaidVenue) => !!x.submissionId);
    paidCache = { at: Date.now(), list };
    return list;
  } catch {
    return paidCache?.list ?? [];
  }
}

// Venues an admin switched Google content on for (no purchase), cached briefly.
type GrantedVenue = { venueId: string; placeId: string };
let grantCache: { at: number; list: GrantedVenue[] } | null = null;

async function getGrantedVenues(): Promise<GrantedVenue[]> {
  if (grantCache && Date.now() - grantCache.at < 60_000) return grantCache.list;
  if (!SECRET) return [];
  try {
    const r = await fetch(`${BASE}/api/venues/google-grants`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return grantCache?.list ?? [];
    const d = await r.json().catch(() => null);
    const list: GrantedVenue[] = (Array.isArray(d?.venues) ? d.venues : [])
      .map((x: Record<string, unknown>) => ({ venueId: String(x.venue_id || ''), placeId: typeof x.place_id === 'string' ? x.place_id : '' }))
      .filter((x: GrantedVenue) => !!x.venueId && !!x.placeId);
    grantCache = { at: Date.now(), list };
    return list;
  } catch {
    return grantCache?.list ?? [];
  }
}

export type GoogleAccess = { allowed: boolean; placeId: string | null; basis: 'grandfathered' | 'paid' | 'admin' | null };

/** May this venue listing show Google photos/reviews — and from which pinned place? */
export async function googleAccess(v: Pick<PublicVenue, 'id' | 'name' | 'city' | 'state'>): Promise<GoogleAccess> {
  const g = grandfatheredPlaceId(v);
  if (g) return { allowed: true, placeId: g, basis: 'grandfathered' };
  const paid = (await getPaidVenues()).find((p) => p.submissionId === v.id);
  if (paid) return { allowed: true, placeId: paid.placeId, basis: 'paid' };
  const granted = (await getGrantedVenues()).find((x) => x.venueId === v.id);
  if (granted) return { allowed: true, placeId: granted.placeId, basis: 'admin' };
  return { allowed: false, placeId: null, basis: null };
}

/** Directory cards: an eligible venue without an owner photo shows its Google
 *  photo (streamed by the hero proxy; never stored), flagged for attribution. */
export async function withGoogleCovers<T extends PublicVenue>(venues: T[]): Promise<T[]> {
  return Promise.all(
    venues.map(async (v) => {
      if (v.coverImage) return v;
      const a = await googleAccess(v);
      if (!a.allowed || !a.placeId) return v;
      return { ...v, coverImage: `/bff/venue-photo/hero?place_id=${encodeURIComponent(a.placeId)}`, coverFromGoogle: true };
    }),
  );
}

/** Pinned place ids of the eligible venues in `venues` (order kept, de-duplicated). */
export async function eligiblePlaceIds(venues: Pick<PublicVenue, 'id' | 'name' | 'city' | 'state'>[]): Promise<string[]> {
  const out: string[] = [];
  for (const v of venues) {
    const a = await googleAccess(v);
    if (a.placeId && !out.includes(a.placeId)) out.push(a.placeId);
  }
  return out;
}

/** True when a place id belongs to an eligible (grandfathered, paid or admin-switched-on) venue. */
export async function isEligiblePlaceId(placeId: string): Promise<boolean> {
  if (GRANDFATHERED_VENUES.some((e) => e.placeId === placeId)) return true;
  if ((await getPaidVenues()).some((p) => p.placeId === placeId)) return true;
  return (await getGrantedVenues()).some((x) => x.placeId === placeId);
}

/** Ids of venues that carry the "Enhanced Listing" badge: paid AI-assisted
 *  onboarding, or grandfathered. Admin-switched-on Google content alone is not
 *  an Enhanced Listing (no AI-assisted onboarding). */
export async function enhancedVenueIds(venues: Pick<PublicVenue, 'id' | 'name' | 'city' | 'state'>[]): Promise<string[]> {
  const out: string[] = [];
  for (const v of venues) {
    const a = await googleAccess(v);
    if (a.allowed && a.basis !== 'admin') out.push(v.id);
  }
  return out;
}

// Caches only the chosen place_id + attribution text (never photo bytes/names).
const heroCache = new Map<string, { hero: HeroPhoto | null; exp: number }>();

/** Page hero from the first ELIGIBLE venue (grandfathered or paid) that has a
 *  Google photo. Free venues are never used. Null → caller's cover/gradient. */
export async function resolveEligibleHero(venues: Pick<PublicVenue, 'id' | 'name' | 'city' | 'state'>[]): Promise<HeroPhoto | null> {
  const ids = (await eligiblePlaceIds(venues)).slice(0, 6);
  const sig = ids.join('~');
  if (!sig) return null;
  const hit = heroCache.get(sig);
  if (hit && hit.exp > Date.now()) return hit.hero;
  let hero: HeroPhoto | null = null;
  for (const placeId of ids) {
    const photo = await getFirstPhoto(placeId);
    if (photo) {
      hero = { placeId, attributions: photo.attributions };
      break;
    }
  }
  heroCache.set(sig, { hero, exp: Date.now() + (hero ? 60 : 10) * 60 * 1000 });
  return hero;
}

/** A retreat may show its venue's Google photos/reviews only when it is bound
 *  to an eligible (grandfathered or paid) listed venue. */
export async function retreatGoogleAllowed(r: { venuePartnerId?: string | null; venueName?: string; city?: string; state?: string }): Promise<boolean> {
  if (!r.venuePartnerId) return false;
  const v = await getVenue(r.venuePartnerId).catch(() => null);
  return (await googleAccess(v ?? { id: r.venuePartnerId, name: r.venueName || '', city: r.city, state: r.state })).allowed;
}
