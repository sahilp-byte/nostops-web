// Server-only origin for the live NOSTOPS backend. Intentionally NOT a
// NEXT_PUBLIC_ variable, so the backend URL is never bundled into client-side
// JavaScript. All reads go to the live backend; we never reimplement logic here.
import { financialLockRule } from '@/lib/financial-lock-rules';
import { getCuration } from '@/lib/server/site-curation';
import { noteRemovedHandles } from '@/lib/public-teacher';

// No built-in fallback host, and a production build never talks to a Preview backend.
const RAW_BACKEND = (process.env.BACKEND_URL || '').trim().replace(/\/+$/, '');
export const BACKEND_BASE =
  process.env.NODE_ENV === 'production' && /\.preview\.(emergentagent\.com|emergentcf\.cloud)$/i.test(RAW_BACKEND.replace(/^https?:\/\//, '').split('/')[0])
    ? 'https://backend-not-configured.invalid'
    : RAW_BACKEND;

type GetOpts = {
  /** seconds to cache with ISR; omit + noStore for fully dynamic SSR */
  revalidate?: number;
  noStore?: boolean;
  headers?: Record<string, string>;
  /** abort the request after this many ms (default 10s) so a hung backend
   * can never hang an SSR render */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10000;

// ── B4.8 — Council / admin trust-review decisions ─────────────────────────────
// A reviewer's SUSPEND or REVOKE decision withdraws "Empanelled" on EVERY public
// teacher read (directory, profile, featured, matching, OG images, sitemap),
// server-side, so no page can keep showing it. The main-backend record itself is
// untouched (its own team updates it). Lookup failure → reads are left as-is.
export const TRUST_WITHDRAWN_TAG = 'trust-withdrawn';
const PULSE_BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');

async function withdrawnHandles(): Promise<Set<string>> {
  const secret = process.env.PULSE_SHARED_SECRET || '';
  if (!secret) return new Set();
  try {
    const r = await fetch(`${PULSE_BASE}/api/trust/public/withdrawn`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': secret },
      next: { revalidate: 60, tags: [TRUST_WITHDRAWN_TAG] },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return new Set();
    const d = await r.json();
    return new Set(Array.isArray(d?.handles) ? d.handles.map((h: unknown) => String(h)) : []);
  } catch {
    return new Set();
  }
}

function markWithdrawn(v: any, set: Set<string>, depth = 0): void {
  if (!v || typeof v !== 'object' || depth > 4) return;
  if (Array.isArray(v)) {
    for (const x of v) markWithdrawn(x, set, depth + 1);
    return;
  }
  if (typeof v.handle === 'string' && set.has(v.handle) && 'is_empanelled' in v) {
    v.is_empanelled = false;
    v.empanelment_withdrawn = true;
  }
  for (const k of Object.keys(v)) markWithdrawn(v[k], set, depth + 1);
}

async function applyTrustDecisions<T>(path: string, data: T): Promise<T> {
  if (!/^\/?(api\/)?teachers\//.test(path)) return data;
  const [set, curation] = await Promise.all([withdrawnHandles(), getCuration()]);
  if (set.size) markWithdrawn(data, set);
  dropRemovedTeachers(data, curation.removedTeachers);
  return data;
}

// Admin › Homepage & Listings "Delete": a removed teacher disappears from EVERY public teacher read
// (directory lists, profile, OG image, search, sitemap, city pages, homepage). The account itself
// is untouched and can sign in; Restore brings the profile back.
function dropRemovedTeachers(data: any, removed: Set<string>): void {
  noteRemovedHandles(removed);
  if (!removed.size || !data || typeof data !== 'object') return;
  const gone = (t: any) => removed.has(String(t?.handle || '').toLowerCase());
  if (Array.isArray(data.teachers)) data.teachers = data.teachers.filter((t: any) => !gone(t));
  if (data.teacher && gone(data.teacher)) data.teacher = null;
}

function buildUrl(path: string): string {
  // FINANCIAL SAFETY AUDIT — the public read helpers (GET only) obey the same money lock as
  // backendFetch, so a state-changing read (payout sweep, wallet heal, mock checkout) can
  // never be sent from a page either. Throws → the caller's normal error path.
  const rule = financialLockRule('GET', path, undefined, process.env.FINANCIAL_ACTIONS_UNLOCKED !== 'true');
  if (rule) throw new Error(`[financial-lock] refused GET (${rule.id})`);
  const p = path.startsWith('/api')
    ? path
    : `/api${path.startsWith('/') ? '' : '/'}${path}`;
  return `${BACKEND_BASE}${p}`;
}

export async function apiGet<T = any>(path: string, opts: GetOpts = {}): Promise<T> {
  const url = buildUrl(path);
  const cacheOpt = opts.noStore
    ? { cache: 'no-store' as const }
    : { next: { revalidate: opts.revalidate ?? 60 } };
  const res = await fetch(url, {
    headers: { Accept: 'application/json', ...(opts.headers || {}) },
    signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    ...cacheOpt,
  });
  if (!res.ok) {
    throw new Error(`Backend ${res.status} ${res.statusText} for ${url}`);
  }
  return applyTrustDecisions(path, (await res.json()) as T);
}

// Never let a single failed widget take down a whole SSR page.
export async function apiGetSafe<T = any>(
  path: string,
  fallback: T,
  opts: GetOpts = {},
): Promise<T> {
  try {
    return await apiGet<T>(path, opts);
  } catch (e) {
    console.error('[apiGetSafe]', path, (e as Error)?.message);
    return fallback;
  }
}

// Fetch JSON but return null (silently) on any non-2xx or error — for OPTIONAL
// endpoints that may not exist yet (contract-first features). No error logging,
// so a not-yet-shipped endpoint never pollutes SSR logs.
export async function apiGetOrNull<T = any>(path: string, opts: GetOpts = {}): Promise<T | null> {
  try {
    const res = await fetch(buildUrl(path), {
      headers: { Accept: 'application/json', ...(opts.headers || {}) },
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      ...(opts.noStore ? { cache: 'no-store' as const } : { next: { revalidate: opts.revalidate ?? 60 } }),
    });
    if (!res.ok) return null;
    return applyTrustDecisions(path, (await res.json()) as T);
  } catch {
    return null;
  }
}
