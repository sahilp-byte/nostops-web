// Server-only: the teacher's scheduled TEACHING sessions (their delivery
// calendar) — distinct from the Bookings inbox (incoming 1:1 requests + actions).
// Aggregates confirmed 1:1 premium sessions (/premium-sessions/my, known shape)
// and group/corporate classes (/teachers/me/sessions, defensively projected as
// its schema is untyped) into one chronological schedule. Read-only.
import { backendFetch } from '@/lib/server/session';

const num = (v: any): number => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);
const str = (v: any): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

const TERMINAL = new Set(['cancelled', 'canceled', 'refunded', 'expired', 'no_show', 'declined']);
const PAST = new Set(['completed', 'session_completed', 'attended']);

export type ScheduledSession = {
  id: string;
  kind: 'one_on_one' | 'class';
  title: string;
  counterparty?: string;
  whenTs: number | null;
  location?: string;
  mode?: string;
  participants?: number;
  amountInr?: number;
  status: string;
  notes?: string;
};

function parseTs(...cands: any[]): number | null {
  for (const c of cands) {
    if (!c) continue;
    const t = Date.parse(String(c));
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

function projectPremium(s: any): ScheduledSession {
  return {
    id: String(s.session_id || s.id),
    kind: 'one_on_one',
    title: s.student_name || 'Student',
    counterparty: str(s.student_name),
    whenTs: parseTs(s.preferred_slot, s.scheduled_at, s.slot),
    mode: 'online',
    amountInr: num(s.teacher_share),
    status: String(s.status || 'confirmed'),
    notes: str(s.notes),
  };
}

// Defensive projection — the /teachers/me/sessions schema is untyped, so read the
// most likely field names with fallbacks. Never throws on shape drift.
function projectClass(x: any): ScheduledSession {
  const online = x.is_online === true || /online|virtual|remote/i.test(String(x.mode || x.format || ''));
  return {
    id: String(x.session_id || x.id || x.booking_id || Math.random().toString(36).slice(2)),
    kind: 'class',
    title: x.title || x.session_title || x.name || x.batch_name || x.program_name || x.company_name || 'Yoga session',
    counterparty: str(x.company_name || x.org_name || x.organisation_name || x.batch_name),
    whenTs: parseTs(x.scheduled_at, x.start_time, x.starts_at, x.session_date, x.date, x.slot, x.when),
    location: str(x.location || x.venue || x.address || x.city),
    mode: online ? 'online' : str(x.mode || x.format) || (x.location ? 'in-person' : undefined),
    participants: num(x.participants || x.attendees || x.rsvp_count || x.expected_count || x.headcount) || undefined,
    status: String(x.status || 'scheduled'),
    notes: str(x.notes),
  };
}

export type NextSession = { title: string; date?: string; time?: string; location?: string; studentName?: string } | null;

export type TeacherSchedule = {
  upcoming: ScheduledSession[];
  past: ScheduledSession[];
  next: NextSession;
  total: number;
  earnedInr: number;
};

export async function getTeacherSchedule(): Promise<TeacherSchedule> {
  const empty: TeacherSchedule = { upcoming: [], past: [], next: null, total: 0, earnedInr: 0 };
  try {
    const [pr, cr, nr] = await Promise.all([
      backendFetch('/premium-sessions/my'),
      backendFetch('/teachers/me/sessions'),
      backendFetch('/teacher/next-session'),
    ]);
    const premium = pr.ok ? await pr.json() : {};
    const classes = cr.ok ? await cr.json() : {};
    const nextRaw = nr.ok ? await nr.json() : {};

    const all: ScheduledSession[] = [
      ...(Array.isArray(premium.sessions) ? premium.sessions.map(projectPremium) : []),
      ...(Array.isArray(classes.sessions) ? classes.sessions.map(projectClass) : Array.isArray(classes) ? classes.map(projectClass) : []),
    ];

    const now = Date.now();
    const isTerminal = (s: ScheduledSession) => TERMINAL.has(s.status.toLowerCase());
    const isPast = (s: ScheduledSession) => PAST.has(s.status.toLowerCase()) || (s.whenTs != null && s.whenTs < now);

    const upcoming = all
      .filter((s) => !isTerminal(s) && !isPast(s))
      .sort((a, b) => (a.whenTs ?? Infinity) - (b.whenTs ?? Infinity));
    const past = all
      .filter((s) => isTerminal(s) || isPast(s))
      .sort((a, b) => (b.whenTs ?? 0) - (a.whenTs ?? 0));

    const earnedInr = all
      .filter((s) => s.kind === 'one_on_one' && (PAST.has(s.status.toLowerCase()) || s.status.toLowerCase() === 'confirmed'))
      .reduce((sum, s) => sum + (s.amountInr || 0), 0);

    const next: NextSession = nextRaw && nextRaw.title
      ? { title: nextRaw.title, date: nextRaw.date || undefined, time: nextRaw.time || undefined, location: nextRaw.location || undefined, studentName: nextRaw.student_name || undefined }
      : null;

    return { upcoming, past, next, total: all.length, earnedInr };
  } catch {
    return empty;
  }
}
