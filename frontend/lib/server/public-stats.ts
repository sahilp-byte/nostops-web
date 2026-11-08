import 'server-only';
import { cache } from 'react';
import { apiGetSafe } from '@/lib/api';
import { isTeacherActivePublic } from '@/lib/public-teacher';
import { getRegisteredTeacherCount } from '@/lib/server/teacher-stats';
import { getCities } from '@/lib/server/cities';
import { visibleCouncilMembers } from '@/lib/council-visibility';
import { getCouncilGate } from '@/lib/server/council-gate';

// ── SINGLE APPROVED SOURCE for every public headline number ──────────────────
// Owner-approved rule: show ONLY numbers a visitor can check on the site.
//   registeredTeachers — all registered teacher accounts (founding counter)
//   publicProfiles     — teachers listed in the /teachers directory
//   empanelledTeachers — Council-empanelled teachers listed in that directory
//   councilMembers     — Gurus shown on /council
//   cities             — cities with ≥1 public teacher (/yoga-teachers)
//   organisations      — organisations on the platform record (platform-stats)
// Unverifiable marketing figures (participants reached, combined years of
// practice, backend "movement" totals) are intentionally NOT exposed.
export type PublicStats = {
  registeredTeachers: number;
  publicProfiles: number;
  empanelledTeachers: number;
  councilMembers: number;
  cities: number;
  organisations: number;
  organisationTarget: number;
};

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

export const getPublicStats = cache(async (): Promise<PublicStats> => {
  const [registeredTeachers, directory, council, platform, cities] = await Promise.all([
    getRegisteredTeacherCount(),
    apiGetSafe<{ teachers?: any[] }>('/teachers/directory?limit=1000', { teachers: [] }, { revalidate: 60 }),
    apiGetSafe<{ jsonld?: any[] }>('/seo/council', { jsonld: [] }, { revalidate: 86400 }),
    apiGetSafe<{ organisations?: number; target_organisations?: number }>('/platform-stats', {}, { revalidate: 300 }),
    getCities(),
  ]);

  // Same gate as the /teachers directory list, so the numbers match what's shown.
  const listed = (Array.isArray(directory.teachers) ? directory.teachers : []).filter(isTeacherActivePublic);

  // Same roster rule as the /council page (members with a /council/{slug} page).
  const org = (Array.isArray(council.jsonld) ? council.jsonld : []).find((o: any) => o?.['@type'] === 'Organization');
  const members: any[] = visibleCouncilMembers(Array.isArray(org?.member) ? org.member : [], await getCouncilGate());
  const councilMembers = members.filter((m) => m?.name && /\/council\/[^/?#"']+/.test(String(m?.url || ''))).length;

  return {
    registeredTeachers: Math.max(registeredTeachers, listed.length),
    publicProfiles: listed.length,
    empanelledTeachers: listed.filter((t) => !!t.is_empanelled).length,
    councilMembers,
    cities: cities.length,
    organisations: num(platform.organisations),
    organisationTarget: num(platform.target_organisations) || 100,
  };
});

export function missionPct(s: PublicStats): number {
  return s.organisationTarget ? Math.min(100, Math.max(0, (s.organisations / s.organisationTarget) * 100)) : 0;
}
