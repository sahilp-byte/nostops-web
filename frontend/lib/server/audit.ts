// 1:1 Session Audit Ledger — server-only data layer.
//
// The remote business backend is frozen and exposes no admin endpoint for 1:1
// sessions, so the Next.js BFF records each booking / payment event into a LOCAL
// FastAPI + local Mongo ledger (mirrors the Teacher Pulse isolation pattern).
// The browser can NEVER reach the ledger directly: every call carries the
// server-only shared secret + an identity built from the httpOnly NOSTOPS
// session. Writes happen inside the booking/payment BFF (best-effort, never
// blocking); reads happen server-side on the admin page.
import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import { getSessionUser } from '@/lib/server/session';
import { backendFetch } from '@/lib/server/session';
import { normalizeRole, type User } from '@/lib/roles';

const AUDIT_BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const TIMEOUT_MS = 6000;

type Actor = { user_id: string; name: string; role: string };

function actorFrom(user: User): Actor {
  return {
    user_id: String(user.user_id || user.email || ''),
    name: (user.name as string) || (user.email as string) || '',
    role: normalizeRole(user.role),
  };
}

function actorHeader(actor: Actor): string {
  return Buffer.from(JSON.stringify(actor), 'utf8').toString('base64');
}

async function auditFetch(path: string, method: string, actor: Actor, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Pulse-Secret': SECRET, ...testTagHeaders(),
    'X-Pulse-User': actorHeader(actor),
  };
  const init: RequestInit = {
    method,
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };
  if (body !== undefined && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  return fetch(`${AUDIT_BASE}/api/audit${path}`, init);
}

// ── Ledger record (called from the booking + payment BFF) ────────────────────
export type LedgerRecord = {
  booking_id: string;
  event: 'reserve' | 'order_created';
  teacher_id?: string;
  teacher_handle?: string;
  teacher_name?: string;
  seeker_email?: string;
  seeker_phone?: string;
  amount_inr?: number;
  currency?: string;
  gateway?: string;
  order_id?: string;
  status?: string;
  session_mode?: string;
  matrix_reason?: string;
  note?: string;
  slot_iso?: string;
};

/** Best-effort ledger write. Never throws — a ledger failure must never break a
 *  real booking or payment. `user` is the authenticated seeker (from the BFF). */
export async function recordOneOnOne(user: User, rec: LedgerRecord): Promise<void> {
  if (!SECRET || !rec.booking_id) return;
  try {
    await auditFetch('/one-on-one', 'POST', actorFrom(user), {
      ...rec,
      seeker_email: rec.seeker_email || (user.email as string) || undefined,
    });
  } catch {
    /* non-fatal */
  }
}

/** Mark the caller's ledger entry PAID by Cashfree order_id. Called by the
 *  payment-status BFF ONLY after re-verifying the order is paid with the remote
 *  gateway — the ledger endpoint additionally scopes the update to this seeker.
 *  Best-effort; never throws. */
export async function markOneOnOnePaidByOrder(user: User, orderId: string, amountInr?: number): Promise<void> {
  if (!SECRET || !orderId) return;
  try {
    await auditFetch('/one-on-one/mark-paid', 'POST', actorFrom(user), {
      order_id: orderId,
      ...(typeof amountInr === 'number' ? { amount_inr: amountInr } : {}),
    });
  } catch {
    /* non-fatal */
  }
}

// ── Admin reads (SSR) ─────────────────────────────────────────────────────────
export type LedgerRow = {
  booking_id: string;
  teacher_id: string | null;
  teacher_handle: string | null;
  teacher_name: string | null;
  seeker_user_id: string | null;
  seeker_name: string | null;
  seeker_email: string | null;
  amount_inr: number | null;
  currency: string;
  gateway: string | null;
  order_id: string | null;
  status: string | null;
  session_mode: string | null;
  matrix_reason: string | null;
  note: string | null;
  slot_iso: string | null;
  created_at: number | null;
  updated_at: number | null;
  event_count: number;
};

export type LedgerStats = { total: number; pending: number; initiated: number; paid: number; gross_inr: number };

export type AdminLedgerData = { rows: LedgerRow[]; stats: LedgerStats; statuses: string[] };

const EMPTY: AdminLedgerData = {
  rows: [],
  stats: { total: 0, pending: 0, initiated: 0, paid: 0, gross_inr: 0 },
  statuses: ['PENDING_PAYMENT', 'PAYMENT_INITIATED', 'PAID'],
};

/** Admin-only server read of the local 1:1 ledger. Returns an empty ledger on
 *  any error / non-admin so the page renders an honest empty state. */
export async function getAdminOneOnOne(): Promise<AdminLedgerData> {
  const user = await getSessionUser();
  if (!user || normalizeRole(user.role) !== 'admin' || !SECRET) return EMPTY;
  try {
    const res = await auditFetch('/admin/one-on-one?limit=500', 'GET', actorFrom(user));
    if (!res.ok) return EMPTY;
    const d = (await res.json()) as AdminLedgerData;
    return { rows: d.rows || [], stats: d.stats || EMPTY.stats, statuses: d.statuses || EMPTY.statuses };
  } catch {
    return EMPTY;
  }
}

/** Raw CSV export of the ledger for an authenticated admin. The caller (an
 *  admin-guarded BFF route) relays the Response straight to the browser. */
export async function fetchOneOnOneExport(user: User, search = ''): Promise<Response> {
  return auditFetch(`/admin/one-on-one-export${search || ''}`, 'GET', actorFrom(user));
}

// ── Admin single-session detail (timeline) ────────────────────────────────────
export type LedgerEvent = {
  event: string;
  at: number;
  status: string | null;
  gateway: string | null;
  order_id: string | null;
  amount_inr: number | null;
  actor_role: string | null;
};
export type LedgerDetail = LedgerRow & { events: LedgerEvent[] };

/** Admin-only read of a single 1:1 session + its full event timeline. Returns
 *  null on error / non-admin / unknown id (page renders notFound()). */
export async function getOneOnOneDetail(bookingId: string): Promise<LedgerDetail | null> {
  const user = await getSessionUser();
  if (!user || normalizeRole(user.role) !== 'admin' || !SECRET) return null;
  try {
    const res = await auditFetch(`/admin/one-on-one/${encodeURIComponent(bookingId)}`, 'GET', actorFrom(user));
    if (!res.ok) return null;
    const d = (await res.json()) as { session?: LedgerDetail };
    return d.session || null;
  } catch {
    return null;
  }
}

// ── Teacher's own 1:1 sessions + earnings snapshot ────────────────────────────
export type TeacherLedgerStats = {
  count: number;
  paid_count: number;
  pending_count: number;
  paid_gross_inr: number;
  pending_gross_inr: number;
  paid_net_inr: number;
  pending_net_inr: number;
};
export type MonthlyPayout = { month: string; label: string; earned_net_inr: number; pending_net_inr: number; count: number };
// Prompt 3 — each row carries the server's per-booking teacher share (85%, exact to the paisa, rule R2
// in backend/pricing_rules.py); the totals above are sums of these same figures. Display only.
export type TeacherLedgerRow = LedgerRow & { teacher_net_inr: number | null };
export type TeacherLedgerData = { rows: TeacherLedgerRow[]; stats: TeacherLedgerStats; monthly: MonthlyPayout[]; fee_pct: number };

const EMPTY_TEACHER: TeacherLedgerData = {
  rows: [],
  stats: {
    count: 0, paid_count: 0, pending_count: 0,
    paid_gross_inr: 0, pending_gross_inr: 0, paid_net_inr: 0, pending_net_inr: 0,
  },
  monthly: [],
  fee_pct: 15,
};

/** The signed-in teacher's OWN 1:1 sessions recorded via NOSTOPS + an earnings
 *  snapshot (85% net). The teacher_id is resolved server-side from the caller's
 *  own native profile — a teacher only ever sees bookings made with THEM. */
export async function getTeacherOneOnOne(): Promise<TeacherLedgerData> {
  const user = await getSessionUser();
  if (!user || !SECRET) return EMPTY_TEACHER;
  const role = normalizeRole(user.role);
  if (role !== 'teacher' && role !== 'admin') return EMPTY_TEACHER;

  let teacherId = '';
  try {
    const r = await backendFetch('/teachers/me/native-profile');
    if (r.ok) {
      const d = await r.json();
      teacherId = String(d?.teacher?.teacher_id || '');
    }
  } catch {
    /* no teacher record */
  }
  if (!teacherId) return EMPTY_TEACHER;

  try {
    const res = await auditFetch(`/teacher/one-on-one?teacher_id=${encodeURIComponent(teacherId)}`, 'GET', actorFrom(user));
    if (!res.ok) return EMPTY_TEACHER;
    const d = (await res.json()) as TeacherLedgerData;
    return {
      rows: d.rows || [],
      stats: d.stats || EMPTY_TEACHER.stats,
      monthly: d.monthly || [],
      fee_pct: d.fee_pct || 15,
    };
  } catch {
    return EMPTY_TEACHER;
  }
}

// ── Seeker's own unpaid reservations (Missed Payment Recovery) ────────────────
export type SeekerPendingRow = {
  booking_id: string;
  teacher_name: string | null;
  teacher_handle: string | null;
  amount_inr: number | null;
  currency: string;
  status: string | null;
  session_mode: string | null;
  matrix_reason: string | null;
  slot_iso: string | null;
  seeker_phone: string | null;
  created_at: number | null;
};

/** The signed-in seeker's OWN reservations that were never paid, so we can
 *  gently nudge them to finish checkout. Scoped server-side to this seeker. */
export async function getSeekerPendingOneOnOne(): Promise<SeekerPendingRow[]> {
  const user = await getSessionUser();
  if (!user || !SECRET) return [];
  try {
    const res = await auditFetch('/seeker/one-on-one', 'GET', actorFrom(user));
    if (!res.ok) return [];
    const d = (await res.json()) as { rows?: SeekerPendingRow[] };
    return Array.isArray(d.rows) ? d.rows : [];
  } catch {
    return [];
  }
}


// ── Admin: teacher status-change audit log (who verified/disabled + when) ─────
export type TeacherStatusLogEntry = {
  field: string;
  from: string | null;
  to: string | null;
  reason: string | null;
  admin_id: string | null;
  admin_name: string | null;
  at: string | null; // ISO
};

/** Best-effort audit write for an admin status change. Never throws. `user` is
 *  the authenticated ADMIN resolved by the BFF guard (identity is set here from
 *  the session, never from the browser). */
export async function recordTeacherStatusChange(
  user: User,
  rec: { teacherId: string; field: string; from?: unknown; to?: unknown; reason?: string | null },
): Promise<void> {
  if (!SECRET || !rec.teacherId) return;
  try {
    await auditFetch('/admin/teacher-status', 'POST', actorFrom(user), {
      teacher_id: rec.teacherId,
      field: rec.field,
      from_value: rec.from === null || rec.from === undefined ? null : String(rec.from),
      to_value: rec.to === null || rec.to === undefined ? null : String(rec.to),
      reason: rec.reason || null,
    });
  } catch {
    /* non-fatal */
  }
}

/** Admin-only SSR read of a teacher's status-change history from the local
 *  audit store. Returns { available:false } on any error / non-admin. */
export async function getTeacherStatusLog(teacherId: string): Promise<{ available: boolean; entries: TeacherStatusLogEntry[] }> {
  const user = await getSessionUser();
  if (!user || normalizeRole(user.role) !== 'admin' || !SECRET) return { available: false, entries: [] };
  try {
    const res = await auditFetch(`/admin/teacher-status/${encodeURIComponent(teacherId)}`, 'GET', actorFrom(user));
    if (!res.ok) return { available: false, entries: [] };
    const d = (await res.json()) as { entries?: TeacherStatusLogEntry[] };
    return { available: true, entries: Array.isArray(d.entries) ? d.entries : [] };
  } catch {
    return { available: false, entries: [] };
  }
}
