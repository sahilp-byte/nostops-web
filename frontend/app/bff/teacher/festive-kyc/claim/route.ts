import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { festivePost, relayFestive } from '@/lib/server/festive-kyc';

// Claim the complimentary (₹0) InstaKYC. No body is trusted: the account comes from the session and
// every fact is re-read from the main app now, then re-checked by the backend (atomic, one per
// account). No payment gateway is called. CSRF-guarded.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ ok: false, error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });
  try {
    return await relayFestive(await festivePost('/claim', user), 'Could not claim the offer.');
  } catch {
    return NextResponse.json({ ok: false, error: 'The festive offer is unavailable right now. Please try again.' }, { status: 502 });
  }
}
