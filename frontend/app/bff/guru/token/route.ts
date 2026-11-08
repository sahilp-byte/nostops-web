// Issues a short-lived, stateless signed CSRF token for the Ask AI Guru widget
// AND returns the visitor's auth state + role (from the httpOnly session) so the
// client can show the correct, NOSTOPS-authored contextual greeting. No cookie
// is set (works on static public pages and inside preview iframes). The token is
// NOT readable cross-origin (no CORS headers), so only our own pages can obtain
// one.
import { NextResponse } from 'next/server';
import { issueGuruToken } from '@/lib/server/guru-csrf';
import { getSessionUser } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json(
    {
      token: issueGuruToken(),
      authenticated: !!user,
      role: user?.role ? String(user.role).toLowerCase() : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
