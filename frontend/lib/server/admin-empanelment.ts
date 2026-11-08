import { backendFetch } from '@/lib/server/session';

// Admin Empanelment data layer (PHASE 3). Reads authoritative backend surfaces:
//   • GET /api/admin/empanelment/stats     → totals, by-badge, recent actions
//   • GET /api/admin/empanelment/teachers  → full roster (empanel status)
//   • GET /api/empanelment/fast-track/queue → the Council review pipeline

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

export type EmpanelRosterRow = {
  teacherId: string;
  name: string;
  city: string;
  experienceYears: number;
  isEmpanelled: boolean;
  rating: number;
  reviewsCount: number;
  badge: string | null;
};

export type EmpanelmentAction = {
  auditId: string;
  teacherName: string;
  action: string;
  actorName: string;
  createdAt: string | null;
};

export type EmpanelmentOverview = {
  totalEmpanelled: number;
  byBadge: { badge: string; total: number; empanelled: number }[];
  recentActions: EmpanelmentAction[];
  roster: EmpanelRosterRow[];
  fastTrack: {
    unclaimed: number;
    claimedPending: number;
    scheduled: number;
    approved30d: number;
    rejected30d: number;
  };
};

export async function getEmpanelmentOverview(): Promise<EmpanelmentOverview> {
  const [statsRes, teachersRes, ftRes] = await Promise.all([
    backendFetch('/admin/empanelment/stats'),
    backendFetch('/admin/empanelment/teachers'),
    backendFetch('/empanelment/fast-track/queue'),
  ]);
  const stats = statsRes.ok ? await statsRes.json().catch(() => ({})) : {};
  const teachers = teachersRes.ok ? await teachersRes.json().catch(() => ({})) : {};
  const ft = ftRes.ok ? await ftRes.json().catch(() => ({})) : {};
  const ftc = ft.counts || {};

  const byBadge = Object.entries(stats.by_badge || {}).map(([badge, v]: [string, any]) => ({
    badge,
    total: num(v?.total),
    empanelled: num(v?.empanelled),
  }));

  const recentActions: EmpanelmentAction[] = (Array.isArray(stats.recent_actions) ? stats.recent_actions : []).map((a: any) => ({
    auditId: str(a.audit_id) || Math.random().toString(36).slice(2),
    teacherName: str(a.teacher_name) || 'Teacher',
    action: str(a.action) || '',
    actorName: str(a.actor_name) || 'Admin',
    createdAt: str(a.created_at),
  }));

  const roster: EmpanelRosterRow[] = (Array.isArray(teachers.teachers) ? teachers.teachers : [])
    .map((t: any) => ({
      teacherId: str(t.teacher_id) || '',
      name: str(t.name) || 'Unnamed teacher',
      city: str(t.city) || '',
      experienceYears: num(t.experience_years),
      isEmpanelled: !!t.is_empanelled,
      rating: num(t.rating),
      reviewsCount: num(t.reviews_count),
      badge: str(t.badge),
    }))
    .filter((t: EmpanelRosterRow) => t.teacherId);

  return {
    totalEmpanelled: num(stats.total_empanelled),
    byBadge,
    recentActions,
    roster,
    fastTrack: {
      unclaimed: num(ftc.unclaimed),
      claimedPending: num(ftc.claimed_pending_interview),
      scheduled: num(ftc.interview_scheduled),
      approved30d: num(ftc.approved_last_30d),
      rejected30d: num(ftc.rejected_last_30d),
    },
  };
}

// ── Fast-Track queue (Council review pipeline) ──
export type FastTrackRequest = {
  requestId: string;
  teacherId: string;
  teacherName: string;
  teacherCity: string;
  status: string;
  claimedByGuruName: string | null;
  paidAmount: number | null;
  createdAt: string | null;
  interview: { scheduledAt: string | null; meetingLink: string | null; notes: string | null } | null;
};

export type FastTrackQueue = {
  counts: EmpanelmentOverview['fastTrack'];
  active: FastTrackRequest[];
};

export async function getFastTrackQueue(): Promise<FastTrackQueue> {
  const res = await backendFetch('/empanelment/fast-track/queue');
  const d = res.ok ? await res.json().catch(() => ({})) : {};
  const c = d.counts || {};
  const active: FastTrackRequest[] = (Array.isArray(d.active) ? d.active : []).map((r: any) => ({
    requestId: str(r.request_id) || '',
    teacherId: str(r.teacher_id) || '',
    teacherName: str(r.teacher_name) || 'Teacher',
    teacherCity: str(r.teacher_city) || '',
    status: str(r.status) || 'pending',
    claimedByGuruName: str(r.claimed_by_guru_name),
    paidAmount: r.payment && Number.isFinite(Number(r.payment.amount)) ? Number(r.payment.amount) : null,
    createdAt: str(r.created_at),
    interview: r.interview
      ? { scheduledAt: str(r.interview.scheduled_at), meetingLink: str(r.interview.meeting_link), notes: str(r.interview.notes) }
      : null,
  })).filter((r: FastTrackRequest) => r.requestId);

  return {
    counts: {
      unclaimed: num(c.unclaimed),
      claimedPending: num(c.claimed_pending_interview),
      scheduled: num(c.interview_scheduled),
      approved30d: num(c.approved_last_30d),
      rejected30d: num(c.rejected_last_30d),
    },
    active,
  };
}
