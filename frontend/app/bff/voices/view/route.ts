import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// PUBLIC, open view counter for NOSTOPS Voices articles. Called by a small
// beacon on the public article page. Intentionally NOT CSRF-guarded — the
// public /voices/* pages never mint the CSRF cookie, and the only effect is
// incrementing a view count (no account / data / money). Mirrors the accepted
// design of the anonymous beta-feedback + waitlist routes.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug.slice(0, 120) : '';
  if (!slug) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await fetch(`${BASE}/api/voices/public/view`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }), cache: 'no-store', signal: AbortSignal.timeout(6000),
    });
  } catch {
    /* best-effort; a view never blocks the reader */
  }
  return NextResponse.json({ ok: true });
}
