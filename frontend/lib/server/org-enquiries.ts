import 'server-only';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole, type User } from '@/lib/roles';
import { localAdminFetch } from '@/lib/server/local-admin';

// Server-only client for the LOCAL Organisation Enquiries store
// (/api/org-enquiries/*). Admin pages read via the get* helpers; the admin BFF
// routes relay writes via orgEnquiryFetch. The admin identity header is built
// from the httpOnly session — never from client input — and the backend
// re-checks the admin role on every route.

export type EnquiryNote = { text: string; author: string; at: string };
export type EnquiryHistory = {
  action: string;
  actor: string;
  at: string;
  from?: string | null;
  to?: string | null;
  subject?: string;
  template?: string;
};
export type EnquiryProposal = { template: string; subject: string; body: string; to: string; sent_by: string; at: string; status: 'sent' | 'failed'; error?: string };
export type EnquiryDelivery = { status: 'sent' | 'failed' | 'skipped' | 'pending'; attempts?: number; error?: string | null; at?: string; reason?: string };
export type OrgEnquiry = {
  id: string;
  ref: string;
  organisation_name: string;
  contact_name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  cohort: string;
  city: string;
  participants: string;
  interests: string[];
  customisation_requested?: boolean;
  duration: string;
  start_period: string;
  message: string | null;
  source_page: string | null;
  landing_page: string | null;
  referrer: string | null;
  utm: Record<string, string>;
  stage: string;
  owner: string | null;
  notes: EnquiryNote[];
  history: EnquiryHistory[];
  notifications: { team?: EnquiryDelivery; ack?: EnquiryDelivery };
  proposals?: EnquiryProposal[];
  created_at: string;
  updated_at: string;
};
export type EnquiryList = { items: OrgEnquiry[]; by_stage: Record<string, number>; cities: string[]; total: number };

// Whitelist of the proposal fields the admin BFF relays (never the raw body).
export function proposalPayload(b: any): { template: string; subject: string; body: string } {
  return {
    template: b?.template === 'call' ? 'call' : 'programme',
    subject: typeof b?.subject === 'string' ? b.subject.slice(0, 200) : '',
    body: typeof b?.body === 'string' ? b.body.slice(0, 8000) : '',
  };
}

export async function orgEnquiryFetch(path: string, user: User, init: RequestInit = {}): Promise<Response> {
  return localAdminFetch(`/api/org-enquiries${path}`, user, init);
}

async function get<T>(path: string, fallback: T): Promise<T> {
  const user = await getSessionUser();
  if (!user || normalizeRole(user.role) !== 'admin') return fallback;
  try {
    const r = await orgEnquiryFetch(path, user);
    return r.ok ? ((await r.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getOrgEnquiries(qs = ''): Promise<EnquiryList> {
  return get<EnquiryList>(qs ? `?${qs}` : '', { items: [], by_stage: {}, cities: [], total: 0 });
}

export function getOrgEnquiry(id: string): Promise<OrgEnquiry | null> {
  return get<OrgEnquiry | null>(`/${encodeURIComponent(id)}`, null);
}

export async function getNewEnquiryCount(): Promise<number> {
  const d = await get<{ new?: number }>('/summary', {});
  return Number(d.new) || 0;
}
