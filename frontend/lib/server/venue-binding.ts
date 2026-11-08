// Pure, framework-free venue-binding decision for the Host-a-Retreat BFF routes
// (create + edit). Extracted so the SAME rules can be exercised by deterministic
// tests with mocked eligible sets — no next/server import, no network, no side
// effects. A retreat is bound to an EXISTING LISTED venue by its canonical id;
// the id is NEVER trusted from the browser and is always re-validated here
// against the authoritative eligible directory.

export const VENUE_BIND_ERR = {
  // create / publication: a venue must be chosen.
  missing: 'Select a listed NOSTOPS venue to publish your retreat.',
  // edit: an existing binding may not be stripped off a (possibly published) retreat.
  cleared: 'A listed venue is required — it cannot be cleared.',
  // the chosen id is not in the eligible directory (forged, deleted, or a venue
  // submission still pending admin publication).
  ineligible: 'That venue is not a listed, eligible NOSTOPS venue. Please pick one from the list.',
} as const;

/** The listed-venue record a retreat is bound to (subset of PublicVenue). */
export type BoundVenue = { id: string; name: string; city?: string; state?: string; lat?: number; lng?: number; capacity?: number };

/**
 * Venue fields a bound retreat must carry. Name, city and state ALWAYS come from
 * the listed venue record (never typed by the host); the host's value is only a
 * fallback when the venue record itself has no city/state. Coordinates come from
 * the venue when it has them, otherwise the host-provided ones are kept.
 */
export function venueDerivedFields(v: BoundVenue, fallback: { venue_city?: unknown; state?: unknown } = {}): Record<string, unknown> {
  const fb = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  const out: Record<string, unknown> = {
    venue_name: v.name,
    venue_city: (v.city || '').trim() || fb(fallback.venue_city),
    state: (v.state || '').trim() || fb(fallback.state),
  };
  if (typeof v.lat === 'number' && typeof v.lng === 'number') {
    out.venue_lat = v.lat;
    out.venue_lng = v.lng;
  }
  return out;
}

/** Seats may never exceed the listed venue's capacity. Unknown capacity ⇒ allowed (UI warns). */
export function seatsOverCapacity(seats: number, capacity?: number | null): string | null {
  if (typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity <= 0) return null;
  return seats > capacity
    ? `This venue holds up to ${capacity} guests. Reduce seats to ${capacity} or fewer, or pick a larger venue.`
    : null;
}

export type VenueBinding =
  | { action: 'omit' } //       field absent on a partial update ⇒ preserve existing binding
  | { action: 'set'; value: string } // validated canonical id to forward
  | { action: 'reject'; error: string }; // 400-worthy validation failure

/**
 * Decide how a retreat POST/PATCH should treat `venue_partner_id`.
 *
 * @param rawValue    the browser-provided value (any type)
 * @param present     whether the key was present on the request body
 * @param eligibleIds authoritative ids of currently-listed, eligible venues
 * @param required    true for create/publication (must be set); false for a
 *                    partial edit (omitting the field preserves the binding)
 */
export function resolveVenueBinding(
  rawValue: unknown,
  present: boolean,
  eligibleIds: Iterable<string>,
  required: boolean,
): VenueBinding {
  if (!present) {
    // Omitted: create must reject (publication needs a venue); edit preserves.
    return required ? { action: 'reject', error: VENUE_BIND_ERR.missing } : { action: 'omit' };
  }
  const id = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!id) {
    // Explicitly empty: never auto-clear a binding.
    return { action: 'reject', error: required ? VENUE_BIND_ERR.missing : VENUE_BIND_ERR.cleared };
  }
  const set = eligibleIds instanceof Set ? eligibleIds : new Set(eligibleIds);
  if (!set.has(id)) return { action: 'reject', error: VENUE_BIND_ERR.ineligible };
  return { action: 'set', value: id };
}
