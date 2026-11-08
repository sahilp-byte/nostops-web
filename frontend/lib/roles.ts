// Role / persona model — single source of truth, derived from the recovered
// mobile source (personaLabels.ts + role usage). Backend role keys are NEVER
// changed; this only maps them to app-side persona groups and friendly labels.

export type AppRole =
  | 'learner'
  | 'teacher'
  | 'corporate'
  | 'coordinator'
  | 'council'
  | 'admin';

export type User = {
  user_id?: string;
  name?: string;
  email?: string;
  role?: string;
  cohort_type?: string | null;
  avatar_url?: string | null;
  extra?: { cohort_type?: string | null } | null;
  [k: string]: unknown;
};

// Backend role key -> app persona group.
const ROLE_MAP: Record<string, AppRole> = {
  seeker: 'learner',
  employee: 'learner',
  itpro: 'learner',
  member: 'learner',
  user: 'learner',
  teacher: 'teacher',
  guru: 'council',
  hr: 'corporate',
  organisation: 'corporate',
  coordinator: 'coordinator',
  council: 'council',
  admin: 'admin',
};

export function normalizeRole(role?: string | null): AppRole {
  return ROLE_MAP[String(role || '').toLowerCase()] ?? 'learner';
}

// Friendly persona label (mirrors mobile personaLabels.ts).
const HR_LABEL_BY_COHORT: Record<string, string> = {
  company: 'Workplace Lead',
  education: 'Student Wellness Lead',
  startup_network: 'Startup Wellness Lead',
};

export function personaLabel(user: User | null | undefined): string {
  const role = String(user?.role || '').toLowerCase();
  const cohort = String(user?.cohort_type || user?.extra?.cohort_type || '');
  if (role === 'hr' || role === 'organisation') {
    return HR_LABEL_BY_COHORT[cohort] || 'Workplace Lead';
  }
  switch (normalizeRole(role)) {
    case 'teacher':
      return 'Yoga Teacher';
    case 'coordinator':
      return 'City Coordinator';
    case 'council':
      return role === 'guru' ? 'Yoga Guru' : 'Council Guru';
    case 'admin':
      return 'Administrator';
    default:
      return 'Yoga Seeker';
  }
}

export function displayName(user: User | null | undefined): string {
  const n = (user?.name || '').trim();
  if (n) return n;
  const email = (user?.email || '').trim();
  return email ? email.split('@')[0] : 'Member';
}
