import type { NextRequest } from 'next/server';
import { badOrigin, forward, readJson, errorMessage, withSession, NextResponse } from '@/lib/server/bff';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password || !body?.name) {
    return NextResponse.json({ error: 'Name, email and password are required.' }, { status: 400 });
  }
  const up = await forward('/auth/register', {
    name: body.name,
    email: body.email,
    password: body.password,
  });
  const data = await readJson(up);
  if (!up.ok) {
    return NextResponse.json({ error: errorMessage(data, 'Registration failed.') }, { status: up.status || 502 });
  }
  // Some backends auto-login on register (return session_token); others require
  // a subsequent login. Handle both without assuming.
  if (typeof data?.session_token === 'string') {
    return withSession(NextResponse.json({ user: data.user ?? null, authenticated: true }), data.session_token);
  }
  return NextResponse.json({ user: data?.user ?? null, authenticated: false });
}
