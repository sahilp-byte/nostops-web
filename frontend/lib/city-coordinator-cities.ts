import { citySlug } from '@/lib/server/cities';

// Single source of truth for the nine cities NOSTOPS is appointing City
// Coordinators in, shared by the /city-coordinator landing page and each city's
// /yoga-teachers/[city] page (which cross-links open seats).
export const COORDINATOR_CITIES = [
  'Delhi',
  'Gurgaon',
  'Bangalore',
  'Mumbai',
  'Navi Mumbai',
  'Pune',
  'Nashik',
  'Chandigarh',
  'Hyderabad',
] as const;

/** The four cities NOSTOPS is beginning with. */
export const COORDINATOR_LAUNCH_CITIES = ['Mumbai', 'Navi Mumbai', 'Pune', 'Nashik'] as const;

const SLUG_SET = new Set<string>(COORDINATOR_CITIES.map((c) => citySlug(c)));

/** True when a city (by its slug) is one of the nine City Coordinator cities. */
// City Coordinator is TEMPORARILY DEACTIVATED (Phase 1). Flip to true to re-enable public entry points.
export const COORDINATOR_ENABLED = false;

export function isCoordinatorCity(slug: string): boolean {
  return SLUG_SET.has(slug);
}
