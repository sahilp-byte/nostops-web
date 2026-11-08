import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole, type User } from '@/lib/roles';

// Server-only admin client for the LOCAL Teacher Discovery store
// (/api/discovery/*). SSR pages read via the get* helpers; BFF admin routes
// relay writes via discoveryAdminRelay. Identity is built from the httpOnly
// session and never trusted from the client.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const TIMEOUT = 12000;

function actorHeader(user: User): string {
  const actor = {
    user_id: String(user.user_id || user.email || ''),
    name: (user.name as string) || (user.email as string) || 'Admin',
    role: normalizeRole(user.role),
  };
  return Buffer.from(JSON.stringify(actor), 'utf8').toString('base64');
}

async function adminFetch(path: string, init: RequestInit, user: User): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Pulse-Secret': SECRET, ...testTagHeaders(),
    'X-Pulse-User': actorHeader(user),
    ...(init.headers as Record<string, string> | undefined),
  };
  return fetch(`${BASE}/api/discovery${path}`, {
    ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
  });
}

async function get<T>(path: string, fallback: T): Promise<T> {
  const user = await getSessionUser();
  if (!user) return fallback;
  try {
    const r = await adminFetch(path, { method: 'GET' }, user);
    if (!r.ok) return fallback;
    return (await r.json()) as T;
  } catch {
    return fallback;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────
export type Funnel = {
  discovered: number; relevant: number; provisional: number; invited: number;
  claimed: number; profile_complete: number; applications: number; empanelled: number;
};
export type Rates = { claim_rate: number; profile_completion_rate: number; application_rate: number; empanelment_rate: number };
export type CampaignRow = {
  id: string; city: string; target: number; status: string; accepted_total: number;
  candidates_remaining?: number; requests_made: number; requests_used?: number;
  max_requests?: number; requests_remaining?: number; region?: string | null;
  area_cells?: string[] | null; last_stop_reason?: string | null; pause_reason?: string | null;
  discovery_paused: boolean; created_at?: number; last_run_at?: number | null;
};
export type Usage = {
  api_requests: number; discovery_requests: number; id_only_requests: number;
  rich_data_requests: number; max_requests_per_run: number; max_pages_per_query: number; note: string;
};
export type Analytics = {
  funnel: Funnel; rates: Rates;
  per_city: Record<string, { candidates: number; invited?: number; claims: number; applications: number }>;
  by_query: Record<string, number>; by_classification: Record<string, number>;
  usage: Usage; campaigns: CampaignRow[];
};
export type CityCfg = { city: string; slug: string; campaign_count: number; active: boolean; is_pilot: boolean };
export type Candidate = {
  _id: string; name: string; locality?: string; city: string; classification: string;
  status: string; admin_status?: string | null; claim_state?: string | null;
  onboarding_stage?: string | null; invited_at?: number | null; invite_count?: number;
  claimed_by_name?: string; source_query?: string; city_slug?: string; teacher_slug?: string;
  google_place_id?: string; verified_handle?: string | null;
};

export const getDiscoveryAnalytics = () =>
  get<Analytics>('/analytics', {
    funnel: { discovered: 0, relevant: 0, provisional: 0, invited: 0, claimed: 0, profile_complete: 0, applications: 0, empanelled: 0 },
    rates: { claim_rate: 0, profile_completion_rate: 0, application_rate: 0, empanelment_rate: 0 },
    per_city: {}, by_query: {}, by_classification: {},
    usage: { api_requests: 0, discovery_requests: 0, id_only_requests: 0, rich_data_requests: 0, max_requests_per_run: 0, max_pages_per_query: 0, note: '' },
    campaigns: [],
  });
export const getDiscoveryCities = () => get<{ cities: CityCfg[] }>('/cities', { cities: [] });
export const getDiscoveryCandidates = (campaignId: string, qs = '') =>
  get<{ items: Candidate[]; total: number }>(`/campaigns/${campaignId}/candidates${qs}`, { items: [], total: 0 });
export const getDiscoveryCampaign = (id: string) =>
  get<{ campaign: (CampaignRow & { stats?: any; last_job?: any }) } | null>(`/campaigns/${id}`, null);

// ── BFF relay (admin writes) ─────────────────────────────────────────────────
export async function discoveryAdminRelay(
  req: NextRequest,
  path: string,
  method: 'GET' | 'POST' | 'PATCH',
  csrf = true,
): Promise<NextResponse> {
  const guard = await requireAdmin(req, { csrf });
  if (!guard.ok) return guard.res;
  const body = method === 'GET' ? undefined : await req.json().catch(() => ({}));
  const init: RequestInit = { method };
  if (body !== undefined) { init.headers = { 'Content-Type': 'application/json' }; init.body = JSON.stringify(body); }
  try {
    const up = await adminFetch(path, init, guard.user);
    const ct = up.headers.get('content-type') || 'application/json';
    if (ct.includes('text/csv')) {
      const buf = await up.arrayBuffer();
      const res = new NextResponse(buf, { status: up.status });
      res.headers.set('content-type', ct);
      const cd = up.headers.get('content-disposition');
      if (cd) res.headers.set('content-disposition', cd);
      return res;
    }
    const data = await up.json().catch(() => ({}));
    if (!up.ok) {
      const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail;
      return NextResponse.json({ error: detail || data?.error || 'Request failed.' }, { status: up.status || 502 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Network error.' }, { status: 502 });
  }
}
