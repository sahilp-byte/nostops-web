import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import { titleCase } from '@/lib/format';
import { ogImages, DEFAULT_OG_IMAGE } from '@/lib/seo';
import PageHero from '@/components/PageHero';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { getDiscoveryDimensions, getDiscovery, isModern } from '@/lib/server/knowledge';
import { getCities } from '@/lib/server/cities';

export const revalidate = 60;
const URL = canonical('/find-your-tradition');

export const metadata: Metadata = {
  title: { absolute: 'Find Your Yoga Tradition · Explore & Decide · NOSTOPS' },
  description:
    'Explore Yoga traditions by what interests you, from movement and breath to meditation, mantra, devotion and philosophy. You decide what resonates.',
  alternates: { canonical: URL },
  openGraph: { type: 'website', siteName: 'NOSTOPS', url: URL, title: 'Find Your Yoga Tradition · NOSTOPS', description: 'Explore Yoga traditions by interest. You decide what resonates.', images: ogImages() },
  twitter: { card: 'summary_large_image', title: 'Find Your Yoga Tradition · NOSTOPS', images: [DEFAULT_OG_IMAGE] },
};

type SP = { searchParams: Promise<{ focus?: string }> };

export default async function FindYourTradition({ searchParams }: SP) {
  const { focus } = await searchParams;
  const [dimensions, discovery, publicCities] = await Promise.all([
    getDiscoveryDimensions(),
    focus ? getDiscovery(focus) : Promise.resolve(null),
    getCities().catch(() => []),
  ]);
  // Only link cities that have a public /yoga-teachers/{city} page (never a 404).
  const live = new Set(publicCities.map((c) => c.slug));
  const result = discovery ? { ...discovery, cities: discovery.cities.filter((c) => live.has(c.city_id)) } : null;

  return (
    <main>
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: 'Find Your Yoga Tradition', path: '/find-your-tradition' }]} />
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-soft">Find Your Yoga Tradition</span>
        </div>
      </nav>

      <PageHero
        eyebrow="Explore & decide"
        title="Find Your Yoga Tradition"
        subtitle="Different Yoga traditions emphasize different practices, philosophies and methods. Explore and decide what resonates with you."
        note="This is an exploration, not a prescription — NOSTOPS won't tell you which tradition you 'should' follow, and makes no medical or spiritual guarantees. Every suggestion below is drawn from real teacher and tradition data."
      />

      <section className="container-x py-10">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Start with what interests you</h2>
        <div className="mt-4 flex flex-wrap gap-2.5" data-testid="discovery-dimensions">
          {dimensions.map((dm) => {
            const active = dm.key === focus;
            return (
              <Link
                key={dm.key}
                href={`/find-your-tradition?focus=${dm.key}`}
                scroll={false}
                className={`rounded-full border px-4 py-2 text-sm font-bold transition ${active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand hover:text-brand-700'}`}
              >
                {dm.label}
              </Link>
            );
          })}
        </div>
      </section>

      {focus && (
        <section className="container-x pb-16" data-testid="discovery-results">
          {!result || (result.traditions.length === 0 && !result.by_city) ? (
            <p className="rounded-2xl border border-line bg-cream p-8 text-center text-muted">
              No NOSTOPS teachers have declared traditions matching <strong>{titleCase(focus)}</strong> yet. Try another interest, or <Link href="/teachers" className="font-bold text-brand-700 hover:underline">browse all teachers</Link>.
            </p>
          ) : result.by_city ? (
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Cities with NOSTOPS teachers</h2>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {result.cities.map((c) => (
                  <Link key={c.city_id} href={`/yoga-teachers/${c.city_id}`} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand-700">
                    {titleCase(c.city_id)} · {c.teacher_count}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="max-w-3xl">
                <h2 className="text-2xl font-extrabold tracking-tight text-ink">Traditions that emphasise {result.label.toLowerCase()}</h2>
                {result.practices.length > 0 && (
                  <p className="mt-2 text-muted">Related practices: {result.practices.map((p) => p.name).join(' · ')}</p>
                )}
              </div>
              <ul className="mt-6 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2">
                {result.traditions.map((t) => (
                  <li key={t.id} className="card flex h-full flex-col p-6">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/yoga-parampara/${t.slug}`} className="text-lg font-extrabold tracking-tight text-ink hover:text-brand-700">{t.display_name}</Link>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isModern(t.classification) ? 'bg-accent/15 text-accent-700' : 'bg-royal-50 text-royal'}`}>{isModern(t.classification) ? 'Modern' : 'Historical'}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{t.classification}{t.teacher_count > 0 ? ` · ${t.teacher_count} teacher${t.teacher_count === 1 ? '' : 's'} on NOSTOPS` : ''}</p>
                    {t.description && <p className="clamp-3 mt-2 text-sm leading-relaxed text-muted">{t.description}</p>}
                    <div className="mt-auto grid grid-cols-1 gap-1.5 pt-4 text-sm font-bold sm:grid-cols-2">
                      <Link href={`/yoga-parampara/${t.slug}`} className="text-brand-700 hover:underline">Explore this tradition →</Link>
                      <Link href={`/yoga-parampara/${t.slug}#teachers`} className="text-brand-700 hover:underline">Meet teachers →</Link>
                      <Link href={`/yoga-parampara/${t.slug}`} className="text-ink-soft hover:text-brand-700">Learn the guru lineage →</Link>
                      <Link href={`/yoga-parampara/${t.slug}`} className="text-ink-soft hover:text-brand-700">Explore scriptures & practices →</Link>
                    </div>
                  </li>
                ))}
              </ul>
              {result.cities.length > 0 && (
                <div className="mt-8 rounded-2xl border border-line bg-cream p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Find teachers near you</h3>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {result.cities.map((c) => (
                      <Link key={c.city_id} href={`/yoga-teachers/${c.city_id}`} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-soft ring-1 ring-line hover:text-brand-700">
                        {titleCase(c.city_id)} · {c.teacher_count}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <p className="mt-6 text-center text-sm"><Link href="/teachers" className="font-bold text-brand-700 hover:underline">Or browse & book any teacher →</Link></p>
        </section>
      )}
    </main>
  );
}
