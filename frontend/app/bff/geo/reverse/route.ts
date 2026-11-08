import { NextResponse } from 'next/server';
import { backendFetch, getSessionUser } from '@/lib/server/session';

// Map modern geocoder city names to the spelling commonly used in teacher
// profiles, so a GPS lookup ("Bengaluru") matches directory tags ("Bangalore").
const CITY_ALIASES: Record<string, string> = {
  bengaluru: 'Bangalore',
  gurugram: 'Gurgaon',
  puducherry: 'Pondicherry',
  vadodara: 'Vadodara',
  thiruvananthapuram: 'Trivandrum',
  kochi: 'Kochi',
  mysuru: 'Mysore',
  mangaluru: 'Mangalore',
};
function normalizeCity(city: string): string {
  const key = city.trim().toLowerCase();
  return CITY_ALIASES[key] || city.trim();
}

// Reverse-geocode a GPS coordinate to a city, server-side via the backend's
// /geo/reverse (so no maps/geocoding key is needed on the client).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  if (!lat || !lng || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
    return NextResponse.json({ error: 'Missing coordinates.' }, { status: 400 });
  }

  try {
    const up = await backendFetch(`/geo/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
    if (!up.ok) return NextResponse.json({ error: 'Could not resolve your location.' }, { status: up.status || 502 });
    const d = await up.json().catch(() => ({}));
    return NextResponse.json({ city: normalizeCity(d?.city || ''), region: d?.region || '', country: d?.country || '' });
  } catch {
    return NextResponse.json({ error: 'Could not resolve your location.' }, { status: 502 });
  }
}
