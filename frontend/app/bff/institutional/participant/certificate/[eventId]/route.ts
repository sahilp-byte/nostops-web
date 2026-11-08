// Streams the co-branded completion certificate PDF for the signed-in participant.
// GET download (no CSRF needed); the participant session is read server-side from
// the httpOnly cookie and forwarded as X-Participant-Session.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getParticipantSessionToken } from '@/lib/server/participant';
import { institutionalFetch } from '@/lib/server/institutional';

export const runtime = 'nodejs';

const EVENT_ID = /^[A-Za-z0-9-]{4,60}$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!EVENT_ID.test(eventId)) {
    return NextResponse.json({ error: 'Invalid event.' }, { status: 400 });
  }
  const token = await getParticipantSessionToken();
  if (!token) return NextResponse.json({ error: 'Please sign in to download your certificate.' }, { status: 401 });
  try {
    const r = await institutionalFetch(`/participant/certificate/${encodeURIComponent(eventId)}`, { participantSession: token });
    if (!r.ok) {
      return NextResponse.json({ error: 'Certificate is not available yet.' }, { status: r.status });
    }
    const buf = await r.arrayBuffer();
    return new NextResponse(Buffer.from(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': r.headers.get('content-disposition') || `attachment; filename="NOSTOPS-Certificate.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
