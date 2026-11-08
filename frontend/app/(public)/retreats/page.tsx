import type { Metadata } from 'next';
import Link from 'next/link';
import { normalizeJsonLd } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import PageHero from '@/components/PageHero';
import { resolveEligibleHero } from '@/lib/server/ai-assisted-venues';
import { getVenues } from '@/lib/server/venues';
import { HeroPhotoCredit } from '@/components/HeroPhotoCredit';
import { getPublicRetreats, type PublicRetreat } from '@/lib/server/retreats';
import { getVerifiedMatcher } from '@/lib/server/venue-submissions-local';
import { citySlug } from '@/lib/server/cities';
import RetreatsExplorer from '@/components/retreats/RetreatsExplorer';
import RetreatCard from '@/components/retreats/RetreatCard';
import RetreatFaq from '@/components/retreats/RetreatFaq';
import { retreatPath } from '@/lib/retreat-url';

// Availability/status changes often -> shorter ISR window.
export const revalidate = 900;

const PATH = '/retreats';
const CANONICAL_URL = canonical(PATH);
const HOME_URL = canonical('/');
const HOST_HREF = '/app/teacher/retreats/new'; // existing Host-a-Retreat workflow
const VENUES_HREF = '/venues';                  // existing venue discovery
const DIRECTORY_ANCHOR = '#retreats-directory';

export async function generateMetadata(): Promise<Metadata> {
  const { retreats } = await getPublicRetreats();
  const n = retreats.length;
  const description =
    n > 0
      ? `Discover ${n} teacher-led yoga retreats across India — immersive, lineage-rooted gatherings shaped by the teacher, the setting, and the community that gathers.`
      : 'Teacher-led yoga retreats across India — immersive, lineage-rooted gatherings shaped by the teacher, the setting, and the community that gathers.';
  return {
    title: 'Yoga Retreats — Teacher-Led Experiences',
    description,
    alternates: { canonical: CANONICAL_URL },
    openGraph: { type: 'website', siteName: 'NOSTOPS', url: CANONICAL_URL, title: 'Step Away. Reconnect. Return Renewed. · NOSTOPS Retreats', description },
    twitter: { card: 'summary_large_image', title: 'Step Away. Reconnect. Return Renewed. · NOSTOPS Retreats', description },
  };
}

// ── Section H — FAQ (verified facts; FAQPage JSON-LD) ───────────────────────
const FAQS: { q: string; a: string }[] = [
  { q: 'Who creates a retreat on NOSTOPS?', a: 'Retreats are created and led by eligible NOSTOPS teachers — Level 2 (Yoga Pracharak), Level 3 (Yoga Guru) and Council Gurus. The teacher brings the practice, the purpose and the community together.' },
  { q: 'Can I explore retreats without creating one?', a: 'Yes. Anyone can browse published retreats freely — no account is needed to explore. Creating a retreat is a separate, teacher-only workflow.' },
  { q: 'How does a yoga teacher select a venue?', a: 'Inside the existing Host a Retreat workflow, the teacher chooses from existing eligible listed venues. Selecting a venue is part of creating the retreat.' },
  { q: 'Can a teacher use a venue submitted by another teacher or a venue owner?', a: 'Yes — once that venue has been reviewed and is an eligible listed venue. A pending or unapproved submission cannot be used to publish a retreat.' },
  { q: 'Does selecting a venue confirm a booking?', a: 'No. Selecting a venue links the retreat to a listed space for discovery. It does not reserve the property or establish the owner’s consent — teachers follow the venue’s own arrangements and booking process.' },
  { q: 'Is basic retreat creation free?', a: 'Yes. Creating and publishing a basic retreat on NOSTOPS is free (₹0).' },
  { q: 'Can teachers invite their own groups?', a: 'Where the retreat’s configuration supports it, teachers can bring their own community and invite participants alongside open signups.' },
  { q: 'Can participants register individually?', a: 'Where a retreat supports individual signups, participants can reserve a seat or enquire on the retreat’s detail page. A seat is only held once the participant confirms.' },
  { q: 'How can venue owners make their spaces discoverable?', a: 'Venue owners (and anyone who knows a suitable space) can submit a venue for free at /venues/submit. Every space is reviewed for suitability before it becomes publicly discoverable.' },
];

function eventFor(r: PublicRetreat): any {
  const url = canonical(retreatPath(r));
  const ev: any = {
    '@type': 'EducationEvent',
    '@id': url,
    name: r.title,
    url,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
  };
  if (r.description) ev.description = r.description;
  if (r.startDate) ev.startDate = r.startDate;
  if (r.endDate) ev.endDate = r.endDate;
  const address: any = { '@type': 'PostalAddress', addressCountry: 'IN' };
  if (r.city) address.addressLocality = r.city;
  if (r.state) address.addressRegion = r.state;
  ev.location = { '@type': 'Place', ...(r.venueName ? { name: r.venueName } : {}), address };
  if (typeof r.priceInr === 'number') {
    ev.offers = {
      '@type': 'Offer',
      price: String(r.priceInr),
      priceCurrency: 'INR',
      url,
      availability: r.status === 'sold_out' || r.seatsRemaining === 0 ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
    };
  }
  ev.organizer = { '@type': 'Organization', name: 'NOSTOPS', url: HOME_URL };
  if (r.guruName) ev.performer = { '@type': 'Person', name: r.guruName };
  return ev;
}

export default async function RetreatsPage() {
  const { retreats, error } = await getPublicRetreats();
  const isVerified = await getVerifiedMatcher().catch(() => (() => false));
  const verifiedRetreats = retreats.filter((r) => isVerified({ venuePartnerId: r.venuePartnerId, name: r.venueName, city: r.city }));
  const verifiedIds = verifiedRetreats.map((r) => r.id);

  // Featured = real records only (verified-venue retreats first, else soonest).
  const featuredPool = verifiedRetreats.length ? verifiedRetreats : retreats;
  const featured = featuredPool.slice(0, 6);
  const featuredVerified = verifiedRetreats.length > 0;

  const heroImage = retreats.find((r) => r.coverImage || r.images[0]);
  const coverSrc = heroImage?.coverImage || heroImage?.images[0] || null;
  // Curated hero: a Google listing photo of a featured retreat's venue — only
  // when that venue is eligible (grandfathered or paid). Else cover / gradient.
  const heroVenues = await getVenues().catch(() => []);
  const googleHero = await resolveEligibleHero(
    featured.map((r) => heroVenues.find((v) => v.id === r.venuePartnerId)).filter((v): v is (typeof heroVenues)[number] => !!v),
  );
  const heroSrc = googleHero ? `/bff/venue-photo/hero?place_id=${encodeURIComponent(googleHero.placeId)}` : coverSrc;

  // Distinct locations for internal linking to /retreats/in/{city} pages.
  const locations = Array.from(
    retreats.reduce((m, r) => {
      if (r.city) {
        const slug = citySlug(r.city);
        const cur = m.get(slug) || { label: r.city, count: 0 };
        cur.count += 1;
        m.set(slug, cur);
      }
      return m;
    }, new Map<string, { label: string; count: number }>()),
  )
    .map(([slug, v]) => ({ slug, ...v }))
    .sort((a, b) => b.count - a.count);

  const jsonld = normalizeJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${CANONICAL_URL}#retreats`,
      url: CANONICAL_URL,
      name: 'NOSTOPS Yoga Retreats',
      isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: HOME_URL },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: retreats.length,
        itemListElement: retreats.map((r, i) => ({ '@type': 'ListItem', position: i + 1, item: eventFor(r) })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
        { '@type': 'ListItem', position: 2, name: 'Retreats', item: CANONICAL_URL },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${CANONICAL_URL}#faq`,
      mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]);

  return (
    <main className="pb-20">
      <JsonLd data={jsonld} />

      {/* ── BREADCRUMB ──────────────────────────────────────────────── */}
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-soft">Retreats</span>
        </div>
      </nav>

      {/* ══ SECTION A — HERO ═══════════════════════════════════════════ */}
      <PageHero
        eyebrow="🌿 The Teacher is the Purpose"
        title="Step Away. Reconnect. Return Renewed."
        subtitle="Discover teacher-led yoga retreats that create space for practice, reflection, and meaningful connection. Explore experiences shaped by the teacher, the setting, and the community that gathers."
        imageSrc={heroSrc}
        attribution={googleHero ? <HeroPhotoCredit attributions={googleHero.attributions} /> : undefined}
        size="tall"
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href={DIRECTORY_ANCHOR} data-analytics="browse_retreats_click" data-testid="hero-explore" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-700 shadow-sm transition hover:bg-cream">Explore Retreats</Link>
          <Link href={HOST_HREF} data-analytics="host_retreat_click" data-testid="hero-host" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-accent-600">Host a Retreat — Free <span aria-hidden>→</span></Link>
        </div>
        {retreats.length > 0 && (
          <p className="mt-6 text-sm font-semibold text-white/70">{retreats.length} teacher-led {retreats.length === 1 ? 'retreat' : 'retreats'} across India</p>
        )}
      </PageHero>

      {/* ══ SECTION B — DISCOVER YOUR NEXT RETREAT ═════════════════════ */}
      <section id="retreats-directory" className="container-x mt-14 scroll-mt-4 md:mt-20" aria-label="Discover retreats">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Discover your next retreat</h2>
          <p className="mt-2 text-ink-soft">Search and filter genuine published retreats by place, focus and availability.</p>
        </div>
        {error ? (
          <div className="card p-8 text-center" data-testid="retreats-error">
            <p className="text-lg font-semibold text-ink">Retreats are temporarily unavailable.</p>
            <p className="mt-2 text-muted">Please try again shortly.</p>
          </div>
        ) : retreats.length === 0 ? (
          <div className="card p-10 text-center" data-testid="retreats-empty">
            <span aria-hidden className="text-4xl">🧘</span>
            <p className="mt-3 text-lg font-bold text-ink">New experiences are on their way.</p>
            <p className="mx-auto mt-1 max-w-md text-ink-soft">Retreats appear here as teachers publish them. In the meantime, <Link href={VENUES_HREF} className="font-bold text-brand-700 hover:underline">explore venues</Link> or, if you teach, <Link href={HOST_HREF} className="font-bold text-brand-700 hover:underline">host a retreat</Link>.</p>
          </div>
        ) : (
          <>
            {locations.length > 0 && (
              <div className="mb-8 text-center">
                <p className="text-xs font-black uppercase tracking-wider text-muted">Browse by location</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {locations.map((loc) => (
                    <Link key={loc.slug} href={`/retreats/in/${loc.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-bold text-ink-soft transition hover:border-accent hover:text-accent-600">
                      <span aria-hidden>📍</span> {loc.label}
                      <span className="text-xs font-semibold text-muted">({loc.count})</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <RetreatsExplorer retreats={retreats} verifiedIds={verifiedIds} />
          </>
        )}
      </section>

      {/* ══ SECTION C — FEATURED RETREATS (real records) ═══════════════ */}
      {retreats.length > 0 && (
        <section className="container-x mt-16 md:mt-24" aria-label="Featured retreats" data-testid="featured-retreats">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              {featuredVerified && <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">🛡️ NOSTOPS Verified</span>}
              <h2 className="mt-3 text-2xl font-black tracking-tight text-ink sm:text-3xl">Featured retreats</h2>
              <p className="mt-2 text-ink-soft">{featuredVerified ? 'Immersions held at venues our team has verified.' : 'A handful of teacher-led experiences to begin with.'}</p>
            </div>
            <Link href={DIRECTORY_ANCHOR} className="text-sm font-bold text-accent-600 hover:underline">Explore all retreats →</Link>
          </div>
          <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((r) => (
              <li key={r.id}><RetreatCard r={r} /></li>
            ))}
          </ul>
        </section>
      )}

      {/* ══ SECTION D — THE TEACHER MAKES THE RETREAT ══════════════════ */}
      <section id="teacher-first" className="container-x mt-16 scroll-mt-4 md:mt-24" aria-label="The teacher makes the retreat">
        <div className="rounded-3xl border border-royal/15 bg-royal-50/40 p-6 sm:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-royal">The Teacher is the Purpose</span>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-ink sm:text-3xl">Every Meaningful Retreat Begins with a Teacher.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
              Behind every retreat is a teacher who brings a practice, a purpose, and a community together. NOSTOPS supports that journey by connecting teachers with eligible venues and helping participants discover teacher-led experiences.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: '🧘', t: 'Yoga teacher', d: 'An eligible NOSTOPS teacher brings the practice and the community.' },
              { icon: '🏡', t: 'Eligible listed venue', d: 'The teacher creates the retreat using an existing, approved listed venue.' },
              { icon: '🎪', t: 'Teacher-created retreat', d: 'One retreat, configured by the teacher with supported fields.' },
              { icon: '🤝', t: 'Group or individual', d: 'Welcome your own community and individual signups where the retreat supports it.' },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl border border-line bg-white p-5">
                <p className="text-2xl">{x.icon}</p>
                <p className="mt-2 text-sm font-black text-ink">{x.t}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{x.d}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted">
            Venue owners or other teachers may submit or recommend venues through the existing venue workflows — but a pending or unapproved venue is not eligible for retreat publication.
          </p>
          <div className="mt-6 text-center">
            <Link href={HOST_HREF} data-analytics="create_retreat_click" data-testid="teacher-create" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-royal px-6 py-3 text-sm font-bold text-white transition hover:opacity-90">Create Your Retreat — Free</Link>
          </div>
        </div>
      </section>

      {/* ══ SECTION E — FIND A VENUE FOR YOUR RETREAT ══════════════════ */}
      <section className="container-x mt-16 md:mt-24" aria-label="Find a venue for your retreat">
        <div className="grid items-center gap-6 rounded-3xl border border-brand/15 bg-gradient-to-br from-brand-50 to-cream p-6 sm:p-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">The Right Setting for Your Practice.</h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-soft">Explore listed venues that may suit your teaching, retreat format, and community.</p>
            <p className="mt-3 max-w-xl text-sm text-muted">Viewing or selecting a venue does not confirm a booking, reserve the property, or establish the owner’s consent — follow the venue’s existing arrangements and booking process. Not every listed venue is suitable or available for every retreat.</p>
            <Link href={VENUES_HREF} data-analytics="explore_venues_click" data-testid="bridge-venues" className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">Explore Venues →</Link>
          </div>
          <div className="hidden place-items-center lg:grid">
            <span aria-hidden className="text-7xl opacity-80">🏔️</span>
          </div>
        </div>
      </section>

      {/* ══ SECTION F — HOW RETREAT PARTICIPATION WORKS ════════════════ */}
      <section className="container-x mt-16 md:mt-24" aria-label="How retreat participation works">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">How it works</h2>
          <p className="mt-2 text-ink-soft">Two simple paths — one for those joining a retreat, one for teachers creating one.</p>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-line bg-white p-6">
            <p className="text-sm font-black uppercase tracking-wide text-brand-700">For participants</p>
            <ol className="mt-4 list-none space-y-3 p-0">
              {[
                'Discover a published retreat.',
                'Review the retreat details, teacher, venue and schedule.',
                'Reserve a seat or enquire using the options on the retreat’s page, where available.',
                'Follow the confirmation and participation instructions shown.',
              ].map((s, i, arr) => (
                <li key={s} className="relative flex gap-3">
                  {i < arr.length - 1 && (
                    <span aria-hidden className="pointer-events-none absolute left-[14px] top-[14px] z-0 h-[calc(100%+0.75rem)] w-px bg-brand/25" />
                  )}
                  <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-black text-white">{i + 1}</span>
                  <span className="text-sm leading-relaxed text-ink-soft">{s}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-3xl border border-royal/20 bg-royal-50/30 p-6">
            <p className="text-sm font-black uppercase tracking-wide text-royal">For teachers</p>
            <ol className="mt-4 list-none space-y-3 p-0">
              {[
                'Explore eligible listed venues.',
                'Select a venue inside the Host a Retreat workflow.',
                'Configure the retreat using the supported fields.',
                'Publish through the existing eligibility and validation process.',
                'Share the published retreat through supported links and channels.',
              ].map((s, i, arr) => (
                <li key={s} className="relative flex gap-3">
                  {i < arr.length - 1 && (
                    <span aria-hidden className="pointer-events-none absolute left-[14px] top-[14px] z-0 h-[calc(100%+0.75rem)] w-px bg-royal/25" />
                  )}
                  <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-royal text-xs font-black text-white">{i + 1}</span>
                  <span className="text-sm leading-relaxed text-ink-soft">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-center text-xs text-muted">A seat is only held once a participant confirms. Retreat creation, venue eligibility and registration each follow their own existing steps.</p>
      </section>

      {/* ══ SECTION G — INVITE PARTICIPANTS & GROW A COMMUNITY ═════════ */}
      <section className="container-x mt-16 md:mt-24" aria-label="Invite participants and grow a community">
        <div className="rounded-3xl border border-accent/20 bg-accent/5 p-6 text-center sm:p-10">
          <span aria-hidden className="text-3xl">🌱</span>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-ink sm:text-3xl">Invite participants and grow a community</h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
            Bring your own community, invite participants, and welcome individual signups — wherever your retreat’s configuration supports these options. NOSTOPS helps people discover your teacher-led experience; it does not guarantee attendance, revenue, or an audience.
          </p>
          <Link href={HOST_HREF} data-analytics="host_retreat_click" data-testid="community-host" className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white transition hover:bg-accent-600">Host a Retreat — Free</Link>
        </div>
      </section>

      {/* ══ SECTION H — FAQ (+ FAQPage JSON-LD) ════════════════════════ */}
      <section className="container-x mt-16 md:mt-24" aria-label="Retreats FAQ">
        <RetreatFaq items={FAQS} />
      </section>

      {/* ══ SECTION I — CLOSING CTA ════════════════════════════════════ */}
      <section className="container-x mt-16 scroll-mt-4 md:mt-24">
        <div className="rounded-3xl border border-brand/15 bg-gradient-to-br from-brand-50 to-cream p-6 text-center sm:p-12">
          <p className="mx-auto max-w-2xl text-2xl font-black tracking-tight text-ink sm:text-3xl">Your Practice Can Become a Shared Journey.</p>
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">Explore teacher-led retreats or begin creating an experience of your own through NOSTOPS.</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={DIRECTORY_ANCHOR} data-analytics="browse_retreats_click" data-testid="closing-explore" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">Explore Retreats</Link>
            <Link href={HOST_HREF} data-analytics="create_retreat_click" data-testid="closing-create" className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-brand bg-white px-6 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50">Create Your Retreat — Free</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
