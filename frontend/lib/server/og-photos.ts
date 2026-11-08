// Real photo candidates for photo-backed social share cards. Pulled from LIVE
// venue / retreat data so shared links preview with genuine venue scenery.
import { getVenues } from '@/lib/server/venues';
import { getPublicRetreats } from '@/lib/server/retreats';

/** Cover photos of live public venues, best (with photo) first. */
export async function venuePhotoCandidates(): Promise<string[]> {
  try {
    const venues = await getVenues({ limit: 100 });
    return venues.map((v) => v.coverImage).filter((x): x is string => typeof x === 'string' && x.length > 0);
  } catch {
    return [];
  }
}

/** Photos for retreat pages: real retreat images first, then venue scenery
 *  (retreats are hosted AT venues), so these pages still get a real photo even
 *  when no retreat is currently published. */
export async function retreatPhotoCandidates(): Promise<string[]> {
  const out: string[] = [];
  try {
    const { retreats } = await getPublicRetreats();
    for (const r of retreats) {
      if (r.coverImage) out.push(r.coverImage);
      for (const i of r.images || []) out.push(i);
    }
  } catch {
    /* fall through to venue scenery */
  }
  out.push(...(await venuePhotoCandidates()));
  return out.filter((x) => typeof x === 'string' && x.length > 0);
}

/** Rotate a candidate list so sibling pages favour different photos (while each
 *  still falls back through the whole list if its first choice fails to load). */
export function rotate<T>(arr: T[], n: number): T[] {
  if (arr.length === 0) return arr;
  const i = ((n % arr.length) + arr.length) % arr.length;
  return [...arr.slice(i), ...arr.slice(0, i)];
}

// ── City share-card photos ──────────────────────────────────────────────────
// Signature local landmark photo for each of the 9 launch cities, so each city
// directory (/yoga-teachers/{city}) previews with its own recognisable skyline
// instead of a flat card. Standard Unsplash license, hosted on
// images.unsplash.com so photo-og's URL-based resize (w/h/fit/q/fm) yields a
// compact 1200x630 JPEG. Unmapped cities fall back to the branded gradient card.
const CITY_PHOTOS: Record<string, string> = {
  delhi: 'https://images.unsplash.com/photo-1587474260584-136574528ed5', // India Gate at dusk
  gurgaon: 'https://images.unsplash.com/photo-1589829973523-e4ddcbbd40e7', // Cyber City skyline, sunset
  bangalore: 'https://images.unsplash.com/photo-1774934879484-542f4102743f', // Vidhana Soudha
  mumbai: 'https://images.unsplash.com/photo-1595658658481-d53d3f999875', // Gateway of India & Taj
  'navi-mumbai': 'https://images.unsplash.com/photo-1706066082423-0b17c373a0d3', // waterfront skyline
  pune: 'https://images.unsplash.com/photo-1517462035531-76bc910a6903', // city lights at night
  nashik: 'https://images.unsplash.com/photo-1694667509674-676629c9d069', // Godavari riverfront ghats
  chandigarh: 'https://images.unsplash.com/photo-1682569295668-eecf20fedf33', // aerial cityscape at dusk
  hyderabad: 'https://images.unsplash.com/photo-1750834115164-8c2658f18dd0', // Charminar
};

const CITY_ALIASES: Record<string, string> = {
  bengaluru: 'bangalore',
  gurugram: 'gurgaon',
};

const CITY_LABELS: Record<string, string> = {
  delhi: 'Delhi',
  gurgaon: 'Gurgaon',
  bangalore: 'Bangalore',
  mumbai: 'Mumbai',
  'navi-mumbai': 'Navi Mumbai',
  pune: 'Pune',
  nashik: 'Nashik',
  chandigarh: 'Chandigarh',
  hyderabad: 'Hyderabad',
};

function canonCity(slug: string): string {
  const key = (slug || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return CITY_ALIASES[key] || key;
}

/** Signature local photo candidate(s) for a launch city's share card, or an
 *  empty list (→ branded fallback card) for any non-launch / unknown city. */
export function cityPhotoCandidates(slug: string): string[] {
  const url = CITY_PHOTOS[canonCity(slug)];
  return url ? [url] : [];
}

/** Proper display name for a launch city (so the share-card headline matches
 *  the photo even when the directory has no teachers there yet), else null. */
export function cityDisplayLabel(slug: string): string | null {
  return CITY_LABELS[canonCity(slug)] ?? null;
}
