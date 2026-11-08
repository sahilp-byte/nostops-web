import { NextResponse, type NextRequest } from 'next/server';
import {
  SESSION_COOKIE, CSRF_COOKIE, CSRF_SSR_HEADER, ACTIVITY_COOKIE, AUTH_COOKIE_ATTRS,
  SESSION_MAX_AGE_S, INACTIVITY_LIMIT_MS, ACTIVITY_REFRESH_MS,
} from '@/lib/session-cookie';

// Next 16 "proxy" convention. Two jobs:
//  1. Fast, optimistic auth gate for the authenticated app (/app/*). This is
//     NOT the security boundary — the /app layout re-validates the session
//     against the backend (/auth/me) and every mutation route authorizes
//     server-side. Proxy only avoids rendering the shell for obviously
//     unauthenticated visitors and marks the area noindex.
//  2. Issue a non-httpOnly double-submit CSRF token cookie on the auth + app
//     surfaces so the client can echo it (x-csrf-token) on BFF writes
//     (verified in lib/server/bff::badOrigin). Scoped away from public SEO
//     pages so their responses stay cacheable (no Set-Cookie).
export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // Stage 5A/5C: claim-token pages are never cached anywhere (Next's own page header omits no-store in dev).
  // They still get the CSRF cookie below (the claim BFF writes are CSRF-protected).
  const isClaim = path.startsWith('/teachers/claim/');
  const isApp = path === '/app' || path.startsWith('/app/');

  // Reuse a valid existing CSRF token, else mint a fresh one.
  const existing = req.cookies.get(CSRF_COOKIE)?.value ?? '';
  const csrf = existing.length >= 16 ? existing : crypto.randomUUID().replace(/-/g, '');

  // Forward the authoritative token to downstream SSR (group layouts render it
  // into <meta name="csrf-token">) so the client can read it even when
  // third-party `document.cookie` access is blocked inside an embedded
  // webview/iframe. Always overwrite so a client can't spoof this header.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(CSRF_SSR_HEADER, csrf);

  // 30-day inactivity rule (lib/session-cookie.ts). A refresh or any signed-in page view is
  // activity; only 30 days with no signed-in visit expires the session.
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const now = Date.now();
  const lastActive = Number(req.cookies.get(ACTIVITY_COOKIE)?.value || 0);
  const idleExpired = !!session && lastActive > 0 && now - lastActive > INACTIVITY_LIMIT_MS;

  let res: NextResponse;
  if (idleExpired) {
    // Drop the stale session before anything renders with it; ask to log in again.
    requestHeaders.set('cookie', req.cookies.getAll().filter((c) => c.name !== SESSION_COOKIE && c.name !== ACTIVITY_COOKIE)
      .map((c) => `${c.name}=${c.value}`).join('; '));
    if (isApp || path === '/login') {
      const login = new URL('/login', req.url);
      login.searchParams.set('reauth', '1');
      if (isApp) login.searchParams.set('next', path + req.nextUrl.search);
      res = path === '/login' && req.nextUrl.searchParams.get('reauth') === '1'
        ? NextResponse.next({ request: { headers: requestHeaders } })
        : NextResponse.redirect(login);
    } else {
      res = NextResponse.next({ request: { headers: requestHeaders } });
    }
    res.cookies.set(SESSION_COOKIE, '', { ...AUTH_COOKIE_ATTRS, maxAge: 0 });
    res.cookies.set(ACTIVITY_COOKIE, '', { ...AUTH_COOKIE_ATTRS, maxAge: 0 });
  } else if (isApp && !session) {
    const login = new URL('/login', req.url);
    // Keep the query (e.g. ?cohort=COMPANY) so the post-login redirect lands on
    // the same view; LoginForm re-validates `next` as a same-site path.
    login.searchParams.set('next', path + req.nextUrl.search);
    res = NextResponse.redirect(login);
  } else {
    res = NextResponse.next({ request: { headers: requestHeaders } });
    if (isApp) res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    // Signed-in activity: refresh at most hourly; also slides the session cookie forward.
    if (session && now - lastActive > ACTIVITY_REFRESH_MS) {
      res.cookies.set(ACTIVITY_COOKIE, String(now), { ...AUTH_COOKIE_ATTRS, maxAge: SESSION_MAX_AGE_S });
      res.cookies.set(SESSION_COOKIE, session, { ...AUTH_COOKIE_ATTRS, maxAge: SESSION_MAX_AGE_S });
    }
  }

  if (existing !== csrf) {
    res.cookies.set(CSRF_COOKIE, csrf, {
      httpOnly: false,
      // SameSite=None + Secure + Partitioned (CHIPS) so the double-submit token
      // is stored and readable when the app is opened inside an embedded
      // cross-site context (Emergent mobile webview / platform preview iframe),
      // where unpartitioned third-party cookies are dropped. Runtime is HTTPS.
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  if (isClaim) {
    res.headers.set('Cache-Control', 'no-store, private, max-age=0');
    res.headers.set('Referrer-Policy', 'no-referrer');
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return res;
}

export const config = {
  matcher: [
    '/teachers/claim/:path*',
    '/app',
    '/app/:path*',
    '/booking-invite/:path*',
    '/participant',
    '/participant/:path*',
    '/events/:slug/register',
    '/venues/submit',
    '/venues/submit/:path*',
    '/venues/ai-onboarding',
    '/venues/ai-onboarding/:path*',
    '/login',
    '/signup',
    '/register',
    '/reset-password',
    '/verify-otp',
    '/choose-role',
    '/join',
    '/emergent-callback',
    // Signed-out teachers open this from a reminder email and POST to a CSRF-checked BFF route.
    '/claim/reminders',
  ],
};
