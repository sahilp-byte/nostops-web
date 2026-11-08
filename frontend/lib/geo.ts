// Tiny, dependency-free geo helpers shared by distance-aware discovery
// (teachers + venues). Coordinates are the rounded, PII-safe values the public
// directory / venue feed already expose — never precise device coordinates.

/** Great-circle distance between two lat/lng points, in kilometres. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371; // Earth radius (km)
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a = s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** True only for a usable coordinate pair (rejects 0,0 / NaN / out-of-range). */
export function hasCoords(lat?: number, lng?: number): lat is number {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
}

/** Human distance label, e.g. "under 1 km", "4 km away", "23 km away". */
export function fmtKm(km?: number): string {
  if (typeof km !== 'number' || !Number.isFinite(km)) return '';
  if (km < 1) return 'under 1 km';
  return `${Math.round(km)} km away`;
}

/** Coarse country bucket from coordinates. Returns 'India' when the point falls
 *  inside India's bounding box, 'International' when it's a valid coordinate
 *  outside it, or undefined when no usable coordinate is given. This is the
 *  "reliable overseas signal" the country filter uses; it refines automatically
 *  if the backend ever adds an explicit country field. */
export function countryFromCoords(lat?: number, lng?: number): string | undefined {
  if (!hasCoords(lat, lng)) return undefined;
  const inIndia = (lat as number) >= 6.5 && (lat as number) <= 37.1 && (lng as number) >= 68.1 && (lng as number) <= 97.4;
  return inIndia ? 'India' : 'International';
}
