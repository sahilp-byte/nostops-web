import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { festivePost, relayFestive } from '@/lib/server/festive-kyc';

// Festive Complimentary InstaKYC — the signed-in account's campaign status (eligibility, profile %,
// KYC stage, claim, applicable fee, next action). Decided by the website backend on its own clock.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });
  try {
    return await relayFestive(await festivePost('/status', user), 'Could not load the festive offer.');
  } catch {
    return NextResponse.json({ ok: false, error: 'The festive offer is unavailable right now.' }, { status: 502 });
  }
}
