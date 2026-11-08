import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canonical } from '@/lib/site';
import { fitDescription, normalizeJsonLd } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { titleCase } from '@/lib/format';
import { getCities, cityDirectoryFaqs } from '@/lib/server/cities';
import { getYogaCity, type YogaCity } from '@/lib/server/yoga-city';
import CityTeacherDiscovery from '@/components/city/CityTeacherDiscovery';
import PurposeQuiz from '@/components/city/PurposeQuiz';
import CityCoordinatorSpotlight from '@/components/city/CityCoordinatorSpotlight';
import CityYogaTraditions from '@/components/city/CityYogaTraditions';
import { getCityCoordinator } from '@/lib/server/city-coordinator';
import { isCoordinatorCity, COORDINATOR_ENABLED } from '@/lib/city-coordinator-cities';
import RetreatCard from '@/components/retreats/RetreatCard';
import VenueCard from '@/components/venues/VenueCard';
import { withGoogleCovers } from '@/lib/server/ai-assisted-venues';
import RetreatFaq from '@/components/retreats/RetreatFaq';
import CityClaimedListings from '@/components/city/CityClaimedListings';
import { listClaimedProvisional } from '@/lib/server/discovery';

// Public SEO content → ISR. Short-ish revalidate so a newly published/empanelled
// teacher (or a new retreat/venue) reflects automatically without a code change.
export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  const cities = await getCities();
  return cities.map((c) => ({ city: c.slug }));
}

const HOME_URL = canonical('/');

function metaDescription(d: YogaCity): string {
  const bits: string[] = [];
  bits.push(`Find ${d.teacherCount} verified yoga ${d.teacherCount === 1 ? 'teacher' : 'teachers'} in ${d.label} on NOSTOPS`);
  if (d.traditions.length) bits.push(`across styles like ${d.traditions.slice(0, 3).map((t) => t.label).join(', ')}`);
  return fitDescription(`${bits.join(' ')}. Book private, group, online or corporate yoga with teacher-first teachers.`);
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const d = await getYogaCity(city);
  if (!d) return { title: 'City not found · NOSTOPS', robots: { index: false, follow: false } };
  const url = canonical(`/yoga-teachers/${d.slug}`);
  const title = `Yoga Teachers in ${d.label}`;
  const description = metaDescription(d);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { type: 'website', siteName: 'NOSTOPS', url, title: `${title} · NOSTOPS`, description },
    twitter: { card: 'summary_large_image', title: `${title} · NOSTOPS`, description },
  };
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-xs font-semibold text-white/70">{label}</p>
    </div>
  );
}

function SectionHead({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <span className="text-xs font-bold uppercase tracking-wider text-brand-700">{kicker}</span>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-ink md:text-3xl">{title}</h2>
      {sub && <p className="mt-2 max-w-3xl text-ink-soft">{sub}</p>}
    </div>
  );
}

export default async function YogaCityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const d = await getYogaCity(city);
  if (!d) notFound();
  const cityVenues = await withGoogleCovers(d.venues.slice(0, 6));
  // Claimed provisional listings in this city (owner rule: claimed = public). Shown in their own
  // section — not counted in the city's teacher numbers or its structured data.
  const claimed = await listClaimedProvisional({ city: d.slug, revalidate: 60 }).catch(() => []);

  // Optional City Coordinator (contract-first — null until the backend ships it).
  const coordinator = await getCityCoordinator(d.slug);

  const url = canonical(`/yoga-teachers/${d.slug}`);

  // ── JSON-LD: CollectionPage → ItemList(Person) + BreadcrumbList + FAQPage ──
  const collectionPage = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#directory`,
    url,
    name: `Yoga Teachers in ${d.label}`,
    description: metaDescription(d),
    isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: HOME_URL },
    about: { '@type': 'Place', name: d.label, address: { '@type': 'PostalAddress', addressLocality: d.label, addressCountry: 'IN' } },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: d.teacherCount,
      itemListElement: d.teachers.map((t, i) => {
        const turl = canonical(`/teachers/${t.handle}`);
        return {
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Person',
            '@id': turl,
            name: t.name,
            url: turl,
            jobTitle: 'Yoga Teacher',
            address: { '@type': 'PostalAddress', addressLocality: d.label, addressCountry: 'IN' },
            ...(t.parampara ? { knowsAbout: titleCase(t.parampara) } : {}),
          },
        };
      }),
    },
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
      { '@type': 'ListItem', position: 2, name: 'Yoga Teachers', item: canonical('/teachers') },
      { '@type': 'ListItem', position: 3, name: d.label, item: url },
    ],
  };
  const faqs = cityDirectoryFaqs({ label: d.label, count: d.teacherCount, styles: d.styles, paramparas: d.paramparas });
  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  const upcomingRetreats = d.retreats.filter((r) => r.status !== 'sold_out').slice(0, 3);
  const showRetreats = upcomingRetreats.length > 0 || d.nearbyRetreats.length > 0;

  return (
    <div>
      <JsonLd data={normalizeJsonLd([collectionPage, breadcrumb, faqPage])} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-ink via-royal to-brand">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="container-x relative py-14 md:py-20">
          <nav className="text-xs text-white/70" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">Home</Link> <span className="px-1">/</span>
            <Link href="/teachers" className="hover:text-white"> Yoga Teachers</Link> <span className="px-1">/</span>
            <span className="text-white"> {d.label}</span>
          </nav>
          <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
            Yoga Teachers in {d.label}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/85">
            A living community of verified, teacher-first yoga teachers in {d.label} — discover a teacher by tradition, purpose,
            experience or format, and book authentic practice directly.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Stat value={d.teacherCount} label={d.teacherCount === 1 ? 'Teacher' : 'Teachers'} />
            {d.empanelledCount > 0 && <Stat value={d.empanelledCount} label="Council empanelled" />}
            {d.verifiedCount > 0 && <Stat value={d.verifiedCount} label="Verified" />}
            {d.traditionCount > 0 && <Stat value={d.traditionCount} label="Traditions & styles" />}
          </div>
        </div>
      </section>

      {/* Momentum — honest rolling-window recent joins (only when real). */}
      {d.recentJoins > 0 && (
        <div className="border-b border-line bg-brand-50/60" data-testid="city-momentum">
          <div className="container-x py-3">
            <p className="text-center text-sm font-semibold text-brand-700">
              🌱 {d.recentJoins} {d.recentJoins === 1 ? 'teacher' : 'teachers'} joined {d.label} in the last {d.momentumDays} days — the community is growing.
            </p>
          </div>
        </div>
      )}

      {/* Discovery */}
      <section id="teachers" className="container-x py-12 md:py-14">
        <SectionHead
          kicker="Find your teacher"
          title={`Discover yoga teachers in ${d.label}`}
          sub="Search and filter by tradition, purpose, experience, language, teaching format and more — every filter runs on real profile data."
        />
        <CityTeacherDiscovery teachers={d.teachers} cityLabel={d.label} />
      </section>

      <CityClaimedListings listings={claimed} cityLabel={d.label} />

      {/* Yoga Traditions in [City] — Knowledge-Graph inventory (renders only when teachers exist) */}
      <CityYogaTraditions city={d.slug} cityLabel={d.label} />

      {/* City Coordinator Spotlight (renders only when backend provides one) */}
      {coordinator && (
        <section className="container-x pb-4">
          <CityCoordinatorSpotlight coordinator={coordinator} cityLabel={d.label} cityTeacherCount={d.teacherCount} />
        </section>
      )}

      {/* Open City Coordinator seat — funnel empanelled teachers to apply. Shows
          only for the nine coordinator cities that don't yet have a coordinator. */}
      {COORDINATOR_ENABLED && !coordinator && isCoordinatorCity(d.slug) && (
        <section className="container-x pb-4" data-testid="city-become-coordinator">
          <Link
            href="/city-coordinator"
            className="flex flex-col items-start gap-4 rounded-3xl border border-brand/20 bg-brand-50/50 p-6 transition hover:border-brand/40 md:flex-row md:items-center md:justify-between md:p-8"
          >
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-brand-700">City Coordinator · Seat open</p>
              <p className="mt-1 text-lg font-black tracking-tight text-ink md:text-xl">Become the City Coordinator in {d.label}</p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">
                Empanelled NOSTOPS teachers at Yoga Level 2 &amp; Level 3 can lead the teacher-first movement in {d.label}.
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white">
              Become the coordinator here <span aria-hidden>→</span>
            </span>
          </Link>
        </section>
      )}

      {/* Yoga Traditions */}
      {d.traditions.length > 0 && (
        <section className="bg-cream">
          <div className="container-x py-12 md:py-14">
            <SectionHead kicker="Explore by tradition" title={`Yoga traditions & styles in ${d.label}`} sub="Browse teachers by the style or school they teach." />
            <div className="flex flex-wrap gap-2.5">
              {d.traditions.map((t) => (
                <Link
                  key={t.slug}
                  href={`/yoga-teachers/${d.slug}/${t.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-brand hover:bg-brand-50/50 hover:text-brand-700"
                  data-testid="city-tradition-link"
                >
                  {titleCase(t.label)}
                  <span className="rounded-full bg-brand-50 px-1.5 text-xs font-bold text-brand-700">{t.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Yoga by Purpose */}
      {d.purposes.length > 0 && (
        <section className="container-x py-12 md:py-14">
          <SectionHead kicker="Explore by purpose" title={`Yoga by purpose in ${d.label}`} sub="Find a teacher for what you are seeking — calm and clarity, physical wellbeing, or gentle adaptive practice." />
          <PurposeQuiz
            citySlug={d.slug}
            cityLabel={d.label}
            purposes={d.purposes.map((p) => ({ id: p.id, slug: p.slug, label: p.label, emoji: p.emoji, tagline: p.tagline, count: p.count }))}
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {d.purposes.map((p) => (
              <Link
                key={p.id}
                href={`/yoga-teachers/${d.slug}/${p.slug}`}
                className="card group flex items-start gap-4 p-5 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md"
                data-testid="city-purpose-link"
              >
                <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-2xl">{p.emoji}</span>
                <span className="min-w-0">
                  <span className="block font-black text-ink group-hover:text-brand-700">{p.label}</span>
                  <span className="mt-0.5 block text-sm text-muted">{p.tagline}</span>
                  <span className="mt-1.5 block text-xs font-bold text-brand-700">{p.count} {p.count === 1 ? 'teacher' : 'teachers'} →</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Localities — renders only when profiles actually capture an area
          (no thin/empty section otherwise; activates automatically). */}
      {d.localities.length > 0 && (
        <section className="bg-cream">
          <div className="container-x py-12 md:py-14">
            <SectionHead kicker="Explore by area" title={`Yoga teachers by locality in ${d.label}`} sub="Find a teacher in your neighbourhood." />
            <div className="flex flex-wrap gap-2.5">
              {d.localities.map((l) => (
                <Link
                  key={l.slug}
                  href={`/yoga-teachers/${d.slug}/${l.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-brand hover:bg-brand-50/50 hover:text-brand-700"
                  data-testid="city-locality-link"
                >
                  {titleCase(l.label)}
                  <span className="rounded-full bg-brand-50 px-1.5 text-xs font-bold text-brand-700">{l.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Retreats & experiences */}
      {showRetreats && (
        <section className="bg-cream">
          <div className="container-x py-12 md:py-14">
            <SectionHead
              kicker="Deepen your practice"
              title={upcomingRetreats.length > 0 ? `Yoga retreats in ${d.label}` : `Retreats near ${d.label}`}
              sub="Immersive, teacher-led experiences — each links to its full NOSTOPS record."
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(upcomingRetreats.length > 0 ? upcomingRetreats : d.nearbyRetreats).map((r) => (
                <RetreatCard key={r.id} r={r} />
              ))}
            </div>
            <Link href="/retreats" className="mt-6 inline-block text-sm font-bold text-brand-700 hover:underline">Browse all retreats →</Link>
          </div>
        </section>
      )}

      {/* Venues (only when the city actually has public venues) */}
      {d.venues.length > 0 && (
        <section className="container-x py-12 md:py-14">
          <SectionHead kicker="Where practice happens" title={`Yoga venues in ${d.label}`} sub="Studios, shalas and retreat spaces that host NOSTOPS teachers." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cityVenues.map((v) => (
              <VenueCard key={v.id} v={v} />
            ))}
          </div>
        </section>
      )}

      {/* Corporate CTA → existing NOSTOPS corporate workflow */}
      <section className="container-x py-4">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-gradient-to-br from-royal/5 to-brand/5 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-lg font-extrabold text-ink">Corporate yoga in {d.label}?</p>
            <p className="mt-1 max-w-xl text-sm text-ink-soft">
              Bring authentic, teacher-led yoga to your team. NOSTOPS routes corporate & group programmes to verified teachers in {d.label}.
            </p>
          </div>
          <Link href="/for-organisations/companies" className="shrink-0 rounded-xl bg-royal px-5 py-3 text-sm font-bold text-white transition hover:opacity-90" data-testid="city-corporate-cta">
            Explore corporate yoga →
          </Link>
        </div>
      </section>

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="container-x py-10">
          <SectionHead kicker="Good to know" title={`Yoga teachers in ${d.label} — FAQs`} />
          <RetreatFaq items={faqs} />
        </section>
      )}

      {/* Nearby cities + recruit CTA */}
      <section className="container-x pb-16">
        {d.nearbyCities.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Yoga teachers in other cities</h3>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {d.nearbyCities.map((c) => (
                <Link
                  key={c.slug}
                  href={`/yoga-teachers/${c.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand-700"
                >
                  {titleCase(c.label)}
                  <span className="rounded-full bg-brand-50 px-1.5 text-xs font-bold text-brand-700">{c.count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-white p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-lg font-extrabold text-ink">Teach yoga in {d.label}?</p>
            <p className="mt-1 text-sm text-ink-soft">Join {d.teacherCount} {d.teacherCount === 1 ? 'teacher' : 'teachers'} already carrying the tradition forward in {d.label}.</p>
          </div>
          <Link href={`/become-a-teacher/${d.slug}`} className="shrink-0 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600">
            Become a teacher →
          </Link>
        </div>
      </section>
    </div>
  );
}
