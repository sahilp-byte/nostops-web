// Server-only loader for the authenticated in-app teacher profile.
// Reads the public profile endpoint (which unfortunately still contains a few
// private fields) and projects it through toTeacherProfile() so nothing
// private is ever serialized. Eligibility is checked against the directory
// (the public/{handle} endpoint returns 200 even for suspended teachers).
import { cache } from 'react';
import { apiGet, apiGetSafe } from '@/lib/api';
import { isPublicTeacher, toTeacherProfile, type TeacherProfile } from '@/lib/teacher';

/** In-app listable handles + the backend's stable teacher_id → CURRENT handle. */
export type TeacherIndex = { handles: Set<string>; byId: Map<string, string> };

// Directory eligibility for in-app profiles (the public/{handle} endpoint returns
// 200 even for suspended teachers). Fails closed to an empty index.
export const getInAppTeacherIndex = cache(async (): Promise<TeacherIndex> => {
  const dir = await apiGetSafe<{ teachers?: any[] }>('/teachers/directory?limit=200', { teachers: [] }, {
    revalidate: 300,
  });
  const rows = (Array.isArray(dir?.teachers) ? dir.teachers : []).filter(isPublicTeacher);
  return {
    handles: new Set(rows.map((t: any) => String(t.handle))),
    byId: new Map(rows.filter((t: any) => t.teacher_id).map((t: any) => [String(t.teacher_id), String(t.handle)])),
  };
});

/** Returns the whitelisted profile, or null when missing / not publicly listable. */
export async function getTeacherProfile(handle: string): Promise<TeacherProfile | null> {
  let raw: any = null;
  try {
    const d = await apiGet<{ teacher?: any }>(`/teachers/public/${encodeURIComponent(handle)}`, {
      revalidate: 120,
    });
    raw = d?.teacher || null;
  } catch {
    return null; // 404 or transient -> treat as not found for the app view
  }
  if (!raw || !raw.handle) return null;
  if (!isPublicTeacher(raw)) return null;

  // Cross-check the directory eligibility set (suspended/inactive teachers still
  // 200 on the profile endpoint but must not be reachable).
  if (!(await getInAppTeacherIndex()).handles.has(String(raw.handle))) return null;

  return toTeacherProfile(raw);
}
