import { backendFetch } from '@/lib/server/session';

// Admin People Manager data layer (PHASE 4). Reads the authoritative backend
// people lists (teachers + council gurus) and normalises them into a common
// row so one UI can moderate both. Suspend / reinstate write through the
// admin-guarded BFF.

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

export type PeopleKind = 'teachers' | 'council';

export type PersonRow = {
  kind: PeopleKind;
  id: string; // teacher_id or guru_id (identifier used by the backend action route)
  name: string;
  handle: string | null;
  city: string | null;
  email: string | null;
  title: string | null;
  status: string; // 'active' | 'suspended' | 'deleted' | ...
  isActive: boolean;
  suspendedUntil: string | null;
  createdAt: string | null;
};

function projectTeacher(t: any): PersonRow {
  return {
    kind: 'teachers',
    id: str(t.teacher_id) || '',
    name: str(t.name) || 'Unnamed',
    handle: str(t.handle),
    city: str(t.city),
    email: str(t.email),
    title: t.empanelled ? 'Empanelled teacher' : 'Teacher',
    status: str(t.status) || (t.is_active ? 'active' : 'inactive'),
    isActive: !!t.is_active,
    suspendedUntil: str(t.suspended_until),
    createdAt: str(t.created_at),
  };
}

function projectGuru(g: any): PersonRow {
  return {
    kind: 'council',
    id: str(g.guru_id) || str(g.user_id) || str(g.handle) || '',
    name: str(g.name) || 'Unnamed',
    handle: str(g.handle),
    city: str(g.city),
    email: str(g.email),
    title: str(g.title) || 'Council Guru',
    status: str(g.status) || (g.is_active ? 'active' : 'inactive'),
    isActive: !!g.is_active,
    suspendedUntil: str(g.suspended_until),
    createdAt: str(g.created_at),
  };
}

export type PeopleData = {
  teachers: PersonRow[];
  council: PersonRow[];
  counts: { teachers: number; council: number; suspended: number };
};

export async function getPeople(): Promise<PeopleData> {
  const [tRes, cRes] = await Promise.all([
    backendFetch('/admin/people/teachers?limit=200'),
    backendFetch('/admin/people/council?limit=200'),
  ]);
  const t = tRes.ok ? await tRes.json().catch(() => ({})) : {};
  const c = cRes.ok ? await cRes.json().catch(() => ({})) : {};
  const teachers = (Array.isArray(t.items) ? t.items : []).map(projectTeacher).filter((r: PersonRow) => r.id);
  const council = (Array.isArray(c.items) ? c.items : []).map(projectGuru).filter((r: PersonRow) => r.id);
  const suspended = [...teachers, ...council].filter((r) => r.status === 'suspended' || (r.suspendedUntil && !r.isActive)).length;
  // Use the roster's authoritative `total` (independent of page size) so the
  // headline counts reflect ALL registered people, not just the first page.
  const teacherTotal = Number(t.total) || teachers.length;
  const councilTotal = Number(c.total) || council.length;
  return {
    teachers,
    council,
    counts: { teachers: teacherTotal, council: councilTotal, suspended },
  };
}
