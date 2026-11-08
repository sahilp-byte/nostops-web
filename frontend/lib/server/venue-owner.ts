// Server-only data layer for the VENUE OWNER studio (PROMPT 7 — venue owner
// benefit + visibility). Everything reads from EXISTING backend endpoints; no
// business logic is re-implemented. All of this is authenticated + noindex —
// confidential Teacher–Venue negotiated economics NEVER reach public pages.
//   GET /retreats/host-eligibility
//   GET /retreats/centers/mine
//   GET /retreats/listings/mine
//   GET /retreats/partnerships/{outgoing,incoming}
//   GET /retreats/payouts/mine
import { backendFetch } from '@/lib/server/session';
import { listLocalCenters, getLocalCenter, isLocalCenterId, getCenterExtra } from '@/lib/server/venue-local';
import { getMyVenueStatuses } from '@/lib/server/venue-submissions-local';

const s = (v: any): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const arr = (v: any): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : []);
const n = (v: any): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

async function readJson<T = any>(path: string): Promise<T | null> {
  try {
    const r = await backendFetch(path);
    if (!r.ok) return null;
    return (await r.json().catch(() => null)) as T;
  } catch {
    return null;
  }
}

export type OwnerCenter = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  address?: string;
  pincode?: string;
  country?: string;
  capacity?: number;
  amenities: string[];
  foodType?: string;
  roomTypes: string[];
  photos: string[];
  distinguishingFeature?: string;
  websiteOrMapsUrl?: string;
  openToPartnerships: boolean;
  isActive: boolean;
  reviewStatus?: string;
  verified?: boolean;
  reviewNote?: string;
};

export type OwnerListing = {
  id: string;
  title: string;
  centerId?: string;
  centerName?: string;
  city?: string;
  theme?: string;
  startsOn?: string;
  endsOn?: string;
  seatsTotal: number;
  seatsRemaining: number;
  pricePerSeatInr: number;
  status: string;
  coHostCount: number;
  inclusions: string[];
};

export type Partnership = {
  id: string;
  retreatId?: string;
  retreatTitle?: string;
  centerId?: string;
  centerName?: string;
  partnerName?: string;
  partnerEmail?: string;
  model: string;
  platformFeePct?: number;
  ownerSharePct?: number;
  guestFeeInr?: number;
  rentalInr?: number;
  rentalOwnerSharePct?: number;
  note?: string;
  status: string;
  counter?: any;
  invitedAt?: string;
  respondedAt?: string;
};

export type PayoutSummary = { heldInEscrow: number; settled: number; currencyHint: string; count: number };

export type VenueOwnerState = {
  canOwnVenues: boolean;
  hostType?: string;
  hostName?: string;
  platformFeePct: number;
  centers: OwnerCenter[];
  listings: OwnerListing[];
  outgoing: Partnership[];
  incoming: Partnership[];
  payouts: PayoutSummary;
};

function mapCenter(c: any): OwnerCenter | null {
  const id = s(c?.center_id);
  if (!id) return null;
  return {
    id,
    name: c.name || 'Venue',
    city: s(c.city),
    state: s(c.state),
    address: s(c.address),
    pincode: s(c.pincode),
    country: s(c.country),
    capacity: n(c.capacity),
    amenities: arr(c.amenities),
    foodType: s(c.food_type),
    roomTypes: arr(c.room_types),
    photos: arr(c.photos),
    distinguishingFeature: s(c.distinguishing_feature),
    websiteOrMapsUrl: s(c.website_or_maps_url),
    openToPartnerships: c.open_to_partnerships !== false,
    isActive: c.is_active !== false,
  };
}
function mapListing(l: any): OwnerListing | null {
  const id = s(l?.retreat_id);
  if (!id) return null;
  return {
    id,
    title: l.title || 'Listing',
    centerId: s(l.center_id),
    centerName: s(l.center_name),
    city: s(l.city),
    theme: s(l.theme),
    startsOn: s(l.starts_on),
    endsOn: s(l.ends_on),
    seatsTotal: n(l.seats_total) ?? 0,
    seatsRemaining: n(l.seats_remaining) ?? 0,
    pricePerSeatInr: n(l.price_per_seat_inr) ?? 0,
    status: String(l.status || ''),
    coHostCount: Array.isArray(l.co_hosts) ? l.co_hosts.length : 0,
    inclusions: arr(l.inclusions),
  };
}
function mapPartnership(p: any): Partnership | null {
  const id = s(p?.partnership_id);
  if (!id) return null;
  return {
    id,
    retreatId: s(p.retreat_id),
    retreatTitle: s(p.retreat_title),
    centerId: s(p.center_id),
    centerName: s(p.center_name),
    partnerName: s(p.partner_name),
    partnerEmail: s(p.partner_email),
    model: String(p.model || 'co_host'),
    platformFeePct: n(p.platform_fee_pct),
    ownerSharePct: n(p.owner_share_pct),
    guestFeeInr: n(p.guest_fee_inr),
    rentalInr: n(p.rental_inr),
    rentalOwnerSharePct: n(p.rental_owner_share_pct),
    note: s(p.note),
    status: String(p.status || 'pending'),
    counter: p.counter ?? null,
    invitedAt: s(p.invited_at),
    respondedAt: s(p.responded_at),
  };
}

/** Owner decision: only empanelled teachers (Level 2 / Level 3, host-eligible) and Council Gurus may claim or manage Global Venues. Admins always. */
export async function canClaimVenues(role?: string): Promise<boolean> {
  if (role === 'admin') return true;
  const elig = await readJson<any>('/retreats/host-eligibility');
  return !!elig?.eligible || s(elig?.host_type) === 'council_guru';
}

export async function getVenueOwnerState(): Promise<VenueOwnerState> {
  const [elig, centersRaw, listingsRaw, outRaw, inRaw, payRaw, localCenters] = await Promise.all([
    readJson<any>('/retreats/host-eligibility'),
    readJson<any>('/retreats/centers/mine'),
    readJson<any>('/retreats/listings/mine'),
    readJson<any>('/retreats/partnerships/outgoing'),
    readJson<any>('/retreats/partnerships/incoming'),
    readJson<any>('/retreats/payouts/mine'),
    listLocalCenters(),
  ]);

  const remoteCenters = (Array.isArray(centersRaw?.items) ? centersRaw.items : []).map(mapCenter).filter((x: OwnerCenter | null): x is OwnerCenter => x !== null);
  // Merge in locally-stored venues (created via the fallback while the remote
  // POST /retreats/centers endpoint is down), de-duplicated by id.
  const remoteIds = new Set(remoteCenters.map((c: OwnerCenter) => c.id));
  const centers = [...remoteCenters, ...localCenters.filter((c) => !remoteIds.has(c.id))];
  const listings = (Array.isArray(listingsRaw?.items) ? listingsRaw.items : []).map(mapListing).filter((x: OwnerListing | null): x is OwnerListing => x !== null);
  const outgoing = (Array.isArray(outRaw?.items) ? outRaw.items : []).map(mapPartnership).filter((x: Partnership | null): x is Partnership => x !== null);
  const incoming = (Array.isArray(inRaw?.items) ? inRaw.items : []).map(mapPartnership).filter((x: Partnership | null): x is Partnership => x !== null);

  const hostType = s(elig?.host_type);
  // Venue ownership is open to host-eligible teachers — Level 2 (Yoga
  // Pracharak) and Level 3 (Yoga Guru) — as well as Council Gurus, plus anyone
  // already holding venues/listings/partnerships. The backend enforces the same
  // owner-eligibility on writes.
  const canOwnVenues = !!elig?.eligible || hostType === 'council_guru' || centers.length > 0 || listings.length > 0 || outgoing.length > 0;

  // Phase 1: loading Venue Studio is READ-ONLY. New centres are mirrored once, explicitly, when
  // they are created (bff/venue/centers POST); live listings change only via the moderated owner editor.
  if (centers.length > 0) {
    // Attach the admin review status of each venue so owners can see it.
    const statuses = await getMyVenueStatuses().catch(() => []);
    if (statuses.length > 0) {
      const byId = new Map(statuses.map((st) => [st.id, st] as const));
      for (const c of centers) {
        const st = byId.get(c.id);
        if (st) {
          c.reviewStatus = st.status;
          c.verified = st.verified;
          c.reviewNote = st.note;
        }
      }
    }
  }

  return {
    canOwnVenues,
    hostType,
    hostName: s(elig?.host_name),
    platformFeePct: n(elig?.platform_fee_pct) ?? 0,
    centers,
    listings,
    outgoing,
    incoming,
    payouts: {
      heldInEscrow: n(payRaw?.total_held_in_escrow) ?? 0,
      settled: n(payRaw?.total_settled) ?? 0,
      currencyHint: s(payRaw?.currency_hint) || 'INR',
      count: n(payRaw?.count) ?? 0,
    },
  };
}

export async function getMyCenter(id: string): Promise<OwnerCenter | null> {
  const base = isLocalCenterId(id)
    ? await getLocalCenter(id)
    : await (async () => {
        const d = await readJson<any>('/retreats/centers/mine');
        const items = Array.isArray(d?.items) ? d.items : [];
        const found = items.find((c: any) => s(c?.center_id) === id);
        return found ? mapCenter(found) : null;
      })();
  if (!base) return null;
  // Merge the locally-stored Google/website link + country when the (remote)
  // record lacks them.
  if (!base.websiteOrMapsUrl || !base.country) {
    const extra = await getCenterExtra(id).catch(() => null);
    if (extra) {
      if (!base.websiteOrMapsUrl && extra.websiteOrMapsUrl) base.websiteOrMapsUrl = extra.websiteOrMapsUrl;
      if (!base.country && extra.country) base.country = extra.country;
    }
  }
  return base;
}
