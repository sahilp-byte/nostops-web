import 'server-only';
import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/server/session';

// Payments Prompt 2D — no seat or group hold once a retreat has started. The start comes from the
// retreat's own record (read here, server-side), never from the request. It is judged in the
// retreat's configured time zone (IANA `timezone` / `time_zone`); NOSTOPS retreats are in India,
// so Asia/Kolkata when none is set. A date-only start means midnight local time on that day.
// Missing / unreadable dates or zones → refused (fail closed).
export const DEFAULT_RETREAT_TZ = 'Asia/Kolkata';
export const RETREAT_STARTED_MESSAGE = 'This retreat has already started, so seats can no longer be reserved. Nothing has been reserved.';
export const RETREAT_DATES_MESSAGE = "This retreat's dates couldn't be confirmed, so it can't be reserved right now. Nothing has been reserved.";
const NOT_FOUND_MESSAGE = 'This retreat could not be found. Nothing has been reserved.';

const DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/** Milliseconds the zone is ahead of UTC at this instant. */
function zoneOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - utcMs;
}

/** The instant (ms) the retreat starts, or null when its date or zone can't be read. */
export function retreatStartsAt(retreat: any): number | null {
  if (!retreat || typeof retreat !== 'object') return null;
  const tz = retreat.timezone || retreat.time_zone || DEFAULT_RETREAT_TZ;
  if (typeof tz !== 'string') return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    return null;
  }
  const raw = typeof retreat.start_date === 'string' ? retreat.start_date.trim() : '';
  const m = DATE.exec(raw);
  if (!m) return null;
  if (m[7] && !m[4]) return null; // an offset needs a time
  const [y, mo, d, hh, mi, ss] = [1, 2, 3, 4, 5, 6].map((i) => Number(m[i] || 0));
  const wall = Date.UTC(y, mo - 1, d, hh, mi, ss);
  const check = new Date(wall);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || hh > 23 || mi > 59 || ss > 59) return null;
  if (m[7]) {
    if (m[7] === 'Z') return wall;
    const off = m[7].replace(':', '');
    const sign = off[0] === '-' ? -1 : 1;
    return wall - sign * (Number(off.slice(1, 3)) * 60 + Number(off.slice(3, 5))) * 60000;
  }
  const first = wall - zoneOffsetMs(wall, tz);
  return wall - zoneOffsetMs(first, tz); // second pass keeps DST changeovers right
}

const refuse = (status: number, reason: string, error: string) =>
  NextResponse.json({ error, reason, hold_refused: true }, { status });

/** Check before a seat/group hold: reads the retreat itself and refuses once it has started. */
export async function retreatOpenRefusal(id: string, now: number = Date.now()): Promise<NextResponse | null> {
  let retreat: any;
  try {
    const r = await backendFetch(`/retreats/${encodeURIComponent(id)}`);
    if (r.status === 404) return refuse(404, 'retreat_not_found', NOT_FOUND_MESSAGE);
    if (!r.ok) return refuse(503, 'retreat_dates_unavailable', RETREAT_DATES_MESSAGE);
    const d = await r.json().catch(() => null);
    retreat = d?.retreat ?? d;
  } catch {
    return refuse(503, 'retreat_dates_unavailable', RETREAT_DATES_MESSAGE);
  }
  const startsAt = retreatStartsAt(retreat);
  if (startsAt === null) return refuse(409, 'retreat_dates_unavailable', RETREAT_DATES_MESSAGE);
  if (now >= startsAt) return refuse(409, 'retreat_started', RETREAT_STARTED_MESSAGE);
  return null;
}
