import 'server-only';
import { getSessionUser } from '@/lib/server/session';
import { institutionalActor, institutionalFetch } from '@/lib/server/institutional';

// Phase 6 — participant registration for NOSTOPS Spaces programmes (backend: /api/institutional/space-registrations).
export type SpaceRegEvent = {
  event_id: string; slug?: string | null; title?: string; event_date?: string | null; start_time?: string | null; end_time?: string | null;
  last_session_date?: string | null; teacher_name?: string | null;
  space?: { id?: string; name?: string; model?: string; locality?: string; district?: string; state?: string };
  programme?: { name?: string; taxonomy?: string; taxonomy_label?: string };
};
export type SpaceRegistration = {
  registration_id: string; event_id: string; status: string; pricing_mode: 'FREE' | 'PAID'; amount: number; currency: string;
  payment_status?: string | null; payment_reference?: string | null; refund_status?: string | null; hold_expires_at?: string | null;
  created_at?: string; confirmed_at?: string | null; cancelled_at?: string | null; participant_name?: string | null;
  participant_email?: string | null; event?: SpaceRegEvent; can_cancel?: boolean; cancel_rule?: string;
  history?: { status: string; at: string }[];
};

/** Calls the registration API as the signed-in user. Identity (id, name, email) comes only from the server session. */
export async function srCall(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; data: any }> {
  const user = await getSessionUser();
  if (!user || !user.user_id) return { status: 401, data: { detail: 'Please sign in to continue.' } };
  try {
    const actor = { ...institutionalActor(user), email: typeof user.email === 'string' ? user.email : undefined };
    const r = await institutionalFetch(`/space-registrations${path}`, { method: init.method || 'GET', body: init.body, actor, timeoutMs: 30000 });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  } catch {
    return { status: 502, data: { detail: 'The registration service is unavailable. Please try again.' } };
  }
}

export function srError(detail: any, fallback: string): string {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {  // FastAPI validation errors
    return detail.some((d) => d?.loc?.includes('reason')) ? 'Please give a reason of at least 10 characters.' : 'Please check the details and try again.';
  }
  return detail.message || fallback;
}

export async function getMySpaceRegistrations(): Promise<SpaceRegistration[]> {
  const r = await srCall('/mine');
  return r.status === 200 ? r.data.items || [] : [];
}
export async function getSpaceRegistration(id: string): Promise<SpaceRegistration | null> {
  const r = await srCall(`/${encodeURIComponent(id)}`);
  return r.status === 200 ? r.data.registration : null;
}
export async function verifySpaceRegistration(id: string): Promise<SpaceRegistration | null> {
  const r = await srCall(`/${encodeURIComponent(id)}/verify`, { method: 'POST', body: {} });
  return r.status === 200 ? r.data.registration : null;
}
export type ProgrammeParticipants = {
  items: SpaceRegistration[]; viewer: 'teacher' | 'admin'; capacity: number; seats_remaining: number; confirmed: number; pending: number;
  registration_closed: boolean; state: { registration_open: boolean; registration_status: string; pricing: { mode: string; fee_minor: number } };
};
export async function getProgrammeParticipants(eid: string): Promise<ProgrammeParticipants | null> {
  const r = await srCall(`/programmes/${encodeURIComponent(eid)}/participants`);
  return r.status === 200 ? r.data : null;
}
export type AdminRegOverview = {
  items: SpaceRegistration[]; totals: Record<string, number>; collected_minor: number; checkout: { enabled: boolean; gateway_mode: string };
};
export async function getAdminSpaceRegistrations(status?: string): Promise<AdminRegOverview | null> {
  const r = await srCall(`/admin/overview${status ? `?status=${encodeURIComponent(status)}` : ''}`);
  return r.status === 200 ? r.data : null;
}

export const REG_STATUS: Record<string, { label: string; tone: string }> = {
  CONFIRMED: { label: 'Confirmed', tone: 'bg-emerald-50 text-emerald-800' },
  PENDING_PAYMENT: { label: 'Awaiting payment', tone: 'bg-amber-50 text-amber-800' },
  CANCELLED: { label: 'Cancelled', tone: 'bg-stone-100 text-stone-700' },
  EXPIRED: { label: 'Reservation expired', tone: 'bg-stone-100 text-stone-700' },
  PAYMENT_FAILED: { label: 'Payment not completed', tone: 'bg-red-50 text-red-800' },
};
export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
