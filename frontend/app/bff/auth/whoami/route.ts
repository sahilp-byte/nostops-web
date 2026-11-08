import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';

// Client-safe login probe for the PUBLIC header. Reads the httpOnly session
// cookie server-side and reports ONLY whether a valid session exists — never
// the token, never any PII. GET (idempotent, no state change) so no CSRF token
// is required. force-dynamic + no-store so the answer always reflects the
// caller's own cookie and is never cached across users.
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json(
    { authenticated: !!user },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
