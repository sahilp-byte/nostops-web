import { testTagHeaders } from '@/lib/server/test-tag';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';

// TIER 2 PREVIEW (free): generate a reviewable website-import draft for the
// owner of a submission, authenticated by the signed edit token. No CAPTCHA
// needed — the token proves the owner opened the emailed link. No payment.
export const runtime = 'nodejs';

const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  if (!SECRET) return NextResponse.json({ error: 'Temporarily unavailable.' }, { status: 503 });
  const raw = await req.json().catch(() => ({}));
  const token = typeof raw?.token === 'string' ? raw.token.trim().slice(0, 512) : '';
  if (token.length < 8) return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 400 });

  try {
    const up = await fetch(`${BASE}/api/venues/public-submissions/import-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      body: JSON.stringify({ token }),
      cache: 'no-store',
      signal: AbortSignal.timeout(14000),
    });
    const data = await up.json().catch(() => ({}));
    if (!up.ok) {
      const payload: Record<string, unknown> = { error: toErrorText(data?.detail, 'Could not generate suggestions.') };
      if (up.status === 402) {
        payload.payment_required = true;
        payload.purchase_url = '/venues/ai-onboarding';
      }
      return NextResponse.json(payload, { status: up.status || 502 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Service is unavailable right now. Please try again shortly.' }, { status: 502 });
  }
}
