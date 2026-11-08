import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { recordCoordinatorApplied } from '@/lib/server/coordinator-local';

// Records a City Coordinator application acknowledgement for the signed-in
// teacher (they tapped "I've submitted my application" after the Jotform).
// CSRF-guarded; identity comes from the session, never the request body.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const res = await recordCoordinatorApplied();
  if (!res.ok) return NextResponse.json({ error: 'Could not save right now. Please try again.' }, { status: 502 });
  return NextResponse.json({ ok: true, applied_at: res.appliedAt });
}
