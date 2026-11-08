// Server-only ADMIN data layer for the Venue Quality & Verification Console
// (PROMPTS 21-25). It EXTENDS existing NOSTOPS data — it does not create a
// parallel moderation store:
//   - Venue SUBMISSIONS come from the intended admin endpoint
//     GET /admin/venue-submissions (per /app/BACKEND_REQUEST_venue_submissions.md).
//     That endpoint is not live yet, so we detect readiness and show honest
//     empty states — never fabricated submissions.
//   - PUBLISHED venues come from the EXISTING read-only /venue-partners directory
//     (via lib/server/venues), and their Google Places + NOSTOPS AI enrichment
//     from the EXISTING /venue-enrichment + venue-insight loaders.
// Confidential economics are never surfaced. Admin-gated at the page/BFF layer.
import { backendFetch } from '@/lib/server/session';
import { localSubmissionsReachable } from '@/lib/server/venue-submissions-local';
import {
  getVenues,
  getVenue,
  getRetreatsAtVenue,
  getVenueGoogle,
  type PublicVenue,
} from '@/lib/server/venues';
import { getRetreatInsight, type RetreatInsight } from '@/lib/server/venue-insight';
import { listLocalSubmissions, getLocalSubmission } from '@/lib/server/venue-submissions-local';
import type { VenueEnrichment } from '@/lib/server/retreats';
import { haversineKm, hasCoords, fmtKm } from '@/lib/geo';
import {
  STATUS_META,
  QUEUE_BUCKETS,
  CLAIM_META,
  type ReviewStatus,
  type SubmitterType,
  type VenueReviewRow,
  type AdminNote,
  type AuditEvent,
  type VenueClaim,
  type ClaimStatus,
  type QualityScore,
  type QualityIndicator,
  type PendingChanges,
} from '@/lib/venue-review-shared';

// Re-export the client-safe shared pieces so existing server-side importers of
// this module keep working unchanged.
export { STATUS_META, QUEUE_BUCKETS, CLAIM_META };
export type { ReviewStatus, SubmitterType, VenueReviewRow, AdminNote, AuditEvent, VenueClaim, ClaimStatus, QualityScore, QualityIndicator };

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((s) => s.trim()) : []);

const KNOWN_STATUS = new Set<ReviewStatus>(Object.keys(STATUS_META) as ReviewStatus[]);
function coerceStatus(v: unknown, fallback: ReviewStatus): ReviewStatus {
  const s = String(v || '').toLowerCase().replace(/[\s-]+/g, '_');
  const alias: Record<string, ReviewStatus> = { pending_review: 'submitted', verifying: 'under_review', pending: 'submitted' };
  const mapped = (alias[s] as ReviewStatus) || (s as ReviewStatus);
  return KNOWN_STATUS.has(mapped) ? mapped : fallback;
}

// Map a backend submission record (intended shape) into a queue row. Defensive:
// tolerates several field-name variants so it works the moment the backend ships.
function mapSubmissionRow(s: Record<string, unknown>): VenueReviewRow | null {
  const id = str(s.submission_id) || str(s.id) || str(s._id);
  const name = str(s.venue_name) || str(s.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    city: str(s.city),
    state: str(s.state),
    venueType: str(s.venue_type),
    status: coerceStatus(s.status, 'submitted'),
    source: 'submission',
    submitterType: (str(s.submitter_role) || str(s.submitter_type)) as SubmitterType | undefined,
    submitterName: str(s.submitter_name),
    submittedAt: str(s.created_at) || str(s.submitted_at),
    website: str(s.website_or_maps_url) || str(s.website),
    address: str(s.address),
    verificationStatus: str(s.verification_status),
    claimed: bool(s.claimed),
    coverImage: null,
    updatedAt: str(s.updated_at) || str(s.created_at),
    hasPendingChanges: !!s.pending_changes,
  };
}

function parsePending(v: unknown): PendingChanges | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const fields = o.fields && typeof o.fields === 'object' ? (o.fields as Record<string, unknown>) : {};
  return {
    fields,
    changed: list(o.changed),
    actor: str(o.actor),
    actorType: str(o.actor_type),
    aiFields: list(o.ai_fields),
    submittedAt: str(o.submitted_at),
    version: num(o.version),
  };
}

function publishedRow(v: PublicVenue): VenueReviewRow {
  return {
    id: v.id,
    name: v.name,
    city: v.city,
    state: v.state,
    venueType: v.bestForFramings[0],
    status: 'published',
    source: 'published',
    submittedAt: undefined,
    address: undefined,
    verificationStatus: v.sattvicCertified ? 'verified' : undefined,
    claimed: undefined,
    coverImage: v.coverImage ?? null,
  };
}

export type PipelineMetrics = {
  pendingReviews: number;
  needsInformation: number;
  approved: number;
  published: number;
  potentialDuplicates: number;
  recentlySubmitted: number;
  recentlyUpdated: number;
};

export type VenueReviewData = {
  rows: VenueReviewRow[];
  counts: Record<ReviewStatus, number>;
  submissionsBackendReady: boolean;
  publishedCount: number;
  cities: string[];
  states: string[];
  venueTypes: string[];
  submitterTypes: string[];
  metrics: PipelineMetrics;
};

/** The full admin queue: live submissions (when the backend ships) + the real
 *  published venue directory. Never fabricates submissions. */
export async function getVenueReviewData(): Promise<VenueReviewData> {
  let submissionRows: VenueReviewRow[] = [];
  let submissionsBackendReady = false;
  try {
    const res = await backendFetch('/admin/venue-submissions?limit=200');
    if (res.ok) {
      submissionsBackendReady = true;
      const d = await res.json().catch(() => null);
      const raw = Array.isArray(d?.submissions) ? d.submissions : Array.isArray(d) ? d : [];
      submissionRows = raw.map(mapSubmissionRow).filter((x: VenueReviewRow | null): x is VenueReviewRow => x !== null);
    }
    // Any non-200 (esp. 404) => endpoint not live yet; leave empty + not-ready.
  } catch {
    /* backend unreachable / not ready — honest empty state */
  }

  // Local mirror of owner-created venues (real data, not fabricated). These are
  // the venues that owners have actually created but that no remote admin
  // endpoint exposes. When present, moderation runs against the local store.
  const localSubs = await listLocalSubmissions().catch(() => [] as Record<string, unknown>[]);
  const localRows = localSubs
    .map(mapSubmissionRow)
    .filter((x: VenueReviewRow | null): x is VenueReviewRow => x !== null);
  if (localRows.length > 0) submissionsBackendReady = true;
  submissionRows = [...submissionRows, ...localRows];

  const venues = await getVenues({ limit: 100 }).catch(() => [] as PublicVenue[]);
  const publishedRows = venues.map(publishedRow);

  const rows = [...submissionRows, ...publishedRows];

  const counts = Object.fromEntries((Object.keys(STATUS_META) as ReviewStatus[]).map((s) => [s, 0])) as Record<ReviewStatus, number>;
  for (const r of rows) counts[r.status] += 1;

  const uniq = (xs: (string | undefined)[]) => Array.from(new Set(xs.filter(Boolean) as string[])).sort();

  // PROMPT 34 — pipeline metrics. "Potential duplicates" is computed over the
  // real directory (name + city + geo proximity); "recently *" use a 7-day window.
  const within7d = (iso?: string) => {
    if (!iso) return false;
    const t = Date.parse(iso);
    return !Number.isNaN(t) && Date.now() - t < 7 * 86400000;
  };
  const potentialDuplicates = venues.filter((v) => computeDuplicates({ id: v.id, name: v.name, city: v.city, lat: v.lat, lng: v.lng }, venues).length > 0).length;
  const metrics: PipelineMetrics = {
    pendingReviews: counts.under_review,
    needsInformation: counts.needs_information,
    approved: counts.approved,
    published: counts.published,
    potentialDuplicates,
    recentlySubmitted: rows.filter((r) => within7d(r.submittedAt)).length,
    recentlyUpdated: rows.filter((r) => within7d(r.updatedAt)).length,
  };

  return {
    rows,
    counts,
    submissionsBackendReady,
    publishedCount: publishedRows.length,
    cities: uniq(rows.map((r) => r.city)),
    states: uniq(rows.map((r) => r.state)),
    venueTypes: uniq(rows.map((r) => r.venueType)),
    submitterTypes: uniq(rows.map((r) => r.submitterType)),
    metrics,
  };
}

// ── Review detail (PROMPT 24) + enrichment (PROMPT 25) ───────────────────────
export type ComparePair = { label: string; submitted?: string; enriched?: string };

// PROMPT 27 — a possible duplicate of the venue being reviewed.
export type DuplicateMatch = { id: string; name: string; city?: string; state?: string; reasons: string[]; score: number; distanceKm?: number };

// PROMPT 26 — NOSTOPS assessment (decision support only; admin decides).
export type VenueAssessment = {
  classification: string;
  yogaSuitability: 'stated' | 'likely' | 'unknown';
  retreatSuitability: 'stated' | 'likely' | 'unknown';
  facilities: string[];
  location: string;
  completenessPct: number;
  missing: string[];
  inconsistencies: string[];
  concerns: string[];
  potentialDuplicate: boolean;
};

// PROMPT 29 / 30 — internal notes + audit history are defined in the
// client-safe shared module and re-exported above.

export type VenueReviewDetail = {
  source: 'submission' | 'published';
  id: string;
  status: ReviewStatus;
  name: string;
  venueType?: string;
  city?: string;
  state?: string;
  country: string;
  address?: string;
  website?: string;
  googleBusinessUrl?: string;
  description?: string;
  capacity?: number;
  indoor?: boolean;
  outdoor?: boolean;
  yogaSuitable?: boolean;
  retreatSuitable?: boolean;
  sattvicCertified?: boolean;
  bestFor: string[];
  amenities: string[];
  photos: string[];
  openMonths: string[];
  weatherBand?: string;
  gettingThere?: string;
  videoUrl?: string;
  // submitter (submissions only; null for already-published directory venues)
  submitterType?: SubmitterType;
  submitterName?: string;
  submitterEmail?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerClaimedAt?: string;
  submitterPhone?: string;
  relationshipNote?: string;
  submittedAt?: string;
  // enrichment
  enrichment: (VenueEnrichment & { retreatId?: string }) | null;
  aiInsight: RetreatInsight | null;
  photoRetreatId?: string; // to build Google photo proxy URLs
  publicVenueId?: string; // present when this is a published venue
  // signals + decision support + internal records
  lat?: number;
  lng?: number;
  phone?: string;
  googlePlaceId?: string;
  duplicates: DuplicateMatch[];
  assessment: VenueAssessment;
  quality: QualityScore;
  notes: AdminNote[];
  history: AuditEvent[];
  claims: VenueClaim[];
  pendingChanges: PendingChanges | null;
};

type BaseDetail = Omit<VenueReviewDetail, 'duplicates' | 'assessment' | 'quality'>;

// ── Duplicate detection (PROMPT 27) ──────────────────────────────────────────
function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an|and|of|yoga|retreat|centre|center|ashram|resort|studio|lodge|pavilion|nostops)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function tokenOverlap(a: string, b: string): number {
  const A = new Set(a.split(' ').filter(Boolean));
  const B = new Set(b.split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const t of A) if (B.has(t)) n += 1;
  return n / Math.max(A.size, B.size);
}
function computeDuplicates(cur: { id?: string; name: string; city?: string; lat?: number; lng?: number }, venues: PublicVenue[]): DuplicateMatch[] {
  const curN = normName(cur.name);
  const out: DuplicateMatch[] = [];
  for (const v of venues) {
    if (cur.id && v.id === cur.id) continue;
    const reasons: string[] = [];
    let score = 0;
    const vN = normName(v.name);
    const sim = tokenOverlap(curN, vN);
    if (vN && curN && vN === curN) { reasons.push('Same name'); score += 1; }
    else if (sim >= 0.6) { reasons.push('Similar name'); score += sim; }
    const sameCity = cur.city && v.city && cur.city.toLowerCase() === v.city.toLowerCase();
    if (sameCity) { reasons.push('Same city'); score += 0.3; }
    let distanceKm: number | undefined;
    if (hasCoords(cur.lat, cur.lng) && hasCoords(v.lat, v.lng)) {
      distanceKm = haversineKm(cur.lat!, cur.lng!, v.lat!, v.lng!);
      if (distanceKm < 2) { reasons.push(`~${fmtKm(distanceKm)} away`); score += 0.6; }
      else if (distanceKm < 10) { reasons.push(`${fmtKm(distanceKm)} away`); score += 0.2; }
    }
    const strong = reasons.some((r) => r === 'Same name') || sim >= 0.6 || (distanceKm !== undefined && distanceKm < 2);
    if (reasons.length && strong) out.push({ id: v.id, name: v.name, city: v.city, state: v.state, reasons, score, distanceKm });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 4);
}

// ── NOSTOPS assessment (PROMPT 26) — deterministic decision support ──────────
function computeAssessment(d: BaseDetail, duplicates: DuplicateMatch[]): VenueAssessment {
  const suit = (flag: boolean | undefined, hints: string[]): 'stated' | 'likely' | 'unknown' => {
    if (flag === true) return 'stated';
    if (d.bestFor.some((f) => hints.some((h) => f.toLowerCase().includes(h)))) return 'likely';
    return 'unknown';
  };
  const classification = d.venueType
    ? d.venueType.replace(/_/g, ' ')
    : d.bestFor[0]
      ? `Suited for ${d.bestFor[0].replace(/_/g, ' ')}`
      : 'Unclassified';

  const hasGeo = hasCoords(d.lat, d.lng);
  const loc = [d.city, d.state].filter(Boolean).join(', ');
  const location = hasGeo ? `Geo-located${loc ? ` · ${loc}` : ''}` : d.address ? `Address on file${loc ? ` · ${loc}` : ''}` : loc ? `City-level only · ${loc}` : 'No location provided';

  // Completeness over the fields that matter for a publishable listing.
  const checks: [boolean, string][] = [
    [!!d.name, 'Name'],
    [!!d.city, 'City'],
    [!!d.state, 'State'],
    [!!(d.address || hasGeo), 'Address / coordinates'],
    [!!d.venueType, 'Venue type'],
    [!!d.description, 'Description'],
    [typeof d.capacity === 'number', 'Capacity'],
    [!!d.website, 'Website / maps link'],
    [d.photos.length > 0, 'Photographs'],
    [d.bestFor.length > 0, 'Suitability (best for)'],
  ];
  const present = checks.filter(([ok]) => ok).length;
  const completenessPct = Math.round((present / checks.length) * 100);
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);

  const inconsistencies: string[] = [];
  if (d.indoor === false && d.outdoor === false) inconsistencies.push('Marked as neither indoor nor outdoor.');
  if (d.retreatSuitable === true && typeof d.capacity !== 'number') inconsistencies.push('Retreat-suitable but no capacity provided.');
  if (d.website && !/^https?:\/\//i.test(d.website)) inconsistencies.push('Website / maps link is not a valid URL.');
  if (d.submitterEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.submitterEmail)) inconsistencies.push('Submitter email looks malformed.');

  const concerns: string[] = [];
  if (d.photos.length === 0) concerns.push('No photographs submitted.');
  if (!d.description) concerns.push('No description provided.');
  if (d.source === 'submission' && !d.submitterEmail) concerns.push('No submitter contact email.');
  if (!d.address && !hasGeo) concerns.push('No precise location — hard to verify on a map.');

  return {
    classification: classification.charAt(0).toUpperCase() + classification.slice(1),
    yogaSuitability: suit(d.yogaSuitable, ['yoga']),
    retreatSuitability: suit(d.retreatSuitable, ['retreat', 'immersion', 'residential']),
    facilities: d.amenities.length ? d.amenities : d.enrichment?.address ? ['Detected via Google listing'] : [],
    location,
    completenessPct,
    missing,
    inconsistencies,
    concerns,
    potentialDuplicate: duplicates.length > 0,
  };
}

// ── Quality / completeness score (PROMPT 35) — internal QC, not a gate ───────
function computeQuality(d: BaseDetail): QualityScore {
  const hasGeo = hasCoords(d.lat, d.lng);
  const indicators: QualityIndicator[] = [
    { label: 'Name provided', met: !!d.name },
    { label: 'Location verified', met: hasGeo || !!d.enrichment?.address },
    { label: 'Address complete', met: !!d.address },
    { label: 'Contact available', met: !!(d.submitterEmail || d.phone || d.website) },
    { label: 'Website available', met: !!d.website },
    { label: 'Photos available', met: d.photos.length > 0 },
    { label: 'Description complete', met: !!d.description && d.description.length >= 40 },
    { label: 'Facilities identified', met: d.amenities.length > 0 || !!d.enrichment },
    { label: 'Capacity available', met: typeof d.capacity === 'number' },
    { label: 'Yoga suitability assessed', met: d.yogaSuitable !== undefined || d.bestFor.some((f) => f.toLowerCase().includes('yoga')) },
    { label: 'Retreat suitability assessed', met: d.retreatSuitable !== undefined || d.bestFor.length > 0 },
    { label: 'External information available', met: !!d.enrichment },
    { label: 'Duplicate check completed', met: true },
  ];
  const met = indicators.filter((i) => i.met).length;
  return { pct: Math.round((met / indicators.length) * 100), met, total: indicators.length, indicators };
}

// ── Ownership claims (PROMPT 33) ─────────────────────────────────────────────
function coerceClaimStatus(v: unknown): ClaimStatus {
  const s = String(v || '').toLowerCase().replace(/[\s-]+/g, '_');
  const known: ClaimStatus[] = ['claim_submitted', 'verification_required', 'verified', 'rejected'];
  const alias: Record<string, ClaimStatus> = { submitted: 'claim_submitted', pending: 'claim_submitted', needs_verification: 'verification_required' };
  const mapped = (alias[s] as ClaimStatus) || (s as ClaimStatus);
  return known.includes(mapped) ? mapped : 'claim_submitted';
}
function parseClaims(v: unknown): VenueClaim[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((c) => {
      const o = c as Record<string, unknown>;
      const claimant = str(o.claimant) || str(o.claimant_name) || str(o.name);
      if (!claimant && !o.status) return null;
      return {
        id: str(o.id) || str(o.claim_id),
        claimant,
        relationship: str(o.relationship) || str(o.relationship_note),
        supporting: str(o.supporting) || str(o.supporting_info) || str(o.evidence),
        contact: str(o.contact) || str(o.email) || str(o.phone),
        status: coerceClaimStatus(o.status),
        created_at: str(o.created_at) || str(o.at),
      } as VenueClaim;
    })
    .filter((x): x is VenueClaim => x !== null);
}

function finalize(base: BaseDetail, venues: PublicVenue[]): VenueReviewDetail {
  const duplicates = computeDuplicates({ id: base.id, name: base.name, city: base.city, lat: base.lat, lng: base.lng }, venues);
  const assessment = computeAssessment(base, duplicates);
  const quality = computeQuality(base);
  return { ...base, duplicates, assessment, quality };
}

function flattenGettingThere(v: PublicVenue): string | undefined {
  const gt = v.gettingThere;
  if (!gt) return undefined;
  if (gt.text) return gt.text;
  const parts = [
    gt.nearestAirport && `Nearest airport: ${gt.nearestAirport}`,
    gt.nearestRailway && `Nearest railway: ${gt.nearestRailway}`,
    gt.nearestRoadHub && `By road: ${gt.nearestRoadHub}`,
    gt.localTransport && `Local transport: ${gt.localTransport}`,
  ].filter(Boolean);
  return parts.length ? parts.join('. ') : undefined;
}

function parseNotes(v: unknown): AdminNote[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((n) => {
      if (typeof n === 'string') return { text: n } as AdminNote;
      const o = n as Record<string, unknown>;
      const text = str(o.text) || str(o.note) || str(o.body);
      return text ? { id: str(o.id), author: str(o.author) || str(o.by), text, created_at: str(o.created_at) || str(o.at) } : null;
    })
    .filter((x): x is AdminNote => x !== null);
}
function parseHistory(v: unknown): AuditEvent[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((e) => {
      const o = e as Record<string, unknown>;
      const action = str(o.action) || str(o.event) || str(o.type);
      return action ? { action, actor: str(o.actor) || str(o.by) || str(o.admin), at: str(o.at) || str(o.created_at) || str(o.timestamp), from: str(o.from) || str(o.from_status), to: str(o.to) || str(o.to_status) || str(o.status), note: str(o.note) || str(o.reason) } : null;
    })
    .filter((x) => x !== null) as AuditEvent[];
}

function detailFromSubmission(s: Record<string, unknown>): BaseDetail {
  const id = (str(s.submission_id) || str(s.id) || str(s._id)) as string;
  return {
    source: 'submission',
    id,
    status: coerceStatus(s.status, 'submitted'),
    name: str(s.venue_name) || str(s.name) || 'Venue submission',
    venueType: str(s.venue_type),
    city: str(s.city),
    state: str(s.state),
    country: str(s.country) || 'India',
    address: str(s.address),
    website: str(s.website_or_maps_url) || str(s.website),
    googleBusinessUrl: str(s.google_business_url),
    description: str(s.description) || str(s.message),
    capacity: num(s.capacity),
    indoor: bool(s.indoor),
    outdoor: bool(s.outdoor),
    yogaSuitable: bool(s.yoga_suitable),
    retreatSuitable: bool(s.retreat_suitable),
    sattvicCertified: bool(s.sattvic_certified),
    bestFor: list(s.best_for),
    amenities: list(s.amenities),
    photos: list(s.photos),
    openMonths: list(s.open_months),
    weatherBand: str(s.weather_band),
    gettingThere: str(s.getting_there),
    videoUrl: str(s.video_url),
    submitterType: (str(s.submitter_role) || str(s.submitter_type)) as SubmitterType | undefined,
    submitterName: str(s.submitter_name),
    submitterEmail: str(s.submitter_email),
    ownerName: str(s.owner_name),
    ownerEmail: str(s.owner_email),
    ownerClaimedAt: str(s.owner_claimed_at),
    submitterPhone: str(s.submitter_phone),
    relationshipNote: str(s.relationship_note),
    submittedAt: str(s.created_at) || str(s.submitted_at),
    enrichment: null,
    aiInsight: null,
    lat: num(s.lat),
    lng: num(s.lng),
    phone: str(s.phone) || str(s.submitter_phone),
    googlePlaceId: str(s.google_place_id),
    notes: parseNotes(s.notes),
    history: parseHistory(s.history),
    claims: parseClaims(s.claims),
    pendingChanges: parsePending(s.pending_changes),
  };
}

/** One record for the review screen. Tries a live submission first (backend not
 *  ready today → null), else resolves a published directory venue + its Google
 *  and NOSTOPS-AI enrichment. Returns null when nothing matches (→ notFound). */
export async function getVenueReviewDetail(id: string): Promise<VenueReviewDetail | null> {
  const venues = await getVenues({ limit: 100 }).catch(() => [] as PublicVenue[]);

  // 1) Try the intended submission endpoint (not live yet → skip gracefully).
  try {
    const res = await backendFetch(`/admin/venue-submissions/${encodeURIComponent(id)}`);
    if (res.ok) {
      const d = await res.json().catch(() => null);
      const s = d?.submission ?? d;
      if (s && (s.submission_id || s.id || s._id)) return finalize(detailFromSubmission(s), venues);
    }
  } catch {
    /* not ready */
  }

  // 1b) Local mirror of an owner-created venue (real owner data).
  const localSub = await getLocalSubmission(id).catch(() => null);
  if (localSub && (localSub.submission_id || localSub.id)) {
    return finalize(detailFromSubmission(localSub as Record<string, unknown>), venues);
  }

  // 2) Published directory venue (real data).
  const v = await getVenue(id);
  if (!v) return null;
  const retreats = await getRetreatsAtVenue(id);
  const google = await getVenueGoogle(retreats).catch(() => null);
  let aiInsight: RetreatInsight | null = null;
  if (google) {
    const srcRetreat = retreats.find((r) => r.id === google.retreatId);
    if (srcRetreat) aiInsight = await getRetreatInsight(srcRetreat, google.e).catch(() => null);
  }

  const base: BaseDetail = {
    source: 'published',
    id: v.id,
    status: 'published',
    name: v.name,
    venueType: v.bestForFramings[0],
    city: v.city,
    state: v.state,
    country: 'India',
    address: google?.e.address,
    website: google?.e.websiteUri,
    googleBusinessUrl: v.googleBusinessUrl,
    description: v.summary,
    capacity: v.capacity,
    indoor: undefined,
    outdoor: undefined,
    yogaSuitable: true,
    retreatSuitable: v.bestForFramings.length > 0 || true,
    sattvicCertified: v.sattvicCertified,
    bestFor: v.bestForFramings,
    amenities: [],
    photos: v.coverImage ? [v.coverImage] : [],
    openMonths: v.openMonths,
    weatherBand: v.weatherBand,
    gettingThere: flattenGettingThere(v),
    videoUrl: v.videoUrl,
    enrichment: google ? { ...google.e, retreatId: google.retreatId } : null,
    aiInsight,
    photoRetreatId: google?.retreatId,
    publicVenueId: v.id,
    lat: v.lat,
    lng: v.lng,
    phone: undefined,
    googlePlaceId: undefined,
    notes: [],
    history: [],
    claims: [],
    pendingChanges: null,
  };
  return finalize(base, venues);
}

/** Readiness for the moderation console. Ready when the intended remote admin
 *  endpoint is live OR the LOCAL fallback store is reachable (the console acts
 *  through a CSRF-guarded BFF that writes to whichever is available), so admins
 *  are never blocked and the "activates when live" state only shows if neither
 *  path exists. */
export async function submissionsApiReady(): Promise<boolean> {
  try {
    const res = await backendFetch('/admin/venue-submissions?limit=1');
    if (res.ok) return true;
  } catch {
    /* fall through to local fallback probe */
  }
  return localSubmissionsReachable();
}

/** "Submitted vs Enriched/Retrieved" comparison rows (PROMPT 25). */
export function buildCompare(d: VenueReviewDetail): ComparePair[] {
  const e = d.enrichment;
  const loc = [d.city, d.state].filter(Boolean).join(', ');
  return [
    { label: 'Name', submitted: d.name, enriched: e?.name },
    { label: 'Address', submitted: d.address || loc || undefined, enriched: e?.address },
    { label: 'Website', submitted: d.website, enriched: e?.websiteUri },
    { label: 'Rating', submitted: undefined, enriched: typeof e?.rating === 'number' ? `${e.rating.toFixed(1)}${e.reviewCount ? ` (${e.reviewCount} reviews)` : ''} on Google` : undefined },
    { label: 'Capacity', submitted: typeof d.capacity === 'number' ? `${d.capacity} guests` : undefined, enriched: undefined },
  ].filter((r) => r.submitted || r.enriched);
}
