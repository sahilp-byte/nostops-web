/**
 * Single source of truth for the NOSTOPS public website origin.
 *
 * The canonical public origin is PERMANENTLY https://www.nostops.org.
 * Everything SEO-related (canonical URLs, metadataBase, JSON-LD @id/url values,
 * Open Graph URLs) must resolve to this origin.
 */

// Prefer the env var, but the canonical origin is fixed regardless.
export const SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.nostops.org';

// The bare host the backend currently emits, and the canonical www host.
const BARE_HOST = 'nostops.org';
const WWW_HOST = 'www.nostops.org';

/**
 * Build an absolute canonical URL for a site-relative path.
 *   canonical('/')            -> https://www.nostops.org/
 *   canonical('/teachers')    -> https://www.nostops.org/teachers
 *   canonical('/teachers/foo')-> https://www.nostops.org/teachers/foo
 *
 * - collapses accidental duplicate slashes in the path
 * - preserves query string and fragment
 * - if given an absolute URL, it is normalized through toWww()
 */
export function canonical(path: string = '/'): string {
  if (!path) return `${SITE_URL}/`;

  // Absolute URL passed in -> normalize origin only.
  if (/^https?:\/\//i.test(path)) {
    return toWww(path);
  }

  // Separate fragment, then query, so we only de-dupe slashes in the path.
  let fragment = '';
  const hashIdx = path.indexOf('#');
  if (hashIdx !== -1) {
    fragment = path.slice(hashIdx);
    path = path.slice(0, hashIdx);
  }

  let query = '';
  const qIdx = path.indexOf('?');
  if (qIdx !== -1) {
    query = path.slice(qIdx);
    path = path.slice(0, qIdx);
  }

  // Ensure a single leading slash and collapse duplicate slashes.
  let p = '/' + path.replace(/^\/+/, '');
  p = p.replace(/\/{2,}/g, '/');

  // Keep the root's trailing slash; strip trailing slash from every other path.
  if (p.length > 1) p = p.replace(/\/+$/, '');

  return `${SITE_URL}${p}${query}${fragment}`;
}

/**
 * Normalize a NOSTOPS public-site URL to the canonical www origin.
 *
 *   https://nostops.org/x      -> https://www.nostops.org/x
 *   http://nostops.org/x       -> https://www.nostops.org/x
 *   https://www.nostops.org/x  -> unchanged (already canonical)
 *
 * Only the bare `nostops.org` host is rewritten. Every other host is returned
 * untouched, including:
 *   - www.nostops.app / nostops.app (a DIFFERENT domain, not the public site)
 *   - subdomains such as api.nostops.org
 *   - arbitrary external URLs (social links, dicebear images, backend URLs)
 * Non-URL / relative strings are returned unchanged.
 */
export function toWww(url: string): string {
  if (!url || typeof url !== 'string') return url;

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    // Not an absolute URL -> never transform arbitrary text.
    return url;
  }

  if (u.hostname.toLowerCase() === BARE_HOST) {
    u.hostname = WWW_HOST;
    if (u.protocol === 'http:') u.protocol = 'https:';
    return u.toString();
  }

  // Already canonical, a different domain, a subdomain, or external -> unchanged.
  return url;
}
