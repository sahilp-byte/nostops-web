import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { growthFetch } from '@/lib/server/venue-growth';

// Owner turns the monthly activity email on/off — from the email's opt-out link (kind=pref)
// or from their toolkit (kind=kit). The signed token identifies the venue; nothing else.
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const raw = await req.json().catch(() => ({}));
  const token = typeof raw?.token === 'string' ? raw.token.slice(0, 400) : '';
  const kind = raw?.kind === 'kit' ? 'kit' : 'pref';
  if (!token || typeof raw?.enabled !== 'boolean') return NextResponse.json({ error: 'Missing details.' }, { status: 400 });
  const up = await growthFetch('/monthly/preference', { method: 'POST', body: JSON.stringify({ token, kind, enabled: raw.enabled }) });
  const d = await up.json().catch(() => null);
  if (!up.ok) return NextResponse.json({ error: toErrorText(d?.detail, 'Could not update your email preference.') }, { status: up.status || 502 });
  return NextResponse.json({ enabled: !!d?.enabled });
}
