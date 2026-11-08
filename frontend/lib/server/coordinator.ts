import { backendFetch } from '@/lib/server/session';

// City Coordinator persona. A coordinator is a teacher who has ALSO been
// promoted/assigned to serve their city. Backed by /coordinators/*.

const n = (v: any): number => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);

export type CoordinatorMe = {
  coordinator: {
    coordinatorId: string;
    name: string;
    city: string;
    whatsapp: string | null;
    active: boolean;
    assignedTeacherCount: number;
    corporatePartnerships: number;
  } | null;
  reason: string;
};

export async function getCoordinatorMe(): Promise<CoordinatorMe> {
  try {
    const r = await backendFetch('/coordinators/me');
    if (!r.ok) return { coordinator: null, reason: 'error' };
    const d = await r.json();
    const c = d.coordinator;
    if (!c) return { coordinator: null, reason: d.reason || '' };
    return {
      coordinator: {
        coordinatorId: c.coordinator_id,
        name: c.name || 'Coordinator',
        city: c.city || '',
        whatsapp: c.whatsapp || null,
        active: c.active !== false,
        assignedTeacherCount: n(c.assigned_teacher_count),
        corporatePartnerships: n(c.stats?.corporate_partnerships),
      },
      reason: d.reason || '',
    };
  } catch {
    return { coordinator: null, reason: 'error' };
  }
}

export type CoordMilestone = { key: string; label: string; target: number; bonus: number; current: number; done: boolean; pct: number };

export type CoordinatorDashboard = {
  name: string;
  city: string;
  whatsapp: string | null;
  teacherCount: number;
  mtdGross: number;
  mtdBookings: number;
  mtdEarning: number;
  revenueShareNote: string;
  teachers: Array<{ teacherId: string; handle: string; name: string; city: string; isEmpanelled: boolean }>;
  milestones: CoordMilestone[];
  earnedBonus: number;
  totalPotential: number;
} | null;

type RosterTeacher = { teacherId: string; handle: string; name: string; city: string; isEmpanelled: boolean };

// The backend seed can return the same teacher twice (one row with a handle,
// one without). Collapse by teacherId, preferring the row that has a handle
// (so the "View →" profile link survives) and any empanelled/city signal.
function dedupeTeachers(list: RosterTeacher[]): RosterTeacher[] {
  const byId = new Map<string, RosterTeacher>();
  for (const t of list) {
    const key = t.teacherId || t.handle || t.name;
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, t);
      continue;
    }
    byId.set(key, {
      teacherId: existing.teacherId || t.teacherId,
      handle: existing.handle || t.handle,
      name: existing.name || t.name,
      city: existing.city || t.city,
      isEmpanelled: existing.isEmpanelled || t.isEmpanelled,
    });
  }
  return Array.from(byId.values());
}

export async function getCoordinatorDashboard(): Promise<CoordinatorDashboard> {
  try {
    const r = await backendFetch('/coordinators/me/dashboard');
    if (!r.ok) return null; // 401/403 → not a coordinator
    const d = await r.json();
    const c = d.coordinator || {};
    const ms: CoordMilestone[] = (d.milestones?.milestones || []).map((m: any) => ({
      key: m.key,
      label: m.label || '',
      target: n(m.target),
      bonus: n(m.bonus),
      current: n(m.current),
      done: !!m.done,
      pct: n(m.pct),
    }));
    const totalPotential = n(d.milestones?.total_potential_inr) || ms.reduce((s, m) => s + m.bonus, 0);
    const earnedBonus = n(d.milestones?.earned_bonus_inr) || ms.reduce((s, m) => s + (m.done ? m.bonus : 0), 0);
    return {
      name: c.name || 'Coordinator',
      city: c.city || '',
      whatsapp: c.whatsapp || null,
      teacherCount: n(d.teacher_count),
      mtdGross: n(d.mtd_gross_inr),
      mtdBookings: n(d.mtd_booking_count),
      mtdEarning: n(d.mtd_coord_earning_inr),
      revenueShareNote: d.revenue_share_note || '',
      teachers: dedupeTeachers(
        (Array.isArray(d.teachers) ? d.teachers : []).map((t: any) => ({
          teacherId: t.teacher_id || '',
          handle: t.handle || '',
          name: t.name || 'Teacher',
          city: t.city || '',
          isEmpanelled: !!t.is_empanelled,
        })),
      ),
      milestones: ms,
      earnedBonus,
      totalPotential,
    };
  } catch {
    return null;
  }
}
