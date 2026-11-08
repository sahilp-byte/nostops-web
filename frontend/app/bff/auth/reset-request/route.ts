import type { NextRequest } from 'next/server';
import { badOrigin, forward, readJson, errorMessage, NextResponse } from '@/lib/server/bff';

// Request a password reset link/email. Returns ok even on 200; 429 => throttled.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body?.email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  const up = await forward('/auth/reset-password/request', { email: body.email });
  const data = await readJson(up);
  if (up.status === 429) {
    return NextResponse.json({ error: errorMessage(data, 'Too many attempts. Please wait a few minutes.') }, { status: 429 });
  }
  if (!up.ok) {
    return NextResponse.json({ error: errorMessage(data, 'Could not process the request.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true });
}
