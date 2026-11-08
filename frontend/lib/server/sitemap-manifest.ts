// Phase 3: the ONE manifest behind /sitemap.xml. Each indexable route family
// declares its URLs once, from the SAME data source (and the same eligibility
// gate) its pages use, so the sitemap can never list a page that 404s or is
// noindex. No caps below the real count; <lastmod> wherever the data has a real
// last-changed date. Families that fail to load are skipped and REPORTED (see
// buildSitemap) rather than silently dropped.
//
// Claimed provisional listings (/teachers/in/{city}/{slug}) ARE listed — owner rule: claimed = indexable;
// unclaimed provisional pages stay noindex and unlisted.
// Not listed: /venues/submit (indexable), /venues/ai-onboarding (noindex while
// payments are locked), disputed-history Guru records (noindex). Never listed: /app, /participant, /bff,
// token routes, auth pages, noindex pages and redirect stubs.
import { apiGet } from '@/lib/api';
import { canonical } from '@/lib/site';
import { getCities } from '@/lib/server/cities';
import { getAllSegments } from '@/lib/server/yoga-city';
import { getVenues, venuePath, venueCitySlug } from '@/lib/server/venues';
import { getPublicDistrictSlugs, getPublicLocalityIds, getPublicSpaceIds } from '@/lib/server/spaces';
import { getPublicRetreats } from '@/lib/server/retreats';
import { retreatPath, retreatCitySlug } from '@/lib/retreat-url';
import { isTeacherActivePublic } from '@/lib/public-teacher';
import { PARAMPARA_CATALOG } from '@/lib/paramparas-catalog';
import { listGurus, listScriptures, listParamparas, isDebatedGuru } from '@/lib/server/knowledge';
import { getVoicesHub } from '@/lib/server/voices';
import { listPublicIndexableEvents, listProgrammes } from '@/lib/server/institutional';
import { GUIDES } from '@/lib/guides';
import { councilSlugFromUrl, visibleCouncilMembers } from '@/lib/council-visibility';
import { getCouncilGate } from '@/lib/server/council-gate';
import { listClaimedProvisional } from '@/lib/server/discovery';

export type SitemapEntry = { path: string; lastmod?: unknown; changefreq?: string; priority?: string; images?: string[] };
type Family = { id: string; entries: () => Promise<SitemapEntry[]> | SitemapEntry[] };

const e = (path: string, changefreq: string, priority: string, lastmod?: unknown): SitemapEntry => ({ path, changefreq, priority, lastmod });

// Image-sitemap entries for the homepage (social card + the photos the page shows).
const HOME_IMAGES = ['/brand/og-home-v2.jpg', '/brand/home/hero.jpg', '/brand/home/teacher.jpg', '/brand/home/retreat.jpg', '/brand/home/closing.jpg'];

// Always-indexable static pages (route matrix §5 A).
const STATIC: SitemapEntry[] = [
  { ...e('/', 'daily', '1.0'), images: HOME_IMAGES },
  e('/teachers', 'weekly', '0.8'),
  e('/claim', 'weekly', '0.8'),
  e('/become-a-teacher', 'weekly', '0.8'),
  { ...e('/festive-free-kyc', 'weekly', '0.8'), images: ['/brand/festive/og-festive-free-kyc.jpg', '/brand/festive/festive-hero.jpg'] },
  e('/yoga-teachers', 'weekly', '0.7'),
  e('/programmes', 'weekly', '0.8'),
  e('/events', 'daily', '0.7'),
  e('/levels', 'monthly', '0.5'),
  e('/retreats', 'daily', '0.8'),
  e('/retreats/host', 'weekly', '0.7'),
  e('/venues', 'weekly', '0.7'),
  e('/venues/all', 'weekly', '0.6'),
  e('/spaces', 'weekly', '0.7'),
  e('/spaces/12345', 'weekly', '0.7'),
  e('/spaces/community-partners', 'monthly', '0.6'),
  e('/list-your-venue', 'monthly', '0.6'),
  e('/for-organisations', 'monthly', '0.8'),
  e('/for-organisations/companies', 'weekly', '0.7'),
  e('/for-organisations/educational-institutions', 'weekly', '0.7'),
  e('/for-organisations/startup-networking-groups', 'weekly', '0.7'),
  e('/for-organisations/impact', 'weekly', '0.6'),
  e('/for-organisations/resources', 'monthly', '0.6'),
  e('/council', 'monthly', '0.6'),
  e('/council/nominate', 'monthly', '0.4'),
  e('/paramparas', 'weekly', '0.6'),
  e('/yoga-parampara', 'weekly', '0.7'),
  e('/find-your-tradition', 'weekly', '0.6'),
  e('/gurus', 'weekly', '0.6'),
  e('/scriptures', 'weekly', '0.6'),
  e('/voices', 'daily', '0.7'),
  e('/voices/api', 'monthly', '0.4'),
  e('/teacher-pulse', 'weekly', '0.6'),
  e('/about', 'monthly', '0.5'),
  e('/philosophy', 'monthly', '0.5'),
  e('/how-it-works', 'monthly', '0.5'),
  e('/trust', 'monthly', '0.5'),
  e('/faq', 'monthly', '0.5'),
  e('/support', 'monthly', '0.6'),
  e('/contact', 'yearly', '0.4'),
  e('/privacy', 'yearly', '0.3'),
  e('/terms', 'yearly', '0.3'),
  e('/refunds', 'yearly', '0.3'),
];

// Every publicly listable teacher profile — the SAME gate the profile page uses
// (directory + isTeacherActivePublic), so a listed URL never 404s.
async function teacherEntries(): Promise<SitemapEntry[]> {
  const d = await apiGet<{ teachers?: any[] }>('/teachers/directory?limit=1000', { revalidate: 3600 });
  const raw = Array.isArray(d?.teachers) ? d.teachers : [];
  return raw.filter(isTeacherActivePublic).map((t) => e(`/teachers/${String(t.handle)}`, 'weekly', '0.7', t.updated_at));
}

// City Yoga Community + teacher-recruitment pages, and every resolvable segment.
async function cityEntries(): Promise<SitemapEntry[]> {
  const cities = await getCities();
  const out = cities.flatMap((c) => [e(`/yoga-teachers/${c.slug}`, 'weekly', '0.7'), e(`/become-a-teacher/${c.slug}`, 'monthly', '0.6')]);
  for (const s of await getAllSegments()) out.push(e(`/yoga-teachers/${s.city}/${s.segment}`, 'weekly', '0.5'));
  return out;
}

// Every public venue (remote partners + admin-published local) + one hub per city.
async function venueEntries(): Promise<SitemapEntry[]> {
  const venues = await getVenues({ limit: 100 }); // 100 = the partner API's maximum page size
  const out = venues.map((v) => e(venuePath(v), 'weekly', '0.6', v.updatedAt));
  const cities = new Set(venues.map(venueCitySlug).filter(Boolean));
  for (const c of cities) out.push(e(`/venues/in/${c}`, 'weekly', '0.6'));
  return out;
}

// Every public retreat at its canonical city-nested URL + each city hub.
async function retreatEntries(): Promise<SitemapEntry[]> {
  const { retreats, error } = await getPublicRetreats();
  if (error) throw new Error('retreat directory unavailable');
  const out: SitemapEntry[] = [];
  const cities = new Set<string>();
  for (const r of retreats) {
    const c = retreatCitySlug(r.city);
    if (!cities.has(c)) { cities.add(c); out.push(e(`/retreats/in/${c}`, 'weekly', '0.6')); }
    out.push(e(retreatPath(r), 'weekly', '0.7', r.updatedAt));
  }
  return out;
}

// Only indexable PUBLIC events from verified organisations (the backend filters).
async function eventEntries(): Promise<SitemapEntry[]> {
  return (await listPublicIndexableEvents()).map((ev) => e(`/events/${ev.slug}`, 'weekly', '0.7', ev.updated_at));
}

// Council member profiles — same /seo/council feed the council pages use.
async function councilEntries(): Promise<SitemapEntry[]> {
  const data = await apiGet<{ jsonld?: any[] }>('/seo/council', { revalidate: 86400 });
  const org = Array.isArray(data?.jsonld) ? data.jsonld.find((o) => o?.['@type'] === 'Organization') : null;
  const members: any[] = visibleCouncilMembers(Array.isArray(org?.member) ? org.member : [], await getCouncilGate());
  return members
    .map((m) => councilSlugFromUrl(m?.url))
    .filter((s): s is string => !!s)
    .map((slug) => e(`/council/${slug}`, 'monthly', '0.5'));
}

// Parampara pages: the backend list + the static classical-lineage catalogue.
async function paramparaEntries(): Promise<SitemapEntry[]> {
  const d = await apiGet<{ paramparas?: { slug?: string }[] }>('/seo/paramparas', { revalidate: 86400 });
  const slugs = new Set<string>((d?.paramparas || []).map((p) => p.slug || '').filter(Boolean));
  for (const p of PARAMPARA_CATALOG) slugs.add(p.slug);
  return [...slugs].map((s) => e(`/paramparas/${s}`, 'monthly', '0.5'));
}

const FAMILIES: Family[] = [
  { id: 'static', entries: () => STATIC },
  { id: 'guides', entries: () => GUIDES.map((g) => e(`/guides/${g.slug}`, 'monthly', '0.6', g.updated)).concat(e('/guides', 'weekly', '0.6')) },
  { id: 'teachers', entries: teacherEntries },
  { id: 'claimed-listings', entries: async () => (await listClaimedProvisional()).map((c) => e(`/teachers/in/${c.city_slug}/${c.teacher_slug}`, 'weekly', '0.5', c.claimed_at)) },
  { id: 'cities', entries: cityEntries },
  { id: 'venues', entries: venueEntries },
  // NOSTOPS Spaces: approved public Spaces only (ids + dates; no names, owners or locations in the feed).
  { id: 'spaces', entries: async () => (await getPublicSpaceIds()).map((s) => e(`/spaces/${encodeURIComponent(s.id)}`, 'weekly', '0.5', s.updated_at)) },
  // District pages: only districts with at least one ACTIVE locality.
  { id: 'spaces-districts', entries: async () => (await getPublicDistrictSlugs()).map(([s, d]) => e(`/spaces/district/${s}/${d}`, 'weekly', '0.6')) },
  // Locality pages: only localities whose coverage status is ACTIVE (others are reachable but noindex).
  { id: 'spaces-localities', entries: async () => (await getPublicLocalityIds()).filter((l) => l.active).map((l) => e(`/spaces/locality/${encodeURIComponent(l.locality_id)}`, 'weekly', '0.6', l.updated_at)) },
  { id: 'retreats', entries: retreatEntries },
  { id: 'events', entries: eventEntries },
  { id: 'council', entries: councilEntries },
  { id: 'paramparas', entries: paramparaEntries },
  { id: 'traditions', entries: async () => (await listParamparas()).map((p) => e(`/yoga-parampara/${p.slug}`, 'monthly', '0.5')) },
  { id: 'gurus', entries: async () => (await listGurus()).filter((g) => !isDebatedGuru(g)).map((g) => e(`/gurus/${g.slug}`, 'monthly', '0.5')) },
  { id: 'scriptures', entries: async () => (await listScriptures()).map((s) => e(`/scriptures/${s.slug}`, 'monthly', '0.5')) },
  { id: 'programmes', entries: async () => {
    const cat = await listProgrammes();
    if (!cat) throw new Error('programme catalogue unavailable');
    return cat.programmes.map((p) => e(`/programmes/${p.slug}`, 'monthly', '0.6'));
  } },
  { id: 'voices', entries: async () => (await getVoicesHub()).map((a) => e(`/voices/${a.slug}`, 'weekly', '0.6', a.published_at)) },
];

/** W3C date (YYYY-MM-DD) from epoch s/ms or an ISO string; undefined when absent, invalid or in the future. */
export function toLastmod(v: unknown): string | undefined {
  let ms: number;
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) ms = v < 1e12 ? v * 1000 : v;
  else if (typeof v === 'string' && v.trim()) ms = Date.parse(v);
  else return undefined;
  if (!Number.isFinite(ms) || ms > Date.now() + 86_400_000) return undefined;
  return new Date(ms).toISOString().slice(0, 10);
}

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Build the sitemap XML from the manifest. `skipped` lists families that failed to load. */
export async function buildSitemap(): Promise<{ xml: string; skipped: string[]; counts: Record<string, number> }> {
  const results = await Promise.all(
    FAMILIES.map(async (f) => {
      try {
        return { id: f.id, entries: await f.entries(), ok: true };
      } catch (err) {
        console.error(`[sitemap] family "${f.id}" skipped:`, (err as Error)?.message || err);
        return { id: f.id, entries: [] as SitemapEntry[], ok: false };
      }
    }),
  );
  const seen = new Set<string>();
  const counts: Record<string, number> = {};
  const urls: string[] = [];
  for (const r of results) {
    counts[r.id] = 0;
    for (const en of r.entries) {
      const loc = canonical(en.path);
      if (seen.has(loc)) continue;
      seen.add(loc);
      counts[r.id] += 1;
      const lastmod = toLastmod(en.lastmod);
      const images = (en.images || []).map((src) => `<image:image><image:loc>${xmlEscape(canonical(src))}</image:loc></image:image>`).join('');
      urls.push(
        `<url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}` +
          `${en.changefreq ? `<changefreq>${en.changefreq}</changefreq>` : ''}${en.priority ? `<priority>${en.priority}</priority>` : ''}${images}</url>`,
      );
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls.join('')}</urlset>\n`;
  return { xml, skipped: results.filter((r) => !r.ok).map((r) => r.id), counts };
}
