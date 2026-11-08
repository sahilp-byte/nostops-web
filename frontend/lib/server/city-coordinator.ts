// Contract-first loader for the City Coordinator Spotlight.
//
// The backend does NOT yet expose a public city-coordinator endpoint (see
// /app/BACKEND_REQUEST_city_coordinator_public.md). This loader is wired to the
// AGREED contract `GET /api/coordinators/city/{slug}` and fails open to null, so:
//   • today (endpoint 404s) it returns null → the spotlight renders nothing
//     (no thin/empty section, no SSR error logs), and
//   • the moment the backend ships that endpoint, the spotlight lights up
//     automatically with zero further frontend changes.
//
// PII-safe: only name / handle / avatar / since / story / teacher_count are read.
// Email, phone, whatsapp, payout/KYC/bank, user_id are NEVER projected even if
// the backend were to include them.
import { apiGetOrNull } from '@/lib/api';
import { isPublicHandleBlocked } from '@/lib/public-teacher';

export type CityCoordinator = {
  name: string;
  teacherHandle?: string;
  avatarUrl?: string;
  avatarB64?: string;
  since?: string;
  story?: string;
  teacherCount?: number;
};

function project(raw: any): CityCoordinator | null {
  // Accept either { coordinator: {...} } or a flat coordinator object.
  const c = raw?.coordinator ?? raw;
  if (!c || typeof c !== 'object') return null;
  const name = typeof c.name === 'string' ? c.name.trim() : '';
  if (!name) return null;
  const teacherHandle = typeof c.teacher_handle === 'string' && c.teacher_handle.trim() ? c.teacher_handle.trim() : undefined;
  // A coordinator whose teacher profile is retired (demo/test) is never shown.
  if (isPublicHandleBlocked(teacherHandle)) return null;
  // Strip stray QA/test markers (e.g. "QA-edit-1") so seed noise never shows publicly.
  const story =
    typeof c.story === 'string'
      ? c.story.replace(/QA-edit-\d+/gi, '').replace(/\s{2,}/g, ' ').trim() || undefined
      : undefined;
  return {
    name,
    teacherHandle,
    avatarUrl: typeof c.avatar_url === 'string' && c.avatar_url ? c.avatar_url : undefined,
    avatarB64: typeof c.avatar_base64 === 'string' && c.avatar_base64 ? c.avatar_base64 : undefined,
    since: typeof c.since === 'string' && c.since.trim() ? c.since.trim() : undefined,
    story,
    teacherCount: typeof c.teacher_count === 'number' && c.teacher_count > 0 ? c.teacher_count : undefined,
  };
}

/** The public City Coordinator for a city slug, or null when none / not yet available. */
export async function getCityCoordinator(slug: string): Promise<CityCoordinator | null> {
  const raw = await apiGetOrNull<any>(`/coordinators/city/${encodeURIComponent(slug)}`, { revalidate: 60 });
  if (!raw) return null;
  return project(raw);
}
