// Server-only: the signed-in learner's 1:1 session bookings. Reads the authed
// /premium-sessions/my endpoint via the BFF (bearer attached from the httpOnly
// cookie). Normalises to a small display shape and splits into upcoming/past.
// The backend exposes no learner-initiated cancel/reschedule for 1:1 sessions,
// so we never render actions that don't exist.
import { backendFetch } from '@/lib/server/session';
import { getInAppTeacherIndex, type TeacherIndex } from '@/lib/server/teacher-profile';

export type Booking = {
  id: string;
  teacherName: string;
  /** As stored on the booking — can be stale after a teacher's handle changes. */
  teacherHandle?: string;
  /** Backend's stable teacher key. */
  teacherId?: string;
  /** In-app profile this booking can link to (resolved by teacher_id), or null when unavailable. */
  profileHandle: string | null;
  teacherWhatsapp?: string;
  slotTs: number | null;
  amount?: number;
  currency: string;
  status: string;
  notes?: string;
};

const TERMINAL = new Set([
  'completed',
  'session_completed',
  'student_completed',
  'teacher_completed',
  'cancelled',
  'canceled',
  'declined_by_teacher',
  'refunded',
  'refunded_teacher_decline',
  'expired',
]);

export function isTerminal(status: string): boolean {
  return TERMINAL.has(String(status || '').toLowerCase());
}

// Sessions that actually happened (vs. cancelled/refunded/declined) — the only
// ones a learner should be invited to review.
const COMPLETED = new Set(['completed', 'session_completed', 'student_completed', 'teacher_completed']);
export function isCompleted(status: string): boolean {
  return COMPLETED.has(String(status || '').toLowerCase());
}

export type ReviewableSession = {
  id: string;
  teacherName: string;
  profileHandle: string | null;
  slotTs: number | null;
};

/** Which listed teacher a booking really belongs to. When the booking carries a
 *  teacher_id, ONLY that id decides (a stale/reused handle never redirects a rating
 *  to someone else); handle-only bookings must match a listed handle. Never by name. */
export function resolveProfileHandle(ref: { teacherHandle?: string; teacherId?: string }, idx: TeacherIndex): string | null {
  if (ref.teacherId) return idx.byId.get(ref.teacherId) ?? null;
  return ref.teacherHandle && idx.handles.has(ref.teacherHandle) ? ref.teacherHandle : null;
}

/** Completed sessions with a teacher reference — rateable when profileHandle is set,
 *  otherwise shown with an "unavailable" note. Never drops or alters a booking. */
export function toReviewable(past: Booking[]): ReviewableSession[] {
  return past
    .filter((b) => (b.teacherHandle || b.teacherId) && isCompleted(b.status))
    .map((b) => ({ id: b.id, teacherName: b.teacherName, profileHandle: b.profileHandle, slotTs: b.slotTs }));
}

function normalize(s: any): Booking {
  const slotRaw = s.preferred_slot || s.slot || s.session_at;
  const ts = slotRaw ? Date.parse(slotRaw) : NaN;
  return {
    id: String(s.session_id || s.booking_id || s.id || Math.random().toString(36).slice(2)),
    teacherName: s.teacher_name || 'Your teacher',
    teacherHandle: s.teacher_handle || undefined,
    teacherId: s.teacher_id || undefined,
    profileHandle: null,
    teacherWhatsapp: (s.teacher_whatsapp || s.teacher_phone || '') || undefined,
    slotTs: Number.isNaN(ts) ? null : ts,
    amount: typeof s.amount === 'number' ? s.amount : typeof s.amount_inr === 'number' ? s.amount_inr : undefined,
    currency: s.currency || 'INR',
    status: String(s.status || 'confirmed'),
    notes: (s.notes || s.note || '').toString() || undefined,
  };
}

async function readList(path: string): Promise<any[]> {
  try {
    const r = await backendFetch(path);
    if (!r.ok) return [];
    const d = await r.json();
    if (Array.isArray(d?.bookings)) return d.bookings;
    if (Array.isArray(d?.sessions)) return d.sessions;
    return [];
  } catch {
    return [];
  }
}

// The signed-in learner's sessions. Reads BOTH the 1:1 booking ledger
// (/one-on-one/my-bookings — where a learner's reserved/paid 1:1 sessions
// actually live) and /premium-sessions/my, merges + de-dupes by id, then splits
// upcoming/past. The backend exposes no learner cancel/reschedule so we render
// no actions that don't exist.
export async function getMyBookings(): Promise<{ upcoming: Booking[]; past: Booking[] }> {
  const [oneOnOne, premium, idx] = await Promise.all([
    readList('/one-on-one/my-bookings'),
    readList('/premium-sessions/my'),
    getInAppTeacherIndex(),
  ]);
  const byId = new Map<string, Booking>();
  for (const s of [...oneOnOne, ...premium]) {
    const b = normalize(s);
    b.profileHandle = resolveProfileHandle(b, idx);
    if (!byId.has(b.id)) byId.set(b.id, b);
  }
  const items = Array.from(byId.values());
  const now = Date.now();

  const upcoming = items
    .filter((b) => b.slotTs != null && b.slotTs >= now && !isTerminal(b.status))
    .sort((a, b) => (a.slotTs ?? 0) - (b.slotTs ?? 0));
  const past = items
    .filter((b) => !(b.slotTs != null && b.slotTs >= now && !isTerminal(b.status)))
    .sort((a, b) => (b.slotTs ?? 0) - (a.slotTs ?? 0));

  return { upcoming, past };
}

// Completed sessions the learner can be invited to review. Used to auto-prompt
// for fresh reviews on Home + My Bookings.
export async function getReviewableSessions(): Promise<ReviewableSession[]> {
  return toReviewable((await getMyBookings()).past);
}
