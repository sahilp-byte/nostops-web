import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { spacesCall, spacesError } from '@/lib/server/spaces';

// Phase 7 — the signed-in teacher's own service PIN codes (identity from the session only; backend enforces role).
export async function GET() {
  const r = await spacesCall('/teacher-localities/me');
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Could not load your teaching localities.') }, { status: r.status });
  return NextResponse.json(r.data);
}

export async function PUT(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const raw = await req.json().catch(() => ({}));
  const pin = (p: { pin?: unknown; locality_id?: unknown }) => ({ pin: String(p?.pin || '').slice(0, 6), locality_id: String(p?.locality_id || '').slice(0, 120) });
  const body = {
    primary: pin(raw.primary || {}),
    additional: (Array.isArray(raw.additional) ? raw.additional : []).slice(0, 4).map(pin),
    source: raw.source === 'device_suggestion' ? 'device_suggestion' : 'manual',
    confirm: raw.confirm === true,
  };
  const r = await spacesCall('/teacher-localities/me', { method: 'PUT', body });
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Could not save your teaching localities.') }, { status: r.status });
  return NextResponse.json(r.data);
}
