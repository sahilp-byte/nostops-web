// Server-only data access for the Yoga Teacher acting as a RETREAT HOST
// (#36 Retreat Hosting). All reads go through the BFF (bearer from the httpOnly
// cookie). The backend owns eligibility, pricing, edit-locks and the ledger —
// we only project to typed, display-safe shapes. Host-eligibility (not the KYC
// gate) governs access, mirroring the backend's own rule.
import { backendFetch } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { tierToLevel, tierLabel } from '@/lib/teacher-levels';

const num = (v: any): number => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);
const str = (v: any): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const arr = (v: any): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);

export type HostEligibility = {
  eligible: boolean;
  hostType: string | null;
  hostName: string | null;
  hostHandle: string | null;
  platformFeePct: number;
};

export async function getHostEligibility(): Promise<HostEligibility> {
  const fallback: HostEligibility = { eligible: false, hostType: null, hostName: null, hostHandle: null, platformFeePct: 15 };
  try {
    const r = await backendFetch('/retreats/host-eligibility');
    if (!r.ok) return fallback;
    const d = await r.json();
    return {
      eligible: !!d.eligible,
      hostType: d.host_type || null,
      hostName: d.host_name || null,
      hostHandle: d.host_handle || null,
      platformFeePct: num(d.platform_fee_pct) || 15,
    };
  } catch {
    return fallback;
  }
}

export type HostBaseLocation = { lat: number; lng: number; label: string | null };

// Access gate for the teacher/host workspace. Council Gurus have no `teacher`
// role key (role can be null) but ARE hosts, so we fall back to host-eligibility.
export async function isHostUser(user: { role?: string | null } | null | undefined): Promise<boolean> {
  if (!user) return false;
  if (normalizeRole(user.role) === 'teacher') return true;
  const e = await getHostEligibility();
  return !!e.eligible;
}

// The teacher's registered location — used to prefill a valid default venue
// coordinate (the backend requires L2 hosts' venues within 100 km of this).
export async function getHostBaseLocation(): Promise<HostBaseLocation | null> {
  try {
    const r = await backendFetch('/teachers/me/native-profile');
    if (!r.ok) return null;
    const d = await r.json();
    const geo = d?.teacher?.geo;
    if (!geo || typeof geo.lat !== 'number' || typeof geo.lng !== 'number') return null;
    return { lat: geo.lat, lng: geo.lng, label: d?.teacher?.location_label || null };
  } catch {
    return null;
  }
}

export type HostedRetreat = {
  id: string;
  title: string;
  theme?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  venueName?: string;
  venueCity?: string;
  state?: string;
  seatsTotal: number;
  seatsFilled: number;
  seatsRemaining: number;
  priceInr: number;
  coverImage?: string | null;
  platformFeePct: number;
};

function projectListItem(r: any): HostedRetreat {
  const seatsTotal = num(r.seats_total);
  const seatsFilled = num(r.seats_filled ?? r.seats_booked);
  const seatsRemaining = typeof r.seats_remaining === 'number' ? r.seats_remaining : Math.max(0, seatsTotal - seatsFilled);
  return {
    id: String(r.retreat_id),
    title: r.title || 'Untitled retreat',
    theme: str(r.theme),
    status: String(r.status || 'draft'),
    startDate: str(r.start_date),
    endDate: str(r.end_date),
    venueName: str(r.venue_name),
    venueCity: str(r.venue_city),
    state: str(r.state),
    seatsTotal,
    seatsFilled,
    seatsRemaining,
    priceInr: num(r.price_per_seat_inr),
    coverImage: r.cover_image || r.venue_hero_image || null,
    platformFeePct: num(r.platform_fee_pct) || 15,
  };
}

export async function getMyHostedRetreats(): Promise<{ eligible: boolean; hostType: string | null; retreats: HostedRetreat[] }> {
  try {
    const r = await backendFetch('/retreats/my-hosted');
    if (!r.ok) return { eligible: false, hostType: null, retreats: [] };
    const d = await r.json();
    const list = Array.isArray(d.retreats) ? d.retreats.map(projectListItem) : [];
    return { eligible: !!d.eligible, hostType: d.host_type || null, retreats: list };
  } catch {
    return { eligible: false, hostType: null, retreats: [] };
  }
}

// Full editable record for the manage/edit screen.
export type RetreatDetail = {
  id: string;
  hostUserId: string | null;
  title: string;
  theme: string;
  status: string;
  startDate: string;
  endDate: string;
  venueName: string;
  venueCity: string;
  state: string;
  venuePartnerId: string;
  venueDescription: string;
  howToGetThere: string;
  weatherNotes: string;
  youtubeTourUrl: string;
  whatToCarry: string[];
  description: string;
  seatsTotal: number;
  priceInr: number;
  venueCostPerSeatInr: number;
  audienceTags: string[];
  inclusions: string[];
  tier: string;
  coverImage: string | null;
  seatsFilled: number;
  seatsRemaining: number;
  platformFeePct: number;
};

function projectDetail(r: any): RetreatDetail {
  const seatsTotal = num(r.seats_total);
  const seatsFilled = num(r.seats_filled ?? r.seats_booked);
  return {
    id: String(r.retreat_id),
    hostUserId: r.host_user_id || r.guru_id || null,
    title: r.title || '',
    theme: r.theme || 'general',
    status: String(r.status || 'draft'),
    startDate: r.start_date || '',
    endDate: r.end_date || '',
    venueName: r.venue_name || '',
    venueCity: r.venue_city || '',
    state: r.state || '',
    venuePartnerId: r.venue_partner_id ? String(r.venue_partner_id) : '',
    venueDescription: r.venue_description || '',
    howToGetThere: r.how_to_get_there || '',
    weatherNotes: r.weather_notes || '',
    youtubeTourUrl: r.youtube_tour_url || '',
    whatToCarry: arr(r.what_to_carry),
    description: r.description || '',
    seatsTotal,
    priceInr: num(r.price_per_seat_inr),
    venueCostPerSeatInr: num(r.venue_cost_per_seat_inr),
    audienceTags: arr(r.audience_tags),
    inclusions: arr(r.inclusions),
    tier: r.tier || 'public',
    coverImage: r.cover_image || null,
    seatsFilled,
    seatsRemaining: typeof r.seats_remaining === 'number' ? r.seats_remaining : Math.max(0, seatsTotal - seatsFilled),
    platformFeePct: num(r.platform_fee_pct) || 15,
  };
}

export type Reservation = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  bookingType: string;
  groupSize: number;
  status: string;
  cohortStatus?: string;
  cohortFitNote?: string;
  cohortDecisionReason?: string;
  cohortDecisionAt?: string;
  effectiveTotalInr: number;
  hostNetInr: number;
  perSeatInr: number;
  venueCostPerSeatInr: number;
  reservedAt?: string;
  expiresAt?: string;
  paidAt?: string;
  cancelledAt?: string;
  cohort?: string;
  cohortVia?: string;
};

function projectReservation(x: any): Reservation {
  const attr = x && typeof x.attribution === 'object' && x.attribution ? x.attribution : {};
  return {
    id: String(x.reservation_id),
    name: x.name || x.organisation_name || 'Guest',
    email: str(x.email),
    phone: str(x.phone),
    companyName: str(x.company_name || x.organisation_name),
    bookingType: String(x.booking_type || 'individual'),
    groupSize: num(x.group_size) || 1,
    status: String(x.status || 'reserved'),
    cohortStatus: str(x.cohort_status),
    cohortFitNote: str(x.cohort_fit_note),
    cohortDecisionReason: str(x.cohort_decision_reason),
    cohortDecisionAt: str(x.cohort_decision_at),
    effectiveTotalInr: num(x.effective_total_inr ?? x.list_total_inr),
    hostNetInr: num(x.host_net_inr),
    perSeatInr: num(x.price_per_seat_inr),
    venueCostPerSeatInr: num(x.venue_cost_per_seat_inr),
    reservedAt: str(x.reserved_at),
    expiresAt: str(x.expires_at),
    paidAt: str(x.paid_at),
    cancelledAt: str(x.cancelled_at),
    cohort: attr.source === 'cohort' ? str(attr.cohort) : undefined,
    cohortVia: attr.source === 'cohort' ? str(attr.via) : undefined,
  };
}

export type EditLock = { locked: boolean; paidCount: number; reason: string | null };

// PROMPT 18 — a person the host wants in their cohort. Backend tracks added → invited.
export type RetreatInvite = {
  id: string;
  name: string;
  whatsapp?: string;
  note?: string;
  status: string;
  createdAt?: string;
  invitedAt?: string;
};

function projectInvite(x: any): RetreatInvite {
  return {
    id: String(x.invite_id),
    name: x.invitee_name || 'Invitee',
    whatsapp: str(x.invitee_whatsapp),
    note: str(x.note),
    status: String(x.status || 'added'),
    createdAt: str(x.created_at),
    invitedAt: str(x.invited_at),
  };
}

export async function getRetreatInvites(id: string): Promise<RetreatInvite[]> {
  try {
    const r = await backendFetch(`/retreats/${id}/invites`);
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.invites) ? d.invites.map(projectInvite) : [];
  } catch {
    return [];
  }
}

// PROMPT 18/20 — aggregate cohort progress (backend-authoritative confirmed count).
export type CohortAggregate = { confirmedCount: number; seatsTotal: number };

export async function getRetreatCohort(id: string): Promise<CohortAggregate | null> {
  try {
    const r = await backendFetch(`/retreats/${id}/cohort`);
    if (!r.ok) return null;
    const d = await r.json();
    return { confirmedCount: num(d.confirmed_count), seatsTotal: num(d.seats_total) };
  } catch {
    return null;
  }
}

export type HostedRetreatBundle = {
  retreat: RetreatDetail;
  editLock: EditLock;
  reservations: Reservation[];
  counts: { reserved: number; paid: number; cancelled: number };
  revenue: { paidInr: number; pendingInr: number };
} | null;

// Detail + edit-lock + reservations for the manage screen. Verifies ownership
// against host_user_id so a host can never open another host's retreat.
export async function getHostedRetreat(id: string, userId?: string | null): Promise<HostedRetreatBundle> {
  try {
    const [dr, lr, rr] = await Promise.all([
      backendFetch(`/retreats/${id}`),
      backendFetch(`/retreats/${id}/edit-lock`),
      backendFetch(`/retreats/${id}/reservations`),
    ]);
    if (!dr.ok) return null;
    const raw = await dr.json();
    const retreat = projectDetail(raw);
    // Ownership guard (fail-closed): when a userId is supplied, the retreat MUST
    // carry a matching host_user_id — a missing/mismatched owner is denied so we
    // never depend solely on the backend to withhold a foreign host's data.
    if (userId && retreat.hostUserId !== userId) return null;

    const lk = lr.ok ? await lr.json() : {};
    const rv = rr.ok ? await rr.json() : {};
    const counts = rv.counts || {};
    const revenue = rv.revenue || {};
    return {
      retreat,
      editLock: { locked: !!lk.locked, paidCount: num(lk.paid_count), reason: lk.reason || null },
      reservations: (Array.isArray(rv.reservations) ? rv.reservations : []).map(projectReservation),
      counts: { reserved: num(counts.reserved), paid: num(counts.paid), cancelled: num(counts.cancelled) },
      revenue: { paidInr: num(revenue.paid_inr), pendingInr: num(revenue.pending_inr) },
    };
  } catch {
    return null;
  }
}


// Cooperative pricing guidance for the create wizard. Returns null for hosts
// without a teacher-tier record (e.g. Council Gurus) — they simply see no band.
export type HostRateContext = {
  level: number | null;
  label: string | null;
  suggestedLow: number | null;
  suggestedHigh: number | null;
  note: string | null;
  cooperativeNote: string | null;
};

export async function getHostRateContext(): Promise<HostRateContext | null> {
  try {
    const r = await backendFetch('/teachers/me/retreat-rate-context');
    if (!r.ok) return null;
    const d = await r.json();
    const ref = d.reference || {};
    return {
      level: typeof d.level === 'number' ? d.level : null,
      label: str(d.label) ?? null,
      suggestedLow: num(ref.suggested_price_per_seat_low) || null,
      suggestedHigh: num(ref.suggested_price_per_seat_high) || null,
      note: str(d.note) ?? null,
      cooperativeNote: str(d.cooperative_note) ?? null,
    };
  } catch {
    return null;
  }
}

// ---- Prompt 3 helper: teacher identity (Teacher-First "Your Teaching" step) ----
// Level ↔ label mapping lives in the canonical lib/teacher-levels.ts map.
const pretty = (v: any): string =>
  typeof v === 'string' ? v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
const strList = (v: any): string[] => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) as string[] : []);

export type TeacherIdentity = {
  name: string | null;
  handle: string | null;
  tier: string | null;
  level: number | null;
  tierLabel: string | null;
  bio: string | null;
  experienceYears: number | null;
  parampara: string | null;
  rootGuru: string | null;
  lineage: string[];
  styles: string[];
  specializations: string[];
  languages: string[];
};

export async function getTeacherIdentity(): Promise<TeacherIdentity | null> {
  try {
    const r = await backendFetch('/teachers/me/profile');
    if (!r.ok) return null;
    const d = await r.json();
    const p = d?.teacher;
    if (!p || typeof p !== 'object') return null;
    const tier = str(p.tier) ?? null;
    return {
      name: str(p.name) ?? null,
      handle: str(p.handle) ?? null,
      tier,
      level: tierToLevel(tier),
      tierLabel: tierLabel(tier) ?? (tier ? pretty(tier) : null),
      bio: str(p.bio) ?? null,
      experienceYears: typeof p.experience_years === 'number' ? p.experience_years : null,
      parampara: str(p.parampara) ? pretty(p.parampara) : null,
      rootGuru: str(p.root_guru_name) ?? null,
      lineage: strList(p.lineage_path),
      styles: strList(p.styles).map(pretty),
      specializations: strList(p.specializations).map(pretty).slice(0, 8),
      languages: strList(p.languages_spoken),
    };
  } catch {
    return null;
  }
}