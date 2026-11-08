import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { claimReminderFetch } from '@/lib/server/claim-reminders';

// Teacher turns off the finish-your-profile reminders from the email's signed link (no sign-in needed).
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const raw = await req.json().catch(() => ({}));
  const token = typeof raw?.token === 'string' ? raw.token.slice(0, 400) : '';
  if (!token) return NextResponse.json({ error: 'Missing link details.' }, { status: 400 });
  const up = await claimReminderFetch('/stop', { method: 'POST', body: JSON.stringify({ token }) });
  const d = await up.json().catch(() => null);
  if (!up.ok) return NextResponse.json({ error: toErrorText(d?.detail, 'Could not update your reminders.') }, { status: up.status || 502 });
  return NextResponse.json({ stopped: true });
}
