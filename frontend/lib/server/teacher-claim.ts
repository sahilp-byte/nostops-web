import 'server-only';
import { classifyClaimStatus, isPlausibleClaimToken, type ClaimLinkState } from '@/lib/teacher-claim';

// Stage 5A/5C — server-side client for the authoritative legacy-teacher claim API
// (contract: LEGACY_TEACHER_CLAIM_API_CONTRACT_V1, supplied by the backend project).
//   GET  /teachers/claim/{token}               public, non-consuming → profile fields | 410
//   POST /teachers/claim/{token}               {password, verification_id?} → {user, session_token, role, next_route} | 409 | 410
//   POST /teachers/claim/{token}/link          Bearer; {teacher_id, verification_id?} → {ok, linked, teacher_id, user_id, role, next_route}
//   POST /teachers/claim/{token}/otp/request   {operation} → {status:"otp_sent", phone_masked} | {status:"manual_review"} | 429
//   POST /teachers/claim/{token}/otp/verify    {operation, code} → {ok, verification_id, operation, expires_in_seconds}
// The base URL comes ONLY from the server env TEACHER_CLAIM_API_BASE (never from request headers and never
// defaulting to the live backend). Nothing here logs, throws or returns the token.
const TIMEOUT_MS = 12000;

export type ClaimProfile = {
  name: string; city: string; bio: string; experience_years: number | null; specializations: string[];
  languages: string[]; avatar_url: string | null; badges: string[]; email_masked: string | null;
};
export type Upstream = { status: number; data: any };
type Fetcher = (url: string, init: RequestInit) => Promise<{ status: number; json?: () => Promise<any> }>;

export function claimApiBase(): string | null {
  const b = (process.env.TEACHER_CLAIM_API_BASE || '').trim().replace(/\/+$/, '');
  // A production build must never call a Preview backend: claim stays disabled until a verified production base is set.
  if (process.env.NODE_ENV === 'production' && /\.preview\.emergentagent\.com\//.test(b + '/')) return null;
  return /^https:\/\/[^/]+\/api$/.test(b) ? b : null;
}

export async function claimCall(token: string, suffix: '' | '/link' | '/otp/request' | '/otp/verify', init: {
  method: 'GET' | 'POST'; body?: unknown; bearer?: string | null;
}, fetcher: Fetcher = fetch): Promise<Upstream> {
  const base = claimApiBase();
  if (!base || !isPlausibleClaimToken(token)) return { status: base ? 410 : 0, data: null };
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.bearer) headers.Authorization = `Bearer ${init.bearer}`;
  try {
    const r = await fetcher(`${base}/teachers/claim/${encodeURIComponent(token)}${suffix}`, {
      method: init.method, headers, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    let data: any = null;
    try { data = r.json ? await r.json() : null; } catch { data = null; }
    return { status: r.status, data };
  } catch {
    return { status: 0, data: null }; // network error / timeout
  }
}

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => x.slice(0, 80)).slice(0, 20) : []);

export function maskEmail(e: unknown): string | null {
  const m = typeof e === 'string' ? e.trim().match(/^([^@\s]+)@([^@\s]+)$/) : null;
  if (!m) return null;
  return `${m[1].slice(0, 1)}•••@${m[2]}`;
}

/** Only the contract's display fields; the full email is masked and nothing else is passed to the browser. */
export function sanitizeProfile(d: any): ClaimProfile {
  const avatar = str(d?.avatar_url, 500);
  const yrs = Number(d?.experience_years);
  return {
    name: str(d?.name, 120), city: str(d?.city, 80), bio: str(d?.bio, 1500),
    experience_years: Number.isFinite(yrs) && yrs >= 0 && yrs < 80 ? Math.round(yrs) : null,
    specializations: list(d?.specializations), languages: list(d?.languages), badges: list(d?.badges),
    avatar_url: /^https:\/\//.test(avatar) ? avatar : null, email_masked: maskEmail(d?.email),
  };
}

export async function checkClaimLink(token: string, fetcher?: Fetcher): Promise<{ state: ClaimLinkState; profile: ClaimProfile | null }> {
  if (!isPlausibleClaimToken(token)) return { state: 'invalid', profile: null };
  const r = await claimCall(token, '', { method: 'GET' }, fetcher);
  const state = classifyClaimStatus(r.status || null);
  return { state, profile: state === 'valid' ? sanitizeProfile(r.data) : null };
}

/** Website destination for the backend's next_route ("/teacher-dashboard" is the app route → /app/teacher). */
export function websiteRoute(next: unknown): string {
  return next === '/teacher-dashboard' ? '/app/teacher' : '/app';
}
