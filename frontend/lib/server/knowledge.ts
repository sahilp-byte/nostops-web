// Server-only reader for the Yogic Paramparā Knowledge Graph.
//
// The graph is served by the ISOLATED local FastAPI module (`/api/knowledge/*`)
// backed by the local Mongo (kg_* collections). It is a NOSTOPS-owned, additive
// layer — it never touches the remote business backend. GET reads are open
// (non-PII); admin actions carry the internal shared secret + an admin identity
// (same defense-in-depth model as Teacher Pulse).
import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';

const KG_BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const TIMEOUT_MS = 8000;

export type Classification =
  | 'Source Tradition' | 'Darśana' | 'Sampradāya' | 'Historical Paramparā'
  | 'Yogic Practice Tradition' | 'Modern Teacher Lineage' | 'Modern Methodology'
  | 'Modern Institution' | 'Related Contemplative Tradition';

export type ParamparaNode = {
  id: string; slug: string; canonical_name: string; display_name: string;
  classification: Classification; origin_period?: string; geographical_root?: string;
  historical_status?: string; verification_status: string; confidence_level?: string;
  parent_id?: string | null; sampradaya_id?: string | null; darshana_id?: string | null;
  civilizational_root_id?: string | null; description?: string; contemporary_description?: string;
  evidence_summary?: string; source_ids?: string[];
};
export type Ref = { id: string; slug?: string; canonical_name?: string; display_name?: string; name?: string; website?: string; classification?: string; verification_status?: string; role?: string; confidence_level?: string };
export type Source = { id: string; title: string; author?: string; year?: number; kind?: string };
export type ParamparaDetail = {
  parampara: ParamparaNode;
  parent?: Ref | null; sampradaya?: Ref | null; darshana?: Ref | null; civilizational_root?: Ref | null;
  gurus: Ref[]; scriptures: Ref[]; practices: Ref[]; methodologies: Ref[];
  institutions: Ref[]; sources: Source[];
};
export type TeacherAffiliation = {
  teacher_id: string; relationship_type: string; verification_status: string;
  city_id?: string | null; guru_id?: string | null; guru_name?: string | null;
  training_institution?: string | null; years_of_training?: number | null; certification?: string | null;
  practices_taught?: string[]; scriptures_studied?: string[]; parampara?: Ref;
};

// ── Historical vs modern presentation helper (drives the visible distinction) ──
const MODERN = new Set<Classification>(['Modern Teacher Lineage', 'Modern Methodology', 'Modern Institution']);
export function isModern(c?: string): boolean { return MODERN.has(c as Classification); }
export function traditionKindLabel(c?: string): string {
  if (isModern(c)) return 'Modern teaching tradition';
  if (c === 'Related Contemplative Tradition') return 'Related contemplative tradition';
  return 'Historical tradition';
}

// Public-facing verification-state label (never asserts an unsupported claim).
export function affiliationLabel(state?: string): string {
  switch (state) {
    case 'Verified': return 'Verified';
    case 'Institutionally verified': return 'Institutionally verified';
    case 'Historically documented': return 'Historical association';
    case 'Methodological association': return 'Methodological association';
    case 'Influenced by': return 'Influenced by';
    case 'Teacher-declared': return 'Teacher-declared';
    default: return 'Teacher-declared';
  }
}
export function isAffiliationVerified(state?: string): boolean {
  return state === 'Verified' || state === 'Institutionally verified' || state === 'Historically documented';
}

async function kgGet<T>(path: string, fallback: T, revalidate = 60): Promise<T> {
  // One retry before falling back — a transient blip must never poison the ISR
  // cache with an empty payload (which stale-while-revalidate would then serve
  // for a very long time). Callers that must never render empty additionally
  // throw at the page level (see the gurus/scriptures hubs).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${KG_BASE}/api/knowledge${path}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate },
      });
      if (!res.ok) {
        if (attempt === 0) continue;
        return fallback;
      }
      return (await res.json()) as T;
    } catch {
      if (attempt === 0) continue;
      return fallback;
    }
  }
  return fallback;
}

export async function listParamparas(): Promise<ParamparaNode[]> {
  const d = await kgGet<{ paramparas?: ParamparaNode[] }>(`/paramparas?limit=1000`, {});
  return Array.isArray(d.paramparas) ? d.paramparas : [];
}
export async function getParampara(slug: string): Promise<ParamparaDetail | null> {
  const d = await kgGet<ParamparaDetail | null>(`/paramparas/${encodeURIComponent(slug)}`, null);
  if (!d || !(d as any).parampara) return null;
  // Normalise optional arrays so every consumer is crash-safe regardless of the
  // backend's response shape (older deployments may omit empty collections).
  d.gurus = Array.isArray(d.gurus) ? d.gurus : [];
  d.scriptures = Array.isArray(d.scriptures) ? d.scriptures : [];
  d.practices = Array.isArray(d.practices) ? d.practices : [];
  d.methodologies = Array.isArray(d.methodologies) ? d.methodologies : [];
  d.institutions = Array.isArray(d.institutions) ? d.institutions : [];
  d.sources = Array.isArray(d.sources) ? d.sources : [];
  return d;
}
export async function getParamparaTeachers(slug: string): Promise<TeacherAffiliation[]> {
  const d = await kgGet<{ teachers?: TeacherAffiliation[] }>(`/paramparas/${encodeURIComponent(slug)}/teachers`, {});
  return Array.isArray(d.teachers) ? d.teachers : [];
}
export async function getParamparaCities(slug: string): Promise<{ city_id: string; teacher_count?: number; availability_status?: string }[]> {
  const d = await kgGet<{ cities?: any[] }>(`/paramparas/${encodeURIComponent(slug)}/cities`, {});
  return Array.isArray(d.cities) ? d.cities : [];
}
export type CityTradition = { id: string; slug: string; display_name?: string; canonical_name?: string; classification?: string; teacher_count?: number };
export async function getCityParamparas(cityId: string): Promise<CityTradition[]> {
  const d = await kgGet<{ paramparas?: CityTradition[] }>(`/cities/${encodeURIComponent(cityId)}/paramparas`, {}, 300);
  const rows = Array.isArray(d.paramparas) ? d.paramparas : [];
  return rows.filter((r) => (r.teacher_count || 0) > 0).sort((a, b) => (b.teacher_count || 0) - (a.teacher_count || 0));
}
export async function getTeacherAffiliations(teacherId: string): Promise<{ affiliations: TeacherAffiliation[] }> {
  return kgGet<{ affiliations: TeacherAffiliation[] }>(`/teachers/${encodeURIComponent(teacherId)}/paramparas`, { affiliations: [] }, 120);
}

export type DiscoveryDimension = { key: string; label: string };
export type DiscoveryTradition = { id: string; slug: string; display_name: string; classification: string; description?: string; verification_status: string; teacher_count: number };
export type DiscoveryResult = { dimension: string; label: string; by_city?: boolean; traditions: DiscoveryTradition[]; practices: { id: string; name: string; category?: string }[]; cities: { city_id: string; teacher_count: number }[] };
export async function getDiscoveryDimensions(): Promise<DiscoveryDimension[]> {
  const d = await kgGet<{ dimensions?: DiscoveryDimension[] }>(`/discovery/dimensions`, {}, 3600);
  return Array.isArray(d.dimensions) ? d.dimensions : [];
}
export async function getDiscovery(dimension: string): Promise<DiscoveryResult | null> {
  const d = await kgGet<DiscoveryResult | null>(`/discovery?dimension=${encodeURIComponent(dimension)}`, null, 300);
  return d && (d as any).dimension ? d : null;
}

// Map a city-page tradition segment slug/label → a Knowledge-Graph parampara
// slug, so combination pages (e.g. /yoga-teachers/mumbai/iyengar) can link to
// the richer tradition page (/yoga-parampara/iyengar-yoga).
const SEGMENT_TO_KG: Record<string, string> = {
  iyengar: 'iyengar-yoga', 'iyengar-yoga': 'iyengar-yoga',
  hatha: 'hatha-yoga', 'hatha-yoga': 'hatha-yoga',
  ashtanga: 'ashtanga-vinyasa', 'ashtanga-yoga': 'ashtanga-vinyasa', 'ashtanga-vinyasa': 'ashtanga-vinyasa',
  vinyasa: 'ashtanga-vinyasa',
  viniyoga: 'viniyoga',
  sivananda: 'sivananda-yoga', 'sivananda-yoga': 'sivananda-yoga',
  satyananda: 'satyananda-yoga', 'bihar-yoga': 'satyananda-yoga',
  kundalini: 'kundalini-yoga-classical', 'kundalini-kriya': 'kundalini-yoga-classical', 'kundalini-yoga': 'kundalini-yoga-classical',
  kriya: 'kriya-yoga-yogananda', 'kriya-yoga': 'kriya-yoga-yogananda',
  raja: 'raja-yoga', 'raja-yoga': 'raja-yoga',
  jnana: 'jnana-yoga', 'jnana-yoga': 'jnana-yoga', bhakti: 'bhakti-yoga', 'bhakti-yoga': 'bhakti-yoga',
  karma: 'karma-yoga', 'karma-yoga': 'karma-yoga', mantra: 'mantra-yoga', 'mantra-yoga': 'mantra-yoga',
  nada: 'nada-yoga', 'nada-yoga': 'nada-yoga', meditation: 'dhyana-yoga',
  'transcendental-meditation': 'transcendental-meditation', vipassana: 'vipassana-goenka',
  isha: 'isha-yoga', 'art-of-living': 'art-of-living',
};
export function resolveTraditionKgSlug(slugOrLabel?: string): string | null {
  if (!slugOrLabel) return null;
  return SEGMENT_TO_KG[slugOrLabel.trim().toLowerCase()] ?? null;
}

// Authoritative indexable-slug set (computed server-side with the same rule as
// isIndexable). Using this as the SINGLE source of truth for BOTH the sitemap
// and each detail page's robots tag guarantees they can never disagree.
export async function getIndexableSlugs(): Promise<string[]> {
  const d = await kgGet<{ slugs?: string[] }>(`/indexable-slugs`, {}, 600);
  return Array.isArray(d.slugs) ? d.slugs : [];
}

/**
 * Indexability gate. A Paramparā page is INDEXABLE only when it has sufficient
 * authoritative content (strong verification + real body/relationships) AND/OR
 * meaningful teacher inventory. Thin or "Requires Scholarly Verification" nodes
 * are rendered but noindex (never a thin indexable page).
 */
export function isIndexable(d: ParamparaDetail, teacherCount = 0): boolean {
  const v = d.parampara.verification_status;
  const strong = v === 'Verified' || v === 'Historically Documented';
  const bodyLen = (d.parampara.description || '').length + (d.parampara.contemporary_description || '').length;
  const graphCount = d.gurus.length + d.scriptures.length + d.practices.length + d.methodologies.length;
  // Raised threshold (accuracy & humility over completeness): a page indexes
  // ONLY when it is authoritative AND genuinely substantial — strong
  // verification with a rich body + well-connected graph, OR real teacher
  // inventory, OR a long-form essay. Concise stubs stay noindex + navigable.
  return (
    (strong && bodyLen >= 160 && graphCount >= 3) ||
    (strong && bodyLen >= 90 && graphCount >= 4) ||
    (bodyLen >= 90 && teacherCount >= 3) ||
    (strong && bodyLen >= 320)
  );
}

// ── Gurus (Ācāryas) ──────────────────────────────────────────────────────
export type GuruNode = {
  id: string; slug: string; canonical_name: string; alternate_names?: string[];
  period?: string; tradition?: string; geographical_association?: string;
  biography?: string; verification_status: string; confidence_level?: string; source_ids?: string[];
  portrait_url?: string; portrait_credit?: string; portrait_license?: string;
  portrait_license_url?: string; portrait_source_url?: string; portrait_source?: string;
};
export type GuruLineageEdge = {
  id: string; guru_id: string; teacher_guru_id: string; relationship_type?: string;
  period?: string; confidence_level?: string; verification_status?: string; note?: string;
};
export type GuruDetail = {
  guru: GuruNode; disciples: Ref[]; teachers: Ref[];
  lineage_edges: GuruLineageEdge[]; paramparas: Ref[]; sources: Source[];
};
export async function listGurus(): Promise<GuruNode[]> {
  const d = await kgGet<{ gurus?: GuruNode[] }>(`/gurus?limit=1000`, {});
  return Array.isArray(d.gurus) ? d.gurus : [];
}
/** Phase 4 (F-D5): disputed-history Guru records are rendered with a visible label
 *  but kept out of search (noindex, follow) and out of the sitemap. */
export function isDebatedGuru(g: Pick<GuruNode, 'verification_status'>): boolean {
  return g.verification_status === 'Requires Scholarly Verification';
}
export async function getGuru(slug: string): Promise<GuruDetail | null> {
  const d = await kgGet<GuruDetail | null>(`/gurus/${encodeURIComponent(slug)}`, null);
  if (!d || !(d as any).guru) return null;
  // Normalise optional arrays so the detail page can never throw on a missing
  // collection (the universal cause of the production 500s on guru profiles).
  d.disciples = Array.isArray(d.disciples) ? d.disciples : [];
  d.teachers = Array.isArray(d.teachers) ? d.teachers : [];
  d.lineage_edges = Array.isArray(d.lineage_edges) ? d.lineage_edges : [];
  d.paramparas = Array.isArray(d.paramparas) ? d.paramparas : [];
  d.sources = Array.isArray(d.sources) ? d.sources : [];
  return d;
}

// ── Scriptures (Śāstra) ────────────────────────────────────────────────────
export type ScriptureNode = {
  id: string; slug: string; canonical_name: string; alternate_names?: string[];
  period?: string; language?: string; tradition?: string; description?: string;
  verification_status: string; confidence_level?: string; source_ids?: string[];
};
export type ScriptureDetail = { scripture: ScriptureNode; paramparas: Ref[]; sources: Source[] };
export async function listScriptures(): Promise<ScriptureNode[]> {
  const d = await kgGet<{ scriptures?: ScriptureNode[] }>(`/scriptures?limit=1000`, {});
  return Array.isArray(d.scriptures) ? d.scriptures : [];
}
export async function getScripture(slug: string): Promise<ScriptureDetail | null> {
  const d = await kgGet<ScriptureDetail | null>(`/scriptures/${encodeURIComponent(slug)}`, null);
  if (!d || !(d as any).scripture) return null;
  d.paramparas = Array.isArray(d.paramparas) ? d.paramparas : [];
  d.sources = Array.isArray(d.sources) ? d.sources : [];
  return d;
}

const STRONG_VERIF = new Set(['Verified', 'Historically Documented']);
// Indexability (honest content gate): a guru/scripture page indexes ONLY when
// the record is strongly verified AND carries a real body (biography/description).
// Thin or "Requires Scholarly Verification" records are rendered but noindex.
export function isGuruIndexable(g: GuruNode): boolean {
  return STRONG_VERIF.has(g.verification_status) && (g.biography || '').trim().length >= 40;
}
export function isScriptureIndexable(s: ScriptureNode): boolean {
  return STRONG_VERIF.has(s.verification_status) && (s.description || '').trim().length >= 25;
}

// ── Tradition Explorer ─────────────────────────────────────────────────────
// From a guru/scripture's associated traditions → the NOSTOPS teachers who
// carry them today (public listing only; never any student/attendee data →
// anti-poaching safe). Fetches teachers for each tradition in parallel and
// dedupes across traditions. Only teachers listed in the public /teachers
// directory are returned, linked by their public handle (never a 404).
export type ExplorerTeacher = { handle: string; name: string; city?: string; verified: boolean };
export type TraditionExplorer = { slug: string; name: string; teachers: ExplorerTeacher[] };
export async function getTraditionExplorer(refs: Ref[]): Promise<TraditionExplorer[]> {
  const withSlug = (refs || []).filter((r) => r && r.slug);
  const { getPublicTeacherIndex } = await import('@/lib/server/cities');
  const byKey = await getPublicTeacherIndex().catch(() => new Map());
  const rows = await Promise.all(
    withSlug.map(async (r) => {
      const teachers = await getParamparaTeachers(r.slug!).catch(() => []);
      const seen = new Set<string>();
      const list: ExplorerTeacher[] = [];
      for (const t of teachers) {
        if (t.verification_status === 'Rejected') continue;
        const pub = byKey.get(t.teacher_id);
        if (!pub || seen.has(pub.handle)) continue;
        seen.add(pub.handle);
        list.push({ handle: pub.handle, name: pub.name, city: pub.city || undefined, verified: isAffiliationVerified(t.verification_status) });
      }
      return { slug: r.slug!, name: r.display_name || r.canonical_name || r.name || r.slug!, teachers: list };
    }),
  );
  return rows;
}

// ── Lineage chain (multi-generation timeline) ──────────────────────────────
export type LineageEdgeFull = { id: string; guru_id: string; teacher_guru_id: string; relationship_type?: string; confidence_level?: string; verification_status?: string; period?: string };
export async function listLineages(): Promise<LineageEdgeFull[]> {
  const d = await kgGet<{ lineages?: LineageEdgeFull[] }>(`/lineages?limit=2000`, {});
  return Array.isArray(d.lineages) ? d.lineages : [];
}
export type LineageStep = { guru: GuruNode; rel?: string; confidence?: string; debated?: boolean };
export type LineageChain = { ancestors: LineageStep[]; descendants: LineageStep[][] };
const _confRank = (c?: string) => ({ High: 3, Medium: 2, Low: 1, Uncertain: 0 } as Record<string, number>)[c || ''] ?? 1;
function _relLabel(rt?: string): string {
  if (rt === 'traditional-attribution') return 'traditional attribution';
  if (rt === 'initiated-by') return 'initiated by';
  if (rt === 'principal-teacher') return 'principal teacher';
  return (rt || 'guru-disciple').replace(/-/g, ' ');
}
// Walks the guru_lineage graph up (ancestors, single strongest path) and down
// (descendants: gen-1 students + gen-2), returning a linear transmission chain.
export async function getGuruLineageChain(gid: string): Promise<LineageChain> {
  const [edges, gurus] = await Promise.all([listLineages(), listGurus()]);
  const byId = new Map(gurus.map((g) => [g.id, g]));
  const step = (e: LineageEdgeFull, g: GuruNode): LineageStep => ({
    guru: g, rel: _relLabel(e.relationship_type), confidence: e.confidence_level,
    debated: e.verification_status === 'Requires Scholarly Verification' || e.relationship_type === 'traditional-attribution',
  });
  // Ancestors: from gid, follow "learned from" (edge.guru_id === current) up.
  const ancestors: LineageStep[] = [];
  const seen = new Set<string>([gid]);
  let cur = gid;
  for (let depth = 0; depth < 4; depth++) {
    const up = edges.filter((e) => e.guru_id === cur && !seen.has(e.teacher_guru_id));
    if (up.length === 0) break;
    up.sort((a, b) => _confRank(b.confidence_level) - _confRank(a.confidence_level));
    const e = up[0];
    const g = byId.get(e.teacher_guru_id);
    if (!g) break;
    seen.add(g.id);
    ancestors.push(step(e, g));
    cur = g.id;
  }
  ancestors.reverse(); // oldest first
  // Descendants: gen-1 students (edge.teacher_guru_id === gid), then gen-2.
  const gen1 = edges.filter((e) => e.teacher_guru_id === gid).map((e) => { const g = byId.get(e.guru_id); return g ? step(e, g) : null; }).filter((s): s is LineageStep => !!s);
  const dSeen = new Set<string>([gid, ...gen1.map((s) => s.guru.id)]);
  const gen2: LineageStep[] = [];
  for (const s of gen1) {
    for (const e of edges.filter((e) => e.teacher_guru_id === s.guru.id && !dSeen.has(e.guru_id))) {
      const g = byId.get(e.guru_id);
      if (!g) continue;
      dSeen.add(g.id);
      gen2.push(step(e, g));
    }
  }
  const descendants: LineageStep[][] = [];
  if (gen1.length) descendants.push(gen1);
  if (gen2.length) descendants.push(gen2);
  return { ancestors, descendants };
}

// ── Admin (internal secret + admin identity) ──
export type KgActor = { user_id: string; role: string; email?: string; name?: string };
function userHeader(a: KgActor): string { return Buffer.from(JSON.stringify(a), 'utf8').toString('base64'); }

export async function kgAdminFetch(path: string, opts: { method?: string; body?: unknown; actor: KgActor }): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders(), 'X-Pulse-User': userHeader(opts.actor) };
  const init: RequestInit = { method: opts.method || 'GET', headers, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) };
  if (opts.body !== undefined && opts.method && opts.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body ?? {});
  }
  return fetch(`${KG_BASE}/api/knowledge${path}`, init);
}
export async function getReviewQueue(actor: KgActor): Promise<any[]> {
  try {
    const res = await kgAdminFetch('/admin/review-queue', { actor });
    if (!res.ok) return [];
    const d = await res.json();
    return Array.isArray(d.pending) ? d.pending : [];
  } catch { return []; }
}
export async function getAuditLog(actor: KgActor, limit = 30): Promise<any[]> {
  try {
    const res = await kgAdminFetch(`/admin/audit?limit=${limit}`, { actor });
    if (!res.ok) return [];
    const d = await res.json();
    return Array.isArray(d.audit) ? d.audit : [];
  } catch { return []; }
}
