import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { spacesCall, spacesError } from '@/lib/server/spaces';

// Private teacher ↔ owner conversation on a sent enquiry.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id } = await params;
  const raw = await req.json().catch(() => ({}));
  const r = await spacesCall(`/enquiries/${encodeURIComponent(id)}/messages`, { method: 'POST', body: { text: String(raw.text || '').slice(0, 2000) } });
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Could not send your message.') }, { status: r.status });
  return NextResponse.json(r.data);
}
