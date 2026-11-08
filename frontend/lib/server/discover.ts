// Server-only data access for the authenticated learner discovery experience.
// Reads the PUBLIC directory endpoint once (no auth required) via the shared
// apiGetSafe fetcher, projects every teacher through the public whitelist so
// private fields never reach the client, derives filter facets from that
// public set (so chip counts always match the visible results), then applies
// all filtering + sorting in-memory. Backend is not modified.
import { apiGetSafe } from '@/lib/api';
import { haversineKm, hasCoords } from '@/lib/geo';
import { mergeOverrides } from '@/lib/server/teacher-status-override';
import {
  buildFacets,
  isPublicTeacher,
  matchesQuery,
  sortTeachers,
  toPublicTeacher,
  type Facets,
  type PublicTeacher,
  type SortKey,
} from '@/lib/teacher';
import { dimensionsOf, scoreTeacher, type DimensionId } from '@/lib/yoga-dimensions';
import { markAdaptiveVerified } from '@/lib/server/institutional';
import { isPublicHandleBlocked } from '@/lib/public-teacher';

export type DiscoverFilters = {
  q?: string;
  city?: string;
  parampara?: string;
  style?: string;
  specialization?: string;
  /** Selected requirement matrices (Mind / Body / Special Needs). Teachers
   *  matching ANY selected matrix are returned; results are then RANKED by how
   *  many selections they match — never hard-excluded for missing some. */
  dims?: DimensionId[];
  /** Optional specific sub-requirements (e.g. 'sleep', 'back') that further
   *  boost ranking without excluding teachers. */
  reqs?: string[];
  /** Show only teachers who offer online sessions. */
  online?: boolean;
  sort?: SortKey;
  /** Learner's "home"/near city — boosts matching teachers to the top of the
   *  Recommended ordering (does not hard-filter). */
  near?: string;
  /** Learner's live coordinates (from "near me"). When present, results are
   *  sorted by REAL distance and each teacher is annotated with distanceKm. */
  lat?: number;
  lng?: number;
};

async function getPublicDirectory(): Promise<PublicTeacher[]> {
  const data = await apiGetSafe<{ teachers?: any[] }>(
    '/teachers/directory?limit=200',
    { teachers: [] },
    { revalidate: 120 },
  );
  const raw = Array.isArray(data?.teachers) ? data.teachers : [];
  // Demo / test handles retired from public view are hidden from signed-in discovery too.
  return markAdaptiveVerified((await mergeOverrides(raw))
    .filter((t) => isPublicTeacher(t) && !isPublicHandleBlocked(t?.handle))
    .map(toPublicTeacher)
    .filter((t): t is PublicTeacher => t !== null));
}

export async function getDiscover(f: DiscoverFilters): Promise<{
  facets: Facets;
  teachers: PublicTeacher[];
  total: number;
  sortedByDistance: boolean;
}> {
  const all = await getPublicDirectory();
  const facets = buildFacets(all);

  let teachers = all;
  if (f.city) teachers = teachers.filter((t) => t.city === f.city);
  if (f.parampara) teachers = teachers.filter((t) => t.parampara === f.parampara);
  if (f.style) teachers = teachers.filter((t) => t.styles.includes(f.style!));
  if (f.specialization) teachers = teachers.filter((t) => t.specializations.includes(f.specialization!));
  // Requirement matrices: keep teachers matching ANY selected matrix (OR).
  if (f.dims && f.dims.length) {
    const dims = f.dims;
    teachers = teachers.filter((t) => {
      const ds = dimensionsOf(t);
      return dims.some((d) => ds.has(d));
    });
  }
  if (f.online) teachers = teachers.filter((t) => t.offersOnline);
  if (f.q) teachers = teachers.filter((t) => matchesQuery(t, f.q!));

  // Distance-first discovery: when the learner shares live coordinates, sort by
  // real great-circle distance and annotate each teacher. Teachers without
  // shared coordinates keep their Recommended order and sink below the located
  // ones (never hidden). Overrides other sorts while active.
  const geo = hasCoords(f.lat, f.lng);
  if (geo) {
    const withCoords: PublicTeacher[] = [];
    const withoutCoords: PublicTeacher[] = [];
    for (const t of sortTeachers(teachers, 'recommended')) {
      if (hasCoords(t.lat, t.lng)) {
        withCoords.push({ ...t, distanceKm: haversineKm(f.lat!, f.lng!, t.lat!, t.lng!) });
      } else {
        withoutCoords.push(t);
      }
    }
    withCoords.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    return { facets, teachers: [...withCoords, ...withoutCoords], total: all.length, sortedByDistance: true };
  }

  let ordered = sortTeachers(teachers, f.sort || 'recommended');
  // "Near me" personalisation: in the default Recommended ordering, float the
  // learner's home-city teachers to the top (stable within each group).
  if (f.near && (!f.sort || f.sort === 'recommended')) {
    const near = f.near;
    ordered = [...ordered.filter((t) => t.city === near), ...ordered.filter((t) => t.city !== near)];
  }

  // Requirement relevance: stable-sort by how many selected matrices +
  // sub-requirements each teacher matches (higher first). Array sort is stable,
  // so teachers with equal relevance keep the ordering established above.
  const dims = f.dims || [];
  const reqs = f.reqs || [];
  if (dims.length || reqs.length) {
    ordered = [...ordered].sort((a, b) => scoreTeacher(b, dims, reqs) - scoreTeacher(a, dims, reqs));
  }

  return { facets, teachers: ordered, total: all.length, sortedByDistance: false };
}
