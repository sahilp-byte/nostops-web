// §12 — participant submits feedback for a COMPLETED event. CSRF-guarded.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, errorMessage } from '@/lib/server/bff';
import { getParticipantSessionToken } from '@/lib/server/participant';
import { institutionalFetch } from '@/lib/server/institutional';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const token = await getParticipantSessionToken();
  if (!token) return NextResponse.json({ error: 'Please sign in to leave feedback.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    const r = await institutionalFetch('/participant/feedback', { method: 'POST', participantSession: token, body });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Could not submit feedback.') }, { status: r.status });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
