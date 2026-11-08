import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Update the learner's preferences (language, notifications, privacy). Forwards
// a deep-merge patch to the authed backend PATCH /me/settings.
export async function PATCH(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const prefs = body?.prefs;
  if (!prefs || typeof prefs !== 'object') {
    return NextResponse.json({ error: 'No preferences supplied.' }, { status: 400 });
  }
  const up = await backendFetch('/me/settings', { method: 'PATCH', body: JSON.stringify({ prefs }) });
  if (!up.ok) {
    const d = await up.json().catch(() => null);
    return NextResponse.json(
      { error: toErrorText(d?.detail || d?.message, 'Could not save your preferences.') },
      { status: up.status || 502 },
    );
  }
  const d = await up.json().catch(() => null);
  return NextResponse.json({ ok: true, prefs: d?.prefs ?? prefs });
}
