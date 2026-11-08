import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getVenue, getVenueAvailability } from '@/lib/server/venues';

export const revalidate = 300;

// PROMPT 9 — GET /venues/{venue_id}/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
// Public availability for a venue: upcoming retreats with occupancy & remaining
// capacity over an optional date window. NO confidential commercial rates.
export async function GET(req: NextRequest, { params }: { params: Promise<{ venue_id: string }> }) {
  const { venue_id } = await params;
  const venue = await getVenue(venue_id);
  if (!venue) return NextResponse.json({ error: 'venue not found' }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const from = sp.get('from') || undefined;
  const to = sp.get('to') || undefined;
  const data = await getVenueAvailability(venue_id, from, to);
  return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
