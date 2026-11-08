import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { ownershipCall, venueAccess, NOT_ELIGIBLE_MSG } from '@/lib/server/venue-ownership';

// Submit a Global Venue ownership claim. The claimant is ALWAYS the signed-in user (set server-side).
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const access = await venueAccess();
  if (!access.signedIn) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!access.eligible) return NextResponse.json({ error: NOT_ELIGIBLE_MSG }, { status: 403 });
  const raw = await req.json().catch(() => ({}));
  const body = {
    venue_id: String(raw.venue_id || '').slice(0, 80),
    relationship: String(raw.relationship || '').slice(0, 60),
    evidence_methods: Array.isArray(raw.evidence_methods) ? raw.evidence_methods.map(String).slice(0, 6) : [],
    business_email: String(raw.business_email || '').slice(0, 160),
    website: String(raw.website || '').slice(0, 300),
    google_business_url: String(raw.google_business_url || '').slice(0, 400),
    note: String(raw.note || '').slice(0, 2000),
    documents: Array.isArray(raw.documents) ? raw.documents.slice(0, 3) : [],
  };
  const r = await ownershipCall('/claims', { method: 'POST', body, eligible: true });
  if (r.status !== 200) return NextResponse.json({ error: toErrorText(r.data?.detail, 'Could not submit the claim.') }, { status: r.status });
  return NextResponse.json(r.data);
}
