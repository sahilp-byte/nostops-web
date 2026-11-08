import type { NextRequest } from 'next/server';
import { badOrigin, forward, readJson, errorMessage, NextResponse } from '@/lib/server/bff';

// Confirm password reset with token + new password.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body?.token || !body?.new_password) {
    return NextResponse.json({ error: 'Token and new password are required.' }, { status: 400 });
  }
  const up = await forward('/auth/reset-password/confirm', {
    token: body.token,
    new_password: body.new_password,
  });
  const data = await readJson(up);
  if (!up.ok) {
    return NextResponse.json({ error: errorMessage(data, 'Reset failed. Request a new link.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true });
}
