import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Redeem a teacher-invite referral code for the LOGGED-IN teacher (attaches the
// invite relationship so the referrer earns on this teacher's milestones).
// Authenticated: backendFetch attaches the bearer from the httpOnly session
// cookie — never exposed to the browser. CSRF double-submit enforced via
// badOrigin(). Forwards to POST /teacher-referrals/redeem {code}.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!/^[A-Za-z0-9_-]{4,20}$/.test(code)) {
    return NextResponse.json({ error: 'Invalid referral code.' }, { status: 400 });
  }

  const up = await backendFetch('/teacher-referrals/redeem', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  const data = await up.json().catch(() => null);
  if (!up.ok) {
    return NextResponse.json(
      { error: toErrorText(data?.detail || data?.message, 'Could not redeem this invitation.') },
      { status: up.status || 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
