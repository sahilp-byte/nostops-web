// SEC (SSRF hardening): when building social-share cards / server-side data-URIs
// we sometimes fetch an image URL that came from backend data. A backend-provided
// URL must NEVER be able to point our server at an internal host or a cloud
// metadata endpoint. Only https URLs on this small, public image-host allowlist
// are permitted; everything else (http, private IPs, arbitrary hosts) is rejected.
const SUFFIX_ALLOW = [
  '.emergentagent.com', // Emergent object storage / integrations
  '.emergent.host', // Emergent-hosted backend + assets
  '.googleusercontent.com', // Google avatar / user content
  '.googleapis.com', // Google Places / storage
];
const EXACT_ALLOW = new Set<string>(['res.cloudinary.com', 'images.unsplash.com']);

// Fork-safe: the backend host can change between environments — always trust the
// currently-configured BACKEND_URL host.
try {
  const h = new URL(process.env.BACKEND_URL || '').hostname.toLowerCase();
  if (h) EXACT_ALLOW.add(h);
} catch {
  /* no backend url configured */
}

export function isAllowedRemoteImage(raw?: string | null): boolean {
  if (!raw) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (EXACT_ALLOW.has(host)) return true;
  return SUFFIX_ALLOW.some((s) => host.endsWith(s));
}
