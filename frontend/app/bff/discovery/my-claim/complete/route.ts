import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { markMyClaimProfileComplete } from '@/lib/server/discovery';

// The signed-in teacher finished onboarding → stop the finish-your-profile reminders for THEIR claim.
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  if (!(await getSessionUser())) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  await markMyClaimProfileComplete();
  return NextResponse.json({ ok: true });
}
