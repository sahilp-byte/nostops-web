import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { spacesCall, spacesError } from '@/lib/server/spaces';

// Non-financial venue terms for one enquiry (availability, facilities, access, conditions). No fees.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id } = await params;
  const raw = await req.json().catch(() => ({}));
  // Forward the body as sent: the backend refuses unknown (e.g. fee/rent) fields with 422 instead of silently dropping them.
  const r = await spacesCall(`/enquiries/${encodeURIComponent(id)}/venue-terms`, { method: 'PUT', body: raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {} });
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Could not save the venue terms.') }, { status: r.status });
  return NextResponse.json(r.data);
}
