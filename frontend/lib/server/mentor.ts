// Server-only: the teacher's Guru–Shishya mentorship view (#37). The backend
// exposes the teacher's *mentor* (assigned Council Guru) and the touchpoint
// history via /teachers/me/mentor-view. A "mentees roster" is a Council-only
// endpoint (403 for teachers), so the teacher-facing screen shows the lineage
// relationship they belong to. Read-only — no teacher-side mutations exist.
import { backendFetch } from '@/lib/server/session';

export type Mentor = {
  guruId: string;
  name: string;
  handle?: string;
  avatarUrl?: string | null;
  title?: string;
  lineage?: string;
  city?: string;
  bio?: string;
  since?: string;
};

export type Touchpoint = {
  id: string;
  guruName: string;
  type: string;
  note: string;
  lineageTransmission: boolean;
  at: string | null;
};

export type MentorView = {
  hasMentor: boolean;
  mentor: Mentor | null;
  touchpoints: Touchpoint[];
} | null;

export async function getMentorView(): Promise<MentorView> {
  try {
    const r = await backendFetch('/teachers/me/mentor-view');
    if (!r.ok) return null;
    const d = await r.json();
    const m = d.mentor;
    return {
      hasMentor: !!d.has_mentor,
      mentor: m
        ? {
            guruId: String(m.guru_id || ''),
            name: m.name || 'Council Guru',
            handle: m.handle || undefined,
            avatarUrl: m.avatar_url || null,
            title: m.title || undefined,
            lineage: m.lineage || undefined,
            city: m.city || undefined,
            bio: m.bio || undefined,
            since: m.since || undefined,
          }
        : null,
      touchpoints: (Array.isArray(d.touchpoints) ? d.touchpoints : []).map((t: any): Touchpoint => ({
        id: String(t.touchpoint_id || Math.random().toString(36).slice(2)),
        guruName: t.guru_name || 'Guru',
        type: String(t.type || 'note'),
        note: (t.note || '').toString(),
        lineageTransmission: !!t.lineage_transmission,
        at: t.at || null,
      })),
    };
  } catch {
    return null;
  }
}
