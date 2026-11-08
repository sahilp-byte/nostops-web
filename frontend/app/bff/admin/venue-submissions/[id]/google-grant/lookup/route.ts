import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { searchPlaces } from '@/lib/server/google-places';

// Admin-only Google place search, so the admin can pick the exact business for
// a venue before switching its Google photos & reviews on.
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const body = await req.json().catch(() => ({}));
  const query = typeof body?.query === 'string' ? body.query : '';
  if (query.trim().length < 3) return NextResponse.json({ error: 'Type the venue name and town to search.' }, { status: 400 });
  const places = await searchPlaces(query);
  return NextResponse.json({ ok: true, places });
}
