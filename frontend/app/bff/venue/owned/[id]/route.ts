import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { ownershipCall, venueAccess, NOT_ELIGIBLE_MSG } from '@/lib/server/venue-ownership';

// Owner edit of a claimed Global Venue. Ownership is enforced by the sidecar against the signed-in user.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const access = await venueAccess();
  if (!access.signedIn) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!access.eligible) return NextResponse.json({ error: NOT_ELIGIBLE_MSG }, { status: 403 });
  const { id } = await params;
  const raw = await req.json().catch(() => ({}));
  const r = await ownershipCall(`/owned/${encodeURIComponent(id)}`, { method: 'PATCH', body: raw && typeof raw === 'object' ? raw : {}, eligible: true });
  if (r.status !== 200) {
    const d = Array.isArray(r.data?.detail) ? r.data.detail[0]?.msg : r.data?.detail;
    return NextResponse.json({ error: toErrorText(d, 'Could not save your changes.') }, { status: r.status });
  }
  return NextResponse.json(r.data);
}
