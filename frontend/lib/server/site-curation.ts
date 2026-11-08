// Homepage featured teachers + website removals (backend/site_curation.py). Read by public pages on
// the server (lib/api.ts teacher reads, lib/server/venues.ts, the homepage). Cached for 60 s and
// refreshed immediately when an admin saves (revalidateTag CURATION_TAG). Lookup failure → defaults
// (nothing featured, nothing removed) so a page never breaks. Server-side only: in the browser the
// shared secret is absent and the defaults are returned.
export const CURATION_TAG = 'site-curation';
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');

export type Curation = {
  featured: string[];
  homeHidden: string[];
  removedTeachers: Set<string>;
  removedVenues: Set<string>;
};

const DEFAULTS = (): Curation => ({ featured: [], homeHidden: ['rajiv-dabhadkar-n'], removedTeachers: new Set(), removedVenues: new Set() });
const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)) : []);
// Last answer that loaded, so a brief outage of the listings service never brings deleted
// teachers or venues back onto public pages.
let lastGood: Curation | null = null;

export async function getCuration(): Promise<Curation> {
  const secret = process.env.PULSE_SHARED_SECRET || '';
  if (!secret) return DEFAULTS();
  try {
    const r = await fetch(`${BASE}/api/site-curation/public`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': secret },
      next: { revalidate: 60, tags: [CURATION_TAG] },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return lastGood ?? DEFAULTS();
    const d = await r.json();
    lastGood = {
      featured: list(d?.featured),
      homeHidden: list(d?.home_hidden),
      removedTeachers: new Set(list(d?.removed_teachers).map((h) => h.toLowerCase())),
      removedVenues: new Set(list(d?.removed_venues)),
    };
    return lastGood;
  } catch {
    return lastGood ?? DEFAULTS();
  }
}
