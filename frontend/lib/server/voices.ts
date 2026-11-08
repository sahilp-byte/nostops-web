import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import { backendFetch, getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { isPublicHandleBlocked } from '@/lib/public-teacher';

// Server-only client for the isolated NOSTOPS Voices backend (local FastAPI +
// local Mongo, /api/voices/*). Private endpoints carry the shared secret +
// server-set identity (never trusted from the browser); public read endpoints
// are open. Mirrors the teacher-status-override.ts pattern.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const TIMEOUT = 12000;

function secretHeaders(extra?: Record<string, string>) {
  return { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders(), ...(extra || {}) };
}

async function actorHeader(): Promise<Record<string, string> | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const actor = Buffer.from(
    JSON.stringify({ user_id: String(user.user_id || user.email || ''), name: (user.name || user.email || '') as string, role: normalizeRole(user.role) }),
    'utf8',
  ).toString('base64');
  return { 'X-Pulse-User': actor };
}

// ── Author identity (the teacher's own record) ───────────────────────────────
export type AuthorIdentity = {
  teacherId: string;
  name: string;
  handle: string;
  bio: string;
  avatarUrl: string;
  city: string;
};

/** Resolve the signed-in teacher's own teacher_id + public author info from the
 *  authoritative native profile (bearer from the httpOnly cookie). */
export async function getMyAuthorIdentity(): Promise<AuthorIdentity | null> {
  try {
    const r = await backendFetch('/teachers/me/native-profile');
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    const t = d?.teacher || {};
    if (!t.teacher_id) return null;
    return {
      teacherId: String(t.teacher_id),
      name: t.name || 'NOSTOPS Teacher',
      handle: t.handle || '',
      bio: typeof t.bio === 'string' ? t.bio.trim() : '',
      avatarUrl: t.avatar_url || (t.avatar_base64 ? `data:image/jpeg;base64,${t.avatar_base64}` : ''),
      city: t.city || '',
    };
  } catch {
    return null;
  }
}

// ── Author enablement flag ───────────────────────────────────────────────────
export async function getAuthorFlag(teacherId: string): Promise<boolean> {
  if (!teacherId) return false;
  try {
    const r = await fetch(`${BASE}/api/voices/author-flag/${encodeURIComponent(teacherId)}`, {
      headers: secretHeaders(), cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return false;
    const d = await r.json().catch(() => null);
    return !!d?.enabled;
  } catch {
    return false;
  }
}

export async function setAuthorFlag(teacherId: string, enabled: boolean): Promise<boolean> {
  const actor = await actorHeader();
  if (!actor) return false;
  try {
    const r = await fetch(`${BASE}/api/voices/admin/author-flag`, {
      method: 'POST', headers: secretHeaders({ ...actor, 'Content-Type': 'application/json' }),
      body: JSON.stringify({ teacher_id: teacherId, enabled }), cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// ── Article types (teacher / admin views) ────────────────────────────────────
export type MyArticleRow = {
  id: string; slug: string; title: string; type: string; topic: string; source_language: string;
  status: string; word_count: number; views: number; available_for_republication: boolean;
  rejection_reason?: string | null; created_at?: number; submitted_at?: number; published_at?: number; updated_at?: number;
};

export type MyArticleFull = MyArticleRow & { content_md: string; summary?: string; consent: boolean; author_name?: string };

async function privateGet<T>(path: string): Promise<T | null> {
  const actor = await actorHeader();
  if (!actor) return null;
  try {
    const r = await fetch(`${BASE}${path}`, { headers: secretHeaders(actor), cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function listMyArticles(teacherId: string): Promise<MyArticleRow[]> {
  const d = await privateGet<{ rows: MyArticleRow[] }>(`/api/voices/teacher/articles?teacher_id=${encodeURIComponent(teacherId)}`);
  return d?.rows || [];
}

export async function getMyArticle(teacherId: string, id: string): Promise<MyArticleFull | null> {
  const d = await privateGet<{ article: MyArticleFull }>(`/api/voices/teacher/articles/${encodeURIComponent(id)}?teacher_id=${encodeURIComponent(teacherId)}`);
  return d?.article || null;
}

export type UpsertResult = { ok: boolean; id?: string; slug?: string; status?: string; error?: string; code?: number };

export async function upsertArticle(body: Record<string, unknown>): Promise<UpsertResult> {
  const actor = await actorHeader();
  if (!actor) return { ok: false, error: 'Not signed in.', code: 401 };
  try {
    const r = await fetch(`${BASE}/api/voices/articles`, {
      method: 'POST', headers: secretHeaders({ ...actor, 'Content-Type': 'application/json' }),
      body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: (d?.detail as string) || 'Could not save the article.', code: r.status };
    return { ok: true, ...d };
  } catch {
    return { ok: false, error: 'Network error. Please try again.', code: 0 };
  }
}

// ── Admin ────────────────────────────────────────────────────────────────────
export type AdminArticleRow = MyArticleRow & { author_name?: string; author_handle?: string };

export async function adminListArticles(status?: string): Promise<{ rows: AdminArticleRow[]; counts: Record<string, number>; statuses: string[] }> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const d = await privateGet<{ rows: AdminArticleRow[]; counts: Record<string, number>; statuses: string[] }>(`/api/voices/admin/articles${q}`);
  return d || { rows: [], counts: {}, statuses: [] };
}

export type AdminArticleFull = AdminArticleRow & {
  content_html: string; content_md: string; author_bio?: string; author_avatar_url?: string;
  author_city?: string; consent: boolean; consent_at?: number; translations: string[];
};

export async function adminGetArticle(id: string): Promise<AdminArticleFull | null> {
  const d = await privateGet<{ article: AdminArticleFull }>(`/api/voices/admin/articles/${encodeURIComponent(id)}`);
  return d?.article || null;
}

async function adminPost(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; data?: any }> {
  const actor = await actorHeader();
  if (!actor) return { ok: false, error: 'Not signed in.' };
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: 'POST', headers: secretHeaders({ ...actor, 'Content-Type': 'application/json' }),
      body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: (d?.detail as string) || 'Action failed.' };
    return { ok: true, data: d };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

export function adminArticleAction(id: string, action: string, reason?: string) {
  return adminPost(`/api/voices/admin/articles/${encodeURIComponent(id)}/action`, { action, ...(reason ? { reason } : {}) });
}
export function adminSetRepublication(id: string, enabled: boolean) {
  return adminPost(`/api/voices/admin/articles/${encodeURIComponent(id)}/republication`, { enabled });
}

// ── Public reads (open) ──────────────────────────────────────────────────────
export type PublicArticle = {
  id: string; slug: string; title: string; type: string; topic: string; language: string; source_language: string;
  available_languages: Array<{ code: string; name: string }>; content_html: string; content_text: string;
  published_at?: number; views?: number; author_name: string; author_bio: string; author_avatar_url: string;
  author_city: string; author_handle: string; available_for_republication: boolean; canonical_url: string;
  reading_minutes?: number; summary?: string;
  attribution: { author: string; originally_published_on: string; original_article_url: string; teacher_profile_url: string; attribution_text: string };
};

export type HubArticle = {
  slug: string; title: string; type: string; topic: string; language: string; author_name: string;
  author_handle: string; author_avatar_url: string; author_city: string; published_at?: number; excerpt: string;
  reading_minutes?: number;
};

async function publicGet<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const r = await fetch(`${BASE}${path}`, { next: { revalidate }, signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function getPublicArticle(slug: string, lang?: string): Promise<PublicArticle | null> {
  const q = lang ? `?lang=${encodeURIComponent(lang)}` : '';
  // Translations can take a few seconds on first view; use no-store when a
  // non-source language is requested so a fresh translation is not blocked by ISR.
  const path = `/api/voices/public/articles/${encodeURIComponent(slug)}${q}`;
  const d = lang
    ? await (async () => {
        try {
          const r = await fetch(`${BASE}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
          if (!r.ok) return null;
          return (await r.json()) as { article: PublicArticle };
        } catch { return null; }
      })()
    : await publicGet<{ article: PublicArticle }>(path, 120);
  const a = d?.article || null;
  // Articles by hidden demo/test authors are retired from every public surface.
  return a && !isPublicHandleBlocked(a.author_handle) ? a : null;
}

export async function getVoicesHub(): Promise<HubArticle[]> {
  const d = await publicGet<{ articles: HubArticle[] }>(`/api/voices/public/hub`, 120);
  return (d?.articles || []).filter((a) => !isPublicHandleBlocked(a.author_handle));
}

export type TeacherArticle = {
  slug: string; title: string; type: string; topic: string; language: string; published_at?: number; excerpt: string;
  reading_minutes?: number;
};

/** PUBLISHED NOSTOPS Voices articles by one teacher (Author Spotlight). */
export async function getArticlesByTeacher(handle: string): Promise<TeacherArticle[]> {
  if (!handle || isPublicHandleBlocked(handle)) return [];
  const d = await publicGet<{ articles: TeacherArticle[] }>(`/api/voices/public/by-teacher?handle=${encodeURIComponent(handle)}`, 120);
  return d?.articles || [];
}

export async function getRepublishableArticles(): Promise<PublicArticle[]> {
  const d = await publicGet<{ articles: PublicArticle[] }>(`/api/voices/public/articles?limit=200`, 120);
  return (d?.articles || []).filter((a) => !isPublicHandleBlocked(a.author_handle));
}
