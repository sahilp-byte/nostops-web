// Shared, pure teacher helpers used by the authenticated learner discovery.
// The backend /teachers/directory returns FULL teacher documents that include
// private fields (email, phone, whatsapp, payout_*, kyc_*, user_id, geo, ...).
// toPublicTeacher() is the ONLY projection allowed to cross into rendered/
// serialized output — it whitelists public-safe fields so private data never
// reaches the browser. No business logic is reimplemented here.
import { DIMENSIONS, dimensionsOf, toDimensionId, type DimensionId } from '@/lib/yoga-dimensions';
import { hasRealCity, publicTrust } from '@/lib/public-teacher';

export type PublicTeacher = {
  handle: string;
  name: string;
  city?: string;
  country?: string;
  parampara?: string;
  /** All self-declared paramparas/lineages (primary first). Powers richer
   *  tradition cross-linking; `parampara` stays the primary for display. */
  paramparas: string[];
  experienceYears?: number;
  styles: string[];
  specializations: string[];
  badges: string[];
  badgePrimary?: string;
  tier?: string;
  isEmpanelled: boolean;
  isVerified: boolean;
  idChecked?: boolean;
  isFeatured: boolean;
  rating?: number;
  reviewsCount?: number;
  avatarUrl?: string | null;
  avatarB64?: string | null;
  languages: string[];
  offersOnline: boolean;
  offersInPerson: boolean;
  offersPrivate: boolean;
  offersGroup: boolean;
  offersCorporate: boolean;
  hasPremium: boolean;
  /** Neighbourhood/area within the city (backend location.area) — usually
   *  empty today; drives locality discovery once profiles capture it. */
  locality?: string;
  /** ISO created-at, used for city "momentum" (recent joins). */
  createdAt?: string;
  rateInr?: number;
  durationMin?: number;
  /** Rounded, PII-safe coordinates from the public directory (when shared). */
  lat?: number;
  lng?: number;
  /** Derived at query time for distance-sorted discovery (not persisted). */
  distanceKm?: number;
  /** Explicitly declared pathways (profile yoga_dimensions), canonical keys only. */
  yogaDimensions: DimensionId[];
  /** True ONLY when NOSTOPS holds a reviewed adaptive-practice verification
   *  record for this teacher (never from self-declared pathways or keywords). */
  adaptiveVerified?: boolean;
};

export type FacetItem = { id: string; label: string; count: number };
export type Facets = {
  cities: FacetItem[];
  paramparas: FacetItem[];
  styles: FacetItem[];
  specializations: FacetItem[];
  dimensions: FacetItem[];
  totals: {
    total_teachers?: number;
    empanelled?: number;
    has_premium_sessions?: number;
    five_plus_years?: number;
  };
};

export type SortKey = 'recommended' | 'rating' | 'experience' | 'name';
export const SORT_KEYS: SortKey[] = ['recommended', 'rating', 'experience', 'name'];
export const SORT_LABELS: Record<SortKey, string> = {
  recommended: 'Recommended',
  rating: 'Highest rated',
  experience: 'Most experienced',
  name: 'Name (A–Z)',
};

/** Same public-eligibility rule used site-wide (never link to suspended/inactive). */
export function isPublicTeacher(t: any): boolean {
  return t?.public_profile_visible !== false && t?.is_active !== false && !t?.suspended_at;
}

/** Whitelist projection — the ONLY safe teacher shape to serialize/render. */
export function toPublicTeacher(t: any): PublicTeacher | null {
  const handle = String(t?.handle || '').trim();
  if (!handle) return null;
  return {
    handle,
    name: t.name || 'NOSTOPS Teacher',
    city: t.city || undefined,
    country: t.country || undefined,
    parampara: t.parampara || undefined,
    paramparas:
      Array.isArray(t.paramparas) && t.paramparas.filter(Boolean).length
        ? t.paramparas.filter(Boolean)
        : t.parampara
          ? [t.parampara]
          : [],
    experienceYears:
      typeof t.experience_years === 'number' && t.experience_years > 0 ? t.experience_years : undefined,
    styles: Array.isArray(t.styles) ? t.styles.filter(Boolean) : [],
    specializations: Array.isArray(t.specializations) ? t.specializations.filter(Boolean) : [],
    yogaDimensions: Array.isArray(t.yoga_dimensions)
      ? Array.from(new Set(t.yoga_dimensions.map(toDimensionId).filter((d: DimensionId | null): d is DimensionId => !!d)))
      : [],
    badges: Array.isArray(t.badges) ? t.badges.filter(Boolean) : [],
    badgePrimary: t.badge_primary || undefined,
    tier: t.tier || undefined,
    isEmpanelled: !!t.is_empanelled,
    isVerified: publicTrust(t).verified,
    idChecked: publicTrust(t).idChecked,
    isFeatured: !!t.is_featured,
    rating: typeof t.rating === 'number' && t.rating > 0 ? t.rating : undefined,
    reviewsCount: typeof t.reviews_count === 'number' && t.reviews_count > 0 ? t.reviews_count : undefined,
    avatarUrl: typeof t.avatar_url === 'string' && t.avatar_url ? t.avatar_url : null,
    avatarB64: typeof t.avatar_base64 === 'string' && t.avatar_base64 ? t.avatar_base64 : null,
    languages: Array.isArray(t.languages_spoken) ? t.languages_spoken.filter(Boolean) : [],
    offersOnline: !!t.offers_online,
    offersInPerson: !!t.offers_in_person,
    offersPrivate: !!t.offers_private_sessions,
    offersGroup: !!t.offers_group_classes,
    offersCorporate: !!t.offers_corporate,
    hasPremium: !!(t.premium_session && t.premium_session.enabled),
    rateInr:
      t.premium_session && t.premium_session.enabled && typeof t.premium_session.rate_inr === 'number' && t.premium_session.rate_inr > 0
        ? t.premium_session.rate_inr
        : undefined,
    durationMin:
      t.premium_session && t.premium_session.enabled
        ? t.premium_session.duration_minutes || t.premium_session.duration_min || undefined
        : undefined,
    lat: typeof t.location?.lat === 'number' ? t.location.lat : typeof t.lat === 'number' ? t.lat : undefined,
    lng: typeof t.location?.lng === 'number' ? t.location.lng : typeof t.lng === 'number' ? t.lng : undefined,
    locality:
      typeof t.location?.area === 'string' && t.location.area.trim()
        ? t.location.area.trim()
        : typeof t.locality === 'string' && t.locality.trim()
          ? t.locality.trim()
          : undefined,
    createdAt: typeof t.created_at === 'string' && t.created_at ? t.created_at : undefined,
  };
}

export function sortTeachers(list: PublicTeacher[], sort: SortKey): PublicTeacher[] {
  const arr = [...list];
  switch (sort) {
    case 'rating':
      arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name));
      break;
    case 'experience':
      arr.sort((a, b) => (b.experienceYears ?? 0) - (a.experienceYears ?? 0) || a.name.localeCompare(b.name));
      break;
    case 'name':
      arr.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default: {
      const score = (x: PublicTeacher) =>
        (x.isFeatured ? 4 : 0) + (x.isEmpanelled ? 2 : 0) + (x.isVerified ? 1 : 0);
      arr.sort(
        (a, b) =>
          score(b) - score(a) || (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name),
      );
    }
  }
  return arr;
}

/** Free-text match across public-safe fields (directory has no server q param). */
export function matchesQuery(t: PublicTeacher, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [t.name, t.city, t.parampara, ...t.styles, ...t.specializations, ...t.languages]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

// Prettify a raw taxonomy id (e.g. "vipassana_yoga") into a display label.
function label(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function tally(rows: Array<[string, string]>): FacetItem[] {
  const map = new Map<string, FacetItem>();
  for (const [id, disp] of rows) {
    const key = id.trim();
    if (!key) continue;
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { id: key, label: disp, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Derive filter facets from the public teacher set so chip counts always
 *  equal the number of visible results for that value. */
export function buildFacets(teachers: PublicTeacher[]): Facets {
  const cityRows: Array<[string, string]> = [];
  const paramparaRows: Array<[string, string]> = [];
  const styleRows: Array<[string, string]> = [];
  const specRows: Array<[string, string]> = [];
  const dimCounts: Record<DimensionId, number> = { mind: 0, body: 0, special_needs: 0 };
  let empanelled = 0;
  let hasPremium = 0;
  let fivePlus = 0;

  for (const t of teachers) {
    // "India" alone isn't a city a learner can pick — never offer it as a city filter.
    if (hasRealCity(t.city, t.country)) cityRows.push([t.city!, t.city!]);
    for (const p of t.paramparas) paramparaRows.push([p, label(p)]);
    for (const s of t.styles) styleRows.push([s, s]);
    for (const sp of t.specializations) specRows.push([sp, sp]);
    for (const d of dimensionsOf(t)) dimCounts[d] += 1;
    if (t.isEmpanelled) empanelled += 1;
    if (t.hasPremium) hasPremium += 1;
    if ((t.experienceYears ?? 0) >= 5) fivePlus += 1;
  }

  return {
    cities: tally(cityRows).slice(0, 50),
    paramparas: tally(paramparaRows),
    styles: tally(styleRows),
    specializations: tally(specRows),
    dimensions: DIMENSIONS.map((d) => ({ id: d.id, label: d.label, count: dimCounts[d.id] })).filter((f) => f.count > 0),
    totals: {
      total_teachers: teachers.length,
      empanelled,
      has_premium_sessions: hasPremium,
      five_plus_years: fivePlus,
    },
  };
}

// ---------------------------------------------------------------------------
// Full teacher profile projection (authed in-app view). Mirrors the SEO page's
// whitelist — private/admin fields (email, phone, whatsapp, payout_*, kyc_*,
// bank_*, user_id, teacher_id, geo) are NEVER carried across.
// ---------------------------------------------------------------------------
export type TeacherProfile = {
  handle: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  bio?: string;
  experienceYears?: number;
  tier?: string;
  isEmpanelled: boolean;
  isVerified: boolean;
  idChecked?: boolean;
  rating?: number;
  reviewsCount?: number;
  styles: string[];
  specializations: string[];
  languages: string[];
  badges: string[];
  avatarUrl?: string | null;
  avatarB64?: string | null;
  sampleVideoUrl?: string | null;
  paramparaLabel?: string;
  paramparaFounder?: string;
  paramparaWords?: string;
  timeZone?: string;
  premium?: { rateInr?: number; durationMin?: number; description?: string } | null;
  offers: { online: boolean; corporate: boolean; group: boolean; privateSession: boolean };
};

export function toTeacherProfile(t: any): TeacherProfile {
  const specsFull = Array.isArray(t.specializations_full) ? t.specializations_full : [];
  const specializations = specsFull.length
    ? specsFull.map((s: any) => s?.name).filter(Boolean)
    : Array.isArray(t.specializations)
      ? t.specializations.map((s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))
      : [];
  const pf = t.parampara_full || {};
  const paramparaVal = String(t.parampara || '');
  const ps = t.premium_session;
  const badgesFull = Array.isArray(t.badges_full) ? t.badges_full : [];
  const badges = badgesFull.length
    ? badgesFull.map((b: any) => (typeof b === 'string' ? b : b?.name)).filter(Boolean)
    : Array.isArray(t.badges)
      ? t.badges.filter(Boolean)
      : [];
  return {
    handle: String(t.handle),
    name: t.name || 'NOSTOPS Teacher',
    city: t.city || undefined,
    state: t.state || undefined,
    country: t.country || undefined,
    bio: typeof t.bio === 'string' && t.bio.trim() ? t.bio.trim() : undefined,
    experienceYears: typeof t.experience_years === 'number' && t.experience_years > 0 ? t.experience_years : undefined,
    tier: t.tier || undefined,
    isEmpanelled: !!t.is_empanelled,
    isVerified: publicTrust(t).verified,
    idChecked: publicTrust(t).idChecked,
    rating: typeof t.rating === 'number' && t.rating > 0 ? t.rating : undefined,
    reviewsCount: typeof t.reviews_count === 'number' && t.reviews_count > 0 ? t.reviews_count : undefined,
    styles: Array.isArray(t.styles) ? t.styles.filter(Boolean) : [],
    specializations,
    languages: Array.isArray(t.languages_spoken)
      ? t.languages_spoken.filter(Boolean)
      : Array.isArray(t.languages)
        ? t.languages.filter(Boolean)
        : [],
    badges,
    avatarUrl: typeof t.avatar_url === 'string' && t.avatar_url ? t.avatar_url : null,
    avatarB64: typeof t.avatar_base64 === 'string' && t.avatar_base64 ? t.avatar_base64 : null,
    sampleVideoUrl: typeof t.sample_video_url === 'string' && t.sample_video_url ? t.sample_video_url : null,
    paramparaLabel: pf.name || (paramparaVal ? paramparaVal.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : undefined),
    paramparaFounder: pf.founder || undefined,
    paramparaWords: pf.lineage_words || undefined,
    timeZone: t.time_zone || undefined,
    premium: ps && ps.enabled ? { rateInr: ps.rate_inr, durationMin: ps.duration_min, description: ps.description } : null,
    offers: {
      online: !!t.offers_online,
      corporate: !!t.offers_corporate,
      group: !!t.offers_group_classes,
      privateSession: !!t.offers_private_sessions,
    },
  };
}
