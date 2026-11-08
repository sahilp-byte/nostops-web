import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { normalizeJsonLd } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { citySlug } from '@/lib/server/cities';
import { getPublicRetreats, type PublicRetreat } from '@/lib/server/retreats';
import RetreatCard from '@/components/retreats/RetreatCard';
import { retreatPath } from '@/lib/retreat-url';

// Rendered per request (see the detail page): with no public retreats at build time the
// route was treated as static and crashed on first visit. Fetches stay cached.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ city: string }> };
const HOME_URL = canonical('/');
const RETREATS_URL = canonical('/retreats');

async function loadCity(slug: string): Promise<{ label: string; list: PublicRetreat[] } | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const { retreats, error } = await getPublicRetreats();
  // A backend outage is an error (5xx), never a "no retreats here" 404.
  if (error) throw new Error('retreat list unavailable');
  const list = retreats.filter((r) => r.city && citySlug(r.city) === slug);
  if (list.length === 0) return null;
  // Human label: use the actual city string from the first matching retreat.
  const label = (list.find((r) => r.city)?.city as string) || slug;
  return { label, list };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { city } = await params;
  const data = await loadCity(city);
  if (!data) return { title: 'Yoga Retreats', robots: { index: false } };
  const url = canonical(`/retreats/in/${city}`);
  const description = `Discover ${data.list.length} yoga retreat${data.list.length === 1 ? '' : 's'} in ${data.label}, led by NOSTOPS teachers and Gurus — immersive, lineage-rooted gatherings you can trust.`;
  const title = `Yoga Retreats in ${data.label}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: 'NOSTOPS', url, title: `${title} · NOSTOPS`, description },
    twitter: { card: 'summary_large_image', title: `${title} · NOSTOPS`, description },
  };
}

function eventFor(r: PublicRetreat): any {
  const url = canonical(retreatPath(r));
  const ev: any = { '@type': 'EducationEvent', '@id': url, name: r.title, url };
  if (r.startDate) ev.startDate = r.startDate;
  if (r.endDate) ev.endDate = r.endDate;
  return ev;
}

export default async function RetreatsInCityPage({ params }: Params) {
  const { city } = await params;
  const data = await loadCity(city);
  if (!data) notFound();
  const { label, list } = data;
  const url = canonical(`/retreats/in/${city}`);

  const jsonld = normalizeJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${url}#retreats`,
      url,
      name: `Yoga Retreats in ${label}`,
      isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: HOME_URL },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: list.length,
        itemListElement: list.map((r, i) => ({ '@type': 'ListItem', position: i + 1, item: eventFor(r) })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
        { '@type': 'ListItem', position: 2, name: 'Retreats', item: RETREATS_URL },
        { '@type': 'ListItem', position: 3, name: label, item: url },
      ],
    },
  ]);

  return (
    <main>
      <JsonLd data={jsonld} />

      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/retreats" className="hover:text-brand-700">Retreats</Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-ink-soft">{label}</span>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-ink">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-700 via-ink to-accent-600 opacity-90" />
        <div className="container-x relative py-14 md:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur">
            <span aria-hidden>📍</span> {label}
          </span>
          <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.1] tracking-tight text-white md:text-5xl">
            Yoga Retreats in {label}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/85">
            {list.length} immersive {list.length === 1 ? 'retreat' : 'retreats'} in {label}, led by teachers who carry the tradition forward.
          </p>
        </div>
      </section>

      <section className="container-x py-12">
        <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <li key={r.id}><RetreatCard r={r} /></li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <Link href="/retreats" className="inline-block rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-brand-700 transition hover:border-accent hover:text-accent-600">
            ← Explore all retreats
          </Link>
        </div>
      </section>
    </main>
  );
}
