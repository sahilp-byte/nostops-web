import 'server-only';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { testTagHeaders } from '@/lib/server/test-tag';
import { toErrorText } from '@/lib/server/bff';

// Phase 3 — NOSTOPS Spaces (backend/spaces.py). The owner identity is always the signed-in user, signed
// here by the BFF; the browser never supplies an owner id. Spaces-only: never used by Global Venues.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export type SpaceLocation = { pin: string; locality_id: string; locality: string; taluk?: string; district: string; state: string; country: 'IN' };
export type SpaceDoc = { id: string; kind: string; name: string; type: string; uploaded_at: string };
export type SpaceHistory = { action: string; actor: string; at: string; note?: string };
export type Space = {
  id: string; status: string; name?: string; space_type?: string; model?: string; description?: string; capacity?: number;
  area_sqft?: number; facilities?: string[]; availability?: string; photos?: string[]; location?: SpaceLocation;
  address_line?: string; landmark?: string; contact_name?: string; contact_phone?: string; contact_email?: string;
  created_at?: string; updated_at?: string; submitted_at?: string; decided_at?: string; decision_note?: string;
  documents?: SpaceDoc[]; history?: SpaceHistory[]; missing?: string[];
  owner_name?: string; owner_email?: string; decided_by?: string;
  site_visit?: { checklist: Record<string, boolean>; visited_on: string; notes: string; by: string; at: string } | null;
};
export type PublicSpace = Pick<Space, 'id' | 'name' | 'space_type' | 'model' | 'description' | 'capacity' | 'area_sqft' | 'facilities' | 'availability' | 'photos' | 'location' | 'landmark'>;

async function userHeaders(): Promise<Record<string, string> | null> {
  const user = await getSessionUser();
  if (!user || !user.user_id) return null; // fail closed: genuine user ID required, never an email fallback
  const x = Buffer.from(JSON.stringify({
    user_id: String(user.user_id), name: user.name || user.email || '', email: user.email || '', role: normalizeRole(user.role),
  }), 'utf8').toString('base64');
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders(), 'X-Pulse-User': x };
}

/** Call /api/spaces{path} as the signed-in user. */
export async function spacesCall(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; data: any }> {
  const h = await userHeaders();
  if (!h) return { status: 401, data: { detail: 'Please sign in.' } };
  try {
    const r = await fetch(`${BASE}/api/spaces${path}`, {
      method: init.method || 'GET', headers: h, cache: 'no-store', signal: AbortSignal.timeout(20000),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  } catch {
    return { status: 502, data: { detail: 'The Spaces service is unavailable. Please try again.' } };
  }
}

async function publicCall(path: string): Promise<{ status: number; data: any }> {
  try {
    const r = await fetch(`${BASE}/api/spaces${path}`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET }, next: { revalidate: 120, tags: ['spaces'] },
      signal: AbortSignal.timeout(10000),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  } catch {
    return { status: 502, data: {} };
  }
}

export async function getMySpaces(): Promise<Space[]> {
  const r = await spacesCall('/mine');
  return r.status === 200 ? r.data.items || [] : [];
}
export async function getMySpace(id: string): Promise<Space | null> {
  const r = await spacesCall(`/mine/${encodeURIComponent(id)}`);
  return r.status === 200 ? { ...r.data.space, missing: r.data.missing } : null;
}
export async function getAdminSpaces(status: string): Promise<{ counts: Record<string, number>; items: Space[] } | null> {
  const r = await spacesCall(`/admin?status=${encodeURIComponent(status)}`);
  return r.status === 200 ? { counts: r.data.counts, items: r.data.items } : null;
}
export async function getAdminSpace(id: string): Promise<{ space: Space; missing: string[]; checklistKeys: string[] } | null> {
  const r = await spacesCall(`/admin/${encodeURIComponent(id)}`);
  return r.status === 200 ? { space: r.data.space, missing: r.data.missing, checklistKeys: r.data.checklist_keys } : null;
}
export type SpaceSearch = {
  pin: string; district: string; state: string; districts: string[]; localities: { id: string; name: string; taluk: string }[];
  exact: PublicSpace[]; nearby: PublicSpace[];
};
export async function searchSpaces(pin: string): Promise<{ status: number; result: SpaceSearch | null; message?: string }> {
  const r = await publicCall(`/public/search?pin=${encodeURIComponent(pin)}`);
  return r.status === 200 ? { status: 200, result: r.data } : { status: r.status, result: null, message: r.data?.detail?.message };
}
export async function getPublicSpace(id: string): Promise<PublicSpace | null> {
  const r = await publicCall(`/public/${encodeURIComponent(id)}`);
  return r.status === 200 ? r.data.space : null;
}
/** Official India Post localities whose name starts with q (exact official names; no fuzzy matching). */
export type LocalityMatch = { id: string; name: string; pin: string; district: string; state: string; taluk: string };
export async function searchLocalityNames(q: string): Promise<{ status: number; localities: LocalityMatch[]; truncated: boolean; message?: string }> {
  const r = await publicCall(`/localities/name-search?q=${encodeURIComponent(q)}`);
  return r.status === 200 ? { status: 200, localities: r.data.localities || [], truncated: !!r.data.truncated }
    : { status: r.status, localities: [], truncated: false, message: r.data?.detail?.message };
}
/** Public district page (ACTIVE localities + approved Spaces of one official district); null when 404. */
export type PublicDistrict = { state: string; district: string; active_localities: { id: string; name: string; pin: string; has_spaces: boolean }[]; has_genuine: boolean; spaces: PublicSpace[] };
export const districtSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'po';
export async function getPublicDistrict(stateSlug: string, districtSlug: string): Promise<PublicDistrict | null> {
  const r = await publicCall(`/public/district/${encodeURIComponent(stateSlug)}/${encodeURIComponent(districtSlug)}`);
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error('district page unavailable');
  return r.data;
}
export async function getPublicDistrictSlugs(): Promise<[string, string][]> {
  const r = await publicCall('/public/districts');
  if (r.status !== 200) throw new Error('spaces districts sitemap unavailable');
  return r.data.items || [];
}
/** Public locality page data (official locality + approved Spaces + coverage status); null when 404. */
export type PublicLocality = { locality: { id: string; name: string; pin: string; district: string; state: string; taluk: string }; coverage_status: string | null; has_genuine: boolean; spaces: PublicSpace[] };
export async function getPublicLocality(lid: string): Promise<PublicLocality | null> {
  const r = await publicCall(`/public/locality/${encodeURIComponent(lid)}`);
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error('locality page unavailable');
  return r.data;
}
export async function getPublicLocalityIds(): Promise<{ locality_id: string; updated_at?: string; active: boolean }[]> {
  const r = await publicCall('/public/localities');
  if (r.status !== 200) throw new Error('spaces localities sitemap unavailable');
  return r.data.items || [];
}
/** Approved public Space ids for the sitemap (QA/TEST ids excluded by the backend). */
export async function getPublicSpaceIds(): Promise<{ id: string; updated_at?: string }[]> {
  const r = await publicCall('/public/sitemap');
  if (r.status !== 200) throw new Error('spaces sitemap unavailable');
  return r.data.items || [];
}

/** User-facing error text from a /api/spaces error body (detail may be a string, a list or { error, message }). */
export function spacesError(detail: any, fallback: string): string {
  if (detail && typeof detail === 'object' && !Array.isArray(detail) && typeof detail.message === 'string') return detail.message;
  return toErrorText(detail, fallback);
}

// Phase 4 — Space enquiries (backend/space_enquiries.py).
export type SpaceEnquiry = {
  id: string; ref?: string; status: string; space_id: string; space_name?: string; programme_title?: string; duration?: string;
  participants?: number; group_type?: string; participant_profile?: string; start_date?: string; end_date?: string; days?: string[];
  time_from?: string; time_to?: string; facilities?: string[]; access_needs?: string; additional_info?: string; teacher_name?: string;
  created_at?: string; updated_at?: string; sent_at?: string; owner_notified?: boolean;
  documents?: { id: string; name: string; type: string; size: number }[]; space?: PublicSpace; missing?: string[];
  focus_areas?: string[]; teacher_email?: string; decided_at?: string; decline_reason?: string;
  venue_terms?: { availability: string; facilities: string[]; access: string; conditions: string; updated_at: string } | null;
  proposal?: { start_date: string; end_date: string; time_from: string; time_to: string; at: string } | null;
  messages?: EnquiryMessage[]; history?: { action: string; at: string; by?: string; note?: string }[];
};
export type EnquiryMessage = { id: string; from: 'teacher' | 'owner'; name: string; text: string; kind: string; at: string; proposal?: SpaceEnquiry['proposal'] };
export type IncomingEnquiries = {
  counts: { total: number; new: number; in_discussion: number; accepted: number; closed: number; discussing: number };
  spaces: { id: string; name: string; locality?: string }[]; items: SpaceEnquiry[];
};
export async function getIncomingEnquiries(q: { space?: string; status?: string; from?: string; to?: string }): Promise<IncomingEnquiries | null> {
  const p = new URLSearchParams({ space_id: q.space || '', status: q.status || 'all', date_from: q.from || '', date_to: q.to || '' });
  const r = await spacesCall(`/enquiries/incoming?${p.toString()}`);
  return r.status === 200 ? r.data : null;
}
export async function getEnquiryWithViewer(id: string): Promise<{ viewer: string; enquiry: SpaceEnquiry } | null> {
  const r = await spacesCall(`/enquiries/${encodeURIComponent(id)}`);
  return r.status === 200 ? { viewer: r.data.viewer, enquiry: { ...r.data.enquiry, missing: r.data.missing } } : null;
}
export async function getEnquiry(id: string): Promise<SpaceEnquiry | null> {
  const r = await spacesCall(`/enquiries/${encodeURIComponent(id)}`);
  return r.status === 200 ? { ...r.data.enquiry, missing: r.data.missing } : null;
}
export async function getMyEnquiries(): Promise<SpaceEnquiry[]> {
  const r = await spacesCall('/enquiries/mine');
  return r.status === 200 ? r.data.items || [] : [];
}
const ENQUIRY_ROLES = new Set(['teacher', 'council', 'admin']);
export async function canSendEnquiry(): Promise<{ signedIn: boolean; allowed: boolean }> {
  const user = await getSessionUser();
  if (!user) return { signedIn: false, allowed: false };
  return { signedIn: true, allowed: ENQUIRY_ROLES.has(normalizeRole(user.role)) };
}
