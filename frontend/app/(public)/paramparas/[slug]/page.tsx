import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { isTeacherActivePublic, isPublicHandleBlocked } from '@/lib/public-teacher';
import { metaToMetadata, normalizeJsonLd, ogImages, DEFAULT_OG_IMAGE } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import PageHero from '@/components/PageHero';
import { getCatalogParampara, catalogSlugs, matchCatalogSlug, PARAMPARA_CATALOG, type CatalogParampara } from '@/lib/paramparas-catalog';

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { params: Promise<{ slug: string }> };
type ParamparaListItem = { slug: string; name: string; short?: string; founder?: string; seat?: string };

async function fetchJson<T = any>(path: string): Promise<{ data: T | null; status: number }> {
  try {
    const data = await apiGet<T>(path, { revalidate: 3600 });
    return { data, status: 200 };
  } catch (e) {
    const m = /Backend (\d+)/.exec((e as Error)?.message || '');
    return { data: null, status: m ? Number(m[1]) : 0 };
  }
}

async function getList(): Promise<ParamparaListItem[]> {
  try {
    const d = await apiGet<{ paramparas?: ParamparaListItem[] }>('/seo/paramparas', { revalidate: 86400 });
    return Array.isArray(d?.paramparas) ? d.paramparas.filter((p) => p && p.slug) : [];
  } catch {
    return [];
  }
}

// Backend-authoritative set of publicly listable teacher handles (so we never
// link a lineage 'member' whose profile is suspended/inactive and 404s).
async function getEligibleHandles(): Promise<Set<string>> {
  try {
    const d = await apiGet<{ teachers?: any[] }>('/teachers/directory', { revalidate: 3600 });
    const raw = Array.isArray(d?.teachers) ? d.teachers : [];
    return new Set(
      raw
        .filter(isTeacherActivePublic)
        .map((t) => String(t.handle)),
    );
  } catch {
    return new Set();
  }
}

// Public teachers whose declared parampara resolves to this catalog lineage.
async function getCatalogMembers(slug: string): Promise<{ handle: string; name: string; city: string }[]> {
  try {
    const d = await apiGet<{ teachers?: any[] }>('/teachers/directory', { revalidate: 3600 });
    const raw = Array.isArray(d?.teachers) ? d.teachers : [];
    return raw
      .filter(isTeacherActivePublic)
      .filter((t) => {
        const vals = [t.parampara, ...(Array.isArray(t.paramparas) ? t.paramparas : [])].filter(Boolean).map(String);
        return vals.some((v) => matchCatalogSlug(v) === slug);
      })
      .map((t) => ({ handle: String(t.handle), name: t.name || 'NOSTOPS Teacher', city: t.city || '' }));
  } catch {
    return [];
  }
}

// Cross-link nav: backend lineages + catalog lineages (deduped by slug).
function mergedNav(list: ParamparaListItem[]): { slug: string; name: string }[] {
  const seen = new Set(list.map((p) => p.slug));
  return [
    ...list.map((p) => ({ slug: p.slug, name: p.name })),
    ...PARAMPARA_CATALOG.filter((p) => !seen.has(p.slug)).map((p) => ({ slug: p.slug, name: p.name })),
  ];
}

export async function generateStaticParams() {
  const list = await getList();
  const slugs = new Set<string>([...list.map((p) => String(p.slug)), ...catalogSlugs()]);
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const url = canonical(`/paramparas/${slug}`);
  const seo = await fetchJson<{ meta?: Record<string, string> }>(`/seo/parampara/${slug}`);

  // Genuine 404 or transient: fall back to the (truthful) list item, then the catalog.
  let meta = seo.data?.meta ?? {};
  if (!seo.data) {
    const item = (await getList()).find((p) => p.slug === slug);
    if (item) {
      meta = { title: `${item.name} · NOSTOPS`, description: item.short || `${item.name} — a recognised yoga lineage.` };
    } else {
      const c = getCatalogParampara(slug);
      if (c) meta = { title: `${c.name} · NOSTOPS`, description: c.short };
    }
  }

  const mapped = metaToMetadata(meta);
  const title = mapped.title ?? { absolute: 'Yoga Parampara · NOSTOPS' };
  const description = mapped.description ?? 'A recognised yoga lineage in the NOSTOPS cooperative.';
  const og = (mapped.openGraph ?? {}) as Record<string, any>;
  const tw = (mapped.twitter ?? {}) as Record<string, any>;
  const ogTitle = og.title ?? (typeof title === 'object' ? (title as any).absolute : title);
  const ogDesc = og.description ?? description;
  const ogImgs = Array.isArray(og.images) && og.images.length ? og.images : ogImages();
  const twImgs = Array.isArray(tw.images) && tw.images.length ? tw.images : [DEFAULT_OG_IMAGE];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...og, type: og.type ?? 'website', siteName: og.siteName ?? 'NOSTOPS', url, title: ogTitle, description: ogDesc, images: ogImgs },
    twitter: { ...tw, card: tw.card ?? 'summary_large_image', title: ogTitle, description: ogDesc, images: twImgs },
  };
}

type Loaded = {
  jsonld: any[];
  eo: any;
  meta: Record<string, string>;
  navIndex: { slug: string; name: string }[];
  eligible: Set<string>;
  fallback?: ParamparaListItem;
  catalog?: CatalogParampara;
  catalogMembers?: { handle: string; name: string; city: string }[];
};

async function loadParampara(slug: string): Promise<Loaded | null> {
  const [seo, list, eligible] = await Promise.all([
    fetchJson<{ meta?: Record<string, string>; jsonld?: any[]; paramparas_index?: any[] }>(`/seo/parampara/${slug}`),
    getList(),
    getEligibleHandles(),
  ]);

  // Backend doesn't carry this slug — try the frontend catalog before 404-ing.
  if (seo.status === 404) {
    const c = getCatalogParampara(slug);
    if (!c) return null; // genuinely nonexistent lineage
    const catalogMembers = await getCatalogMembers(slug);
    return {
      jsonld: [],
      eo: null,
      meta: {},
      navIndex: mergedNav(list).filter((p) => p.slug !== slug),
      eligible: new Set(catalogMembers.map((m) => m.handle)),
      catalog: c,
      catalogMembers,
    };
  }

  if (!seo.data) {
    // transient failure: only render if this is a known valid slug (truthful fallback)
    const item = list.find((p) => p.slug === slug);
    if (!item) return null;
    return { jsonld: [], eo: null, meta: {}, navIndex: mergedNav(list), eligible, fallback: item };
  }

  // Retired (demo/test) teachers are removed from the backend lineage roster.
  const jl = (Array.isArray(seo.data.jsonld) ? seo.data.jsonld : []).map((o: any) =>
    o?.['@type'] === 'EducationalOrganization' && Array.isArray(o.member)
      ? { ...o, member: o.member.filter((m: any) => !isPublicHandleBlocked(handleFromUrl(m?.url))) }
      : o,
  );
  const eo = jl.find((o: any) => o?.['@type'] === 'EducationalOrganization') ?? null;
  const backendNav = Array.isArray(seo.data.paramparas_index)
    ? seo.data.paramparas_index.filter((p: any) => p?.slug).map((p: any) => ({ slug: String(p.slug), name: String(p.name || p.slug) }))
    : list.map((p) => ({ slug: p.slug, name: p.name }));
  // Include catalog lineages in the "other paramparas" nav for cross-linking.
  const navSeen = new Set(backendNav.map((p: { slug: string }) => p.slug));
  const navIndex = [...backendNav, ...PARAMPARA_CATALOG.filter((p) => !navSeen.has(p.slug)).map((p) => ({ slug: p.slug, name: p.name }))];

  return { jsonld: normalizeJsonLd(jl), eo, meta: seo.data.meta ?? {}, navIndex, eligible };
}

function handleFromUrl(u?: string): string | null {
  if (!u || typeof u !== 'string') return null;
  const m = /\/teachers\/([^/?#"']+)/.exec(u);
  return m ? m[1] : null;
}

export default async function ParamparaDetailPage({ params }: Params) {
  const { slug } = await params;
  const data = await loadParampara(slug);
  if (!data) notFound();

  const { jsonld, eo, meta, navIndex, eligible, fallback, catalog, catalogMembers } = data;

  // Prefer authoritative EducationalOrganization; fall back to list item, then catalog.
  const name: string = eo?.name || fallback?.name || catalog?.name || 'Yoga Parampara';
  const description: string = eo?.description || meta.description || fallback?.short || catalog?.short || '';
  const founderName: string | undefined =
    (typeof eo?.founder === 'object' ? eo?.founder?.name : eo?.founder) || fallback?.founder || catalog?.founder;
  const founderDesc: string | undefined = typeof eo?.founder === 'object' ? eo?.founder?.description : undefined;
  const foundingDate: string | undefined = eo?.foundingDate;
  const seat: string | undefined = eo?.location?.name || eo?.location?.address?.addressLocality || fallback?.seat || catalog?.seat;
  const keywords: string[] = catalog
    ? catalog.characteristics
    : typeof eo?.keywords === 'string'
      ? eo.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
      : Array.isArray(eo?.keywords)
        ? eo.keywords.filter(Boolean)
        : [];
  const members: any[] = catalog
    ? (catalogMembers ?? []).map((m) => ({ name: m.name, url: `/teachers/${m.handle}`, address: { addressLocality: m.city } }))
    : Array.isArray(eo?.member)
      ? eo.member
      : [];

  // Catalog pages carry no backend JSON-LD — synthesise Breadcrumb + EducationalOrganization.
  const pageUrl = canonical(`/paramparas/${slug}`);
  const finalJsonLd = catalog
    ? normalizeJsonLd([
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: canonical('/') },
            { '@type': 'ListItem', position: 2, name: 'Paramparas', item: canonical('/paramparas') },
            { '@type': 'ListItem', position: 3, name, item: pageUrl },
          ],
        },
        {
          '@context': 'https://schema.org',
          '@type': 'EducationalOrganization',
          name,
          description,
          url: pageUrl,
          ...(founderName ? { founder: { '@type': 'Person', name: founderName } } : {}),
          ...(seat ? { location: { '@type': 'Place', name: seat } } : {}),
        },
      ])
    : jsonld;

  return (
    <main>
      {finalJsonLd.length > 0 && <JsonLd data={finalJsonLd} />}

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/paramparas" className="hover:text-brand-700">Paramparas</Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-soft">{name}</span>
        </div>
      </nav>

      {/* Hero — unified public-marketing gradient */}
      <PageHero>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/90 backdrop-blur">
            Parampara
          </span>
          {catalog && (
            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/80 backdrop-blur">
              {catalog.region}
            </span>
          )}
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-white md:text-5xl">{name}</h1>
        {description && <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/85">{description}</p>}
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {founderName && (
            <div>
              <span className="font-bold text-white">Founder:</span>{' '}
              <span className="text-white/80">{founderName}{founderDesc ? ` (${founderDesc.replace(/^Founder\s*·\s*/, '')})` : ''}</span>
            </div>
          )}
          {foundingDate && (
            <div><span className="font-bold text-white">Founded:</span> <span className="text-white/80">{foundingDate}</span></div>
          )}
          {seat && (
            <div><span className="font-bold text-white">Seat:</span> <span className="text-white/80">{seat}</span></div>
          )}
        </div>
      </PageHero>

      <div className="container-x grid gap-10 py-14 md:grid-cols-3">
        <div className="space-y-12 md:col-span-2">
          {catalog && catalog.about.length > 0 && (
            <section>
              <h2 className="text-xl font-extrabold tracking-tight">About this parampara</h2>
              <div className="mt-4 space-y-4 text-lg leading-relaxed text-ink-soft">
                {catalog.about.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          )}

          {keywords.length > 0 && (
            <section>
              <h2 className="text-xl font-extrabold tracking-tight">Known for</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {keywords.map((k) => (
                  <span key={k} className="rounded-full bg-royal-50 px-3 py-1 text-sm font-medium text-royal">{k}</span>
                ))}
              </div>
            </section>
          )}

          {catalog?.keyTexts && catalog.keyTexts.length > 0 && (
            <section>
              <h2 className="text-xl font-extrabold tracking-tight">Key texts</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {catalog.keyTexts.map((t) => (
                  <span key={t} className="rounded-full bg-cream px-3 py-1 text-sm font-medium text-ink-soft">{t}</span>
                ))}
              </div>
            </section>
          )}

          {catalog?.lineageWords && (
            <section>
              <h2 className="text-xl font-extrabold tracking-tight">Guru–Shishya lineage</h2>
              <p className="mt-4 text-lg text-ink-soft">{catalog.lineageWords}</p>
            </section>
          )}

          {/* Empanelled teachers in this lineage */}
          {members.length > 0 && (
            <section>
              <h2 className="text-xl font-extrabold tracking-tight">NOSTOPS teachers in this lineage</h2>
              <ul className="mt-4 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
                {members.map((m, i) => {
                  const handle = handleFromUrl(m?.url);
                  const city = m?.address?.addressLocality;
                  const linkable = handle && eligible.has(handle);
                  return (
                    <li key={handle || i} className="card p-4">
                      {linkable ? (
                        <Link href={`/teachers/${handle}`} className="font-bold text-brand-700 hover:underline">
                          {m?.name}
                        </Link>
                      ) : (
                        <span className="font-bold text-ink">{m?.name}</span>
                      )}
                      {city && <span className="block text-sm text-muted">{city}</span>}
                    </li>
                  );
                })}
              </ul>
              <Link href="/teachers" className="mt-4 inline-block text-sm font-bold text-brand-700 hover:underline">
                Browse all NOSTOPS teachers →
              </Link>
            </section>
          )}

          <section className="card p-6">
            {catalog ? (
              <p className="text-sm leading-relaxed text-muted">
                This is an informational reference to {name}, one of the classical yoga paramparas of India &amp; the
                Himalayas. Inclusion here is educational and does not itself imply NOSTOPS Council empanelment. NOSTOPS —
                India&apos;s Teacher-First Yoga Cooperative — honours every living Guru–Shishya lineage.
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-muted">
                As a recognised parampara within NOSTOPS — India&apos;s Teacher-First Yoga Cooperative —
                this lineage is stewarded as a living Guru–Shishya tradition, with knowledge transmitted
                directly from teacher to student.
              </p>
            )}
          </section>
        </div>

        {/* Sidebar: other lineages */}
        <aside>
          <div className="card p-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Other paramparas</h2>
            <ul className="mt-3 list-none space-y-2 p-0 text-sm">
              {navIndex.filter((p) => p.slug !== slug).map((p) => (
                <li key={p.slug}>
                  <Link href={`/paramparas/${p.slug}`} className="text-ink-soft hover:text-brand-700">{p.name}</Link>
                </li>
              ))}
            </ul>
            <Link href="/paramparas" className="mt-4 inline-block text-sm font-bold text-brand-700 hover:underline">
              ← All paramparas
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
