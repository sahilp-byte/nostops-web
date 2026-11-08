import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { CODE_RE, VREF_COOKIE, VID_COOKIE, recordGrowthEvent } from '@/lib/server/venue-growth';

// Venue invitation attribution. The referring venue (opaque code) and the anonymous
// visitor id come from first-party cookies set by /v/{code}; a teacher's user id
// always comes from the server-side session, never from the browser.
export const runtime = 'nodejs';

const USER_KINDS = new Set(['register_complete', 'existing_signin', 'profile_complete']);

export async function POST(req: NextRequest) {
  const code = req.cookies.get(VREF_COOKIE)?.value || '';
  if (!CODE_RE.test(code)) return NextResponse.json({ counted: false });
  const raw = await req.json().catch(() => ({}));
  const kind = typeof raw?.kind === 'string' ? raw.kind : '';

  if (kind === 'profile_view') {
    const venueId = typeof raw?.venue_id === 'string' ? raw.venue_id.slice(0, 80) : '';
    const visitor = req.cookies.get(VID_COOKIE)?.value || '';
    if (!venueId || !visitor) return NextResponse.json({ counted: false });
    return NextResponse.json({ counted: await recordGrowthEvent({ code, kind, visitor: visitor.slice(0, 64), venue_id: venueId }) });
  }
  if (USER_KINDS.has(kind)) {
    if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ counted: false });
    return NextResponse.json({ counted: await recordGrowthEvent({ code, kind, user_id: String(user.user_id || user.email || '') }) });
  }
  return NextResponse.json({ error: 'unknown kind' }, { status: 400 });
}
