import { backendFetch } from '@/lib/server/session';

// Admin Empanelment Interviewers data layer (PHASE 9). Reads the authoritative
// backend lists of active interviewers and eligible candidates. Assign / revoke
// write through the admin-guarded BFF.

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);

export type InterviewerPerson = {
  handle: string;
  name: string;
  title: string | null;
  lineage: string | null;
  city: string | null;
  specialtyFocus: string[];
  photoUrl: string | null;
  interviewsCompleted: number;
};

function project(m: any): InterviewerPerson {
  return {
    handle: str(m.handle) || str(m.user_id) || '',
    name: str(m.name) || 'Council member',
    title: str(m.title),
    lineage: str(m.lineage),
    city: str(m.city),
    specialtyFocus: arr(m.specialty_focus),
    photoUrl: str(m.photo_url),
    interviewsCompleted: num(m.interviews_completed),
  };
}

export type InterviewersData = {
  interviewers: InterviewerPerson[];
  candidates: InterviewerPerson[];
};

export async function getInterviewers(): Promise<InterviewersData> {
  const [iRes, cRes] = await Promise.all([
    backendFetch('/admin/empanelment/interviewers'),
    backendFetch('/admin/empanelment/interviewers/candidates'),
  ]);
  const i = iRes.ok ? await iRes.json().catch(() => ({})) : {};
  const c = cRes.ok ? await cRes.json().catch(() => ({})) : {};
  return {
    interviewers: (Array.isArray(i.interviewers) ? i.interviewers : []).map(project).filter((m: InterviewerPerson) => m.handle),
    candidates: (Array.isArray(c.candidates) ? c.candidates : []).map(project).filter((m: InterviewerPerson) => m.handle),
  };
}
