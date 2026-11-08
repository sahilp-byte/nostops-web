import { backendFetch } from '@/lib/server/session';

// Admin Council Roster data layer (PHASE 8). Reads GET /api/admin/council-roster —
// the authoritative Council of Gurus roster. Deactivate / reactivate write
// through the admin-guarded BFF.

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);

export type CouncilMember = {
  handle: string;
  name: string;
  title: string | null;
  lineage: string | null;
  decades: number;
  city: string | null;
  specialtyFocus: string[];
  languages: string[];
  bio: string | null;
  notableMentees: number;
  signatureWorks: string[];
  photoUrl: string | null;
  isActive: boolean;
};

function project(m: any): CouncilMember {
  const status = str(m.status);
  return {
    handle: str(m.handle) || str(m.user_id) || '',
    name: str(m.name) || 'Council member',
    title: str(m.title),
    lineage: str(m.lineage),
    decades: num(m.decades),
    city: str(m.city),
    specialtyFocus: arr(m.specialty_focus),
    languages: arr(m.languages),
    bio: str(m.bio),
    notableMentees: num(m.notable_mentees),
    signatureWorks: arr(m.signature_works),
    photoUrl: str(m.photo_url),
    isActive: m.is_active !== false && status !== 'inactive' && status !== 'deactivated',
  };
}

export type CouncilRosterData = {
  members: CouncilMember[];
  total: number;
  active: number;
};

export async function getCouncilRoster(): Promise<CouncilRosterData> {
  const res = await backendFetch('/admin/council-roster');
  const d = res.ok ? await res.json().catch(() => ({})) : {};
  const members = (Array.isArray(d.members) ? d.members : []).map(project).filter((m: CouncilMember) => m.handle);
  return { members, total: num(d.total) || members.length, active: num(d.active) || members.filter((m: CouncilMember) => m.isActive).length };
}
