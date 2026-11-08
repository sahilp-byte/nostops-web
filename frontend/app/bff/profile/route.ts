import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Update the learner's basic profile (name, location). Forwards to the authed
// backend PUT /auth/profile with the bearer from the httpOnly cookie. Returns
// only the safe fields the client submitted — never the full backend user doc.
export async function PUT(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const location = typeof body?.location === 'string' ? body.location.trim() : '';
  if (name.length < 1 || name.length > 80) {
    return NextResponse.json({ error: 'Please enter a name (1–80 characters).' }, { status: 400 });
  }
  const payload: Record<string, string> = { name };
  if (location) payload.location = location;

  const up = await backendFetch('/auth/profile', { method: 'PUT', body: JSON.stringify(payload) });
  if (!up.ok) {
    const d = await up.json().catch(() => null);
    return NextResponse.json(
      { error: toErrorText(d?.detail || d?.message, 'Could not update your profile.') },
      { status: up.status || 502 },
    );
  }
  return NextResponse.json({ ok: true, name, location });
}
