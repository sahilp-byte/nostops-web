// §8 — participant sign-out. Revokes the engine session + clears the cookie.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { badOrigin } from '@/lib/server/bff';
import { PARTICIPANT_COOKIE } from '@/lib/session-cookie';
import { institutionalFetch } from '@/lib/server/institutional';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const token = (await cookies()).get(PARTICIPANT_COOKIE)?.value;
  try {
    if (token) await institutionalFetch('/participant/auth/logout', { method: 'POST', participantSession: token });
  } catch {
    /* best-effort revoke */
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PARTICIPANT_COOKIE, '', {
    httpOnly: true, secure: true, sameSite: 'none', partitioned: true, path: '/', maxAge: 0,
  });
  return res;
}
