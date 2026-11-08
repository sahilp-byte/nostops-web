// Server-only PUBLIC retreat data access. Everything the public Retreats
// experience needs is projected here from the EXISTING backend endpoints:
//   GET /retreats                              -> listing
//   GET /retreats/{id}                         -> full record (rich fields)
//   GET /seo/retreat/{id}                      -> meta + JSON-LD (SEO)
//   GET /venue-enrichment/retreats/{id}/venue  -> Google Place + reviews + photos
// No business logic is reimplemented — we only read and shape for display.
import { apiGet } from '@/lib/api';
import { countryFromCoords } from '@/lib/geo';
import { isPublicHandleBlocked } from '@/lib/public-teacher';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Statuses that represent a live, publicly indexable retreat.
export const INDEXABLE = new Set(['published', 'filling', 'sold_out']);

// QA/test and duplicate retreats HARD-EXCLUDED from every public surface
// (listings, city pages, detail pages → 404, sitemap, OG). The records are
// untouched on the business backend — see /app/memory/LIVE_BACKEND_QA_CLEANUP.md
// for the backend clean-up steps.
const HIDDEN_PUBLIC_RETREATS = new Set([
  'rt_f27d935937', // WEBQA MinCohort Retreat
  'rt_ec33638e2e', // WEBQA Guru Curated
  'rt_79636c03d3', // WEBQA Verify Coords Retreat
  'rt_8d568a7a58', // In-band Hindi Retreat (QA)
  'rt_c7c3865f34', // Ganesh Baug 2 Nov — duplicate (owner: hide both 2 Nov copies)
  'rt_41f614da0e', // Ganesh Baug 2 Nov — duplicate (owner: hide both 2 Nov copies)
  'rt_1cf46fdf0f', // QA L2 host allowed check
  'rt_d96a28cb70', // QA Wizard Full-Field Retreat
  'rt_5c3bcbf3f7', // Group Booking Test Retreat
  'rt_b62cffe0b7', // Rich Venue Fields Test
  'rt_81756996e2', // UI TEST Retreat Silent Immersion 2026
]);
const QA_VENUE = /^(web)?qa\b|^test\b/i;
// Test titles: TEST_…, WEBQA…, QA …, "Retreat Image Test…", "In-band Hindi Retreat".
const QA_TITLE = /^(test[\s_-]|webqa|qa[\s_-]|retreat image test)|^in-band hindi retreat$/i;

/** Live status + not a hidden QA/duplicate record. Takes the RAW backend retreat. */
export function isPublicRetreatRecord(r: any): boolean {
  return (
    !!r?.retreat_id &&
    INDEXABLE.has(String(r.status)) &&
    !HIDDEN_PUBLIC_RETREATS.has(String(r.retreat_id)) &&
    !QA_VENUE.test(String(r.venue_name || '').trim()) &&
    !QA_TITLE.test(String(r.title || '').trim())
  );
}

const str = (v: any): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const arr = (v: any): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((s) => s.trim()) : []);

export function fmtDate(d?: string): string {
  if (!d || typeof d !== 'string') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return '';
  const [, y, mo, day] = m;
  return `${Number(day)} ${MONTHS[Number(mo) - 1] || ''} ${y}`;
}
export function fmtRange(s?: string, e?: string): string {
  const a = fmtDate(s);
  const b = fmtDate(e);
  if (a && b) return a === b ? a : `${a} – ${b}`;
  return a || b || '';
}
export function durationDays(s?: string, e?: string): number | null {
  if (!s || !e) return null;
  const a = Date.parse(s);
  const b = Date.parse(e);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}
export function statusLabel(s: string): string {
  return s === 'sold_out' ? 'Sold out' : s === 'filling' ? 'Filling fast' : 'Open for booking';
}

export type PublicRetreat = {
  id: string;
  title: string;
  description?: string;
  theme?: string;
  guruName?: string;
  guruHandle?: string;
  hostType?: string;
  venueName?: string;
  venuePartnerId?: string;
  city?: string;
  state?: string;
  country?: string;
  /** Venue coordinates (from the retreat payload) — used for distance/nearby. */
  lat?: number;
  lng?: number;
  /** Derived at query time for "nearby" ranking (not persisted). */
  distanceKm?: number;
  startDate?: string;
  endDate?: string;
  priceInr?: number;
  seatsTotal?: number;
  seatsRemaining?: number;
  seatsFilled?: number;
  status: string;
  /** Last change (ISO) — sitemap <lastmod>. */
  updatedAt?: string;
  tier?: string;
  inclusions: string[];
  audienceTags: string[];
  coverImage?: string | null;
  images: string[];
  // Rich fields (present when the host has filled them in).
  venueDescription?: string;
  howToGetThere?: string;
  weatherNotes?: string;
  youtubeTourUrl?: string;
  whatToCarry: string[];
};

function pickImages(r: any): string[] {
  const raw = Array.isArray(r?.images) ? r.images : [];
  const urls = raw
    .map((x: any) => (typeof x === 'string' ? x : x?.url || x?.src || x?.image_url))
    .filter((x: any): x is string => typeof x === 'string' && /^https?:\/\//.test(x));
  const cover = typeof r?.cover_image === 'string' && /^https?:\/\//.test(r.cover_image) ? [r.cover_image] : [];
  // Cover first, de-duplicated.
  return Array.from(new Set([...cover, ...urls]));
}

export function toPublicRetreat(r: any): PublicRetreat | null {
  const id = str(r?.retreat_id);
  if (!id) return null;
  // A host retired from public surfaces (demo/test account) is never named.
  const hostHidden = isPublicHandleBlocked(str(r.guru_handle));
  return {
    id,
    title: r.title || 'NOSTOPS Retreat',
    description: str(r.description),
    theme: str(r.theme),
    guruName: hostHidden ? undefined : str(r.guru_name),
    guruHandle: hostHidden ? undefined : str(r.guru_handle),
    hostType: str(r.host_type),
    venueName: str(r.venue_name),
    venuePartnerId: str(r.venue_partner_id),
    city: str(r.venue_city),
    state: str(r.state),
    country: str(r.country) || countryFromCoords(typeof r.venue_lat === 'number' ? r.venue_lat : undefined, typeof r.venue_lng === 'number' ? r.venue_lng : undefined) || (str(r.state) ? 'India' : undefined),
    lat: typeof r.venue_lat === 'number' ? r.venue_lat : undefined,
    lng: typeof r.venue_lng === 'number' ? r.venue_lng : undefined,
    startDate: str(r.start_date),
    endDate: str(r.end_date),
    priceInr: typeof r.price_per_seat_inr === 'number' ? r.price_per_seat_inr : undefined,
    seatsTotal: typeof r.seats_total === 'number' ? r.seats_total : undefined,
    seatsRemaining: typeof r.seats_remaining === 'number' ? r.seats_remaining : undefined,
    seatsFilled: typeof r.seats_filled === 'number' ? r.seats_filled : undefined,
    status: String(r.status || ''),
    updatedAt: str(r.updated_at),
    tier: str(r.tier),
    inclusions: arr(r.inclusions),
    audienceTags: arr(r.audience_tags).filter((t) => t.toLowerCase() !== 'public'),
    coverImage: typeof r.cover_image === 'string' && r.cover_image ? r.cover_image : null,
    images: pickImages(r),
    venueDescription: str(r.venue_description),
    howToGetThere: str(r.how_to_get_there),
    weatherNotes: str(r.weather_notes),
    youtubeTourUrl: str(r.youtube_tour_url),
    whatToCarry: arr(r.what_to_carry),
  };
}

export async function getPublicRetreats(): Promise<{ retreats: PublicRetreat[]; error: boolean }> {
  try {
    const d = await apiGet<{ retreats?: any[] }>('/retreats', { revalidate: 900 });
    const raw = Array.isArray(d?.retreats) ? d.retreats : [];
    const retreats = raw
      .filter(isPublicRetreatRecord)
      .map(toPublicRetreat)
      .filter((r): r is PublicRetreat => r !== null);
    return { retreats, error: false };
  } catch {
    return { retreats: [], error: true };
  }
}

async function fetchJson<T = any>(path: string): Promise<{ data: T | null; status: number }> {
  try {
    const data = await apiGet<T>(path, { revalidate: 900 });
    return { data, status: 200 };
  } catch (e) {
    const m = /Backend (\d+)/.exec((e as Error)?.message || '');
    return { data: null, status: m ? Number(m[1]) : 0 };
  }
}

export async function getRetreatSeo(id: string): Promise<{ meta: Record<string, string>; jsonld: any[]; status: number }> {
  const r = await fetchJson<{ meta?: Record<string, string>; jsonld?: any[] }>(`/seo/retreat/${id}`);
  return {
    meta: (r.data?.meta as Record<string, string>) || {},
    jsonld: Array.isArray(r.data?.jsonld) ? (r.data!.jsonld as any[]) : [],
    status: r.status,
  };
}

// ---- Google Place venue enrichment (Places API New, via backend proxy) ----
export type VenueReview = {
  author?: string;
  authorPhoto?: string;
  rating?: number;
  text?: string;
  relativeTime?: string;
};
export type VenuePhoto = { name: string; widthPx?: number; heightPx?: number; attribution?: string };
export type VenueEnrichment = {
  name?: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  mapsUri?: string;
  websiteUri?: string;
  phone?: string;
  reviews: VenueReview[];
  photos: VenuePhoto[];
  ai?: { summary?: string; highlights: string[] };
};

const first = (...vals: any[]) => vals.find((v) => v !== undefined && v !== null && v !== '');
const textOf = (v: any): string | undefined =>
  typeof v === 'string' ? v : typeof v?.text === 'string' ? v.text : undefined;

/** Reads the Google Place enrichment for a retreat. Returns null when the venue
 *  is not connected (all fields are hidden gracefully in that case). Defensive
 *  against Places API (New) vs legacy field names. */
export async function getVenueEnrichment(id: string): Promise<VenueEnrichment | null> {
  const r = await fetchJson<any>(`/venue-enrichment/retreats/${id}/venue?include_reviews=true&include_photos=true`);
  const v = r.data;
  if (!v || v.connected === false || v.connected === undefined) return null;

  // Field names verified against a live connected venue (Places API New via the
  // backend snapshot): reviews use author_name/author_photo_uri/relative_time;
  // photos use width_px/height_px/author_attributions[].display_name; the AI
  // insight is exposed as flat nostops_ai_summary + nostops_ai_categories. All
  // legacy/guessed aliases are kept as fallbacks so a backend rename can't break
  // rendering.
  const reviews: VenueReview[] = (Array.isArray(v.reviews) ? v.reviews : [])
    .map((rv: any) => ({
      author: first(rv.author_name, rv.authorAttribution?.displayName, rv.author?.displayName),
      authorPhoto: first(rv.author_photo_uri, rv.profile_photo_url, rv.authorAttribution?.photoUri, rv.author?.photoUri),
      rating: typeof rv.rating === 'number' ? rv.rating : undefined,
      text: textOf(first(rv.text, rv.originalText, rv.comment)),
      relativeTime: first(rv.relative_time, rv.relative_time_description, rv.relativePublishTimeDescription),
    }))
    .filter((x: VenueReview) => x.text || x.author);

  const photos: VenuePhoto[] = (Array.isArray(v.photos) ? v.photos : [])
    .map((p: any) => ({
      name: first(p.name, p.photo_name, p.photo_reference),
      widthPx: first(p.width_px, p.widthPx, p.width),
      heightPx: first(p.height_px, p.heightPx, p.height),
      attribution: textOf(first(p.author_attributions?.[0]?.display_name, p.authorAttributions?.[0]?.displayName, p.attribution)),
    }))
    .filter((p: VenuePhoto) => typeof p.name === 'string' && p.name);

  const aiSummary = textOf(first(v.nostops_ai_summary, v.ai?.summary, v.ai?.text, v.nostops_ai?.summary));
  const catsRaw = first(v.nostops_ai_categories, v.ai?.highlights, v.ai?.points, v.nostops_ai?.categories);
  const highlights = (Array.isArray(catsRaw) ? catsRaw : [])
    .map((c: any) => (typeof c === 'string' ? c : textOf(first(c?.label, c?.name, c?.title, c?.text))))
    .filter((s: any): s is string => typeof s === 'string' && !!s.trim())
    .map((s: string) => s.trim());
  const ai = aiSummary || highlights.length ? { summary: aiSummary, highlights } : undefined;

  return {
    name: textOf(first(v.google_display_name, v.display_name, v.displayName, v.name, v.venue_name)),
    address: first(v.google_formatted_address, v.formatted_address, v.formattedAddress, v.address),
    rating: typeof v.rating === 'number' ? v.rating : undefined,
    reviewCount: first(v.review_count, v.user_rating_count, v.userRatingCount, v.reviews_count),
    mapsUri: first(v.google_maps_uri, v.googleMapsUri, v.maps_url, v.url),
    websiteUri: first(v.website_uri, v.websiteUri, v.website),
    phone: first(v.international_phone_number, v.formatted_phone_number, v.phone),
    reviews,
    photos,
    ai,
  };
}

/** Related retreats — same city, then same teacher, then same theme. */
export function relatedRetreats(current: PublicRetreat, all: PublicRetreat[], n = 3): PublicRetreat[] {
  const pool = all.filter((r) => r.id !== current.id);
  const score = (r: PublicRetreat) =>
    (r.city && r.city === current.city ? 3 : 0) +
    (r.guruHandle && r.guruHandle === current.guruHandle ? 2 : 0) +
    (r.theme && r.theme === current.theme ? 1 : 0);
  return pool
    .map((r) => ({ r, s: score(r) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.r);
}
