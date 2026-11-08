// Client-safe shared types + label maps for the Admin Teacher Directory
// (Prompts 5–8). No server imports here so both the server data layer and the
// client table/detail components can use it.
import type { VerificationStatus, EmpanelmentStatus, LevelStatus } from '@/lib/teacher-status';

export type AdminTeacherRow = {
  teacherId: string;
  handle: string | null;
  name: string;
  city: string;
  avatarUrl: string | null;
  verification: VerificationStatus;
  empanelment: EmpanelmentStatus;
  level: LevelStatus; // 'none' | 1 | 2 | 3
  completion: number; // 0..100
  createdAt: string | null;
  updatedAt: string | null;
  profileVisible: boolean;
  inDirectory: boolean; // false → limited/hidden record (not in the visible directory)
};

export const VERIFICATION_META: Record<VerificationStatus, { label: string; badge: string }> = {
  verified: { label: 'Verified', badge: 'bg-emerald-50 text-emerald-700' },
  pending: { label: 'Pending', badge: 'bg-amber-50 text-amber-700' },
  not_verified: { label: 'Not verified', badge: 'bg-slate-100 text-slate-600' },
};

export const EMPANELMENT_META: Record<EmpanelmentStatus, { label: string; badge: string }> = {
  empanelled: { label: 'Empanelled', badge: 'bg-emerald-50 text-emerald-700' },
  pending: { label: 'Pending', badge: 'bg-amber-50 text-amber-700' },
  not_empanelled: { label: 'Not empanelled', badge: 'bg-slate-100 text-slate-600' },
};

const LEVEL_NAMES: Record<number, string> = { 1: 'Yoga Shikshak', 2: 'Yoga Pracharak', 3: 'Yoga Guru' };
export function levelLabelShort(level: LevelStatus): string {
  return level === 'none' ? 'No level' : `L${level}`;
}
export function levelLabelFull(level: LevelStatus): string {
  return level === 'none' ? 'No level assigned' : `Level ${level} · ${LEVEL_NAMES[level]}`;
}
export function levelColor(level: LevelStatus): string {
  return level === 1 ? '#0D9488' : level === 2 ? '#0EA5E9' : level === 3 ? '#0F766E' : '#94A3B8';
}

// Prompt 7 — administrative filters. Each is a predicate over a row so search +
// filter compose cleanly on the client.
export type TeacherFilter =
  | 'all'
  | 'awaiting_verification'
  | 'verified'
  | 'awaiting_empanelment'
  | 'empanelled'
  | 'level_1'
  | 'level_2'
  | 'level_3'
  | 'profile_incomplete';

export const TEACHER_FILTERS: { key: TeacherFilter; label: string }[] = [
  { key: 'all', label: 'All Teachers' },
  { key: 'awaiting_verification', label: 'Awaiting Verification' },
  { key: 'verified', label: 'Verified' },
  { key: 'awaiting_empanelment', label: 'Awaiting Empanelment' },
  { key: 'empanelled', label: 'Empanelled' },
  { key: 'level_1', label: 'Level 1' },
  { key: 'level_2', label: 'Level 2' },
  { key: 'level_3', label: 'Level 3' },
  { key: 'profile_incomplete', label: 'Profile Incomplete' },
];

export function matchesFilter(r: AdminTeacherRow, f: TeacherFilter): boolean {
  switch (f) {
    case 'all': return true;
    case 'awaiting_verification': return r.verification !== 'verified';
    case 'verified': return r.verification === 'verified';
    case 'awaiting_empanelment': return r.empanelment !== 'empanelled';
    case 'empanelled': return r.empanelment === 'empanelled';
    case 'level_1': return r.level === 1;
    case 'level_2': return r.level === 2;
    case 'level_3': return r.level === 3;
    case 'profile_incomplete': return !r.inDirectory || r.completion < 100;
    default: return true;
  }
}

// Case-insensitive name match (full / partial / first / last) + handle + id + city.
export function matchesQuery(r: AdminTeacherRow, needle: string): boolean {
  if (!needle) return true;
  const hay = [r.name, r.handle, r.teacherId, r.city].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(needle);
}
