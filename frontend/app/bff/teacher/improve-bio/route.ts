// AI bio polish proxy. CSRF-guarded + requires a signed-in session. Forwards the
// teacher's draft to the internal AI service (which holds the LLM key). The draft
// is the only thing sent; nothing is stored. Free for every teacher — never gated
// by KYC / payment / empanelment.
import { testTagHeaders } from '@/lib/server/test-tag';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';

const AI_BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bio = typeof body?.bio === 'string' ? body.bio.trim() : '';
  const hints = typeof body?.hints === 'string' ? body.hints : '';
  if (bio.length < 20) {
    return NextResponse.json({ error: 'Write a little more first, then let AI polish it.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${AI_BASE}/api/ai/improve-bio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      body: JSON.stringify({ bio: bio.slice(0, 4000), hints: hints.slice(0, 1000) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return NextResponse.json({ error: data?.detail || 'AI could not improve the bio right now.' }, { status: upstream.status });
    }
    return NextResponse.json({ bio: data?.bio || '' });
  } catch {
    return NextResponse.json({ error: 'AI is taking too long. Please try again.' }, { status: 504 });
  }
}
