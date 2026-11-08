import 'server-only';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { testTagHeaders } from '@/lib/server/test-tag';
import { canClaimVenues } from '@/lib/server/venue-owner';

// Phase 1 — Global Venue Owner claims + owner editing. Calls the local sidecar
// (/api/venues/claims*, /api/venues/owned*) with the BFF-signed user identity;
// the browser never supplies an owner id.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export type ClaimItem = {
  id: string; venue_id: string; venue_name?: string; venue_city?: string; status: string; relationship?: string;
  evidence_methods?: string[]; business_email?: string; website?: string; google_business_url?: string; note?: string;
  created_at?: string; decision_note?: string | null; is_transfer?: boolean; duplicate_of?: string | null; conflict?: boolean;
  documents?: { id: string; name: string; type: string }[];
  claimant_name?: string; claimant_email?: string; claimant_id?: string; decided_by?: string; email_domain_matches_website?: boolean;
  history?: { action: string; actor: string; at: string; note?: string | null }[];
};
export type GettingThere = { nearestAirport?: string; nearestRailway?: string; nearestRoadHub?: string; localTransport?: string; text?: string };
export type OwnedVenue = {
  id: string; status?: string; updated_at?: string; owner_claimed_at?: string;
  name?: string; city?: string; state?: string; address?: string; country?: string; capacity?: number; description?: string;
  photos?: string[]; venue_type?: string; best_for?: string[];
  contact_phone?: string; contact_email?: string; website_or_maps_url?: string; amenities?: string[]; open_months?: string[];
  getting_there?: GettingThere; things_to_carry?: string[];
  owner_name?: string; owner_relationship?: string; verification_status?: string; open_to_partnerships?: boolean;
  pending: { fields: Record<string, unknown>; changed: string[]; submitted_at?: string } | null;
  recent?: { action: string; actor: string; at: string; fields?: string[] }[];
};

async function hdrs(eligible = false): Promise<Record<string, string> | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const x = Buffer.from(JSON.stringify({
    user_id: String(user.user_id || user.email || ''), name: user.name || user.email || '', email: user.email || '', role: normalizeRole(user.role),
    // Set only by the BFF after its own empanelment check (claim / owner-edit writes).
    ...(eligible ? { venue_eligible: true } : {}),
  }), 'utf8').toString('base64');
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders(), 'X-Pulse-User': x };
}

/** Raw call to the sidecar as the signed-in user. Returns status + parsed JSON. */
export async function ownershipCall(path: string, init: { method?: string; body?: unknown; eligible?: boolean } = {}): Promise<{ status: number; data: any }> {
  const h = await hdrs(!!init.eligible);
  if (!h) return { status: 401, data: { detail: 'Please sign in.' } };
  try {
    const r = await fetch(`${BASE}/api/venues${path}`, {
      method: init.method || 'GET', headers: h, cache: 'no-store', signal: AbortSignal.timeout(20000),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  } catch {
    return { status: 502, data: { detail: 'The venue service is unavailable. Please try again.' } };
  }
}

export async function getMyClaims(): Promise<ClaimItem[]> {
  const r = await ownershipCall('/claims/mine');
  return r.status === 200 ? r.data.items || [] : [];
}
export async function getMyOwnedVenues(): Promise<OwnedVenue[]> {
  const r = await ownershipCall('/owned');
  return r.status === 200 ? r.data.items || [] : [];
}
export async function getOwnedVenue(id: string): Promise<OwnedVenue | null> {
  const r = await ownershipCall(`/owned/${encodeURIComponent(id)}`);
  return r.status === 200 ? r.data.venue : null;
}
export async function getAllClaims(): Promise<ClaimItem[]> {
  const r = await ownershipCall('/claims');
  return r.status === 200 ? r.data.items || [] : [];
}

/** Can the signed-in user claim / manage Global Venues? (empanelled teachers, Council Gurus, admins) */
export async function venueAccess(): Promise<{ signedIn: boolean; eligible: boolean }> {
  const user = await getSessionUser();
  if (!user) return { signedIn: false, eligible: false };
  return { signedIn: true, eligible: await canClaimVenues(normalizeRole(user.role)) };
}
export const NOT_ELIGIBLE_MSG = 'Only empanelled NOSTOPS teachers (Level 2 and Level 3) and Council Gurus can claim and manage venues.';

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted', verification_pending: 'Verification pending', under_review: 'Under admin review',
  approved: 'Approved', rejected: 'Rejected', disputed: 'Disputed — admin will resolve',
};
