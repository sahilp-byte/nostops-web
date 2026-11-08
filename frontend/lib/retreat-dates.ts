// Retreat date rules (TVR-13), shared by the host wizard (UI hints) and the BFF
// create / edit routes (the authoritative server-side check we control).
// Dates are calendar days "YYYY-MM-DD" in India time.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function isRealDate(d: string): boolean {
  if (!DATE_RE.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

/** Returns an error message, or null when the dates are acceptable. */
export function retreatDatesError(start: string, end: string, today: string = todayIST()): string | null {
  if (!isRealDate(start) || !isRealDate(end)) return 'Choose valid start and end dates.';
  if (start < today) return 'The start date must be today or later.';
  if (end < start) return 'End date must be on or after the start date.';
  return null;
}
