import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch, getSessionUser } from '@/lib/server/session';

// Save the teacher's own GPS location so they surface in nearby/distance search.
// Forwards to the backend's POST /teachers/me/location. CSRF + session enforced.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const lat = Number(b?.latitude);
  const lng = Number(b?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: 'Missing coordinates.' }, { status: 400 });

  const payload: Record<string, unknown> = { latitude: lat, longitude: lng };
  for (const k of ['label', 'city', 'state', 'country']) if (b?.[k]) payload[k] = String(b[k]).slice(0, 120);

  const up = await backendFetch('/teachers/me/location', { method: 'POST', body: JSON.stringify(payload) });
  const d = await up.json().catch(() => null);
  if (!up.ok) return NextResponse.json({ error: toErrorText(d?.detail || d?.error, 'Could not save your location.') }, { status: up.status || 502 });
  return NextResponse.json({ ok: true, city: d?.city || payload.city || '', label: d?.label || '' });
}
