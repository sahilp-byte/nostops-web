import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';
import { verifyVenue } from '@/lib/server/venue-submissions-local';

// Admin: mark a venue Verified / Unverified. The badge then shows on the
// venue's public surfaces (directory page + retreat listing pages).
//
// Remote-first: proxies to the intended contract POST /api/admin/venues/{id}/verify
// (body { verified }). While that endpoint isn't live (404) or the remote is
// unreachable, it falls back to the LOCAL verification store so admins stay
// unblocked — and flips to the remote automatically the moment it ships, with
// no further frontend changes.
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'Unknown venue.' }, { status: 400 });
  const verified = body?.verified !== false;

  // 1) Try the intended remote contract first.
  let up: Response | null = null;
  try {
    up = await backendFetch(`/admin/venues/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      body: JSON.stringify({ verified }),
    });
  } catch {
    up = null; // remote unreachable → local fallback below
  }
  if (up && up.status !== 404) {
    const data = await up.json().catch(() => ({}));
    if (!up.ok) return NextResponse.json({ error: toErrorText(data?.detail || data?.error, 'Could not update verification.') }, { status: up.status || 502 });
    return NextResponse.json({ ok: true, ...data });
  }

  // 2) Remote not live (404) or unreachable → LOCAL verification store.
  const res = await verifyVenue({
    id,
    verified,
    name: typeof body?.name === 'string' ? body.name : '',
    city: typeof body?.city === 'string' ? body.city : '',
    venuePartnerId: typeof body?.venuePartnerId === 'string' ? body.venuePartnerId : '',
  });
  if (!res.ok) return NextResponse.json({ error: res.error || 'Could not update verification.' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
