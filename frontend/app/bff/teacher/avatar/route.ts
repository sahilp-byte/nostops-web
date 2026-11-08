import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Teacher profile photo. CSRF-guarded proxy to /teachers/me/avatar.
// POST { base64 } uploads a compressed data-URI (client downscales to <1MB
// before sending); DELETE removes it. The backend owns storage.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const base64 = typeof body?.base64 === 'string' ? body.base64 : '';
  if (!base64) return NextResponse.json({ error: 'No image supplied.' }, { status: 400 });
  // ~1.6MB base64 ≈ 1.2MB binary — a generous ceiling; client compresses well below this.
  if (base64.length > 1_600_000) return NextResponse.json({ error: 'Image is too large. Please pick a smaller photo.' }, { status: 400 });

  const up = await backendFetch('/teachers/me/avatar', { method: 'POST', body: JSON.stringify({ base64 }) });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText(data?.detail || data?.message, 'Could not update your photo.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, avatar_url: data?.avatar_url ?? null });
}

export async function DELETE(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const up = await backendFetch('/teachers/me/avatar', { method: 'DELETE' });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText(data?.detail || data?.message, 'Could not remove your photo.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true });
}
