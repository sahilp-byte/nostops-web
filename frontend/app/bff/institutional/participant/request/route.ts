// §8 — participant magic-link REQUEST (anonymous, CSRF double-submit guarded).
// Upserts the participant + emails a one-time sign-in link via the local engine.
// Debug token fields (QA only) are NEVER forwarded to the browser.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, errorMessage } from '@/lib/server/bff';
import { institutionalFetch } from '@/lib/server/institutional';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || '').trim();
  if (!email || email.length > 254) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  try {
    const r = await institutionalFetch('/participant/auth/request', {
      method: 'POST',
      body: {
        email,
        event_slug: body?.event_slug || null,
        session_id: typeof body?.session_id === 'string' ? body.session_id.slice(0, 80) : null,
        name: typeof body?.name === 'string' ? body.name.slice(0, 120) : null,
      },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Could not send the link. Please try again.') }, { status: r.status });
    return NextResponse.json({ ok: true, sent: d?.sent !== false });
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
