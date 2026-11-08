import type { Metadata } from 'next';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { metaToMetadata, normalizeJsonLd } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import PageHero from '@/components/PageHero';
import { PARAMPARA_CATALOG } from '@/lib/paramparas-catalog';

// Static, deterministic lineage data -> ISR (long revalidate).
export const revalidate = 3600;

const PATH = '/paramparas';
const CANONICAL_URL = canonical(PATH); // https://www.nostops.org/paramparas

type ParamparaListItem = {
  slug: string;
  name: string;
  short?: string;
  founder?: string;
  seat?: string;
};

async function getIndex(): Promise<{ meta?: Record<string, string>; jsonld?: any[] } | null> {
  try {
    return await apiGet('/seo/paramparas-index', { revalidate: 86400 });
  } catch {
    return null;
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

export async function generateMetadata(): Promise<Metadata> {
  const idx = await getIndex();
  const mapped = metaToMetadata(idx?.meta ?? {});
  const title = mapped.title ?? { absolute: 'Yoga Paramparas · Recognised Lineages · NOSTOPS' };
  const description =
    mapped.description ??
    'The classical yoga lineages recognised by the NOSTOPS Council of Yoga Gurus — each a living Guru–Shishya Parampara.';
  const og = (mapped.openGraph ?? {}) as Record<string, any>;
  const tw = (mapped.twitter ?? {}) as Record<string, any>;
  const ogTitle = og.title ?? (typeof title === 'object' ? (title as any).absolute : title);
  const ogDesc = og.description ?? description;
  return {
    title,
    description,
    alternates: { canonical: CANONICAL_URL },
    openGraph: { ...og, type: og.type ?? 'website', siteName: og.siteName ?? 'NOSTOPS', url: CANONICAL_URL, title: ogTitle, description: ogDesc, images: og.images ?? [{ url: '/brand/og-card.png', width: 1200, height: 630, alt: 'NOSTOPS' }] },
    twitter: { ...tw, card: tw.card ?? 'summary', title: ogTitle, description: ogDesc, images: tw.images ?? ['/brand/og-card.png'] },
  };
}

export default async function ParamparasIndexPage() {
  const [idx, list] = await Promise.all([getIndex(), getList()]);
  const catalogItemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Classical yoga paramparas of India & the Himalayas',
    itemListElement: PARAMPARA_CATALOG.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.name,
      item: canonical(`/paramparas/${p.slug}`),
    })),
  };
  const jsonld = normalizeJsonLd([...(Array.isArray(idx?.jsonld) ? (idx!.jsonld as any[]) : []), catalogItemList]);
  // Never show a catalog card whose slug is already an authoritative backend lineage.
  const backendSlugs = new Set(list.map((p) => p.slug));
  const catalog = PARAMPARA_CATALOG.filter((p) => !backendSlugs.has(p.slug));
  const lead =
    idx?.meta?.description ||
    'The classical yoga lineages recognised by the NOSTOPS Council of Yoga Gurus.';

  return (
    <main>
      <JsonLd data={jsonld} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-soft">Paramparas</span>
        </div>
      </nav>

      {/* Hero — unified public-marketing gradient */}
      <PageHero
        eyebrow="Recognised Lineages"
        title="Yoga Paramparas"
        subtitle={lead}
        note={
          <>
            A parampara is a living lineage — knowledge transmitted directly from Guru to Shishya
            (teacher to student). NOSTOPS teachers carry these traditions forward as custodians of an
            unbroken chain of practice.
          </>
        }
      />

      {/* Directory */}
      <section className="container-x py-14">
        <h2 className="text-2xl font-extrabold tracking-tight">
          {list.length > 0 ? `${list.length} recognised lineages` : 'Recognised lineages'}
        </h2>

        {list.length === 0 ? (
          <div className="mt-8 card p-8 text-center">
            <p className="text-lg font-semibold text-ink">Lineages are temporarily unavailable.</p>
            <p className="mt-2 text-muted">Please try again shortly.</p>
          </div>
        ) : (
          <ul className="mt-8 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/paramparas/${p.slug}`}
                  className="card group flex h-full flex-col p-6 transition hover:border-brand hover:shadow-md"
                >
                  <h3 className="text-lg font-extrabold tracking-tight group-hover:text-brand-700">{p.name}</h3>
                  {p.short && !p.name.toLowerCase().includes(p.short.toLowerCase()) && (
                    <p className="clamp-3 mt-2 text-sm leading-relaxed text-muted">{p.short}</p>
                  )}
                  <dl className="mt-auto pt-4 text-xs text-muted">
                    {p.founder && (
                      <div className="flex gap-1.5">
                        <dt className="font-semibold text-ink-soft">Founder:</dt>
                        <dd>{p.founder}</dd>
                      </div>
                    )}
                    {p.seat && (
                      <div className="mt-0.5 flex gap-1.5">
                        <dt className="font-semibold text-ink-soft">Seat:</dt>
                        <dd>{p.seat}</dd>
                      </div>
                    )}
                  </dl>
                  <span className="mt-3 inline-block text-sm font-bold text-brand-700">Explore lineage →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Informational catalog — classical paramparas of India & the Himalayas.
          Clearly distinct from Council-empanelled lineages above. */}
      {catalog.length > 0 && (
        <section className="bg-cream" data-testid="parampara-catalog">
          <div className="container-x py-14">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">Classical yoga paramparas of India &amp; the Himalayas</h2>
            <p className="mt-2 max-w-3xl text-muted">
              An informational reference to the great living lineages of Indian and Himalayan yoga. Listing here is
              educational and does not itself imply NOSTOPS Council empanelment.
            </p>
            <ul className="mt-8 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/paramparas/${p.slug}`}
                    className="card group flex h-full flex-col p-6 transition hover:border-brand hover:shadow-md"
                    data-testid="catalog-parampara-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-extrabold tracking-tight group-hover:text-brand-700">{p.name}</h3>
                      <span className="shrink-0 rounded-full bg-royal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-royal">{p.region}</span>
                    </div>
                    <p className="clamp-3 mt-2 text-sm leading-relaxed text-muted">{p.short}</p>
                    <dl className="mt-auto pt-4 text-xs text-muted">
                      {p.founder && (
                        <div className="flex gap-1.5">
                          <dt className="font-semibold text-ink-soft">Founder:</dt>
                          <dd>{p.founder}</dd>
                        </div>
                      )}
                      {p.seat && (
                        <div className="mt-0.5 flex gap-1.5">
                          <dt className="font-semibold text-ink-soft">Seat:</dt>
                          <dd>{p.seat}</dd>
                        </div>
                      )}
                    </dl>
                    <span className="mt-3 inline-block text-sm font-bold text-brand-700">Explore lineage →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
