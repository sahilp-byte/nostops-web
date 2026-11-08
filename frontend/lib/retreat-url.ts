// Single source of truth for PUBLIC retreat URLs.
//
// SEO architecture: public pages use human-readable, keyword-rich slugs (like
// /teachers/{handle}, /paramparas/{slug}). Retreats now follow the same rule,
// city-nested for local SEO:
//
//     /retreats/in/{city}/{title}-{city}-{month-year}-{rt_id}
//
// The opaque backend id (rt_…) stays embedded at the END so the frozen backend
// still resolves the retreat with NO backend change — we simply extract it from
// the slug server-side. Old /retreats/{rt_id} links 301-redirect to this URL.
//
// This module is PURE (no server-only imports) so it is safe in both server and
// client components.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function slug(s: string): string {
  return (s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function monthYear(startDate?: string): string {
  if (!startDate) return '';
  const m = /^(\d{4})-(\d{2})/.exec(startDate);
  if (!m) return '';
  const mi = parseInt(m[2], 10) - 1;
  return mi >= 0 && mi < 12 ? `${MONTHS[mi]}-${m[1]}` : '';
}

export type RetreatUrlInput = { id: string; title?: string; city?: string; startDate?: string };

/** City segment for the URL. Falls back to "india" so the path is always valid. */
export function retreatCitySlug(city?: string): string {
  return slug(city || '') || 'india';
}

/** The full slug segment: `{title}-{city}-{month-year}-{rt_id}`. */
export function retreatSlug(r: RetreatUrlInput): string {
  const base =
    [slug(r.title || 'yoga-retreat'), slug(r.city || ''), monthYear(r.startDate)]
      .filter(Boolean)
      .join('-')
      .replace(/-+/g, '-') || 'yoga-retreat';
  return `${base}-${r.id}`;
}

/** Canonical public path for a retreat. */
export function retreatPath(r: RetreatUrlInput): string {
  return `/retreats/in/${retreatCitySlug(r.city)}/${retreatSlug(r)}`;
}

/** Recover the backend id (rt_…) from a slug/param. Tolerates the bare id too.
 *  Returns '' for anything that isn't a well-formed retreat id (bad encoding, path
 *  segments, junk), so callers 404 without ever calling the backend with it. */
export function retreatIdFromParam(param: string): string {
  let p = param || '';
  try {
    p = decodeURIComponent(p);
  } catch {
    /* already decoded / malformed escape: use as-is */
  }
  const i = p.lastIndexOf('rt_');
  const id = i >= 0 ? p.slice(i) : '';
  return /^rt_[A-Za-z0-9_-]{1,64}$/.test(id) ? id : '';
}
