import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { spacesCall, spacesError } from '@/lib/server/spaces';

// Send the enquiry to the Space owner. Idempotent on the backend (a repeat returns the same enquiry).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id } = await params;
  const r = await spacesCall(`/enquiries/${encodeURIComponent(id)}/send`, { method: 'POST', body: {} });
  if (r.status !== 200) {
    const d = r.data?.detail;
    return NextResponse.json({ error: spacesError(d, 'Could not send your enquiry.'), missing: d?.missing || [], ref: d?.ref }, { status: r.status });
  }
  return NextResponse.json(r.data);
}
