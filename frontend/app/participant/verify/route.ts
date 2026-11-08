// §8 — magic-link landing. The email link points here (SITE_URL/participant/verify
// ?token=...&next=...). We redeem the one-time token server-side, set the httpOnly
// participant session cookie, and redirect to the intended destination. The raw
// token is consumed here and never exposed to client JS.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PARTICIPANT_COOKIE } from '@/lib/session-cookie';
import { institutionalFetch } from '@/lib/server/institutional';

export const runtime = 'nodejs';

// Only permit internal destinations inside our own event-register / participant area.
function safeNext(next: string | null | undefined): string {
  const n = (next || '').trim();
  if (!n.startsWith('/') || n.startsWith('//')) return '/participant';
  if (n.startsWith('/events/') || n === '/participant' || n.startsWith('/participant')) return n;
  return '/participant';
}

// Build the PUBLIC origin from forwarded headers. In this proxied environment a
// Route Handler's req.url resolves to the internal host (0.0.0.0:3000), which
// must NEVER leak into a redirect Location (browser SSL error). Mirror of
// lib/pulse-rss.ts.
function publicBase(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host;
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const base = publicBase(req);
  const token = req.nextUrl.searchParams.get('token');
  const nextParam = req.nextUrl.searchParams.get('next');
  if (!token || token.length > 512) {
    return NextResponse.redirect(new URL('/participant?error=invalid', base));
  }
  try {
    const r = await institutionalFetch('/participant/auth/verify', { method: 'POST', body: { token } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.session_token) {
      return NextResponse.redirect(new URL('/participant?error=expired', base));
    }
    const dest = safeNext(d?.next || nextParam);
    const url = new URL(dest, base);
    url.searchParams.set('verified', '1');
    const res = NextResponse.redirect(url);
    res.cookies.set(PARTICIPANT_COOKIE, String(d.session_token), {
      httpOnly: true, secure: true, sameSite: 'none', partitioned: true, path: '/',
      maxAge: Number(d?.session_ttl) || 60 * 60 * 24 * 30,
    });
    return res;
  } catch {
    return NextResponse.redirect(new URL('/participant?error=error', base));
  }
}
