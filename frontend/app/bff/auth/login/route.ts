import type { NextRequest } from 'next/server';
import { badOrigin, forward, readJson, errorMessage, withSession, NextResponse } from '@/lib/server/bff';

// User-facing messages for a slow or unavailable main backend. They never echo
// the backend's own error body (which could carry internals) for 5xx failures.
const SLOW = 'Sign-in is taking longer than usual because our server is slow to respond. Please try again in a moment.';
const UNREACHABLE = "We couldn't reach the sign-in service. Please check your connection and try again in a moment.";
const UNAVAILABLE = 'Sign-in is temporarily unavailable. Please try again in a few minutes.';
const INCOMPLETE = 'Sign-in could not be completed. Please try again.';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  // One attempt only (no automatic retry of a credential submission). A timeout
  // or connection failure returns a JSON 504/502 instead of an unhandled 500,
  // and no session cookie is ever set on any failure path.
  let up: Response;
  try {
    up = await forward('/auth/login', { email: body.email, password: body.password });
  } catch (e) {
    const timedOut = (e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError';
    return NextResponse.json({ error: timedOut ? SLOW : UNREACHABLE }, { status: timedOut ? 504 : 502 });
  }
  const data = await readJson(up);
  if (up.status >= 500) {
    return NextResponse.json({ error: UNAVAILABLE }, { status: up.status === 504 || up.status === 524 ? 504 : 502 });
  }
  if (!up.ok) {
    return NextResponse.json({ error: errorMessage(data, 'Login failed.') }, { status: up.status });
  }
  if (typeof data?.session_token !== 'string' || !data.session_token) {
    // A "successful" reply without a session is not a sign-in.
    return NextResponse.json({ error: INCOMPLETE }, { status: 502 });
  }
  return withSession(NextResponse.json({ user: data.user ?? null }), data.session_token);
}
