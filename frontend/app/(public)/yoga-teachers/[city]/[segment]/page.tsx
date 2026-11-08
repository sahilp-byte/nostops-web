import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canonical } from '@/lib/site';
import { normalizeJsonLd } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { titleCase } from '@/lib/format';
import { getYogaCity, getYogaCitySegment, getIndexableSegments } from '@/lib/server/yoga-city';
import SegmentTraditionLink from '@/components/city/SegmentTraditionLink';
import { CityTeacherCard } from '@/components/city/CityTeacherDiscovery';

export const revalidate = 60;
export const dynamicParams = true;

// Pre-render ONLY indexable (≥ threshold) sub-routes. Thinner ones (1–2 teachers)
// are still reachable on demand but render with noindex; zero-match → 404.
export async function generateStaticParams() {
  const segs = await getIndexableSegments();
  return segs.map((s) => ({ city: s.city, segment: s.segment }));
}

const HOME_URL = canonical('/');

export async function generateMetadata({ params }: { params: Promise<{ city: string; segment: string }> }): Promise<Metadata> {
  const { city, segment } = await params;
  const d = await getYogaCitySegment(city, segment);
  if (!d) return { title: 'Not found · NOSTOPS', robots: { index: false, follow: false } };
  const url = canonical(`/yoga-teachers/${d.citySlug}/${d.slug}`);
  const title = `${titleCase(d.label)} Yoga Teachers in ${d.cityLabel}`;
  const description = `Find ${d.count} ${d.count === 1 ? 'yoga teacher' : 'yoga teachers'} offering ${titleCase(d.label)} in ${d.cityLabel} on NOSTOPS. Book authentic, teacher-led yoga directly.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // Insufficient-content pages stay out of the index but remain followable so
    // link equity still flows to the teacher profiles and the city page.
    // Every resolved city sub-route (≥1 teacher) is public and indexable — it is
    // a genuine long-tail directory page (e.g. "Hatha Yoga teachers in Pune").
    robots: { index: true, follow: true },
    openGraph: { type: 'website', siteName: 'NOSTOPS', url, title: `${title} · NOSTOPS`, description },
    twitter: { card: 'summary_large_image', title: `${title} · NOSTOPS`, description },
  };
}

export default async function YogaCitySegmentPage({ params }: { params: Promise<{ city: string; segment: string }> }) {
  const { city, segment } = await params;
  const d = await getYogaCitySegment(city, segment);
  if (!d) notFound();

  // Sibling categories for internal linking (cheap — shares the cached loaders).
  const yc = await getYogaCity(d.citySlug);
  const siblings = [
    ...(yc?.traditions.filter((t) => t.slug !== d.slug) ?? []).slice(0, 6).map((t) => ({ slug: t.slug, label: t.label })),
    ...(yc?.purposes.filter((p) => p.slug !== d.slug) ?? []).map((p) => ({ slug: p.slug, label: p.short })),
  ].slice(0, 8);

  const url = canonical(`/yoga-teachers/${d.citySlug}/${d.slug}`);
  const cityUrl = canonical(`/yoga-teachers/${d.citySlug}`);
  const collectionPage = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#directory`,
    url,
    name: `${titleCase(d.label)} Yoga Teachers in ${d.cityLabel}`,
    isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: HOME_URL },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: d.count,
      itemListElement: d.teachers.map((t, i) => {
        const turl = canonical(`/teachers/${t.handle}`);
        return { '@type': 'ListItem', position: i + 1, item: { '@type': 'Person', '@id': turl, name: t.name, url: turl, jobTitle: 'Yoga Teacher' } };
      }),
    },
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
      { '@type': 'ListItem', position: 2, name: 'Yoga Teachers', item: canonical('/teachers') },
      { '@type': 'ListItem', position: 3, name: d.cityLabel, item: cityUrl },
      { '@type': 'ListItem', position: 4, name: titleCase(d.label), item: url },
    ],
  };

  return (
    <div>
      <JsonLd data={normalizeJsonLd([collectionPage, breadcrumb])} />

      <section className="bg-cream">
        <div className="container-x py-12 md:py-16">
          <nav className="text-xs text-muted" aria-label="Breadcrumb">
            <Link href="/teachers" className="hover:text-brand-700">Yoga Teachers</Link> <span className="px-1">/</span>
            <Link href={`/yoga-teachers/${d.citySlug}`} className="hover:text-brand-700"> {d.cityLabel}</Link> <span className="px-1">/</span>
            <span className="text-ink-soft"> {titleCase(d.label)}</span>
          </nav>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">
            {titleCase(d.label)} yoga teachers in {d.cityLabel}
          </h1>
          <p className="mt-2 max-w-2xl text-ink-soft">{d.intro}</p>
          <p className="mt-3 text-sm font-bold text-brand-700">{d.count} {d.count === 1 ? 'teacher' : 'teachers'}</p>
        </div>
      </section>

      <section className="container-x py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {d.teachers.map((t) => (
            <CityTeacherCard key={t.handle} t={t} showAdaptiveStatus={d.kind === 'purpose' && d.slug === 'special-needs'} />
          ))}
        </div>
      </section>

      {/* Knowledge-Graph enrichment: link this combo into the tradition entry */}
      {d.kind === 'tradition' && <SegmentTraditionLink segment={d.slug} label={d.label} cityLabel={d.cityLabel} />}

      {/* Internal linking back to city + sibling categories */}
      <section className="container-x pb-16">
        <div className="rounded-2xl border border-line bg-white p-6">
          <Link href={`/yoga-teachers/${d.citySlug}`} className="text-sm font-bold text-brand-700 hover:underline" data-testid="segment-city-link">
            ← All yoga teachers in {d.cityLabel}
          </Link>
          {siblings.length > 0 && (
            <div className="mt-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted">More ways to explore {d.cityLabel}</h2>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {siblings.map((sb) => (
                  <Link
                    key={sb.slug}
                    href={`/yoga-teachers/${d.citySlug}/${sb.slug}`}
                    className="inline-flex items-center rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand-700"
                  >
                    {titleCase(sb.label)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
