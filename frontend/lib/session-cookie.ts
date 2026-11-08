// Standalone constants so both server modules and middleware (edge runtime) can
// import them WITHOUT pulling in next/headers or react.
export const SESSION_COOKIE = 'nostops_session';

// §8 — institutional PARTICIPANT session (opaque token from the local engine).
// httpOnly; set by the /participant/verify BFF route after a magic-link redeem.
// Fully separate from the main nostops_session (remote business auth).
// Re-authentication after 30 days WITHOUT authenticated activity (June 2026, all personas).
// httpOnly timestamp (ms) of the last signed-in visit, set at sign-in and refreshed by proxy.ts
// (at most once an hour) on signed-in page views. Each refresh also extends the session cookie, so
// an active member stays signed in; 30 idle days → both cookies cleared → log in again.
// The backend's own token expiry still applies on top (an expired token resolves no user).
export const ACTIVITY_COOKIE = 'nostops_active';
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;
export const INACTIVITY_LIMIT_MS = SESSION_MAX_AGE_S * 1000;
export const ACTIVITY_REFRESH_MS = 60 * 60 * 1000;
export const AUTH_COOKIE_ATTRS = { httpOnly: true, secure: true, sameSite: 'none' as const, partitioned: true, path: '/' };

export const PARTICIPANT_COOKIE = 'nostops_participant';

// Non-httpOnly double-submit CSRF token. Issued by middleware, echoed by the
// client (lib/auth-client sendBff) as the `x-csrf-token` header, and verified
// on every state-changing /bff/* route. Readable by JS on purpose.
export const CSRF_COOKIE = 'nostops_csrf';
export const CSRF_HEADER = 'x-csrf-token';

// The same token is also rendered into a <meta name="csrf-token"> tag on the
// auth/app screens (SSR) so the client can read it even when third-party
// `document.cookie` access is blocked inside an embedded webview/iframe. The
// proxy forwards the authoritative token to SSR via CSRF_SSR_HEADER.
export const CSRF_META = 'csrf-token';
export const CSRF_SSR_HEADER = 'x-nostops-csrf-ssr';
