import type { NextRequest } from 'next/server';
import { badOrigin, forward, readJson, errorMessage, withSession, NextResponse } from '@/lib/server/bff';

// Role-scoped login/signup: POST /auth/login-by-role or /auth/signup-by-role.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const mode = body?.mode === 'register' ? 'register' : 'login';
  const role = String(body?.role || '').toLowerCase();
  if (!role || !body?.email || !body?.password || (mode === 'register' && !body?.name)) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }
  const path = mode === 'register' ? '/auth/signup-by-role' : '/auth/login-by-role';
  const payload =
    mode === 'register'
      ? { role, name: body.name, email: body.email, password: body.password, extra: body.extra ?? {} }
      : { role, email: body.email, password: body.password };

  const up = await forward(path, payload);
  const data = await readJson(up);

  // Backend signals wrong role for this account.
  if (data?.role_mismatch) {
    return NextResponse.json(
      { role_mismatch: true, actual_role: data.actual_role ?? null, error: errorMessage(data, 'Please use the correct login for your account.') },
      { status: 409 },
    );
  }
  if (!up.ok || typeof data?.session_token !== 'string') {
    return NextResponse.json(
      { error: errorMessage(data, mode === 'register' ? 'Signup failed.' : 'Login failed.') },
      { status: up.status || 502 },
    );
  }
  return withSession(NextResponse.json({ user: data.user ?? null }), data.session_token);
}
