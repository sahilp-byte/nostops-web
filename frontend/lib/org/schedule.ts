// B2.2 — repeating programme schedule helpers (shared by the event wizard, the
// public event + register pages and the organiser / teacher rosters). Weekdays
// use the backend convention: 0 = Monday … 6 = Sunday. Dates are 'YYYY-MM-DD'
// calendar dates, handled in UTC so they never shift a day.

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const MAX_SCHEDULE_DAYS = 366;

function utc(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Weekday (0 = Monday) of a calendar date, or null. */
export function weekdayOf(date: string): number | null {
  const d = utc(date);
  return d ? (d.getUTCDay() + 6) % 7 : null;
}

/** Whole days from `a` to `b` (b − a), or null. */
export function daysBetween(a: string, b: string): number | null {
  const x = utc(a);
  const y = utc(b);
  return x && y ? Math.round((y.getTime() - x.getTime()) / 86400000) : null;
}

/** Every date from start to end (inclusive) that falls on one of `weekdays`. */
export function sessionDates(start: string, weekdays: number[], end: string): string[] {
  const s = utc(start);
  const span = daysBetween(start, end);
  if (!s || span == null || span < 0 || span > MAX_SCHEDULE_DAYS) return [];
  const out: string[] = [];
  for (let i = 0; i <= span; i++) {
    const d = new Date(s.getTime() + i * 86400000);
    if (weekdays.includes((d.getUTCDay() + 6) % 7)) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** 'Mon, 6 Jul 2026' */
export function formatSessionDate(date: string): string {
  const d = utc(date);
  if (!d) return date;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** 'Mon & Thu' */
export function weekdayList(weekdays: number[]): string {
  return [...weekdays].sort((a, b) => a - b).map((d) => WEEKDAYS[d]).join(' & ');
}

/** Upper bound of a recommended group size label, e.g. '15–30 participants' → 30. */
export function groupSizeMax(label?: string | null): number | null {
  const nums = (label || '').match(/\d+/g);
  return nums && nums.length ? Number(nums[nums.length - 1]) : null;
}
