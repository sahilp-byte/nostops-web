// PROMPT 21 — Venue operational capacity model.
// A venue has its OWN operational capacity, distinct from a teacher's desired
// cohort size. It is bounded by several real-world dimensions; the number of
// people a venue can actually host at once is the TIGHTEST binding dimension.
// The backend persists only a single `capacity` integer per centre, so the
// detailed breakdown below is planning guidance and the computed operational
// capacity is what we store.

export type VenueCapacityBreakdown = {
  accommodation?: number; // total overnight sleeping capacity (people)
  rooms?: number; // room inventory (# of rooms) — informational
  practiceHall?: number; // people the practice / yoga hall holds
  meals?: number; // dining capacity served per sitting (people)
  services?: number; // other service capacity (people) — soft unless included
};

const pos = (v?: number | null): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

// The dimensions that HARD-gate how many people can actually be hosted at once:
// they must sleep somewhere (accommodation), fit the sessions (practice hall)
// and be fed (meals). Room inventory is informational; "other services" is only
// binding when the caller explicitly opts it in.
export function operationalCapacity(b: VenueCapacityBreakdown, opts?: { includeServices?: boolean }): number {
  const hard = [pos(b.accommodation), pos(b.practiceHall), pos(b.meals)];
  if (opts?.includeServices) hard.push(pos(b.services));
  const set = hard.filter((n) => n > 0);
  return set.length ? Math.min(...set) : 0;
}

// Which dimension is the bottleneck (for a human-readable "Limited by …" note).
// Returns null when no hard dimension is set, or when a single dimension is set
// (nothing to compare against).
export function bindingConstraint(b: VenueCapacityBreakdown, opts?: { includeServices?: boolean }): string | null {
  const dims: { label: string; v: number }[] = [
    { label: 'accommodation', v: pos(b.accommodation) },
    { label: 'the practice hall', v: pos(b.practiceHall) },
    { label: 'dining', v: pos(b.meals) },
  ];
  if (opts?.includeServices) dims.push({ label: 'services', v: pos(b.services) });
  const set = dims.filter((d) => d.v > 0);
  if (set.length < 2) return null;
  const min = Math.min(...set.map((d) => d.v));
  const binders = set.filter((d) => d.v === min);
  // Only call something the bottleneck if it's strictly tighter than the rest.
  if (binders.length === set.length) return null;
  return binders[0].label;
}

export function hasAnyCapacity(b: VenueCapacityBreakdown): boolean {
  return pos(b.accommodation) + pos(b.rooms) + pos(b.practiceHall) + pos(b.meals) + pos(b.services) > 0;
}
