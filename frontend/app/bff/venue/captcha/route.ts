import { testTagHeaders } from '@/lib/server/test-tag';
import { NextResponse } from 'next/server';

// Issues a fresh self-hosted image CAPTCHA (PNG data-URI + signed single-use
// token) for the public /venues/submit form. GET only; the shared secret is
// attached server-side. The plaintext answer never leaves the backend.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export async function GET() {
  if (!SECRET) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  try {
    const up = await fetch(`${BASE}/api/venues/captcha`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!up.ok) return NextResponse.json({ error: 'Could not load verification. Please retry.' }, { status: 502 });
    const data = await up.json().catch(() => ({}));
    return NextResponse.json(
      { token: data?.token || '', image: data?.image || '', expires_in: data?.expires_in || 300 },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Could not load verification. Please retry.' }, { status: 502 });
  }
}
