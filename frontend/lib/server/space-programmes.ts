import 'server-only';
import { getSessionUser } from '@/lib/server/session';
import { getTeacherSelfProfile } from '@/lib/server/teacher';
import { institutionalActor, institutionalFetch } from '@/lib/server/institutional';

// Phase 5B — teacher-created Space-linked programmes (backend: /api/institutional/space-programmes).
export type SpaceProgramme = {
  event_id: string; slug?: string | null; space_id: string; space_enquiry_id: string; teacher_id: string; teacher_name?: string;
  space_snapshot?: { name?: string; model?: string; capacity?: number; locality?: string; district?: string; state?: string; pin?: string };
  programme_id: string; programme?: { name?: string; taxonomy?: string; taxonomy_label?: string };
  title: string; subtitle?: string | null; event_date?: string | null; start_time?: string | null; end_time?: string | null;
  duration_minutes?: number; capacity?: number; language?: string; visibility: string; lifecycle: string; lifecycle_effective?: string;
  listing_approval?: { status: string; type?: string; approver_role?: string; at?: string; note?: string | null; reason?: string };
  problems?: string[];
  space_seats_used?: number | null; space_registration_closed?: boolean | null;
  space_pricing?: { mode?: string; fee_minor?: number } | null;
};
export type AcceptedEnquiry = { id: string; ref?: string; space_id: string; space_name?: string; programme_title?: string; participants?: number; taxonomies: string[] };

/** Call the Space programme API as the signed-in user (fails closed without a genuine user ID). */
export async function spCall(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; data: any }> {
  const user = await getSessionUser();
  if (!user || !user.user_id) return { status: 401, data: { detail: 'Please sign in.' } };
  try {
    const r = await institutionalFetch(`/space-programmes${path}`, { method: init.method || 'GET', body: init.body, actor: institutionalActor(user) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  } catch {
    return { status: 502, data: { detail: 'The programme service is unavailable. Please try again.' } };
  }
}

/** Narrow authoritative status refresh: read the teacher's own record on the live backend (server-side,
 *  session bearer token) and pass ONLY empanelment + ID verification. Fails closed if unavailable/incomplete. */
export async function refreshTeacherStatus(): Promise<{ ok: boolean; status: number; error: string }> {
  const prof = await getTeacherSelfProfile().catch(() => null);
  const self = prof?.self;
  if (!self || typeof self.isEmpanelled !== 'boolean' || typeof self.kycVerified !== 'boolean') {
    return { ok: false, status: 403, error: 'We could not confirm your empanelment and verification right now, so the programme was not saved.' };
  }
  const r = await spCall('/teacher-status', { method: 'POST', body: { empanelled: self.isEmpanelled, id_verified: self.kycVerified, handle: self.handle || undefined, name: self.name || undefined } });
  if (r.status !== 200) return { ok: false, status: r.status, error: spError(r.data?.detail, 'Could not confirm your teacher status.') };
  return { ok: true, status: 200, error: '' };
}

const PROBLEM: Record<string, string> = {
  space_not_approved: 'The Space is not currently approved.',
  enquiry_not_accepted_in_principle: 'The enquiry is not currently accepted in principle.',
  enquiry_space_mismatch: 'The enquiry belongs to a different Space.',
  enquiry_teacher_mismatch: 'The enquiry belongs to a different teacher.',
  enquiry_owner_mismatch: 'The Space owner has changed since the enquiry.',
  teacher_not_in_directory: 'Your teacher status has not been confirmed yet.',
  teacher_status_not_refreshed: 'Your teacher status needs to be re-confirmed.',
  teacher_not_empanelled_and_verified: 'Only empanelled, ID-verified NOSTOPS teachers can run Space programmes.',
  special_needs_requires_verified_adaptive_practice: 'Special Needs programmes need a verified adaptive-practice qualification.',
  owner_listing_approval_missing_or_invalid: 'The Space owner has not approved this programme listing (or the owner has changed).',
  capacity_exceeds_space: 'Capacity is more than the Space allows.',
  taxonomy_not_in_enquiry: 'The programme must be in a focus area agreed in the enquiry.',
};
export const problemText = (p: string) => PROBLEM[p] || p.replace(/_/g, ' ');

export function spError(detail: any, fallback: string): string {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail?.problems) && detail.problems.length) return detail.problems.map(problemText).join(' ');
  return detail.message || fallback;
}

export async function getMySpaceProgrammes(): Promise<{ items: SpaceProgramme[]; accepted_enquiries: AcceptedEnquiry[] }> {
  const r = await spCall('/mine');
  return r.status === 200 ? r.data : { items: [], accepted_enquiries: [] };
}
export async function getOwnerSpaceProgrammes(): Promise<SpaceProgramme[]> {
  const r = await spCall('/owner');
  return r.status === 200 ? r.data.items || [] : [];
}
export async function getSpaceProgramme(id: string): Promise<{ programme: SpaceProgramme; viewer: string; history: { action: string; actor_role: string; created_at: string }[] } | null> {
  const r = await spCall(`/${encodeURIComponent(id)}`);
  return r.status === 200 ? r.data : null;
}
