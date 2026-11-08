// Server-only: the teacher's 1:1 (one-on-one) bookings with the action-relevant
// fields the richer /one-on-one/my-bookings endpoint exposes (confirm/decline,
// complete, reassign). The backend owns every state transition; here we only
// read + derive which actions are currently valid for each booking.
import { backendFetch } from '@/lib/server/session';

const num = (v: any): number => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);

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

export function isTerminalStatus(s: string): boolean {
  return TERMINAL.has(String(s || '').toLowerCase());
}

export type OneOnOneBooking = {
  id: string;
  studentName: string;
  studentPhone: string | null;
  studentEmail: string | null;
  notes: string;
  slotTs: number | null;
  amountInr: number;
  earnInr: number;
  paymentId: string | null;
  status: string;
  declinedReason: string | null;
  teacherConfirmedAt: string | null;
  teacherCompletedAt: string | null;
  studentCompletedAt: string | null;
  // Derived action gates (backend re-validates on every call):
  awaitingTeacher: boolean; // paid + not yet confirmed/declined → accept/decline
  canComplete: boolean; // confirmed + not yet marked complete by teacher
  canReassign: boolean; // active (non-terminal) → may offer to an alternate teacher
  isTerminal: boolean;
};

function project(s: any): OneOnOneBooking {
  const ts = s.preferred_slot ? Date.parse(s.preferred_slot) : NaN;
  const status = String(s.status || 'pending_payment');
  const terminal = isTerminalStatus(status);
  // Gateway-NEUTRAL payment id + paid signal. Prefer the neutral fields; keep
  // razorpay_payment_id ONLY as a legacy fallback so historical Razorpay-paid
  // bookings still resolve while new Cashfree-paid bookings work too. The
  // teacher accept/decline rule below is unchanged — only the definition of
  // "paid" is now gateway-agnostic.
  const paymentId = s.payment_id || s.cashfree_payment_id || s.razorpay_payment_id || null;
  const payStatus = String(s.payment_status || '').toLowerCase();
  const paid = !!paymentId || status === 'paid' || status === 'confirmed' || payStatus === 'paid' || payStatus === 'success';
  const confirmed = !!s.teacher_confirmed_at;
  const amountInr = num(s.amount_inr ?? s.amount);
  return {
    id: String(s.booking_id || s.id),
    studentName: s.student_name || 'Student',
    studentPhone: s.student_phone || null,
    studentEmail: s.student_email || null,
    notes: (s.notes || '').toString(),
    slotTs: Number.isNaN(ts) ? null : ts,
    amountInr,
    earnInr: Math.round(amountInr * 0.85),
    paymentId,
    status,
    declinedReason: s.declined_reason || null,
    teacherConfirmedAt: s.teacher_confirmed_at || null,
    teacherCompletedAt: s.teacher_completed_at || null,
    studentCompletedAt: s.student_completed_at || null,
    awaitingTeacher: paid && !confirmed && !terminal,
    canComplete: confirmed && !s.teacher_completed_at && !terminal,
    canReassign: !terminal && !s.teacher_completed_at,
    isTerminal: terminal,
  };
}

export async function getOneOnOneBookings(): Promise<{ total: number; earnedInr: number; bookings: OneOnOneBooking[] }> {
  try {
    const r = await backendFetch('/one-on-one/my-bookings');
    if (!r.ok) return { total: 0, earnedInr: 0, bookings: [] };
    const d = await r.json();
    const bookings = (Array.isArray(d.bookings) ? d.bookings : []).map(project);
    const earnedInr = bookings
      .filter((b: OneOnOneBooking) => b.status === 'session_completed' || b.teacherCompletedAt)
      .reduce((sum: number, b: OneOnOneBooking) => sum + b.earnInr, 0);
    return { total: bookings.length, earnedInr, bookings };
  } catch {
    return { total: 0, earnedInr: 0, bookings: [] };
  }
}
