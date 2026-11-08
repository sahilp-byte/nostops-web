// Teacher Pulse — server-only data layer + guards.
//
// The Teacher Pulse store is an INTERNAL local service (local FastAPI + local
// Mongo). The browser can NEVER reach it directly: every call carries the
// server-only shared secret + an authenticated identity that this layer builds
// from the httpOnly NOSTOPS session (validated against the remote /auth/me).
// This mirrors the app's defense-in-depth: identity is never trusted from the
// client. Reads are done server-side (SSR pages); writes go through /bff/pulse/*
// (CSRF-guarded) and /bff/admin/pulse/* (admin-guarded).
import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole, personaLabel, type User } from '@/lib/roles';
import { getTeacherSelfProfile } from '@/lib/server/teacher';

const PULSE_BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const TIMEOUT_MS = 8000;

export const PULSE_ROLES = new Set(['teacher', 'council', 'coordinator', 'admin']);

export type PulseActor = { user_id: string; name: string; role: string; persona: string; handle?: string | null; public?: boolean };

export function actorFrom(user: User): PulseActor {
  return {
    user_id: String(user.user_id || user.email || ''),
    name: (user.name as string) || (user.email as string) || 'Teacher',
    role: normalizeRole(user.role),
    persona: personaLabel(user),
  };
}

function userHeader(actor: PulseActor): string {
  return Buffer.from(JSON.stringify(actor), 'utf8').toString('base64');
}

/** Low-level fetch to the internal Pulse service. Returns the raw Response. */
export async function pulseFetchRaw(
  path: string,
  opts: { method?: string; body?: unknown; actor: PulseActor; timeoutMs?: number } ,
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Pulse-Secret': SECRET, ...testTagHeaders(),
    'X-Pulse-User': userHeader(opts.actor),
  };
  const init: RequestInit = {
    method: opts.method || 'GET',
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
  };
  if (opts.body !== undefined && opts.method && opts.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body ?? {});
  }
  return fetch(`${PULSE_BASE}/api/pulse${path}`, init);
}

/** Typed GET helper for SSR. Returns fallback on any error. */
async function get<T>(path: string, actor: PulseActor, fallback: T): Promise<T> {
  try {
    const res = await pulseFetchRaw(path, { actor });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────
export type PulseConfig = { status: string; allow_new_threads: boolean; public_read?: boolean; launch_date: number; close_date: number };
export type PulseCategory = { id: string; slug: string; name: string; description?: string; thread_count: number };
export type PublicThread = {
  id: string; title: string; snippet: string; author_name: string; author_persona: string;
  author_handle?: string | null; author_public?: boolean; category_name?: string; category_slug?: string;
  reply_count: number; official?: boolean; pinned?: boolean; created_at: number; last_activity_at: number;
};
export type PulseThread = {
  id: string; category_id?: string; category_slug?: string; category_name?: string;
  title: string; body: string; author_id: string; author_name: string; author_persona: string;
  author_handle?: string | null; author_public?: boolean;
  status: string; pinned: boolean; reply_count: number; participant_count?: number;
  created_at: number; last_activity_at: number; edited_at?: number | null;
  open_reports?: number; flagged?: boolean; official?: boolean; featured?: boolean;
};
export type PulsePost = {
  id: string; thread_id: string; body: string; author_id: string; author_name: string;
  author_persona: string; author_handle?: string | null; author_public?: boolean;
  status: string; created_at: number; edited_at?: number | null;
};

// ── Community reads (SSR) ─────────────────────────────────────────────────────
export const getPulseConfig = (a: PulseActor) =>
  get<PulseConfig>('/config', a, { status: 'ACTIVE', allow_new_threads: true, launch_date: 0, close_date: 0 });
export const getPulseCategories = (a: PulseActor) =>
  get<{ categories: PulseCategory[] }>('/categories', a, { categories: [] });
export const getPulseThreads = (a: PulseActor, qs = '') =>
  get<{ threads: PulseThread[]; total: number }>(`/threads${qs}`, a, { threads: [], total: 0 });
export const getPulseThread = (a: PulseActor, id: string) =>
  get<{ thread: PulseThread; posts: PulsePost[] } | null>(`/threads/${id}`, a, null);
export const getMyInvites = (a: PulseActor) =>
  get<{ invites: Array<{ token: string; status: string; created_at: number; accepted_at: number | null }> }>('/invites/mine', a, { invites: [] });
export const resolveInvite = (a: PulseActor, token: string) =>
  get<{ inviter_name: string; status: string } | null>(`/invites/${token}`, a, null);

// A synthetic, privilege-less actor for PUBLIC reads (e.g. resolving an invite
// link before the visitor signs in). Carries no real identity and can only read
// non-sensitive endpoints; the shared secret is still required server-side.
export const PUBLIC_ACTOR: PulseActor = { user_id: 'public', name: '', role: 'public', persona: '' };
export const resolveInvitePublic = (token: string) => resolveInvite(PUBLIC_ACTOR, token);

// ── Public (anonymous, read-only teaser) reads ───────────────────────────────
export const getPublicConfig = () =>
  get<{ public_read: boolean; status: string }>('/public/config', PUBLIC_ACTOR, { public_read: false, status: 'ACTIVE' });
export const getPublicFeatured = (qs = '') =>
  get<{ public_read: boolean; threads: PublicThread[] }>(`/public/threads${qs}`, PUBLIC_ACTOR, { public_read: false, threads: [] });
export const getPublicThreadTeaser = (id: string) =>
  get<{ thread: PublicThread } | null>(`/public/threads/${id}`, PUBLIC_ACTOR, null);

// ── Admin reads (SSR) ─────────────────────────────────────────────────────────
export const getPulseOverview = (a: PulseActor) => get<any>('/admin/overview', a, null);
export const getAdminThreads = (a: PulseActor, qs = '') =>
  get<{ threads: PulseThread[]; total: number }>(`/admin/threads${qs}`, a, { threads: [], total: 0 });
export const getAdminThread = (a: PulseActor, id: string) =>
  get<{ thread: PulseThread; posts: PulsePost[]; reports: any[] } | null>(`/admin/threads/${id}`, a, null);
export const getAdminReports = (a: PulseActor, status = 'OPEN') =>
  get<{ reports: any[] }>(`/admin/reports?status=${status}`, a, { reports: [] });
export const getAdminMembers = (a: PulseActor, qs = '') =>
  get<{ members: any[] }>(`/admin/members${qs}`, a, { members: [] });
export const getAdminConfig = (a: PulseActor) =>
  get<PulseConfig>('/admin/config', a, { status: 'ACTIVE', allow_new_threads: true, launch_date: 0, close_date: 0 });
export const getAdminCategories = (a: PulseActor) =>
  get<{ categories: Array<{ id: string; slug: string; name: string; description: string; order: number; archived: boolean; thread_count: number }> }>('/admin/categories', a, { categories: [] });
export const getWelcomeThread = (a: PulseActor) =>
  get<{ thread: PulseThread | null }>('/admin/welcome', a, { thread: null });
export const getDigest = (a: PulseActor) =>
  get<{ summary: string | null; generated_at?: number; based_on?: { threads: number; replies: number }; model?: string }>('/admin/digest', a, { summary: null });

// ── Page guards ────────────────────────────────────────────────────────────────
/** RSC guard: signed-in participant (teacher/council/coordinator/admin). Returns
 *  the actor + live config. Redirects unauth → /login, others → /app. */
export async function requirePulseParticipant(): Promise<{ actor: PulseActor; config: PulseConfig; isAdmin: boolean }> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const role = normalizeRole(user.role);
  if (!PULSE_ROLES.has(role)) redirect('/app');
  const actor = actorFrom(user);
  const config = await getPulseConfig(actor);
  return { actor, config, isAdmin: role === 'admin' };
}

// ── BFF guard (community writes) ────────────────────────────────────────────────
export type PulseGuard = { ok: true; actor: PulseActor; res?: NextResponse } | { ok: false; res: NextResponse; actor?: PulseActor };

export async function requirePulseUser(req: NextRequest, opts: { csrf?: boolean } = {}): Promise<PulseGuard> {
  const csrf = opts.csrf ?? true;
  if (csrf && badOrigin(req)) {
    return { ok: false, res: NextResponse.json({ error: 'invalid origin' }, { status: 403 }) };
  }
  const user = await getSessionUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) };
  if (!PULSE_ROLES.has(normalizeRole(user.role))) {
    return { ok: false, res: NextResponse.json({ error: 'Teacher Pulse is for yoga teachers.' }, { status: 403 }) };
  }
  const actor = actorFrom(user);
  // Reward authorship with visibility: attach the author's LIVE public profile
  // handle (never a suspended/absent one → no dead links) so their posts can
  // link to /teachers/{handle}. Anti-poaching is unaffected — this is the
  // teacher's OWN public marketing page and exposes no students. Only fetched
  // on writes (infrequent), so reads stay cheap.
  if (actor.role !== 'admin') {
    try {
      const { self } = await getTeacherSelfProfile();
      if (self?.handle && self?.publicVisible) { actor.handle = self.handle; actor.public = true; }
    } catch { /* no public profile → no link */ }
  }
  return { ok: true, actor };
}

/** Relay an internal Pulse Response back to the browser (JSON or CSV). */
export async function pulseRelay(upstream: Response): Promise<NextResponse> {
  const ct = upstream.headers.get('content-type') || 'application/json';
  const buf = await upstream.arrayBuffer();
  const res = new NextResponse(buf, { status: upstream.status });
  res.headers.set('content-type', ct);
  const cd = upstream.headers.get('content-disposition');
  if (cd) res.headers.set('content-disposition', cd);
  return res;
}
