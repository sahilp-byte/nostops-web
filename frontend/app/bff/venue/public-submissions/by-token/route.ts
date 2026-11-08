import { testTagHeaders } from '@/lib/server/test-tag';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { toErrorText } from '@/lib/server/bff';

// PUBLIC: load a submission for editing, authenticated by a signed edit token
// (from the emailed magic link). GET is safe to call without CSRF.
export const runtime = 'nodejs';

const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export async function GET(req: NextRequest) {
  if (!SECRET) return NextResponse.json({ error: 'Temporarily unavailable.' }, { status: 503 });
  const token = (new URL(req.url).searchParams.get('token') || '').trim();
  if (!token) return NextResponse.json({ error: 'Missing edit link token.' }, { status: 400 });
  try {
    const up = await fetch(`${BASE}/api/venues/public-submissions/by-token?token=${encodeURIComponent(token)}`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    const data = await up.json().catch(() => ({}));
    if (!up.ok) return NextResponse.json({ error: toErrorText(data?.detail, 'This edit link is invalid or has expired.') }, { status: up.status || 502 });
    return NextResponse.json({ ok: true, submission: data?.submission });
  } catch {
    return NextResponse.json({ error: 'Service is unavailable right now. Please try again shortly.' }, { status: 502 });
  }
}
