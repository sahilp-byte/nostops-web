import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import { cache } from 'react';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';

// Server-only client for the LOCAL Teacher Discovery store (/api/discovery/*).
// Public provisional-profile reads carry the shared secret (SSR only); when a
// visitor is signed in we also pass their identity so the backend can tell us
// whether THEY are the account that claimed this profile (never leaks who the
// claimer is to anyone else).
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const TIMEOUT = 10000;

export type ProvisionalProfile = {
  name: string;
  locality: string;
  city: string;
  city_slug: string;
  teacher_slug: string;
  classification: string;
  claim_state: 'PROVISIONAL' | 'CLAIM_INVITED' | 'CLAIMED';
  is_claimer: boolean;
  lat?: number | null;
  lng?: number | null;
  data_source: string;
  /** When set, this entry graduated to a live verified profile — redirect there. */
  verified_handle?: string | null;
};

export type ClaimSearchResult = {
  name: string;
  locality: string;
  city: string;
  city_slug: string;
  teacher_slug: string;
  claim_state: 'PROVISIONAL' | 'CLAIM_INVITED' | 'CLAIMED';
};

// The signed-in account's own claimed-but-not-yet-live provisional listing.
export type PendingClaim = {
  name: string;
  locality: string;
  city: string;
  city_slug: string;
  teacher_slug: string;
};

async function optionalUserHeader(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const actor = {
    user_id: String(user.user_id || user.email || ''),
    name: (user.name as string) || (user.email as string) || '',
    role: normalizeRole(user.role),
    // Server-to-server only: kept with a claim for the finish-your-profile reminder emails.
    email: (user.email as string) || '',
  };
  return Buffer.from(JSON.stringify(actor), 'utf8').toString('base64');
}

export async function getProvisionalProfile(
  citySlug: string,
  teacherSlug: string,
): Promise<{ profile: ProvisionalProfile; signedIn: boolean; indexable: boolean } | null> {
  const uHeader = await optionalUserHeader();
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() };
  if (uHeader) headers['X-Pulse-User'] = uHeader;
  try {
    const r = await fetch(
      `${BASE}/api/discovery/public/provisional/${encodeURIComponent(citySlug)}/${encodeURIComponent(teacherSlug)}`,
      { headers, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT) },
    );
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    if (!d?.profile) return null;
    return { profile: d.profile as ProvisionalProfile, signedIn: !!uHeader, indexable: d.indexable === true };
  } catch {
    return null;
  }
}

export type ClaimedListing = ClaimSearchResult & { claimed_at?: number | null; profile_done?: boolean };

// Every CLAIMED provisional listing (owner rule: claimed = public + indexable) — feeds the sitemap
// and, with `city`, the city teacher page (pass `revalidate` there so the page stays ISR).
// Throws when the store is unreachable so the sitemap reports the family as skipped.
export async function listClaimedProvisional(opts: { city?: string; revalidate?: number } = {}): Promise<ClaimedListing[]> {
  const qs = opts.city ? `?city_slug=${encodeURIComponent(opts.city)}` : '';
  const r = await fetch(`${BASE}/api/discovery/public/claimed${qs}`, {
    headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
    ...(opts.revalidate ? { next: { revalidate: opts.revalidate } } : { cache: 'no-store' as const }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!r.ok) throw new Error(`claimed listings unavailable (${r.status})`);
  const d = await r.json();
  return (Array.isArray(d?.items) ? d.items : []).map((x: any) => ({ ...x, claim_state: 'CLAIMED' as const }));
}

/** The signed-in claimer finished their teacher profile → stops their finish-your-profile reminders.
 *  Idempotent and best-effort (never blocks the caller). */
export async function markMyClaimProfileComplete(): Promise<void> {
  const uHeader = await optionalUserHeader();
  if (!uHeader) return;
  await fetch(`${BASE}/api/discovery/my-claim/profile-complete`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders(), 'X-Pulse-User': uHeader },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT),
  }).catch(() => undefined);
}

// The signed-in account's own claimed-but-not-yet-live provisional listing, if
// any. Lets the web app treat a "claimed but not onboarded" account as a teacher
// whose onboarding is in progress (route to Start Onboarding + pre-fill wizard),
// without depending on the remote auth backend flipping the persona at claim time
// (it can't — claiming is a local-only operation the remote never sees). Returns
// null once the listing graduates to a live verified profile.
export const getMyPendingClaim = cache(async (): Promise<PendingClaim | null> => {
  const uHeader = await optionalUserHeader();
  if (!uHeader) return null;
  try {
    const r = await fetch(`${BASE}/api/discovery/my-claim`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders(), 'X-Pulse-User': uHeader },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    return (d?.claim as PendingClaim) || null;
  } catch {
    return null;
  }
});
// (optionally within a city). Carries the server-only shared secret (SSR only).
export async function searchProvisional(
  q: string,
  city?: string,
): Promise<ClaimSearchResult[]> {
  const term = (q || '').trim();
  if (term.length < 2) return [];
  const qs = new URLSearchParams({ q: term });
  if (city) qs.set('city', city);
  try {
    const r = await fetch(`${BASE}/api/discovery/public/search?${qs.toString()}`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return [];
    const d = await r.json().catch(() => null);
    return Array.isArray(d?.items) ? (d.items as ClaimSearchResult[]) : [];
  } catch {
    return [];
  }
}
