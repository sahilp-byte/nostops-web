// SEC-001: only allow a strict SAME-SITE absolute path as the post-login target.
// Reject protocol-relative (`//evil.com`), backslash tricks (`/\evil.com`), any
// value with a scheme, control chars, or backslashes — all of which browsers can
// treat as an off-site redirect (open-redirect / phishing). Fallback: /app.
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/')) return '/app';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/app';
  if (raw.includes('\\') || /[\u0000-\u001f]/.test(raw)) return '/app';
  return raw;
}

// Same-tab hand-off of the post-login target across the Google/Apple round trip
// (the Emergent auth page only returns to /emergent-callback).
export const AUTH_NEXT_KEY = 'nostops_auth_next';
