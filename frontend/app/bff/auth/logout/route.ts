import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { SESSION_COOKIE } from '@/lib/server/session';
import { backendFetch } from '@/lib/server/session';
import { ACTIVITY_COOKIE, AUTH_COOKIE_ATTRS } from '@/lib/session-cookie';

// Best-effort backend logout, then delete the BFF cookie (same attributes).
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  try {
    await backendFetch('/auth/logout', { method: 'POST' });
  } catch {
    /* ignore — we still clear the local session below */
  }
  const resp = NextResponse.json({ ok: true });
  resp.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
    maxAge: 0,
  });
  resp.cookies.set(ACTIVITY_COOKIE, '', { ...AUTH_COOKIE_ATTRS, maxAge: 0 });
  return resp;
}
