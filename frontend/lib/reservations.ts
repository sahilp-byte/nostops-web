// Client-side ledger of the seeker's retreat reservations. The backend exposes
// NO "my reservations" list endpoint for a seeker (only a host-side list), so we
// remember the reservations this device created — enough to let the seeker come
// back, check status and complete payment on a held seat. Nothing sensitive is
// stored and it never leaves the device.
export type LocalReservation = {
  reservationId: string;
  retreatId: string;
  title: string;
  kind: 'individual' | 'group';
  amountInr?: number;
  groupSize?: number;
  expiresAt?: string | null;
  createdAt: number;
};

const KEY = 'nostops.reservations.v1';
const CAP = 50;

export function loadReservations(): LocalReservation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as LocalReservation[]) : [];
  } catch {
    return [];
  }
}

export function saveReservation(r: LocalReservation): void {
  if (typeof window === 'undefined') return;
  try {
    const list = loadReservations().filter((x) => x.reservationId !== r.reservationId);
    list.unshift(r);
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP)));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export function removeReservation(reservationId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = loadReservations().filter((x) => x.reservationId !== reservationId);
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
