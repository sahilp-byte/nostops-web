export function inr(n?: number | null): string {
  if (n == null || isNaN(Number(n))) return '';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(n));
}

/** Rupees with paise only when the amount has them (2,125 · 1,062.50). Display only: it never
 *  rounds a fractional amount to a whole rupee (pricing rule R2, backend/pricing_rules.py). */
export function inrExact(n?: number | null): string {
  if (n == null || isNaN(Number(n))) return '';
  const v = Number(n);
  return new Intl.NumberFormat('en-IN', Number.isInteger(v) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

export function titleCase(s?: string | null): string {
  if (!s) return '';
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

// Deterministic, timezone-stable date formatters (UTC). Using these in client
// components avoids SSR/CSR hydration mismatches that toLocaleDateString /
// toLocaleString cause (server node TZ/locale ≠ browser TZ/locale). Admin
// operational surfaces show UTC consistently.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "Sun, 6 Dec 2026" — same UTC semantics as fmtDate, with the weekday where there is room. */
export function fmtDateLong(iso?: string | null): string {
  const base = fmtDate(iso);
  return base ? `${WEEKDAYS[new Date(iso as string).getUTCDay()]}, ${base}` : '';
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${fmtDate(iso)}, ${hh}:${mm} UTC`;
}

