import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import type { VenueGettingThere } from '@/lib/server/venues';
import type { VenueRevision } from '@/lib/venue-review-shared';

// Server-only client for the LOCAL admin "venue submissions" review store
// (/api/venues/submissions/*). Owner-created venues (retreat centers) are only
// visible per-owner on the remote, so we mirror them here on Venue Studio load
// and let admins review them from the Venue Submissions console. Auth mirrors
// the other local modules: shared secret + a server-set X-Pulse-User identity.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const TIMEOUT = 12000;

async function headers(): Promise<Record<string, string> | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const x = Buffer.from(
    JSON.stringify({
      user_id: String(user.user_id || user.email || ''),
      name: user.name || user.email || '',
      email: user.email || '',
      role: normalizeRole(user.role),
    }),
    'utf8',
  ).toString('base64');
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders(), 'X-Pulse-User': x };
}

export type MirrorItem = {
  center_id: string;
  name?: string;
  city?: string;
  state?: string;
  address?: string;
  capacity?: number;
  amenities?: string[];
  room_types?: string[];
  food_type?: string;
  distinguishing_feature?: string;
  photos?: string[];
  open_to_partnerships?: boolean;
  website_or_maps_url?: string;
  retreat_count?: number;
  retreat_title?: string;
  retreat_theme?: string;
};

/** Fire-and-forget: shadow the current owner's real venues into the local
 *  admin review store. Best-effort; never throws. */
export async function mirrorMyVenues(items: MirrorItem[]): Promise<void> {
  if (!items.length) return;
  const h = await headers();
  if (!h) return;
  try {
    await fetch(`${BASE}/api/venues/submissions/mirror`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ items }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch {
    /* best-effort */
  }
}

export async function listLocalSubmissions(): Promise<Record<string, unknown>[]> {
  const h = await headers();
  if (!h) return [];
  try {
    const r = await fetch(`${BASE}/api/venues/submissions`, { headers: h, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return [];
    const d = await r.json().catch(() => null);
    return Array.isArray(d?.submissions) ? d.submissions : [];
  } catch {
    return [];
  }
}

export async function getLocalSubmission(id: string): Promise<Record<string, unknown> | null> {
  const h = await headers();
  if (!h) return null;
  try {
    const r = await fetch(`${BASE}/api/venues/submissions/${encodeURIComponent(id)}`, { headers: h, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    return d?.submission ?? null;
  } catch {
    return null;
  }
}

export type VerifiedVenue = { id: string; name?: string; city?: string; state?: string; dedupeKey?: string; venuePartnerId?: string };

function dkey(name?: string, city?: string): string {
  const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${norm(name)}|${norm(city)}`;
}

/** Public (server-side) read of verified venues, used to badge public pages. */
export async function getVerifiedVenues(): Promise<VerifiedVenue[]> {
  if (!SECRET) return [];
  try {
    const r = await fetch(`${BASE}/api/venues/verified`, { headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() }, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return [];
    const d = await r.json().catch(() => null);
    return (Array.isArray(d?.venues) ? d.venues : []).map((v: Record<string, unknown>) => ({
      id: String(v.id || ''),
      name: (v.name as string) || undefined,
      city: (v.city as string) || undefined,
      state: (v.state as string) || undefined,
      dedupeKey: (v.dedupe_key as string) || undefined,
      venuePartnerId: (v.venue_partner_id as string) || undefined,
    }));
  } catch {
    return [];
  }
}

/** Build a matcher over the verified set: matches by id, venue_partner_id, or
 *  normalized name+city (so it works for both directory venues and retreats). */
export async function getVerifiedMatcher(): Promise<(args: { id?: string; venuePartnerId?: string; name?: string; city?: string }) => boolean> {
  const verified = await getVerifiedVenues();
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const v of verified) {
    if (v.id) ids.add(v.id);
    if (v.venuePartnerId) ids.add(v.venuePartnerId);
    if (v.dedupeKey) keys.add(v.dedupeKey);
  }
  return ({ id, venuePartnerId, name, city }) => {
    if (id && ids.has(id)) return true;
    if (venuePartnerId && ids.has(venuePartnerId)) return true;
    if ((name || city) && keys.has(dkey(name, city))) return true;
    return false;
  };
}

export type OwnerVenueStatus = { id: string; status: string; verified: boolean; note?: string };
/** Owner-side read of the review status of their own venues, for the studio. */
export async function getMyVenueStatuses(): Promise<OwnerVenueStatus[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const h = await headers();
  if (!h) return [];
  const ownerId = String(user.user_id || user.email || '');
  try {
    const r = await fetch(`${BASE}/api/venues/my-venue-status?owner_id=${encodeURIComponent(ownerId)}`, { headers: h, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return [];
    const d = await r.json().catch(() => null);
    return (Array.isArray(d?.items) ? d.items : []).map((x: Record<string, unknown>) => ({ id: String(x.id || ''), status: String(x.status || 'submitted'), verified: !!x.verified, note: (x.note as string) || undefined }));
  } catch {
    return [];
  }
}

/** Admin: retroactively pull in owner venues (local fallback + public retreats). */
export async function backfillSubmissions(retreatVenues: Record<string, unknown>[]): Promise<{ ok: boolean; count?: number; error?: string }> {
  const h = await headers();
  if (!h) return { ok: false, error: 'Not signed in.' };
  try {
    const r = await fetch(`${BASE}/api/venues/submissions/backfill`, { method: 'POST', headers: h, body: JSON.stringify({ retreat_venues: retreatVenues }), cache: 'no-store', signal: AbortSignal.timeout(20000) });
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: (d?.detail as string) || 'Backfill failed.' };
    return { ok: true, count: Number(d?.count) || 0 };
  } catch {
    return { ok: false, error: 'Sync service unavailable.' };
  }
}

/** Admin: mark a venue verified / unverified. */
export async function verifyVenue(body: { id: string; verified: boolean; name?: string; city?: string; venuePartnerId?: string }): Promise<{ ok: boolean; error?: string }> {
  const h = await headers();
  if (!h) return { ok: false, error: 'Not signed in.' };
  try {
    const r = await fetch(`${BASE}/api/venues/verify`, {
      method: 'POST', headers: h, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
      body: JSON.stringify({ id: body.id, verified: body.verified, name: body.name || '', city: body.city || '', venue_partner_id: body.venuePartnerId || '' }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: (d?.detail as string) || 'Could not update verification.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Verification service unavailable.' };
  }
}


/** Public (server-side) read of ADMIN-PUBLISHED local venues, merged into the
 *  public venue directory. The remote /venue-partners directory is frozen, so
 *  admin "publish" would be a no-op there — this exposes locally-published
 *  submissions so the Next.js directory can merge them in. Shared-secret read. */
export type PublishedVenue = {
  id: string;
  /** Last change (epoch ms or ISO) — sitemap <lastmod>. */
  updatedAt?: number | string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  capacity?: number;
  coverImage?: string | null;
  summary?: string;
  bestForFramings: string[];
  photos: string[];
  amenities: string[];
  gettingThere?: VenueGettingThere;
  openMonths: string[];
  weatherBand?: string;
  thingsToCarry: string[];
  sattvicCertified: boolean;
  websiteOrMapsUrl?: string;
  googleBusinessUrl?: string;
  lat?: number;
  lng?: number;
  dedupeKey?: string;
  verified: boolean;
  /** Venue Partner Growth: the venue's widget is live on its own website (never a verification). */
  growthPartner: boolean;
};

// Normalise the backend's getting_there (object with snake_case keys OR a legacy
// free-text string) into the camelCase shape the public venue model expects.
function mapGettingThere(v: unknown): VenueGettingThere | undefined {
  if (typeof v === 'string' && v.trim()) return { text: v.trim() };
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const s = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : undefined);
    const g: VenueGettingThere = {
      nearestAirport: s(o.nearest_airport),
      nearestRailway: s(o.nearest_railway),
      nearestRoadHub: s(o.nearest_road_hub),
      localTransport: s(o.local_transport),
      text: s(o.text),
    };
    return Object.values(g).some(Boolean) ? g : undefined;
  }
  return undefined;
}

export async function getPublishedVenues(): Promise<PublishedVenue[]> {
  if (!SECRET) return [];
  try {
    const r = await fetch(`${BASE}/api/venues/published`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return [];
    const d = await r.json().catch(() => null);
    return (Array.isArray(d?.venues) ? d.venues : []).map((v: Record<string, unknown>) => {
      const cover = typeof v.cover_image === 'string' && (v.cover_image.startsWith('/') || /^https?:\/\//.test(v.cover_image)) ? v.cover_image : null;
      const photos = Array.isArray(v.photos) ? (v.photos as unknown[]).filter((p): p is string => typeof p === 'string' && !!p.trim()) : [];
      return {
        id: String(v.venue_id || ''),
        name: (v.name as string) || 'Venue',
        city: (v.city as string) || undefined,
        state: (v.state as string) || undefined,
        country: (v.country as string) || undefined,
        capacity: typeof v.capacity === 'number' ? v.capacity : undefined,
        coverImage: cover,
        summary: (v.summary as string) || undefined,
        bestForFramings: Array.isArray(v.best_for_framings) ? (v.best_for_framings as unknown[]).filter((x): x is string => typeof x === 'string') : [],
        photos,
        amenities: Array.isArray(v.amenities) ? (v.amenities as unknown[]).filter((x): x is string => typeof x === 'string' && !!x.trim()) : [],
        gettingThere: mapGettingThere(v.getting_there),
        openMonths: Array.isArray(v.open_months) ? (v.open_months as unknown[]).filter((x): x is string => typeof x === 'string') : [],
        weatherBand: (v.weather_band as string) || undefined,
        thingsToCarry: Array.isArray(v.things_to_carry) ? (v.things_to_carry as unknown[]).filter((x): x is string => typeof x === 'string' && !!x.trim()) : [],
        sattvicCertified: v.sattvic_certified === true,
        websiteOrMapsUrl: (v.website_or_maps_url as string) || undefined,
        googleBusinessUrl: (v.google_business_url as string) || undefined,
        lat: typeof v.lat === 'number' ? v.lat : undefined,
        lng: typeof v.lng === 'number' ? v.lng : undefined,
        dedupeKey: (v.dedupe_key as string) || undefined,
        verified: v.verified === true,
        growthPartner: v.growth_partner === true,
        updatedAt: typeof v.updated_at === 'number' || typeof v.updated_at === 'string' ? v.updated_at : undefined,
      };
    }).filter((v: PublishedVenue) => !!v.id);
  } catch {
    return [];
  }
}

/** Admin: manually add a venue into the review queue (for email/phone requests).
 *  Writes through the LOCAL store into the same `venue_submissions` collection. */
export async function createLocalSubmission(
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status?: number; error?: string; submissionId?: string; deduped?: boolean }> {
  const h = await headers();
  if (!h) return { ok: false, status: 401, error: 'Not signed in.' };
  try {
    const r = await fetch(`${BASE}/api/venues/submissions/admin-add`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify(payload || {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, status: r.status, error: (d?.detail as string) || 'Could not add submission.' };
    return { ok: true, submissionId: (d?.submission_id as string) || undefined, deduped: !!d?.deduped };
  } catch {
    return { ok: false, status: 502, error: 'Submission service is unavailable right now.' };
  }
}

export async function actLocalSubmission(
  id: string,
  action: string,
  body: { note?: string; reason?: string; site_base?: string },
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const h = await headers();
  if (!h) return { ok: false, status: 401, error: 'Not signed in.' };
  try {
    const r = await fetch(`${BASE}/api/venues/submissions/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify(body || {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => null);
      return { ok: false, status: r.status, error: (d?.detail as string) || 'Could not complete this action.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 502, error: 'Moderation service is unavailable right now.' };
  }
}


/** Local fallback: append an internal admin note to a submission. */
export async function noteLocalSubmission(id: string, text: string): Promise<{ ok: boolean; status?: number; error?: string; note?: unknown }> {
  const h = await headers();
  if (!h) return { ok: false, status: 401, error: 'Not signed in.' };
  try {
    const r = await fetch(`${BASE}/api/venues/submissions/${encodeURIComponent(id)}/notes`, {
      method: 'POST', headers: h, body: JSON.stringify({ text }), cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, status: r.status, error: (d?.detail as string) || 'Could not save note.' };
    return { ok: true, note: d?.note };
  } catch {
    return { ok: false, status: 502, error: 'Notes service is unavailable right now.' };
  }
}

/** Admin: run the website importer for a submission (returns suggested fields
 *  for review; writes nothing). Optional url override for any owner site. */
export async function importDraftLocal(
  id: string,
  url?: string,
): Promise<{ ok: boolean; status?: number; error?: string; proposed?: Record<string, string>; unverified?: string[]; source?: string; message?: string }> {
  const h = await headers();
  if (!h) return { ok: false, status: 401, error: 'Not signed in.' };
  try {
    const r = await fetch(`${BASE}/api/venues/submissions/${encodeURIComponent(id)}/import-draft`, {
      method: 'POST', headers: h, body: JSON.stringify({ url: (url || '').trim().slice(0, 400) }), cache: 'no-store', signal: AbortSignal.timeout(16000),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, status: r.status, error: (d?.detail as string) || 'Could not run website import.' };
    return {
      ok: true,
      proposed: (d?.proposed && typeof d.proposed === 'object') ? d.proposed : {},
      unverified: Array.isArray(d?.unverified) ? d.unverified : [],
      source: (d?.source as string) || undefined,
      message: (d?.message as string) || undefined,
    };
  } catch {
    return { ok: false, status: 502, error: 'Import service is unavailable right now.' };
  }
}

/** Local fallback: edit/enrich a submission before publication. */
export async function editLocalSubmission(id: string, patch: Record<string, unknown>): Promise<{ ok: boolean; status?: number; error?: string }> {
  const h = await headers();
  if (!h) return { ok: false, status: 401, error: 'Not signed in.' };
  try {
    const r = await fetch(`${BASE}/api/venues/submissions/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: h, body: JSON.stringify(patch), cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, status: r.status, error: (d?.detail as string) || 'Could not save changes.' };
    return { ok: true };
  } catch {
    return { ok: false, status: 502, error: 'Edit service is unavailable right now.' };
  }
}

// ── Version history + pending owner changes + AI onboarding (admin) ─────────
async function adminCall(path: string, method: 'GET' | 'POST' | 'PUT', body?: unknown): Promise<{ ok: boolean; status: number; error?: string; data?: any }> {
  const h = await headers();
  if (!h) return { ok: false, status: 401, error: 'Not signed in.' };
  try {
    const r = await fetch(`${BASE}${path}`, {
      method, headers: h, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, status: r.status, error: (d?.detail as string) || 'Could not complete this action.' };
    return { ok: true, status: r.status, data: d };
  } catch {
    return { ok: false, status: 502, error: 'Venue service is unavailable right now.' };
  }
}

export async function getLocalRevisions(id: string): Promise<VenueRevision[]> {
  const r = await adminCall(`/api/venues/submissions/${encodeURIComponent(id)}/revisions`, 'GET');
  const raw: Record<string, unknown>[] = r.ok && Array.isArray(r.data?.revisions) ? r.data.revisions : [];
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return raw.map((x) => ({
    id: String(x.id || ''),
    version: Number(x.version) || 0,
    kind: x.kind === 'proposed' ? 'proposed' : 'applied',
    action: String(x.action || ''),
    state: (x.state as string) || null,
    actor: (x.actor as string) || undefined,
    actorType: (x.actor_type as string) || undefined,
    changed: strs(x.changed),
    aiFields: strs(x.ai_fields),
    fields: x.fields && typeof x.fields === 'object' ? (x.fields as Record<string, unknown>) : {},
    note: (x.note as string) || undefined,
    createdAt: (x.created_at as string) || undefined,
    decidedBy: (x.decided_by as string) || undefined,
    decisionNote: (x.decision_note as string) || undefined,
  }));
}

export function decidePendingLocal(id: string, decision: 'approve' | 'reject', note: string, siteBase: string) {
  return adminCall(`/api/venues/submissions/${encodeURIComponent(id)}/pending/${decision}`, 'POST', { note, site_base: siteBase });
}

export function restoreRevisionLocal(id: string, rid: string) {
  return adminCall(`/api/venues/submissions/${encodeURIComponent(id)}/revisions/${encodeURIComponent(rid)}/restore`, 'POST', {});
}

export type AiOnboardingAdmin = {
  active: boolean;
  placeId: string | null;
  placeConfirmedBy?: string;
  purchasedAt?: number;
  orders: { orderId: string; status?: string; paid: boolean; amount?: number; currency?: string; createdAt?: number; duplicatePayment: boolean }[];
};

export async function getAiOnboardingAdminLocal(id: string): Promise<AiOnboardingAdmin | null> {
  const r = await adminCall(`/api/ai-onboarding/admin/${encodeURIComponent(id)}`, 'GET');
  if (!r.ok || !r.data) return null;
  const d = r.data;
  return {
    active: !!d.active,
    placeId: d.place_id || null,
    placeConfirmedBy: d.place_confirmed_by || undefined,
    purchasedAt: typeof d.purchased_at === 'number' ? d.purchased_at : undefined,
    orders: (Array.isArray(d.orders) ? d.orders : []).map((o: Record<string, unknown>) => ({
      orderId: String(o.order_id || ''), status: (o.status as string) || undefined, paid: !!o.paid,
      amount: typeof o.amount === 'number' ? o.amount : undefined, currency: (o.currency as string) || undefined,
      createdAt: typeof o.created_at === 'number' ? o.created_at : undefined, duplicatePayment: !!o.duplicate_payment,
    })),
  };
}

export function setGooglePlaceLocal(id: string, placeId: string) {
  return adminCall(`/api/ai-onboarding/admin/${encodeURIComponent(id)}/place`, 'PUT', { place_id: placeId });
}

// ── Google photos & reviews switched on per venue by an admin (no purchase) ──
export type GoogleGrantAdmin = { active: boolean; placeId: string | null; grantedBy?: string; grantedAt?: number };

export async function getGoogleGrantLocal(id: string): Promise<GoogleGrantAdmin | null> {
  const r = await adminCall(`/api/venues/google-grants/${encodeURIComponent(id)}`, 'GET');
  if (!r.ok || !r.data) return null;
  const d = r.data;
  return {
    active: !!d.active,
    placeId: d.place_id || null,
    grantedBy: d.granted_by || undefined,
    grantedAt: typeof d.granted_at === 'number' ? d.granted_at : undefined,
  };
}

export function setGoogleGrantLocal(id: string, placeId: string) {
  return adminCall(`/api/venues/google-grants/${encodeURIComponent(id)}`, 'PUT', { place_id: placeId });
}

/** True when the LOCAL moderation fallback store is reachable for this admin —
 *  i.e. the console can genuinely act on submissions today, even before the
 *  remote admin API ships. */
export async function localSubmissionsReachable(): Promise<boolean> {
  const h = await headers();
  if (!h) return false;
  try {
    const r = await fetch(`${BASE}/api/venues/submissions`, { headers: h, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT) });
    return r.ok;
  } catch {
    return false;
  }
}