import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getVenueByPath } from '@/lib/server/venues';
import { renderVenueOg } from '@/lib/server/venue-og';

// Stable, directly-addressable social preview image for a venue's clean page —
// the same branded 1200x630 card used for og:image, served at a fixed URL so the
// owner's "Share your listing" card can show (and let them save) the preview.
export const runtime = 'nodejs';
export const revalidate = 900;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const city = (sp.get('city') || '').trim();
  const venue = (sp.get('venue') || '').trim();
  if (!city || !venue) return NextResponse.json({ error: 'city and venue required' }, { status: 400 });
  const v = await getVenueByPath(city, venue);
  if (!v) return NextResponse.json({ error: 'venue not found' }, { status: 404 });
  return renderVenueOg(v.id);
}
