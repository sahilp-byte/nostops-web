import 'server-only';
import { getPublicDirectory, citySlug } from '@/lib/server/cities';
import { listParamparas } from '@/lib/server/knowledge';
import { slugify } from '@/lib/server/yoga-city';
import { isPublicHandleBlocked } from '@/lib/public-teacher';
import type { PublicTeacher } from '@/lib/teacher';

// Honest tradition ↔ teacher bridge. Matches ONLY on what a teacher
// self-declares (their parampara / teaching styles) against a tradition's
// slug / name, using the same PII-safe public directory the city pages use.
// A self-declared match is never presented as a verified lineage.

export type TraditionTeacher = { handle: string; name: string; city?: string };

// Slug variants so short teacher terms bridge to full tradition names
// (e.g. "Hatha" ↔ "Hatha Yoga", "Iyengar" ↔ "Iyengar Yoga"). Symmetric.
function variants(v: string | undefined | null): string[] {
  const s = slugify(v || '');
  if (!s) return [];
  const stripped = s.replace(/-?yoga$/, '').replace(/^yoga-?/, '');
  return stripped && stripped !== s ? [s, stripped] : [s];
}

function keysFor(...vals: (string | undefined | null)[]): Set<string> {
  const s = new Set<string>();
  for (const v of vals) for (const k of variants(v)) s.add(k);
  return s;
}

function hasMatch(keys: Set<string>, value: string | undefined | null): boolean {
  return variants(value).some((v) => keys.has(v));
}

/** Public teachers who self-declare this tradition (via parampara or style). */
export async function getTraditionTeachers(
  tradition: { slug: string; name?: string; canonicalName?: string },
  limit = 12,
): Promise<{ teachers: TraditionTeacher[]; total: number }> {
  const keys = keysFor(tradition.slug, tradition.name, tradition.canonicalName);
  if (keys.size === 0) return { teachers: [], total: 0 };
  let all: PublicTeacher[] = [];
  try {
    all = await getPublicDirectory();
  } catch {
    return { teachers: [], total: 0 };
  }
  const matched = all.filter(
    (t) =>
      !isPublicHandleBlocked(t.handle) &&
      (t.paramparas.some((p) => hasMatch(keys, p)) || t.styles.some((s) => hasMatch(keys, s))),
  );
  return {
    teachers: matched.slice(0, limit).map((t) => ({ handle: t.handle, name: t.name, city: t.city })),
    total: matched.length,
  };
}

/** Knowledge traditions a teacher's self-declared parampara/styles map onto. */
export async function matchTeacherTraditions(
  teacher: { parampara?: string; paramparas?: string[]; styles?: string[] },
  limit = 4,
): Promise<{ slug: string; name: string }[]> {
  const tk = keysFor(teacher.parampara, ...(teacher.paramparas || []), ...(teacher.styles || []));
  if (tk.size === 0) return [];
  let traditions: Awaited<ReturnType<typeof listParamparas>> = [];
  try {
    traditions = await listParamparas();
  } catch {
    return [];
  }
  const out: { slug: string; name: string }[] = [];
  for (const t of traditions) {
    const name = t.display_name || t.canonical_name || t.slug;
    if (hasMatch(tk, t.slug) || hasMatch(tk, t.canonical_name) || hasMatch(tk, name)) {
      out.push({ slug: t.slug, name });
      if (out.length >= limit) break;
    }
  }
  return out;
}

export type TraditionCityLink = { citySlug: string; cityLabel: string; segment: string; count: number };

/**
 * Cities where this tradition's self-declared teachers practise. Each entry
 * links to the real `/yoga-teachers/{city}/{style}` segment page and is derived
 * from the SAME PII-safe public directory those segment pages use — so every
 * link resolves to a live page (no 404s / thin pages). The segment slug is the
 * EXACT style slug the segment resolver matches on. Honest: a self-declared
 * match is never presented as a verified lineage.
 */
export async function getTraditionCitySegments(
  tradition: { slug: string; name?: string; canonicalName?: string },
): Promise<TraditionCityLink[]> {
  const keys = keysFor(tradition.slug, tradition.name, tradition.canonicalName);
  if (keys.size === 0) return [];
  let all: PublicTeacher[] = [];
  try {
    all = await getPublicDirectory();
  } catch {
    return [];
  }
  // citySlug -> { cityLabel, segmentSlug -> teacher count }
  const byCity = new Map<string, { cityLabel: string; segs: Map<string, number> }>();
  const NON_CITY = new Set(['india', 'online', 'remote', '']);
  for (const t of all) {
    if (isPublicHandleBlocked(t.handle) || !t.city) continue;
    const cslug = citySlug(t.city);
    if (!cslug || NON_CITY.has(cslug)) continue;
    // Every self-declared style/parampara of this teacher that matches the
    // tradition, keyed by the EXACT slug the segment page resolves on.
    const segs = new Set<string>();
    for (const s of t.styles) if (hasMatch(keys, s)) { const sl = slugify(s); if (sl) segs.add(sl); }
    for (const p of t.paramparas) if (hasMatch(keys, p)) { const sl = slugify(p); if (sl) segs.add(sl); }
    if (segs.size === 0) continue;
    let entry = byCity.get(cslug);
    if (!entry) { entry = { cityLabel: t.city, segs: new Map() }; byCity.set(cslug, entry); }
    for (const sl of segs) entry.segs.set(sl, (entry.segs.get(sl) || 0) + 1);
  }
  const out: TraditionCityLink[] = [];
  for (const [cslug, { cityLabel, segs }] of byCity) {
    // Dominant segment slug for this city (most teachers under this tradition).
    let best = ''; let bestCount = 0;
    for (const [sl, c] of segs) if (c > bestCount) { best = sl; bestCount = c; }
    if (!best) continue;
    out.push({ citySlug: cslug, cityLabel, segment: best, count: bestCount });
  }
  return out.sort((a, b) => b.count - a.count || a.cityLabel.localeCompare(b.cityLabel));
}
