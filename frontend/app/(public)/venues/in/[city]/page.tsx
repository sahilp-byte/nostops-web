import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { normalizeJsonLd, ogImages, DEFAULT_OG_IMAGE } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { getVenues, venuePath, type PublicVenue } from '@/lib/server/venues';
import { venueCitySlug } from '@/lib/venue-url';
import { getPublicRetreats } from '@/lib/server/retreats';
import { citySlug } from '@/lib/server/cities';
import VenueCard from '@/components/venues/VenueCard';
import { enhancedVenueIds, withGoogleCovers } from '@/lib/server/ai-assisted-venues';

export const revalidate = 900;

type Params = { params: Promise<{ city: string }> };
const HOME_URL = canonical('/');
const VENUES_URL = canonical('/venues');

// Only build city pages that actually have venues (no thin/empty pages). New
// cities appear automatically via ISR.
export async function generateStaticParams() {
  const venues = await getVenues({ limit: 100 });
  const slugs = new Set<string>();
  for (const v of venues) { const s = venueCitySlug(v); if (s) slugs.add(s); }
  return Array.from(slugs).map((city) => ({ city }));
}

async function loadCity(slug: string): Promise<{ label: string; list: PublicVenue[] } | null> {
  const venues = await getVenues({ limit: 100 });
  const list = venues.filter((v) => venueCitySlug(v) === slug);
  if (list.length === 0) return null;
  const label = (list.find((v) => v.city)?.city as string) || slug;
  return { label, list: await withGoogleCovers(list) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { city } = await params;
  const data = await loadCity(city);
  if (!data) return { title: 'Yoga & Retreat Venues', robots: { index: false } };
  const url = canonical(`/venues/in/${city}`);
  const title = `Yoga & Retreat Venues in ${data.label}`;
  const description = `Discover ${data.list.length} trusted yoga retreat venue${data.list.length === 1 ? '' : 's'} in ${data.label} on NOSTOPS — spaces reviewed for residential yoga, retreats and teacher trainings.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
    openGraph: { type: 'website', siteName: 'NOSTOPS', url, title: `${title} · NOSTOPS`, description, images: ogImages() },
    twitter: { card: 'summary_large_image', title: `${title} · NOSTOPS`, description, images: [DEFAULT_OG_IMAGE] },
  };
}

export default async function VenuesInCityPage({ params }: Params) {
  const { city } = await params;
  const data = await loadCity(city);
  if (!data) notFound();
  const { label, list } = data;
  const url = canonical(`/venues/in/${city}`);

  // Gated cross-link: only link to /retreats/in/{city} if it actually has retreats.
  const { retreats } = await getPublicRetreats().catch(() => ({ retreats: [] }));
  const cityHasRetreats = retreats.some((r) => r.city && citySlug(r.city) === city);
  const enhanced = new Set(await enhancedVenueIds(list));

  const jsonld = normalizeJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${url}#venues`,
      url,
      name: `Yoga & Retreat Venues in ${label}`,
      isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: HOME_URL },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: list.length,
        itemListElement: list.map((v, i) => ({ '@type': 'ListItem', position: i + 1, name: v.name, url: canonical(venuePath(v)) })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
        { '@type': 'ListItem', position: 2, name: 'Venues', item: VENUES_URL },
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
          <Link href="/venues" className="hover:text-brand-700">Venues</Link>
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
            Yoga &amp; Retreat Venues in {label}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/85">
            {list.length} trusted {list.length === 1 ? 'venue' : 'venues'} in {label} for residential yoga, retreats and teacher trainings.
          </p>
          {cityHasRetreats && (
            <Link href={`/retreats/in/${city}`} className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-700 shadow-sm transition hover:bg-cream">
              See yoga retreats in {label} →
            </Link>
          )}
        </div>
      </section>

      <section className="container-x py-12">
        <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3" data-testid="city-venue-grid">
          {list.map((v) => (
            <li key={v.id}><VenueCard v={v} enhanced={enhanced.has(v.id)} /></li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <Link href="/venues" className="inline-block rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-brand-700 transition hover:border-accent hover:text-accent-600">
            ← Explore all venues
          </Link>
        </div>
      </section>
    </main>
  );
}
