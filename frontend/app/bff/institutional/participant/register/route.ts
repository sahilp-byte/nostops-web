// §8 — authenticated participant event REGISTRATION (CSRF double-submit guarded).
// The participant session token is read server-side from the httpOnly cookie and
// forwarded as X-Participant-Session; it never reaches the browser.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, errorMessage } from '@/lib/server/bff';
import { getParticipantSessionToken } from '@/lib/server/participant';
import { institutionalFetch } from '@/lib/server/institutional';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const token = await getParticipantSessionToken();
  if (!token) return NextResponse.json({ error: 'Please confirm your email to continue.' }, { status: 401 });
  const raw = await req.json().catch(() => ({}));
  const body: Record<string, unknown> = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
  // Payments Prompt 2C — the engine checks the billing country of a PAID registration before it
  // writes anything. A non-text value is passed in its JSON form (never a valid code), so it is
  // refused as invalid instead of failing validation.
  const bc = body.billing_country;
  if (bc !== undefined && bc !== null) body.billing_country = (typeof bc === 'string' ? bc : JSON.stringify(bc)).slice(0, 8);
  try {
    const r = await institutionalFetch('/participant/register', {
      method: 'POST',
      participantSession: token,
      body,
    });
    const d = await r.json().catch(() => ({}));
    const refused = (d as any)?.detail;
    if (!r.ok && refused && typeof refused === 'object' && refused.routing_refused === true) {
      return NextResponse.json(
        { error: String(refused.error || ''), routing_refused: true, hold_refused: true, reason: refused.reason },
        { status: r.status },
      );
    }
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Could not complete your registration.') }, { status: r.status });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
