import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { spacesCall, spacesError } from '@/lib/server/spaces';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const r = await spacesCall(`/enquiries/${encodeURIComponent(id)}`, { method: 'PATCH', body });
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Could not save your enquiry.') }, { status: r.status });
  return NextResponse.json(r.data);
}
