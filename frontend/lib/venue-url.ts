// Pure, client-safe helpers for building public venue URLs. No server imports,
// so both Client Components (e.g. VenueCard) and Server Components can use them.
// All venues (owner-submitted `pub_…` + curated partner `vp_…`) resolve to the
// clean /venues/in/{city}/{venue} shape; internal IDs never leak into URLs.
export type VenueUrlParts = { id: string; name?: string; city?: string };

function slugify(s?: string): string {
  return (s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
export function venueCitySlug(v: Pick<VenueUrlParts, 'city'>): string {
  return v.city ? slugify(v.city) : '';
}
export function venueNameSlug(v: Pick<VenueUrlParts, 'name'>): string {
  return slugify(v.name);
}
/** Parses a comma-separated `?ids=` value (shared shortlist / compare) into
 *  unique, well-formed venue ids, capped at `max`. */
export function parseVenueIds(raw: string | string[] | undefined, max: number): string[] {
  const s = Array.isArray(raw) ? raw.join(',') : raw || '';
  const out: string[] = [];
  for (const part of s.split(',')) {
    const id = part.trim();
    if (/^[A-Za-z0-9_-]{1,80}$/.test(id) && !out.includes(id)) out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

/** Canonical public path for a venue listing page. Falls back to /venues/{id}
 *  only when a venue has no city to slug. */
export function venuePath(v: VenueUrlParts): string {
  const c = venueCitySlug(v);
  const n = venueNameSlug(v);
  return c && n ? `/venues/in/${c}/${n}` : `/venues/${v.id}`;
}
