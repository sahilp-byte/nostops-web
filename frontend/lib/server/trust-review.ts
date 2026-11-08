import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import { localAdminFetch } from '@/lib/server/local-admin';
import type { User } from '@/lib/roles';

// B4.8 — server-only client for the Council / admin TRUST REVIEW queue
// (/api/trust/*). The reviewer identity is built from the httpOnly session; the
// backend re-checks the role (admin or Council guru) on every request.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export type TrustDecision = {
  decision_id: string;
  action: 'CONFIRM' | 'SUSPEND' | 'REVOKE';
  resulting_status: string;
  previous_status: string;
  reason: string;
  decided_at: string;
  reviewer_name?: string;
  reviewer_role?: string;
};

export type TrustCase = {
  case_id: string;
  teacher_id: string;
  handle?: string;
  name?: string;
  city?: string;
  country?: string;
  exception: string;
  status: 'PENDING_REVIEW' | 'CONFIRMED' | 'SUSPENDED' | 'REVOKED';
  status_label: string;
  snapshot: {
    id_check?: string;
    empanelled_on_main_backend?: boolean;
    empanelment_path?: string | null;
    empanelment_updated_at?: string | null;
    empanelment_certificate_on_record?: boolean;
    level_badge?: string | null;
    tier?: string | null;
    observed_at?: string;
  };
  decisions: TrustDecision[];
  created_at?: string;
  audit: { event: string; at: string; actor?: string; actor_role?: string; detail?: string }[];
};

export type TrustQueue = { cases: TrustCase[]; pendingCount: number; note: string };

export async function getTrustQueue(user: User): Promise<TrustQueue | null> {
  try {
    const r = await localAdminFetch('/api/trust/review/cases', user);
    if (!r.ok) return null;
    const d = await r.json();
    return { cases: Array.isArray(d?.cases) ? d.cases : [], pendingCount: Number(d?.pending_count) || 0, note: String(d?.note || '') };
  } catch {
    return null;
  }
}

export type MyTrustCase = {
  status: TrustCase['status'];
  status_label: string;
  opened_at?: string | null;
  note?: string | null;
  decided_at?: string | null;
  decided_by?: string | null;
} | null;

/** The signed-in teacher's own review case, looked up by the handle from their OWN record. */
export async function getMyTrustCase(user: User, handle?: string | null): Promise<MyTrustCase> {
  if (!handle) return null;
  try {
    const r = await localAdminFetch(`/api/trust/me?handle=${encodeURIComponent(handle)}`, user);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.case ?? null;
  } catch {
    return null;
  }
}

export type FreeEmpanelmentPolicy = {
  status: string;
  enforced: boolean;
  council_application_enabled: boolean;
  proposed: { min_one_on_one_sessions: number; min_avg_rating: number; min_genuine_reviews: number; then: string };
  conflicting_sources: { where: string; rule: string }[];
};

export async function getFreeEmpanelmentPolicy(): Promise<FreeEmpanelmentPolicy | null> {
  if (!SECRET) return null;
  try {
    const r = await fetch(`${BASE}/api/trust/policy`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    return (await r.json())?.free_empanelment ?? null;
  } catch {
    return null;
  }
}

export const WITHDRAWN_STATUSES = new Set(['SUSPENDED', 'REVOKED']);
