import { NextResponse } from 'next/server';
import { backendFetch, getSessionUser } from '@/lib/server/session';

// "Near me" summary for the signed-in user. Proxies the backend's
// GET /users/me/nearby?radius_km=X, which resolves the caller's own saved/live
// origin server-side and returns real counts of teachers/batches/coordinators/
// retreats within the radius. The origin (lat/lng) never needs to leave the
// server via the client — we only surface the resolved city + counts.
// GET is idempotent (no state change) so no CSRF token is required.
export const dynamic = 'force-dynamic';

const ALLOWED_RADII = [5, 10, 25, 50, 100];

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let radius = Number(searchParams.get('radius_km'));
  if (!ALLOWED_RADII.includes(radius)) radius = 25;

  try {
    const up = await backendFetch(`/users/me/nearby?radius_km=${radius}`);
    if (!up.ok) return NextResponse.json({ error: 'Could not load nearby results.' }, { status: up.status || 502 });
    const d = await up.json().catch(() => ({}));
    const origin = d?.resolved_origin || {};
    const nearby = d?.nearby || {};
    return NextResponse.json(
      {
        city: typeof origin.city === 'string' ? origin.city : '',
        source: typeof origin.source === 'string' ? origin.source : '',
        hasOrigin: !!nearby.has_origin,
        radiusKm: Number(nearby.radius_km) || radius,
        counts: {
          teachers: Number(nearby.teachers_nearby) || 0,
          batches: Number(nearby.batches_upcoming_nearby) || 0,
          coordinators: Number(nearby.coordinators_nearby) || 0,
          retreats: Number(nearby.retreats_nearby) || 0,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Could not load nearby results.' }, { status: 502 });
  }
}
