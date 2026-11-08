// Server-only PUBLIC venue data access (PROMPT 8 — venue as a first-class entity).
// Venues are read from the EXISTING backend, no business logic re-implemented:
//   GET /venue-partners                              -> curated venue directory
//   GET /retreats                                    -> retreats (linked by venue_partner_id)
//   GET /venue-enrichment/retreats/{id}/venue        -> Google Place (rating/reviews/photos)
// Confidential Teacher–Venue negotiated economics are NEVER surfaced here.
import { apiGetSafe } from '@/lib/api';
import { fitDescription } from '@/lib/seo';
import { titleCase } from '@/lib/format';
import { haversineKm, hasCoords, countryFromCoords } from '@/lib/geo';
import { getPublicRetreats, getVenueEnrichment, type PublicRetreat, type VenueEnrichment } from '@/lib/server/retreats';
import { getPublishedVenues } from '@/lib/server/venue-submissions-local';
import { getCuration } from '@/lib/server/site-curation';
import { venuePath, venueCitySlug, venueNameSlug } from '@/lib/venue-url';
import type { Metadata } from 'next';

const num = (v: any): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: any): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const arr = (v: any): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((s) => s.trim()) : []);

export type VenueGettingThere = {
  nearestAirport?: string;
  nearestRailway?: string;
  nearestRoadHub?: string;
  localTransport?: string;
  text?: string;
};

export type PublicVenue = {
  id: string;
  /** Last change (epoch ms or ISO) when the source provides it — sitemap <lastmod>. */
  updatedAt?: number | string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lng?: number;
  capacity?: number;
  coverImage?: string | null;
  /** The cover is a Google listing photo (needs a "Photo: Google" credit). */
  coverFromGoogle?: boolean;
  summary?: string;
  bestForFramings: string[];
  photos?: string[];
  amenities?: string[];
  sattvicCertified: boolean;
  openMonths: string[];
  gettingThere?: VenueGettingThere;
  thingsToCarry: string[];
  weatherBand?: string;
  videoUrl?: string;
  websiteOrMapsUrl?: string;
  googleBusinessUrl?: string;
  /** NOSTOPS Partner badge: the venue shares NOSTOPS on its own website (local listings only). */
  growthPartner?: boolean;
};

// Backend `getting_there` is EITHER a rich object (nearest_airport/railway/road_hub/
// local_transport) OR a legacy free-text string. Normalise both to VenueGettingThere.
function parseGettingThere(v: any): VenueGettingThere | undefined {
  if (typeof v === 'string' && v.trim()) return { text: v.trim() };
  if (v && typeof v === 'object') {
    const g: VenueGettingThere = {
      nearestAirport: str(v.nearest_airport),
      nearestRailway: str(v.nearest_railway),
      nearestRoadHub: str(v.nearest_road_hub),
      localTransport: str(v.local_transport),
    };
    return Object.values(g).some(Boolean) ? g : undefined;
  }
  return undefined;
}

export function mapVenue(v: any): PublicVenue | null {
  const id = str(v?.venue_id);
  if (!id) return null;
  return {
    id,
    name: v.name || 'NOSTOPS Venue',
    city: str(v.city),
    state: str(v.state),
    country: str(v.country) || countryFromCoords(num(v.lat), num(v.lng)) || undefined,
    lat: num(v.lat),
    lng: num(v.lng),
    capacity: num(v.capacity),
    coverImage: typeof v.cover_image === 'string' && /^https?:\/\//.test(v.cover_image) ? v.cover_image : null,
    summary: str(v.summary),
    bestForFramings: arr(v.best_for_framings),
    photos: arr(v.photos),
    amenities: arr(v.amenities),
    sattvicCertified: v.sattvic_certified === true,
    openMonths: arr(v.open_months),
    gettingThere: parseGettingThere(v.getting_there),
    thingsToCarry: arr(v.things_to_carry),
    weatherBand: str(v.weather_band),
    videoUrl: str(v.video_url),
    websiteOrMapsUrl: str(v.website_or_maps_url),
    googleBusinessUrl: str(v.google_business_url),
  };
}

/** Venues that can be BOUND to a retreat via `venue_partner_id`. These come
 *  ONLY from the remote `/venue-partners` directory, because the remote retreat
 *  backend validates `venue_partner_id` against its OWN partner venues and
 *  rejects anything else with HTTP 422. Admin-published LOCAL submissions are
 *  display-only (they have no remote partner id) and are intentionally EXCLUDED
 *  here — binding one would dead-end at the backend. This is the authoritative
 *  eligible set for the retreat create/edit venue picker + BFF validation. */
export async function getBindableVenues(opts: { city?: string; framing?: string; limit?: number; includeRemoved?: boolean } = {}): Promise<PublicVenue[]> {
  const qs = new URLSearchParams();
  if (opts.city) qs.set('city', opts.city);
  if (opts.framing) qs.set('framing', opts.framing);
  qs.set('limit', String(opts.limit ?? 100));
  const [d, removed] = await Promise.all([
    apiGetSafe<{ venues?: any[] }>(`/venue-partners?${qs.toString()}`, { venues: [] }, { revalidate: 900 }),
    removedVenueIds(opts.includeRemoved),
  ]);
  return (Array.isArray(d?.venues) ? d.venues : [])
    .filter((v) => String(v?.status ?? 'active') === 'active')
    .map(mapVenue)
    .filter((v): v is PublicVenue => v !== null && !removed.has(v.id));
}

// Admin › Homepage & Listings "Delete": a removed venue leaves every public venue surface (and the
// retreat venue picker). The venue record itself is untouched; Restore brings it back.
async function removedVenueIds(includeRemoved?: boolean): Promise<Set<string>> {
  return includeRemoved ? new Set() : (await getCuration()).removedVenues;
}

/** Curated, publicly discoverable venues (active partners) MERGED with
 *  admin-published local submissions (the remote /venue-partners directory is
 *  frozen, so admin "publish" is exposed via a local store and merged here).
 *  This is the PUBLIC DISPLAY directory — for retreat BINDING use
 *  getBindableVenues() (remote-eligible only). */
export async function getVenues(opts: { city?: string; framing?: string; limit?: number; includeRemoved?: boolean } = {}): Promise<PublicVenue[]> {
  const [remote, published, removed] = await Promise.all([
    getBindableVenues(opts),
    getPublishedVenues().catch(() => []),
    removedVenueIds(opts.includeRemoved),
  ]);

  // Merge admin-published local venues, de-duplicated against the remote set by
  // normalized name+city (and id), so an admin "Approve & Publish" actually goes
  // live in the public directory.
  const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const seen = new Set(remote.map((v) => `${norm(v.name)}|${norm(v.city)}`));
  const seenIds = new Set(remote.map((v) => v.id));
  const localMapped: PublicVenue[] = [];
  for (const p of published) {
    const key = p.dedupeKey || `${norm(p.name)}|${norm(p.city)}`;
    if (seen.has(key) || seenIds.has(p.id) || removed.has(p.id)) continue;
    seen.add(key);
    localMapped.push({
      id: p.id,
      name: p.name,
      city: p.city,
      state: p.state,
      country: p.country || countryFromCoords(p.lat, p.lng) || undefined,
      lat: p.lat,
      lng: p.lng,
      capacity: p.capacity,
      coverImage: p.coverImage ?? null,
      summary: p.summary,
      bestForFramings: p.bestForFramings,
      photos: p.photos,
      amenities: p.amenities,
      sattvicCertified: p.sattvicCertified,
      openMonths: p.openMonths,
      gettingThere: p.gettingThere,
      weatherBand: p.weatherBand,
      thingsToCarry: p.thingsToCarry,
      websiteOrMapsUrl: p.websiteOrMapsUrl,
      googleBusinessUrl: p.googleBusinessUrl,
      growthPartner: p.growthPartner,
      updatedAt: p.updatedAt,
    });
  }
  return [...localMapped, ...remote];
}

/** A single venue by id (no backend detail endpoint — resolved from the list). */
export async function getVenue(id: string): Promise<PublicVenue | null> {
  const all = await getVenues({ limit: 100 });
  return all.find((v) => v.id === id) ?? null;
}

// ── Clean, SEO-friendly public venue URLs ───────────────────────────────────
// Pure URL/slug helpers live in the client-safe `@/lib/venue-url` module (so
// Client Components like VenueCard can use them). Imported at the top for
// internal use; re-exported here for server callers that import from this module.
export { venuePath, venueCitySlug, venueNameSlug };

/** Reverse of venuePath — resolve a venue from its {city}/{name} slug pair. */
export async function getVenueByPath(city: string, name: string): Promise<PublicVenue | null> {
  const all = await getVenues({ limit: 100 });
  const c = (city || '').toLowerCase();
  const n = (name || '').toLowerCase();
  return all.find((v) => venueCitySlug(v) === c && venueNameSlug(v) === n) ?? null;
}

/** Shared SEO metadata for a venue listing page (used by both URL shapes).
 *  `url` must be the absolute canonical (callers pass canonical(venuePath(v))). */
export function buildVenueMetadata(v: PublicVenue, url: string): Metadata {
  const loc = [v.city, v.state].filter(Boolean).join(', ');
  const description = fitDescription(v.summary, `${v.name}${loc ? ` in ${loc}` : ''} is a trusted yoga retreat venue on NOSTOPS.`);
  return {
    title: v.name,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
    openGraph: { type: 'website', siteName: 'NOSTOPS', url, title: `${v.name} · NOSTOPS`, description },
    twitter: { card: 'summary_large_image', title: `${v.name} · NOSTOPS`, description },
  };
}

export type NearbyVenue = PublicVenue & { distanceKm: number };

/** Public venues with usable coordinates, ranked by real distance from a point.
 *  Reuses the SAME cached venue directory (no extra backend call). Only venues
 *  within radiusKm are returned; PII-safe (public venue fields only). */
export async function getNearbyVenues(lat: number, lng: number, opts: { radiusKm?: number; limit?: number } = {}): Promise<NearbyVenue[]> {
  const radiusKm = opts.radiusKm ?? 300;
  const all = await getVenues({ limit: 100 }).catch(() => [] as PublicVenue[]);
  return all
    .filter((v) => hasCoords(v.lat, v.lng))
    .map((v) => ({ ...v, distanceKm: haversineKm(lat, lng, v.lat!, v.lng!) }))
    .filter((v) => v.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, opts.limit ?? 6);
}

/** Live public retreats hosted at this venue (linked via venue_partner_id). */
export async function getRetreatsAtVenue(venueId: string): Promise<PublicRetreat[]> {
  const { retreats } = await getPublicRetreats();
  return retreats
    .filter((r) => r.venuePartnerId === venueId)
    .sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')));
}

/** Google enrichment for a venue — pulled from the first connected retreat here
 *  (venue-enrichment is keyed by retreat). Best-effort; null when none connected.
 *  Returns the source retreat id so callers can build Google photo proxy URLs. */
export async function getVenueGoogle(retreats: PublicRetreat[]): Promise<{ e: VenueEnrichment; retreatId: string } | null> {
  for (const r of retreats.slice(0, 4)) {
    const e = await getVenueEnrichment(r.id).catch(() => null);
    if (e) return { e, retreatId: r.id };
  }
  return null;
}

const MONTH_ABBR: Record<string, string> = {
  jan: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', may: 'May', jun: 'Jun',
  jul: 'Jul', aug: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov', dec: 'Dec',
};

/** Human label for the backend's open_months tokens (e.g. all_except_jul_aug). */
export function fmtOpenMonths(tokens: string[]): string {
  if (!tokens.length) return '';
  return tokens
    .map((raw) => {
      const t = raw.toLowerCase();
      if (t === 'all' || t === 'year_round' || t === 'all_year') return 'Open year-round';
      const m = /^all_except_(.+)$/.exec(t);
      if (m) {
        const parts = m[1].split('_').map((x) => MONTH_ABBR[x] || titleCase(x));
        return `Year-round, except ${parts.join('–')}`;
      }
      return MONTH_ABBR[t] || titleCase(raw);
    })
    .join(' · ');
}

/** Upcoming (future) retreats + a compact list of available date ranges. */
export function availableDates(retreats: PublicRetreat[]): { start?: string; end?: string; id: string; title: string }[] {
  const today = new Date().toISOString().slice(0, 10);
  return retreats
    .filter((r) => !r.endDate || r.endDate >= today)
    .map((r) => ({ start: r.startDate, end: r.endDate, id: r.id, title: r.title }));
}

// PROMPT 9 — Venue availability. Occupancy + remaining capacity for each retreat
// at a venue, over an optional date window. No confidential rates are included.
export type VenueAvailabilityItem = {
  retreatId: string;
  title: string;
  start?: string;
  end?: string;
  seatsTotal: number;
  seatsFilled: number;
  seatsRemaining: number;
  occupancyPct: number;
  status: string;
  availability: 'available' | 'filling' | 'sold_out';
};
export type VenueAvailability = {
  venueId: string;
  venueName?: string;
  from: string;
  to?: string;
  count: number;
  items: VenueAvailabilityItem[];
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function computeAvailabilityItems(retreats: PublicRetreat[], from: string, to?: string): VenueAvailabilityItem[] {
  return retreats
    .filter((r) => {
      const end = r.endDate || r.startDate || '';
      const start = r.startDate || r.endDate || '';
      if (from && end && end < from) return false; // fully in the past relative to window
      if (to && start && start > to) return false;
      return true;
    })
    .map((r) => {
      const seatsTotal = r.seatsTotal ?? 0;
      const seatsRemaining = r.seatsRemaining ?? Math.max(0, seatsTotal - (r.seatsFilled ?? 0));
      const seatsFilled = r.seatsFilled ?? Math.max(0, seatsTotal - seatsRemaining);
      const occupancyPct = seatsTotal > 0 ? Math.round((seatsFilled / seatsTotal) * 100) : 0;
      const soldOut = r.status === 'sold_out' || (seatsTotal > 0 && seatsRemaining <= 0);
      const availability: VenueAvailabilityItem['availability'] = soldOut ? 'sold_out' : occupancyPct >= 60 || r.status === 'filling' ? 'filling' : 'available';
      return { retreatId: r.id, title: r.title, start: r.startDate, end: r.endDate, seatsTotal, seatsFilled, seatsRemaining, occupancyPct, status: r.status, availability };
    })
    .sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
}

export async function getVenueAvailability(venueId: string, from?: string, to?: string): Promise<VenueAvailability> {
  const today = new Date().toISOString().slice(0, 10);
  const fromDate = from && ISO.test(from) ? from : today;
  const toDate = to && ISO.test(to) ? to : undefined;
  const [venue, retreats] = await Promise.all([getVenue(venueId), getRetreatsAtVenue(venueId)]);
  const items = computeAvailabilityItems(retreats, fromDate, toDate);
  return { venueId, venueName: venue?.name, from: fromDate, to: toDate, count: items.length, items };
}
