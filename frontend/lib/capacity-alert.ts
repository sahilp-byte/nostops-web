// Capacity Alerts — warn a host as a retreat's bookings approach the venue's
// operational limit. The persisted `seats_total` IS the enforced operational cap
// (PROMPT 21 caps it at venue capacity at setup), so "seats filled vs seats
// total" is the live proximity to that limit.

export type CapacityLevel = 'ok' | 'filling' | 'almost_full' | 'full' | 'over';

export type CapacityStatus = {
  level: CapacityLevel;
  seatsRemaining: number;
  pctFull: number;
  alert: boolean; // true for almost_full / full / over
  title: string;
  message: string;
};

export function capacityStatus(seatsFilled: number, seatsTotal: number): CapacityStatus {
  const total = Math.max(0, Math.floor(seatsTotal || 0));
  const filled = Math.max(0, Math.floor(seatsFilled || 0));
  const remaining = Math.max(0, total - filled);
  const pctFull = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
  // "About to hit" = within ~10% of the limit (at least 1, at most 3 seats).
  const threshold = total > 0 ? Math.max(1, Math.min(3, Math.ceil(total * 0.1))) : 0;

  if (total > 0 && filled > total) {
    return { level: 'over', seatsRemaining: 0, pctFull: 100, alert: true, title: 'Over capacity', message: `${filled} booked exceeds the venue's ${total}-seat operational limit.` };
  }
  if (total > 0 && remaining === 0) {
    return { level: 'full', seatsRemaining: 0, pctFull: 100, alert: true, title: 'At capacity', message: `All ${total} seats are taken — you've reached the venue's operational limit.` };
  }
  if (total > 0 && remaining <= threshold) {
    return { level: 'almost_full', seatsRemaining: remaining, pctFull, alert: true, title: 'Almost full', message: `Only ${remaining} ${remaining === 1 ? 'seat' : 'seats'} left before you hit the venue's ${total}-seat limit.` };
  }
  if (total > 0 && pctFull >= 60) {
    return { level: 'filling', seatsRemaining: remaining, pctFull, alert: false, title: 'Filling up', message: `${remaining} of ${total} seats left.` };
  }
  return { level: 'ok', seatsRemaining: remaining, pctFull, alert: false, title: '', message: '' };
}
