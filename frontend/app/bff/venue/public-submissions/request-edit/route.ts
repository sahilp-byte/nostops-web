import { testTagHeaders } from '@/lib/server/test-tag';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';

// PUBLIC: request a secure "edit your submission" magic link by email. The
// backend only emails the address ON THE RECORD (no enumeration) and always
// responds generically. Shared secret attached server-side.
export const runtime = 'nodejs';

const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  if (!SECRET) return NextResponse.json({ error: 'Temporarily unavailable.' }, { status: 503 });
  const raw = await req.json().catch(() => ({}));
  if (s(raw.company).length > 0) return NextResponse.json({ ok: true }); // honeypot

  const email = s(raw.email).slice(0, 160);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 64) || 'unknown';
  // Build the edit-link base from the request origin so links match this
  // environment (preview vs production) and always point at our own app.
  const origin = new URL(req.url).origin;

  try {
    const up = await fetch(`${BASE}/api/venues/public-submissions/request-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders(), 'X-Forwarded-For': ip },
      body: JSON.stringify({
        email,
        site_base: origin,
        captcha_token: s(raw.captcha_token).slice(0, 512),
        captcha_answer: s(raw.captcha_answer).slice(0, 16),
        honeypot: '',
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const data = await up.json().catch(() => ({}));
    if (!up.ok) return NextResponse.json({ error: toErrorText(data?.detail, 'Could not send the link. Please try again.') }, { status: up.status || 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Service is unavailable right now. Please try again shortly.' }, { status: 502 });
  }
}
