// Stage 5A — legacy teacher claim shell: pure helpers (no network, safe for client and server).
// Only the confirmed, NON-consuming contract is used:
//   GET /api/teachers/claim/{raw_token} — 200 = valid invitation (response body NOT read: its schema is
//   unconfirmed), 410 = "Invalid or expired claim link" (observed). The backend does not distinguish
//   "already used" from "expired", so those share one generic state.

export type ClaimLinkState = 'valid' | 'invalid' | 'unavailable';

export const CLAIM_ROUTE_PREFIX = '/teachers/claim/';
const CLAIM_PATH_RE = /\/teachers\/claim\/[^/?#\s]+/g;

/** Shape check only (never proves validity): URL-safe characters, sane length. */
export function isPlausibleClaimToken(token: string): boolean {
  return typeof token === 'string' && /^[A-Za-z0-9._~-]{8,512}$/.test(token);
}

/** Map the backend's HTTP status to a page state. Outages are never shown as "invalid". */
export function classifyClaimStatus(status: number | null): ClaimLinkState {
  if (status === 200) return 'valid';
  if (status === 400 || status === 404 || status === 410 || status === 422) return 'invalid';
  return 'unavailable';
}

/** Remove claim tokens from any path/URL/message before it is logged or reported. */
export function redactClaimTokens(text: string): string {
  return String(text ?? '').replace(CLAIM_PATH_RE, `${CLAIM_ROUTE_PREFIX}[redacted]`);
}

export function isClaimPath(pathname: string | null | undefined): boolean {
  return !!pathname && pathname.startsWith(CLAIM_ROUTE_PREFIX);
}
