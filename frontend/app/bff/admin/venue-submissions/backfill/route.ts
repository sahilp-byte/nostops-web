import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { backfillSubmissions } from '@/lib/server/venue-submissions-local';
import { getPublicRetreats } from '@/lib/server/retreats';

// Admin "Sync venues now" — retroactively pull in owner-created venues:
//  (a) the local fallback store (handled server-side), and
//  (b) every venue with a published public retreat (discovered here from the
//      public retreats feed and passed to the local store).
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  let retreatVenues: Record<string, unknown>[] = [];
  try {
    const { retreats } = await getPublicRetreats();
    const byVenue = new Map<string, Record<string, unknown>>();
    for (const r of retreats) {
      const name = (r.venueName || '').trim();
      const city = (r.city || '').trim();
      if (!name) continue;
      const key = `${name.toLowerCase()}|${city.toLowerCase()}`;
      const existing = byVenue.get(key);
      if (existing) {
        existing.retreat_count = (Number(existing.retreat_count) || 1) + 1;
        continue;
      }
      byVenue.set(key, {
        name,
        city,
        state: r.state || '',
        lat: typeof r.lat === 'number' ? r.lat : undefined,
        lng: typeof r.lng === 'number' ? r.lng : undefined,
        host_name: r.guruName || '',
        host_user_id: '',
        retreat_id: r.id,
        retreat_title: r.title || '',
        retreat_theme: r.theme || '',
        retreat_count: 1,
        venue_partner_id: r.venuePartnerId || '',
      });
    }
    retreatVenues = [...byVenue.values()];
  } catch {
    retreatVenues = [];
  }

  const res = await backfillSubmissions(retreatVenues);
  if (!res.ok) return NextResponse.json({ error: res.error || 'Sync failed.' }, { status: 502 });
  return NextResponse.json({ ok: true, count: res.count ?? 0 });
}
