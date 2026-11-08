import 'server-only';
import { NextResponse } from 'next/server';
import { normalizeRole, type User } from '@/lib/roles';
import { testTagHeaders } from '@/lib/server/test-tag';
import { toErrorText } from '@/lib/server/bff';

// Server-only client for backend/guru_nominations.py (the website's Guru Nominations pipeline).
// The shared secret and the caller's identity (incl. email for the nominator record) are added
// HERE from the httpOnly session — never from browser input. The backend re-checks the role.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

function actor(user: User): string {
  const a = {
    user_id: String(user.user_id || user.email || ''),
    name: String(user.name || user.email || ''),
    email: String(user.email || ''),
    role: normalizeRole(user.role),
  };
  return Buffer.from(JSON.stringify(a), 'utf8').toString('base64');
}

export function nominationsFetch(path: string, user: User, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Pulse-Secret': SECRET,
    'X-Pulse-User': actor(user),
    ...testTagHeaders(),
  };
  if (typeof init.body === 'string') headers['Content-Type'] = 'application/json';
  return fetch(`${BASE}/api/guru-nominations${path}`, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(10000) });
}

export async function relayNomination(up: Response, fallback: string): Promise<NextResponse> {
  const data = await up.json().catch(() => ({}));
  if (!up.ok) return NextResponse.json({ ok: false, error: toErrorText(data?.detail, fallback) }, { status: up.status });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, private' } });
}

async function getJson<T>(path: string, user: User): Promise<T | null> {
  try {
    const r = await nominationsFetch(path, user);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

// ── Nominator view ─────────────────────────────────────────────────────────────
export type MyNomination = {
  id: string;
  status: string;
  status_label: string;
  nominee_name: string;
  nominee_lineage: string;
  nominee_city: string;
  nominee_decades: number | null;
  relationship: string;
  citation: string;
  references: string;
  messages: { from: 'nostops' | 'nominator'; text: string; at: string | null }[];
  open_question: string | null;
  council_url: string | null;
  can_reply: boolean;
  can_withdraw: boolean;
  created_at: string | null;
  updated_at: string | null;
};

/** null = the nominations service could not be reached. */
export async function getMyNominations(user: User): Promise<MyNomination[] | null> {
  const d = await getJson<{ items: MyNomination[] }>('/mine', user);
  return d ? d.items || [] : null;
}

// ── Admin view ─────────────────────────────────────────────────────────────────
export type GuruNomination = {
  id: string;
  status: string;
  status_label: string;
  archived: boolean;
  archive_reason: string;
  nominee: { name: string; lineage?: string; city?: string; decades?: number | null; email?: string; phone?: string };
  nominator: { user_id?: string; name?: string; email?: string; role?: string; phone?: string };
  relationship: string;
  citation: string;
  references: string;
  council_handle: string | null;
  consent: { accepted_on: string; channel: string; channel_label: string; photo_ok: boolean; note: string; recorded_at: string | null; recorded_by?: { name?: string } } | null;
  messages: { from: string; text: string; at: string | null }[];
  history: { action: string; at: string | null; by?: { name?: string }; note?: string }[];
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
};

export type GuruNominationList = {
  items: GuruNomination[];
  counts: Record<string, number>;
  channels: Record<string, string>;
};

export async function adminListGuruNominations(user: User, filter: string): Promise<GuruNominationList | null> {
  return getJson<GuruNominationList>(`/admin/list?filter=${encodeURIComponent(filter)}`, user);
}

export async function adminGetGuruNomination(user: User, id: string): Promise<GuruNomination | null> {
  const d = await getJson<{ nomination: GuruNomination }>(`/admin/item/${encodeURIComponent(id)}`, user);
  return d?.nomination || null;
}

export async function getOpenNominationCount(user: User): Promise<number> {
  const d = await getJson<{ open: number }>('/admin/summary', user);
  return Number(d?.open) || 0;
}

export type AppArchive = Record<string, { reason: string; at: string | null; by: string }>;

/** Website-side archive flags for nominations made in the mobile app (main backend). */
export async function getAppNominationArchive(user: User): Promise<AppArchive> {
  const d = await getJson<{ archived: AppArchive }>('/admin/app-archive', user);
  return d?.archived || {};
}
