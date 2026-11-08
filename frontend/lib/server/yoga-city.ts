// Server-only data layer for the canonical City Yoga Community pages
// (/yoga-teachers/{city} and /yoga-teachers/{city}/{tradition|purpose}).
//
// This module NEVER re-fetches or reimplements business logic — it COMPOSES the
// existing PII-safe loaders (getCityEcosystem/getCityDirectory in cities.ts,
// which themselves read the one cached public /teachers/directory + public
// retreats + public venues). On top of that it derives:
//   • discovery facets (buildFacets) scoped to the city,
//   • a "Yoga Traditions" list (from teacher styles),
//   • a "Lineages" list (from parampara),
//   • a "Yoga by Purpose" list (Mind/Body/Special-Needs, from yoga-dimensions),
//   • and per-category content thresholds that gate which sub-routes may be
//     INDEXED (≥ INDEX_MIN_TEACHERS) vs merely rendered (noindex) vs 404 (zero).
//
// Categories with ZERO real data are never emitted (no thin/empty pages). There
// is NO gender data and NO locality/area data in the backend today, so those
// filters and locality sub-pages are intentionally not built here (documented
// in the audit). Everything below is grounded only in fields that exist.
import {
  getCityEcosystem,
  getCityDirectory,
  getCities,
  citySlug,
  type CityEcosystem,
  type CityRef,
} from '@/lib/server/cities';
import { buildFacets, type PublicTeacher, type Facets } from '@/lib/teacher';
import { DIMENSIONS, dimensionsOf, type DimensionId } from '@/lib/yoga-dimensions';
import { markAdaptiveVerified } from '@/lib/server/institutional';
import { isPublicHandleBlocked } from '@/lib/public-teacher';
import { titleCase } from '@/lib/format';

/** Minimum public teachers a category/locality must have to become INDEXABLE. */
export const INDEX_MIN_TEACHERS = 3;

/** Slugify a taxonomy value the same way city slugs are built. */
export function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export type TraditionRef = { slug: string; label: string; count: number; indexable: boolean };
export type LineageRef = { slug: string; label: string; count: number; indexable: boolean };
export type LocalityRef = { slug: string; label: string; count: number; indexable: boolean };
export type PurposeRef = {
  id: DimensionId;
  slug: string;
  label: string;
  short: string;
  emoji: string;
  tagline: string;
  count: number;
  indexable: boolean;
};

// DimensionId <-> URL slug. 'special_needs' uses a hyphenated slug.
const PURPOSE_SLUG: Record<DimensionId, string> = { mind: 'mind', body: 'body', special_needs: 'special-needs' };
const SLUG_PURPOSE: Record<string, DimensionId> = { mind: 'mind', body: 'body', 'special-needs': 'special_needs' };

function purposeCounts(teachers: PublicTeacher[]): Record<DimensionId, number> {
  const counts: Record<DimensionId, number> = { mind: 0, body: 0, special_needs: 0 };
  for (const t of teachers) {
    for (const d of dimensionsOf(t)) counts[d] += 1;
  }
  return counts;
}

/** Rolling window (days) used for the city "momentum" (recent joins) banner. */
export const MOMENTUM_DAYS = 90;

export type YogaCity = CityEcosystem & {
  facets: Facets;
  traditions: TraditionRef[];
  lineages: LineageRef[];
  localities: LocalityRef[];
  purposes: PurposeRef[];
  /** Teachers who joined in the last MOMENTUM_DAYS (real created_at only). */
  recentJoins: number;
  momentumDays: number;
};

/**
 * Full City Yoga Community payload. Returns null when the city has no public
 * teachers (page 404s). Every section's data is real; empty sections are
 * rendered as honest empty-states / omitted upstream — never fabricated.
 */
export async function getYogaCity(slug: string): Promise<YogaCity | null> {
  const eco = await getCityEcosystem(slug);
  if (!eco) return null;

  // Defensive: never surface a hard-blocked public handle (city label 'India'
  // is already excluded upstream, but keep this consistent with the profile gate).
  const teachers = await markAdaptiveVerified(eco.teachers.filter((t) => !isPublicHandleBlocked(t.handle)));
  const facets = buildFacets(teachers);

  // Traditions = teaching styles/schools present in the city.
  const styleMap = new Map<string, { label: string; count: number }>();
  for (const t of teachers)
    for (const s of t.styles) {
      const sl = slugify(s);
      if (!sl) continue;
      const cur = styleMap.get(sl);
      if (cur) cur.count += 1;
      else styleMap.set(sl, { label: s, count: 1 });
    }
  const traditions: TraditionRef[] = [...styleMap.entries()]
    .map(([sl, v]) => ({ slug: sl, label: v.label, count: v.count, indexable: v.count >= INDEX_MIN_TEACHERS }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // Lineages = parampara (Guru–Shishya lineage) present in the city — counts
  // every self-declared parampara (not just the primary) for richer coverage.
  const paramMap = new Map<string, { label: string; count: number }>();
  for (const t of teachers) {
    for (const pid of t.paramparas) {
      const sl = slugify(pid);
      if (!sl) continue;
      const cur = paramMap.get(sl);
      if (cur) cur.count += 1;
      else paramMap.set(sl, { label: titleCase(pid), count: 1 });
    }
  }
  const lineages: LineageRef[] = [...paramMap.entries()]
    .map(([sl, v]) => ({ slug: sl, label: v.label, count: v.count, indexable: v.count >= INDEX_MIN_TEACHERS }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // Purposes = Mind / Body / Special-Needs (only those actually represented).
  const pc = purposeCounts(teachers);
  const purposes: PurposeRef[] = DIMENSIONS.map((d) => ({
    id: d.id,
    slug: PURPOSE_SLUG[d.id],
    label: d.label,
    short: d.short,
    emoji: d.emoji,
    tagline: d.tagline,
    count: pc[d.id],
    indexable: pc[d.id] >= INDEX_MIN_TEACHERS,
  })).filter((p) => p.count > 0);

  // Localities = neighbourhood/area within the city (backend location.area).
  // Empty for every teacher today — this activates automatically once profiles
  // start capturing an area, and never renders a thin/empty section meanwhile.
  const localityMap = new Map<string, { label: string; count: number }>();
  for (const t of teachers) {
    if (!t.locality) continue;
    const sl = slugify(t.locality);
    if (!sl) continue;
    const cur = localityMap.get(sl);
    if (cur) cur.count += 1;
    else localityMap.set(sl, { label: t.locality, count: 1 });
  }
  const localities: LocalityRef[] = [...localityMap.entries()]
    .map(([sl, v]) => ({ slug: sl, label: v.label, count: v.count, indexable: v.count >= INDEX_MIN_TEACHERS }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // Momentum — teachers who joined within the rolling window (real created_at).
  const cutoff = Date.now() - MOMENTUM_DAYS * 86_400_000;
  const recentJoins = teachers.filter((t) => t.createdAt && !Number.isNaN(Date.parse(t.createdAt)) && Date.parse(t.createdAt) >= cutoff).length;

  return { ...eco, teachers, facets, traditions, lineages, localities, purposes, recentJoins, momentumDays: MOMENTUM_DAYS };
}

export type YogaCitySegment = {
  citySlug: string;
  cityLabel: string;
  kind: 'tradition' | 'purpose' | 'locality';
  slug: string;
  label: string;
  intro: string;
  teachers: PublicTeacher[];
  count: number;
  /** ≥ INDEX_MIN_TEACHERS ⇒ indexable; below ⇒ rendered but noindex. */
  indexable: boolean;
};

/**
 * Resolve a /{city}/{segment} sub-page. Returns null when the city is unknown
 * OR the segment matches no real category with ≥1 teacher (→ 404). A segment is
 * resolved as a Purpose (mind/body/special-needs) first, else as a Tradition
 * (style) or Lineage (parampara) that shares the slug.
 */
export async function getYogaCitySegment(citySlugParam: string, segment: string): Promise<YogaCitySegment | null> {
  const dir = await getCityDirectory(citySlugParam);
  if (!dir) return null;
  const teachers = dir.teachers.filter((t) => !isPublicHandleBlocked(t.handle));
  const seg = slugify(segment);

  // Purpose?
  const dim = SLUG_PURPOSE[seg];
  if (dim) {
    const matched = await markAdaptiveVerified(teachers.filter((t) => dimensionsOf(t).has(dim)));
    if (matched.length === 0) return null;
    const meta = DIMENSIONS.find((d) => d.id === dim)!;
    return {
      citySlug: dir.slug,
      cityLabel: dir.label,
      kind: 'purpose',
      slug: PURPOSE_SLUG[dim],
      label: meta.label,
      intro: meta.blurb,
      teachers: matched,
      count: matched.length,
      indexable: matched.length >= INDEX_MIN_TEACHERS,
    };
  }

  // Tradition (style) or lineage (any self-declared parampara) sharing this slug.
  const matched = teachers.filter(
    (t) => t.styles.some((s) => slugify(s) === seg) || t.paramparas.some((p) => slugify(p) === seg),
  );
  if (matched.length > 0) {
    const styleLabel = matched.flatMap((t) => t.styles).find((s) => slugify(s) === seg);
    const paramLabel = styleLabel ? undefined : matched.flatMap((t) => t.paramparas).find((p) => slugify(p) === seg);
    const label = styleLabel || (paramLabel ? titleCase(paramLabel) : titleCase(seg));
    return {
      citySlug: dir.slug,
      cityLabel: dir.label,
      kind: 'tradition',
      slug: seg,
      label,
      intro: `Teachers offering ${label} in ${dir.label}, each carrying forward an authentic practice you can book directly.`,
      teachers: matched,
      count: matched.length,
      indexable: matched.length >= INDEX_MIN_TEACHERS,
    };
  }

  // Locality (neighbourhood/area) sharing this slug — active only once profiles
  // capture an area (no such data today, so this branch never matches yet).
  const localMatched = teachers.filter((t) => t.locality && slugify(t.locality) === seg);
  if (localMatched.length > 0) {
    const localLabel = localMatched.map((t) => t.locality!).find((l) => slugify(l) === seg) || titleCase(seg);
    return {
      citySlug: dir.slug,
      cityLabel: dir.label,
      kind: 'locality',
      slug: seg,
      label: localLabel,
      intro: `Yoga teachers in ${localLabel}, ${dir.label} — find and book an authentic teacher close to you.`,
      teachers: localMatched,
      count: localMatched.length,
      indexable: localMatched.length >= INDEX_MIN_TEACHERS,
    };
  }

  return null;
}

/** Every INDEXABLE sub-route across all cities — used for SSG pre-render params. */
export async function getIndexableSegments(): Promise<{ city: string; segment: string }[]> {
  const cities = await getCities().catch(() => [] as CityRef[]);
  const out: { city: string; segment: string }[] = [];
  for (const c of cities) {
    const yc = await getYogaCity(c.slug).catch(() => null);
    if (!yc) continue;
    for (const tr of yc.traditions) if (tr.indexable) out.push({ city: c.slug, segment: tr.slug });
    for (const ln of yc.lineages) if (ln.indexable && !out.some((o) => o.city === c.slug && o.segment === ln.slug)) out.push({ city: c.slug, segment: ln.slug });
    for (const lo of yc.localities) if (lo.indexable && !out.some((o) => o.city === c.slug && o.segment === lo.slug)) out.push({ city: c.slug, segment: lo.slug });
    for (const p of yc.purposes) if (p.indexable) out.push({ city: c.slug, segment: p.slug });
  }
  return out;
}

/**
 * EVERY resolvable sub-route across all cities (any category with ≥1 real
 * teacher — the same condition under which the page returns 200). Used by the
 * sitemap so all genuine city child-pages are advertised for search + GenAI
 * discovery (not just the ≥3-teacher subset).
 */
export async function getAllSegments(): Promise<{ city: string; segment: string }[]> {
  const cities = await getCities().catch(() => [] as CityRef[]);
  const out: { city: string; segment: string }[] = [];
  const seen = new Set<string>();
  const add = (city: string, segment: string) => {
    const k = `${city}/${segment}`;
    if (segment && !seen.has(k)) { seen.add(k); out.push({ city, segment }); }
  };
  for (const c of cities) {
    const yc = await getYogaCity(c.slug).catch(() => null);
    if (!yc) continue;
    for (const tr of yc.traditions) add(c.slug, tr.slug);
    for (const ln of yc.lineages) add(c.slug, ln.slug);
    for (const lo of yc.localities) add(c.slug, lo.slug);
    for (const p of yc.purposes) add(c.slug, p.slug);
  }
  return out;
}

export { citySlug };
