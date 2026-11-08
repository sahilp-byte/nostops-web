import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import { normalizeJsonLd } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { titleCase } from '@/lib/format';
import { getCities } from '@/lib/server/cities';

// City Directory hub — the scalable "all cities" page that anchors the
// City → Teachers → Teacher-Profile internal-linking network. Cities come from
// the SAME source of truth as the City pages (getCities → public directory), so
// this stays in sync automatically as cities publish/unpublish.
export const revalidate = 60;

const URL = canonical('/yoga-teachers');
const HOME_URL = canonical('/');

export async function generateMetadata(): Promise<Metadata> {
  const cities = await getCities();
  const names = cities.slice(0, 3).map((c) => titleCase(c.label));
  const description =
    cities.length > 0
      ? `Browse NOSTOPS yoga teachers by city${names.length ? `, from ${names.join(', ')}` : ''}. Find verified, teacher-first yoga teachers near you and book directly.`
      : 'Browse NOSTOPS yoga teachers by city. Find verified, teacher-first yoga teachers near you and book authentic practice directly.';
  return {
    title: 'Find Yoga Teachers by City',
    description,
    alternates: { canonical: URL },
    robots: { index: true, follow: true },
    openGraph: { type: 'website', siteName: 'NOSTOPS', url: URL, title: 'Find Yoga Teachers by City · NOSTOPS', description, images: [{ url: '/brand/og-card.png', width: 1200, height: 630, alt: 'NOSTOPS' }] },
    twitter: { card: 'summary_large_image', title: 'Find Yoga Teachers by City · NOSTOPS', description, images: ['/brand/og-card.png'] },
  };
}

export default async function CityDirectoryPage() {
  const cities = await getCities();
  const totalTeachers = cities.reduce((n, c) => n + c.count, 0);

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
      { '@type': 'ListItem', position: 2, name: 'Yoga Teachers', item: canonical('/teachers') },
      { '@type': 'ListItem', position: 3, name: 'Cities', item: URL },
    ],
  };
  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${URL}#cities`,
    url: URL,
    name: 'Find Yoga Teachers by City',
    isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: HOME_URL },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: cities.length,
      itemListElement: cities.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: `Yoga Teachers in ${titleCase(c.label)}`,
        item: canonical(`/yoga-teachers/${c.slug}`),
      })),
    },
  };

  return (
    <div>
      <JsonLd data={normalizeJsonLd([breadcrumb, collection])} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-ink via-royal to-brand">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="container-x relative py-14 md:py-20">
          <nav className="text-xs text-white/70" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">Home</Link> <span className="px-1">/</span>
            <Link href="/teachers" className="hover:text-white"> Yoga Teachers</Link> <span className="px-1">/</span>
            <span className="text-white"> Cities</span>
          </nav>
          <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
            Find yoga teachers by city
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/85">
            NOSTOPS is a teacher-first cooperative honouring the Guru–Shishya Parampara. Choose your city to discover verified,
            empanelled yoga teachers near you — by tradition, purpose, experience and format — and book authentic practice directly.
          </p>
          {cities.length > 0 && (
            <p className="mt-6 inline-flex flex-wrap gap-3 text-sm font-semibold text-white/80">
              <span className="rounded-lg bg-white/10 px-3 py-1.5 ring-1 ring-white/15">{cities.length} {cities.length === 1 ? 'city' : 'cities'}</span>
              <span className="rounded-lg bg-white/10 px-3 py-1.5 ring-1 ring-white/15">{totalTeachers} {totalTeachers === 1 ? 'teacher' : 'teachers'}</span>
            </p>
          )}
        </div>
      </section>

      {/* City grid */}
      <section className="container-x py-12 md:py-16">
        {cities.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-lg font-bold text-ink">City pages are coming soon.</p>
            <p className="mt-2 text-sm text-muted">
              We&apos;re onboarding teachers across India. In the meantime, browse the{' '}
              <Link href="/teachers" className="font-bold text-brand-700 hover:underline">full teacher directory</Link>.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-black tracking-tight text-ink md:text-3xl">Cities with NOSTOPS teachers</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cities.map((c) => (
                <Link
                  key={c.slug}
                  href={`/yoga-teachers/${c.slug}`}
                  className="card group flex items-center justify-between p-5 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md"
                  data-testid="directory-city-card"
                >
                  <span className="min-w-0">
                    <span className="block font-black text-ink group-hover:text-brand-700">Yoga teachers in {titleCase(c.label)}</span>
                    <span className="mt-0.5 block text-sm text-muted">{c.count} {c.count === 1 ? 'teacher' : 'teachers'}</span>
                  </span>
                  <span aria-hidden className="ml-3 shrink-0 text-brand-700 transition group-hover:translate-x-0.5">→</span>
                </Link>
              ))}
            </div>
            <div className="mt-10 rounded-2xl border border-line bg-cream p-6 text-sm leading-relaxed text-ink-soft">
              Don&apos;t see your city yet? Browse the{' '}
              <Link href="/teachers" className="font-bold text-brand-700 hover:underline">full teacher directory</Link>, or{' '}
              <Link href="/become-a-teacher" className="font-bold text-brand-700 hover:underline">join as a teacher</Link> to bring
              NOSTOPS to your city.
            </div>
          </>
        )}
      </section>
    </div>
  );
}
