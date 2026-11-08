// Server-only helpers for city SEO pages. Cities are derived from the SAME public
// teacher directory the /teachers page uses (fetch-cache deduped), and every
// teacher crosses through the PII-safe toPublicTeacher() whitelist. No new
// business logic — just city grouping for local-search landing pages.
import { apiGetSafe } from '@/lib/api';
import { toPublicTeacher, isPublicTeacher, sortTeachers, type PublicTeacher } from '@/lib/teacher';
import { isPublicHandleBlocked } from '@/lib/public-teacher';
import { mergeOverrides } from '@/lib/server/teacher-status-override';
import { haversineKm, hasCoords } from '@/lib/geo';
import { titleCase } from '@/lib/format';
import { getPublicRetreats, type PublicRetreat } from '@/lib/server/retreats';
import { getVenues, type PublicVenue } from '@/lib/server/venues';
import { TEACHER_SHARE_SENTENCE, TEACHER_SHARE_OTHER_WORK } from '@/lib/org/pricing';

// Country/aggregate buckets that are not real cities.
const NON_CITY = new Set(['india', 'online', '', 'remote']);

export function citySlug(city: string): string {
  return city.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function getPublicDirectory(): Promise<PublicTeacher[]> {
  const data = await apiGetSafe<{ teachers?: any[] }>('/teachers/directory', { teachers: [] }, { revalidate: 60 });
  return (await mergeOverrides(Array.isArray(data.teachers) ? data.teachers : []))
    .filter((t) => isPublicTeacher(t) && !isPublicHandleBlocked(t?.handle))
    .map(toPublicTeacher)
    .filter((t): t is PublicTeacher => t !== null);
}

/** Public directory keyed by BOTH the public handle and the internal
 *  teacher_id, so other data sources (e.g. the knowledge graph) can link a
 *  teacher by handle — and skip anyone not publicly listed. */
export async function getPublicTeacherIndex(): Promise<Map<string, PublicTeacher>> {
  const data = await apiGetSafe<{ teachers?: any[] }>('/teachers/directory', { teachers: [] }, { revalidate: 60 });
  const map = new Map<string, PublicTeacher>();
  for (const raw of await mergeOverrides(Array.isArray(data.teachers) ? data.teachers : [])) {
    if (!isPublicTeacher(raw) || isPublicHandleBlocked(raw?.handle)) continue;
    const t = toPublicTeacher(raw);
    if (!t) continue;
    map.set(t.handle, t);
    if (raw?.teacher_id) map.set(String(raw.teacher_id), t);
  }
  return map;
}

export type CityRef = { slug: string; label: string; count: number };

/** Distinct cities (with public-teacher counts) that have at least one teacher. */
export async function getCities(): Promise<CityRef[]> {
  const teachers = await getPublicDirectory();
  const map = new Map<string, { label: string; count: number }>();
  for (const t of teachers) {
    const city = (t.city || '').trim();
    if (!city || NON_CITY.has(city.toLowerCase())) continue;
    const slug = citySlug(city);
    const cur = map.get(slug);
    if (cur) cur.count += 1;
    else map.set(slug, { label: city, count: 1 });
  }
  return [...map.entries()]
    .map(([slug, v]) => ({ slug, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export type CityDirectory = {
  label: string;
  slug: string;
  teachers: PublicTeacher[];
  styles: { id: string; count: number }[];
  paramparas: { id: string; count: number }[];
  count: number;
} | null;

/** Public teachers for a city slug, or null if the city has no public teachers. */
export async function getCityDirectory(slug: string): Promise<CityDirectory> {
  const all = await getPublicDirectory();
  const inCity = all.filter((t) => t.city && citySlug(t.city) === slug);
  if (inCity.length === 0) return null;
  const label = inCity[0].city as string;
  const teachers = sortTeachers(inCity, 'recommended');

  const tally = (rows: string[]) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r) m.set(r, (m.get(r) || 0) + 1);
    return [...m.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
  };
  return {
    label,
    slug,
    teachers,
    styles: tally(teachers.flatMap((t) => t.styles)).slice(0, 12),
    paramparas: tally(teachers.flatMap((t) => t.paramparas)).slice(0, 8),
    count: teachers.length,
  };
}

/** Lightweight city summary for the become-a-teacher/[city] page. */
export async function getCitySummary(slug: string): Promise<{ label: string; count: number } | null> {
  const cities = await getCities();
  return cities.find((c) => c.slug === slug) ?? null;
}

export type CityStage = 'emerging' | 'growing' | 'active' | 'mature';

export type CityEcosystem = {
  label: string;
  slug: string;
  stage: CityStage;
  teachers: PublicTeacher[];
  teacherCount: number;
  empanelledCount: number;
  verifiedCount: number;
  acceptingCount: number;
  styles: { id: string; count: number }[];
  paramparas: { id: string; count: number }[];
  traditionCount: number;
  retreats: PublicRetreat[];
  retreatCount: number;
  nearbyRetreats: PublicRetreat[];
  venues: PublicVenue[];
  venueCount: number;
  nearbyCities: CityRef[];
};

function stageFor(teacherCount: number, retreatCount: number, venueCount: number): CityStage {
  if (teacherCount >= 8 && retreatCount > 0 && venueCount > 0) return 'mature';
  if (retreatCount > 0 || venueCount > 0) return 'active';
  if (teacherCount >= 3) return 'growing';
  return 'emerging';
}

/**
 * ONE aggregated, PII-safe read for the city "local yoga ecosystem" landing.
 * Every source is an EXISTING cached loader (public directory, public retreats,
 * public venues, city index) — fanned out in parallel, no new backend calls or
 * business logic. Returns null when the city has no public teachers (the page
 * 404s). Counts are always real; sections with zero data render as empty-states
 * upstream — never fabricated.
 */
export async function getCityEcosystem(slug: string): Promise<CityEcosystem | null> {
  const [dir, retreatsRes, allVenues, allCities] = await Promise.all([
    getCityDirectory(slug),
    getPublicRetreats().catch(() => ({ retreats: [] as PublicRetreat[], error: true })),
    getVenues({ limit: 100 }).catch(() => [] as PublicVenue[]),
    getCities().catch(() => [] as CityRef[]),
  ]);
  if (!dir) return null;
  const { label, teachers } = dir;

  // Distinct traditions represented (styles + paramparas), computed from the
  // full teacher list rather than the capped display arrays.
  const styleSet = new Set<string>();
  for (const t of teachers) for (const s of t.styles) if (s) styleSet.add(s.toLowerCase());
  const paramSet = new Set<string>();
  for (const t of teachers) for (const p of t.paramparas) if (p) paramSet.add(p.toLowerCase());
  const traditionCount = new Set<string>([...styleSet, ...paramSet]).size;

  const empanelledCount = teachers.filter((t) => t.isEmpanelled).length;
  const verifiedCount = teachers.filter((t) => t.isVerified).length;
  const acceptingCount = teachers.filter((t) => t.offersPrivate || t.offersGroup || t.offersOnline || t.offersCorporate).length;

  // Retreats in this city — upcoming/open first, sold-out and past last.
  const today = new Date().toISOString().slice(0, 10);
  const statusRank: Record<string, number> = { filling: 0, published: 1, sold_out: 2 };
  const cityRetreats = retreatsRes.retreats
    .filter((r) => r.city && citySlug(r.city) === slug)
    .sort((a, b) => {
      const aPast = !!a.startDate && a.startDate < today;
      const bPast = !!b.startDate && b.startDate < today;
      if (aPast !== bPast) return aPast ? 1 : -1;
      const sr = (statusRank[a.status] ?? 3) - (statusRank[b.status] ?? 3);
      if (sr) return sr;
      return (a.startDate || '9999').localeCompare(b.startDate || '9999');
    });

  const cityVenues = allVenues.filter((v) => v.city && citySlug(v.city) === slug);
  const nearbyCities = allCities.filter((c) => c.slug !== slug).slice(0, 6);

  // "Nearby retreats" — so a quiet city still shows timely experiences close by.
  // Anchor the city on its teacher centroid (falls back to its own retreats'
  // coords), then rank public retreats in OTHER cities by real distance from
  // that anchor, keeping only those within ~250 km. Retreats carry venue_lat/
  // venue_lng, so distances are authoritative regardless of the city label.
  const NEARBY_RADIUS_KM = 250;
  const centroid = (pts: { lat?: number; lng?: number }[]): [number, number] | null => {
    const c = pts.filter((p) => hasCoords(p.lat, p.lng));
    if (!c.length) return null;
    return [c.reduce((s, p) => s + p.lat!, 0) / c.length, c.reduce((s, p) => s + p.lng!, 0) / c.length];
  };
  const anchor = centroid(teachers) || centroid(cityRetreats);
  let nearbyRetreats: PublicRetreat[] = [];
  if (anchor) {
    const [aLat, aLng] = anchor;
    nearbyRetreats = retreatsRes.retreats
      .filter((r) => r.city && citySlug(r.city) !== slug && hasCoords(r.lat, r.lng))
      .map((r) => ({ ...r, distanceKm: haversineKm(aLat, aLng, r.lat!, r.lng!) }))
      .filter((r) => (r.distanceKm as number) <= NEARBY_RADIUS_KM)
      .sort((a, b) => {
        const aPast = !!a.startDate && a.startDate < today;
        const bPast = !!b.startDate && b.startDate < today;
        if (aPast !== bPast) return aPast ? 1 : -1;
        return (a.distanceKm as number) - (b.distanceKm as number);
      })
      .slice(0, 4);
  }

  return {
    label,
    slug,
    stage: stageFor(dir.count, cityRetreats.length, cityVenues.length),
    teachers,
    teacherCount: dir.count,
    empanelledCount,
    verifiedCount,
    acceptingCount,
    styles: dir.styles,
    paramparas: dir.paramparas,
    traditionCount,
    retreats: cityRetreats,
    retreatCount: cityRetreats.length,
    nearbyRetreats,
    venues: cityVenues,
    venueCount: cityVenues.length,
    nearbyCities,
  };
}

// ─── City FAQ builders ───────────────────────────────────────────────────────
// Search-friendly, VERIFIED-FACTS FAQs grounded ONLY in real data already shown
// on the page (counts, styles, paramparas) + fixed NOSTOPS brand facts (the
// 70/80/85 teacher-first split, InstaKYC + Council empanelment, free
// registration). No fabricated numbers. Rendered on-page AND as FAQPage JSON-LD.
export type CityFaq = { q: string; a: string };

function listPhrase(items: string[], max = 5): string {
  const xs = items.filter(Boolean).slice(0, max);
  if (xs.length === 0) return '';
  if (xs.length === 1) return xs[0];
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

/** Seeker-facing FAQ for /yoga-teachers/{slug} ("Yoga teachers in {City}"). */
export function cityDirectoryFaqs(d: Pick<NonNullable<CityDirectory>, 'label' | 'count' | 'styles' | 'paramparas'>): CityFaq[] {
  const { label, count } = d;
  const styles = listPhrase(d.styles.map((s) => titleCase(s.id)));
  const paramparas = listPhrase(d.paramparas.map((p) => titleCase(p.id)));
  return [
    count > 0 ? { q: `How many yoga teachers are on NOSTOPS in ${label}?`, a: `There ${count === 1 ? 'is' : 'are'} ${count} verified yoga ${count === 1 ? 'teacher' : 'teachers'} in ${label} on NOSTOPS, each carrying forward an authentic lineage.` } : null,
    styles ? { q: `What styles of yoga can I find in ${label}?`, a: `Teachers in ${label} offer ${styles}, among other styles.` } : null,
    { q: `How do I book a yoga teacher in ${label}?`, a: `Open any teacher’s profile and book a private, group, online or corporate session directly with the teacher — pricing is shown on each profile.` },
    { q: `Are NOSTOPS yoga teachers in ${label} verified?`, a: 'Teachers can complete InstaKYC verification and be empanelled by the Council of Gurus; verified and empanelled badges appear on their profiles.' },
    paramparas ? { q: `Which yoga traditions (paramparas) are represented in ${label}?`, a: `Lineages carried forward in ${label} include ${paramparas}.` } : null,
    { q: 'Is it free to find a yoga teacher on NOSTOPS?', a: `Yes — discovering and browsing teachers in ${label} is free. Each teacher sets their own pricing, shown on their profile.` },
    { q: `I teach yoga in ${label} — can I join NOSTOPS?`, a: `Yes. Registration is free: create a teacher profile and get discovered by seekers across ${label}.` },
  ].filter((x): x is CityFaq => x !== null);
}

/** Teacher-recruitment FAQ for /become-a-teacher/{slug}. */
export function cityEcosystemFaqs(eco: CityEcosystem): CityFaq[] {
  const { label, teacherCount, venueCount, traditionCount } = eco;
  const traditions = listPhrase([...eco.paramparas, ...eco.styles].map((s) => titleCase(s.id)));
  return [
    { q: `How do I become a yoga teacher on NOSTOPS in ${label}?`, a: `Register for free, complete your profile, verify with InstaKYC and get empanelled by the Council of Gurus — then seekers in ${label} can find and book you.` },
    { q: `Is it free to join as a yoga teacher in ${label}?`, a: `Yes, registration is free. NOSTOPS is a teacher-first cooperative. ${TEACHER_SHARE_SENTENCE}` },
    { q: 'How much do NOSTOPS yoga teachers keep?', a: `${TEACHER_SHARE_SENTENCE} ${TEACHER_SHARE_OTHER_WORK}` },
    teacherCount > 0 ? { q: `How many yoga teachers are already on NOSTOPS in ${label}?`, a: `${teacherCount} yoga ${teacherCount === 1 ? 'teacher is' : 'teachers are'} already carrying the tradition forward in ${label}${traditionCount > 0 ? ` across ${traditionCount} ${traditionCount === 1 ? 'tradition' : 'traditions'} and styles` : ''}.` } : null,
    { q: `Can I host retreats or corporate sessions in ${label}?`, a: `Yes. Eligible teachers can host retreats${venueCount > 0 ? ` at NOSTOPS venues in ${label}` : ''}, and corporate & group programmes are routed to NOSTOPS teachers — brought to you, not chased by you.` },
    { q: 'What is Council empanelment?', a: 'Empanelment is verification by the Council of Gurus that honours your lineage and gives seekers a trusted badge on your profile.' },
    traditions ? { q: `Which yoga traditions are represented in ${label}?`, a: `Lineages and styles carried forward in ${label} include ${traditions}.` } : null,
  ].filter((x): x is CityFaq => x !== null);
}

export type RecentJoin = { name: string; city?: string };

/** Most recently onboarded public teachers (name + city only) — powers the
 *  homepage "just joined" live ticker. Reads the SAME cached public directory
 *  (no extra backend load) and sorts by created_at desc. PII-safe: name/city
 *  are already public in the directory. */
export async function getRecentJoins(limit = 12): Promise<RecentJoin[]> {
  const data = await apiGetSafe<{ teachers?: any[] }>('/teachers/directory', { teachers: [] }, { revalidate: 60 });
  const raw = Array.isArray(data.teachers) ? data.teachers : [];
  return raw
    .filter((t) => isPublicTeacher(t) && !isPublicHandleBlocked(t?.handle))
    .filter((t) => typeof t?.name === 'string' && t.name.trim())
    .sort((a, b) => String(b?.created_at || '').localeCompare(String(a?.created_at || '')))
    .slice(0, limit)
    .map((t) => ({ name: String(t.name).trim(), city: t?.city ? String(t.city) : undefined }));
}
