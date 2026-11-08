import type { NextRequest } from 'next/server';
import { badOrigin, forward, readJson, errorMessage, withSession, NextResponse } from '@/lib/server/bff';

// Emergent-managed Google/Apple social login: exchange the opaque session_id
// (returned in the callback URL fragment) for the backend bearer token.
// The session_id is sensitive; it is never logged or returned to the browser.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  let sessionId: unknown;
  try {
    sessionId = (await req.json())?.session_id;
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  if (typeof sessionId !== 'string' || sessionId.length < 1 || sessionId.length > 2048) {
    return NextResponse.json({ error: 'invalid session_id' }, { status: 400 });
  }
  const up = await forward('/auth/session', { session_id: sessionId });
  const data = await readJson(up);
  if (!up.ok || typeof data?.session_token !== 'string') {
    return NextResponse.json({ error: errorMessage(data, 'Sign-in failed.') }, { status: 401 });
  }
  return withSession(NextResponse.json({ user: data.user ?? null }), data.session_token);
}
