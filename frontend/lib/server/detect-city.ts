import 'server-only';
import { cookies, headers } from 'next/headers';

// Server-only "near me" city detection, shared by the provisional profile page
// (and reusable elsewhere). Resolves the VISITOR's city from (1) a saved choice
// (the `nostops_city` cookie set when a teacher picks their city on /claim) or
// (2) an edge/CDN geo header — then maps common Indian city-name variants onto
// the exact launch-city label. Returns '' when nothing resolves.

export const LAUNCH_CITIES = [
  'Delhi', 'Gurgaon', 'Bangalore', 'Mumbai', 'Navi Mumbai',
  'Pune', 'Nashik', 'Chandigarh', 'Hyderabad',
] as const;

const CITY_ALIASES: Record<string, string> = {
  bengaluru: 'Bangalore', bangalore: 'Bangalore',
  gurugram: 'Gurgaon', gurgaon: 'Gurgaon',
  bombay: 'Mumbai', mumbai: 'Mumbai', 'navi mumbai': 'Navi Mumbai',
  'new delhi': 'Delhi', delhi: 'Delhi',
  nasik: 'Nashik', nashik: 'Nashik',
  pune: 'Pune', chandigarh: 'Chandigarh', hyderabad: 'Hyderabad',
};

export function toLaunchCity(raw?: string | null): string {
  if (!raw) return '';
  let key = raw.trim();
  try { key = decodeURIComponent(key); } catch { /* raw already decoded */ }
  key = key.toLowerCase();
  const mapped = CITY_ALIASES[key];
  if (mapped) return mapped;
  return LAUNCH_CITIES.find((c) => c.toLowerCase() === key) || '';
}

export function citySlug(city: string): string {
  return (city || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** The visitor's detected launch city { label, slug }, or empty strings. */
export async function detectVisitorCity(): Promise<{ label: string; slug: string }> {
  const jar = await cookies();
  let label = toLaunchCity(jar.get('nostops_city')?.value);
  if (!label) {
    const h = await headers();
    label = toLaunchCity(
      h.get('cf-ipcity') || h.get('x-vercel-ip-city') || h.get('x-geo-city') ||
      h.get('cloudfront-viewer-city') || h.get('x-appengine-city'),
    );
  }
  return { label, slug: label ? citySlug(label) : '' };
}
