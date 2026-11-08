import type { Metadata } from 'next';
import { type ReactNode } from 'react';
import Link from 'next/link';
import { normalizeJsonLd } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { resolveEligibleHero, enhancedVenueIds, withGoogleCovers } from '@/lib/server/ai-assisted-venues';
import { HeroPhotoCredit } from '@/components/HeroPhotoCredit';
import { getVenues, venuePath, venueCitySlug, type PublicVenue } from '@/lib/server/venues';
import GuidesPromo from '@/components/GuidesPromo';
import { getPublicRetreats } from '@/lib/server/retreats';
import { getVerifiedMatcher } from '@/lib/server/venue-submissions-local';
import VenueExplorer from '@/components/venues/VenueExplorer';
import { tier2PreviewEnabled } from '@/lib/server/flags';

export const revalidate = 900;

const PATH = '/venues';
const CANONICAL_URL = canonical(PATH);
const HOME_URL = canonical('/');

// Existing NOSTOPS routes ONLY — no new workflow is introduced.
const SUBMIT_HREF = '/venues/submit';        // free manual listing (public, no account)
const AI_HREF = '/venues/ai-onboarding';     // existing AI-assisted onboarding (flag-gated)
const CONTACT_HREF = '/contact';             // existing enquiry route (marketing/PR)
const RETREATS_HREF = '/retreats';           // existing retreat discovery
const HOST_RETREAT_HREF = '/app/teacher/retreats/new'; // existing Host-a-Retreat workflow
const DIRECTORY_ANCHOR = '#venues-directory';

export async function generateMetadata(): Promise<Metadata> {
  const venues = await getVenues();
  const n = venues.length;
  const description =
    n > 0
      ? `Discover ${n}+ yoga & retreat venues across India on NOSTOPS — connect with teachers and retreat creators. Free listing, optional AI onboarding.`
      : 'Bring your venue into the NOSTOPS yoga ecosystem — connect with teachers and retreat creators. Free listing, optional AI onboarding.';
  return {
    title: 'Yoga & Retreat Venues — A Space for Practice',
    description,
    alternates: { canonical: CANONICAL_URL },
    openGraph: { type: 'website', siteName: 'NOSTOPS', url: CANONICAL_URL, title: 'A Space for Practice. A Place for Transformation. · NOSTOPS', description },
    twitter: { card: 'summary_large_image', title: 'A Space for Practice. A Place for Transformation. · NOSTOPS', description },
  };
}

// ── Section G — FAQ (verified facts + approved prices; FAQPage JSON-LD) ──────
const FAQS: { q: string; a: string }[] = [
  { q: 'Is listing my venue free?', a: 'Yes. Basic venue listing is completely free (₹0) and always will be. You add your venue details and one or two photos and submit for review — no account, subscription or AI purchase required.' },
  { q: 'Can I create a retreat for free?', a: 'Yes. Eligible teachers can create and publish a retreat for free using the existing Host a Retreat workflow and select a listed venue. Creating a retreat is free and is separate from any booking.' },
  { q: 'Do I need AI onboarding?', a: 'No. AI-assisted onboarding is optional — a one-time ₹1,999 plus applicable GST in India that simply helps complete your listing faster. The international price is US$30, but international checkout is temporarily unavailable while PayPal checkout is being prepared. The free manual listing is never gated behind it.' },
  { q: 'Can I update my venue information?', a: 'Yes. You can update your venue details through your submission’s secure edit link. Significant changes may be re-checked before they appear publicly.' },
  { q: 'Will my venue be published immediately?', a: 'No. Every submission is reviewed by NOSTOPS for suitability before it goes live. A submission is not the same as a published, bookable venue, and approval is not guaranteed.' },
  { q: 'How can I connect with teachers and retreat creators?', a: 'Once published, your venue becomes discoverable to verified teachers, retreat creators and organisations across NOSTOPS. Listing improves discoverability; it does not guarantee bookings or leads.' },
];

// ── Section C — three service tiers ─────────────────────────────────────────
type Tier = {
  key: string;
  label: string;        // coloured header-bar text, e.g. "Tier 1 — Free Forever"
  chipText: string;     // top-right chip
  name: string;
  price: string;
  priceSuffix?: string;
  priceNote?: string;
  blurb: string;
  points: string[];
  cta: string;
  href: string;
  img: string;
  c: { strip: string; chip: string; price: string; dot: string; cta: string };
  testid: string;
  analytics: string;
};

// ── Section E — teacher-first ecosystem (exact institutional cohort names) ───
export default async function VenuesPage() {
  const [venues, { retreats }] = await Promise.all([getVenues(), getPublicRetreats()]);
  const isVerified = await getVerifiedMatcher().catch(() => (() => false));
  const verifiedVenues = venues.filter((v) => isVerified({ id: v.id, venuePartnerId: v.id, name: v.name, city: v.city }));
  const verifiedIds = verifiedVenues.map((v) => v.id);
  const enhancedIds = await enhancedVenueIds(venues);
  // Cards: eligible venues without an owner photo show their Google photo.
  const cardVenues = await withGoogleCovers(venues);

  // Real retreat counts per venue — grounded in published records (never invented).
  const countByVenue: Record<string, number> = {};
  for (const r of retreats) if (r.venuePartnerId) countByVenue[r.venuePartnerId] = (countByVenue[r.venuePartnerId] || 0) + 1;

  const aiEnabled = tier2PreviewEnabled();
  const aiHref = aiEnabled ? AI_HREF : CONTACT_HREF; // never 404 a CTA

  const coverSrc = venues.find((v) => v.coverImage)?.coverImage || null;
  // Curated hero: a Google listing photo of an ELIGIBLE (grandfathered or paid)
  // venue only. Falls back to the cover image / gradient otherwise.
  const googleHero = await resolveEligibleHero(venues);
  const heroSrc = googleHero ? `/bff/venue-photo/hero?place_id=${encodeURIComponent(googleHero.placeId)}` : coverSrc;

  const tierFallback = ['/brand/org/hero.jpg', '/brand/org/education.jpg', '/brand/org/startup.jpg'];
  const venueCovers = venues.filter((v) => v.coverImage).map((v) => v.coverImage!) as string[];
  const tierImg = (i: number) => venueCovers[i] || tierFallback[i];
  const ecoFallback = ['/brand/org/hero.jpg', '/brand/org/hero.jpg', '/brand/org/companies.jpg', '/brand/org/education.jpg'];
  const ecoImg = (i: number) => venueCovers[i] || ecoFallback[i];
  const ctaImg = venueCovers[2] || venueCovers[0] || '/brand/org/hero.jpg';
  // Featured venues: prefer records that actually have a cover photo (real data only).
  const featured = [...cardVenues].sort((a, b) => Number(!!b.coverImage) - Number(!!a.coverImage)).slice(0, 6);
  const sv = (d: string): ReactNode => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden><path d={d} /></svg>);

  const TIERS: Tier[] = [
    {
      key: 't1', label: 'Tier 1 — Free Forever', chipText: 'Start here',
      name: 'Basic Venue Listing', price: '₹0',
      blurb: 'Create and submit your venue profile yourself.',
      points: ['Manual venue details entry', 'Upload 1–2 photos of your space', 'Submit for suitability review', 'No auto-import or AI purchase required'],
      cta: 'List My Venue for Free', href: SUBMIT_HREF, img: tierImg(0),
      c: { strip: 'bg-brand', chip: 'bg-white/20 text-white', price: 'text-brand-700', dot: 'bg-brand', cta: 'bg-brand text-white hover:bg-brand-600' },
      testid: 'tier-free', analytics: 'tier_free_click',
    },
    {
      key: 't2', label: 'Tier 2 — AI-Assisted', chipText: 'Most Popular',
      name: 'AI-Powered Venue Onboarding', price: '₹1,999', priceSuffix: '+ applicable GST', priceNote: 'India: one-time · International: US$30 (checkout temporarily unavailable)',
      blurb: '',
      points: ['Import permitted info from your website or Google Business / Maps link', 'AI-assisted venue information analysis', 'Completeness checks and suggestions', 'Relevant venue-to-retreat matching', 'Owner-approved, deeper cross-linked public pages'],
      cta: 'Get AI-Assisted Onboarding', href: aiHref, img: tierImg(1),
      c: { strip: 'bg-royal', chip: 'bg-white/20 text-white', price: 'text-royal', dot: 'bg-royal', cta: 'bg-royal text-white hover:opacity-90' },
      testid: 'tier-ai', analytics: 'tier_ai_click',
    },
    {
      key: 't3', label: 'Tier 3 — Marketing & PR', chipText: 'Custom Support',
      name: 'Marketing & PR Support', price: 'Custom quotation',
      blurb: 'Get expert support to position, promote and grow your venue.',
      points: ['Venue positioning and storytelling', 'Listing copy and presentation support', 'Promotional support by agreed scope', 'Increased visibility among target audiences'],
      cta: 'Discuss Marketing Support', href: CONTACT_HREF, img: tierImg(2),
      c: { strip: 'bg-accent', chip: 'bg-white/25 text-white', price: 'text-accent-600', dot: 'bg-accent', cta: 'border border-accent bg-white text-accent-600 hover:bg-accent/10' },
      testid: 'tier-marketing', analytics: 'tier_marketing_click',
    },
  ];

  const jsonld = normalizeJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': CANONICAL_URL,
      url: CANONICAL_URL,
      name: 'Yoga & Retreat Venues · NOSTOPS',
      description: 'Bring your venue into the NOSTOPS yoga ecosystem — discoverable to teachers, retreat creators and organisations.',
      isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: HOME_URL },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: venues.length,
        itemListElement: venues.map((v: PublicVenue, i) => ({ '@type': 'ListItem', position: i + 1, url: canonical(venuePath(v)), name: v.name })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
        { '@type': 'ListItem', position: 2, name: 'Venues', item: CANONICAL_URL },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${CANONICAL_URL}#faq`,
      mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]);

  const BENEFITS: { title: string; desc: string; icon: ReactNode }[] = [
    { title: 'Reach Yoga Teachers', desc: 'Get discovered by verified teachers for classes, workshops and retreats.', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>) },
    { title: 'Be Discovered for Retreats', desc: 'Showcase your space to retreat creators and destination seekers.', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden><path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>) },
    { title: 'Connect with Organisations', desc: 'Increase visibility with companies, educational institutions and networking groups.', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden><path d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>) },
    { title: 'Owner-Controlled Public Profile', desc: 'You review and approve your profile before it goes live.', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden><path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>) },
  ];

  return (
    <main>
      <JsonLd data={jsonld} />

      {/* ── BREADCRUMB ──────────────────────────────────────────────── */}
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-ink-soft">Venues</span>
        </div>
      </nav>

      {/* ══ SECTION A — HERO (two-column, screenshot-matched) ═══════════ */}
      <section aria-label="Venues hero" className="bg-brand-50">
        <div className="container-x lg:grid lg:grid-cols-[46%_54%] lg:items-stretch lg:gap-0">
          <div className="flex flex-col justify-center py-12 lg:py-20 lg:pr-12">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-brand-700">Yoga — India&apos;s Teachers-First Yoga Collective</span>
            <h1 className="mt-4 max-w-xl text-balance text-4xl font-black leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[2.5rem] xl:text-5xl">Your Space. Their Practice. A World of Possibilities.</h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-soft sm:text-lg">List your venue for free. Connect with yoga teachers, retreat creators and organisations seeking meaningful spaces to practise, learn and reconnect.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href={SUBMIT_HREF} data-analytics="add_venue_click" data-testid="hero-list" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600">List Your Venue — Free →</Link>
              <Link href={DIRECTORY_ANCHOR} data-analytics="explore_venues_click" data-testid="hero-explore" className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-brand bg-white px-6 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50">Explore Venues</Link>
            </div>
            <p className="mt-4 text-xs font-semibold text-muted">No listing fee. No mandatory AI purchase. No subscription.</p>
          </div>
          <div className="relative -mx-5 min-h-[300px] overflow-hidden sm:min-h-[360px] lg:mx-0 lg:min-h-[560px] lg:mr-[min(-20px,calc(580px_-_50vw))]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroSrc || '/brand/org/hero.jpg'} alt="A welcoming open-air yoga retreat venue" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute bottom-4 left-4 max-w-[15rem] rounded-2xl bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
              <p className="flex items-center gap-2 text-xs font-bold text-ink"><span aria-hidden className="text-brand-700">🌿</span> Welcoming spaces for a healthier, more connected world.</p>
            </div>
            {googleHero ? (
              <div className="pointer-events-auto absolute bottom-2 right-3 max-w-[70%] truncate text-right text-[10px] font-medium text-white/80">
                <HeroPhotoCredit attributions={googleHero.attributions} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ══ SECTION A2 — FOUR BENEFITS ═════════════════════════════════ */}
      <section aria-label="Why list on NOSTOPS" className="border-y border-brand/10 bg-brand-50">
        <div className="container-x grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:py-10">
          {BENEFITS.map((b) => (
            <div key={b.title} data-testid="venue-benefit" className="flex gap-3">
              <span aria-hidden className="mt-0.5 shrink-0 text-brand-700">{b.icon}</span>
              <div>
                <p className="text-sm font-black text-ink">{b.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ SECTION C — THREE SERVICE TIERS ════════════════════════════ */}
      <section id="tiers" className="container-x mt-16 scroll-mt-4 md:mt-24" aria-label="Venue service options">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Choose how you want to get started</h2>
          <p className="text-sm text-ink-soft sm:max-w-xs sm:text-right">Three ways to list, enhance and promote your venue on NOSTOPS.</p>
        </div>
        <div className="mt-8 grid items-stretch gap-5 md:grid-cols-3">
          {TIERS.map((t) => (
            <div key={t.key} data-testid={t.testid} className={`flex h-full flex-col overflow-hidden rounded-3xl border bg-white shadow-sm ${t.key === 't2' ? 'border-royal/30 ring-1 ring-royal/15' : 'border-line'}`}>
              <div className={`flex items-center justify-between gap-2 px-5 py-3 ${t.c.strip}`}>
                <span className="text-xs font-black uppercase tracking-wide text-white">{t.label}</span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${t.c.chip}`}>{t.chipText}</span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-brand-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black leading-snug tracking-tight text-ink">{t.name}</h3>
                    <p className={`mt-1 text-2xl font-black tracking-tight ${t.c.price}`}>
                      {t.price}
                      {t.priceSuffix && <span className="ml-1 align-middle text-xs font-bold text-muted">{t.priceSuffix}</span>}
                    </p>
                    {t.priceNote && <p className="mt-0.5 text-[11px] font-semibold text-muted">{t.priceNote}</p>}
                  </div>
                </div>
                {t.blurb ? <p className="mt-4 text-sm leading-relaxed text-ink-soft">{t.blurb}</p> : null}
                <ul className="mt-4 flex-1 list-none space-y-2.5 p-0 text-sm text-ink-soft">
                  {t.points.map((p) => (
                    <li key={p} className="flex gap-2.5">
                      <span aria-hidden className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-black text-white ${t.c.dot}`}>✓</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <Link href={t.href} data-analytics={t.analytics} className={`mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl px-5 py-3 text-sm font-bold transition ${t.c.cta}`}>{t.cta} →</Link>
              </div>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-center text-xs text-muted">Free manual listing is always available, independent of AI-assisted onboarding. Marketing support is optional and never required to list or host.</p>
      </section>

      {/* ══ SECTION B — ONE VENUE, MULTIPLE OPPORTUNITIES ══════════════ */}
      <section id="ecosystem" className="container-x mt-16 scroll-mt-4 md:mt-24" aria-label="One venue, multiple opportunities">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">One Venue. Multiple Opportunities.</h2>
          <p className="text-sm text-ink-soft sm:max-w-xs sm:text-right">Your venue can serve different audiences across the NOSTOPS ecosystem.</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Yoga Teachers', copy: 'Classes, workshops and residential programmes led by verified teachers.', href: RETREATS_HREF, img: ecoImg(0), icon: sv('M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z') },
            { title: 'Retreat Creators', copy: 'Teacher-led retreats and immersive experiences hosted at your space.', href: HOST_RETREAT_HREF, img: ecoImg(1), icon: sv('M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z') },
            { title: 'Companies', copy: 'Workplace wellness and group programmes for Companies.', href: '/for-organisations/companies', img: ecoImg(2), icon: sv('M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21') },
            { title: 'Educational Institutions & Startup/Networking Groups', copy: 'Relevant visibility and community programmes for Educational Institutions and Startup & Networking Groups.', href: '/for-organisations', img: ecoImg(3), icon: sv('M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5') },
          ].map((c) => (
            <Link key={c.title} href={c.href} data-testid="ecosystem-card" className="group flex gap-4 rounded-2xl border border-line bg-white p-4 transition hover:border-brand hover:shadow-sm">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-brand-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-brand-700"><span className="shrink-0">{c.icon}</span><p className="text-sm font-black leading-snug text-ink group-hover:text-brand-700">{c.title}</p></div>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{c.copy}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══ SECTION C2 — HOW IT WORKS (four steps, mint band) ══════════ */}
      <section id="how-it-works" className="mt-16 scroll-mt-4 bg-brand-50 py-14 md:mt-24 md:py-20" aria-label="How it works">
        <div className="container-x">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">How it works</h2>
            <p className="mt-3 text-ink-soft">Choose free listing, optional AI-assisted onboarding, or marketing support. Every venue is reviewed before it goes live.</p>
          </div>
          <div className="mt-10 flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-0">
            {[
              { n: 1, t: 'Choose your path', d: 'Pick free listing, optional AI-assisted onboarding, or marketing support.', icon: sv('M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z') },
              { n: 2, t: 'Add venue details', d: 'Enter your venue information and photos — manually or with AI help.', icon: sv('m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10') },
              { n: 3, t: 'NOSTOPS reviews submission', d: 'Our team reviews every venue for suitability. Approval isn’t automatic or guaranteed.', icon: sv('M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z') },
              { n: 4, t: 'Your venue goes live', d: 'Approved venues become publicly discoverable to teachers, creators and organisations.', icon: sv('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m-8.716 6h17.432M3.284 15h17.432') },
            ].map((s, i, arr) => (
              <div data-testid="how-step" key={s.n} className="relative flex flex-1 flex-col items-start text-left">
                {/* subtle connecting line behind the numbers — the journey as one path */}
                {i < arr.length - 1 && (
                  <div aria-hidden className="pointer-events-none absolute left-[18px] top-[20px] z-0 hidden h-px w-full bg-brand/30 sm:block" />
                )}
                <div className="relative z-10 flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-black text-white">{s.n}</div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-brand-700 shadow-sm ring-4 ring-brand-50">{s.icon}</span>
                </div>
                <p className="mt-4 text-sm font-black text-ink">{s.t}</p>
                <p className="mt-1 max-w-[15rem] text-sm leading-relaxed text-ink-soft">{s.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-2xl text-xs text-muted">Venue approval, retreat creation and booking confirmation are separate steps. A pending submission is not an approved, bookable venue.</p>
        </div>
      </section>

      {/* ══ SECTION D — FEATURED VENUES (real records) ════════════════ */}
      <section className="container-x mt-16 scroll-mt-4 md:mt-24" aria-label="Featured venues">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Featured Venues</h2>
            <p className="mt-2 text-ink-soft">Real spaces across India, suited to yoga, retreats and wellness programmes.</p>
          </div>
          <Link href={DIRECTORY_ANCHOR} data-testid="explore-more-venues" className="hidden shrink-0 text-sm font-bold text-brand-700 hover:underline sm:inline">Explore more venues →</Link>
        </div>
        {featured.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-line bg-white p-10 text-center" data-testid="venues-empty">
            <span aria-hidden className="text-4xl">🏡</span>
            <p className="mt-3 text-lg font-bold text-ink">Venues are being added.</p>
            <p className="mt-1 text-ink-soft">Be the first — <Link href={SUBMIT_HREF} className="font-bold text-brand-700 hover:underline">list your venue for free</Link>.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((v) => (
              <Link key={v.id} href={venuePath(v)} data-testid="featured-venue" className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-ink">
                {v.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.coverImage} alt={v.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-700 to-royal" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
                {v.coverFromGoogle && <span className="absolute right-2 top-2 rounded bg-ink/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">Photo: Google</span>}
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="text-sm font-black leading-snug text-white">{v.name}</p>
                  {(v.city || v.state) && <p className="mt-0.5 text-xs font-semibold text-white/80">{[v.city, v.state].filter(Boolean).join(', ')}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-4 sm:hidden">
          <Link href={DIRECTORY_ANCHOR} className="text-sm font-bold text-brand-700 hover:underline">Explore more venues →</Link>
        </div>
      </section>

      {/* ══ SECTION D2 — BROWSE ALL VENUES (existing discovery, preserved) ═ */}
      <section id="venues-directory" className="container-x mt-12 scroll-mt-4" aria-label="Browse all venues">
        {venues.length > 0 && (() => {
          const byCity = new Map<string, { label: string; count: number }>();
          for (const v of venues) {
            const s = venueCitySlug(v);
            if (!s || !v.city) continue;
            const cur = byCity.get(s);
            if (cur) cur.count += 1;
            else byCity.set(s, { label: v.city, count: 1 });
          }
          const cities = [...byCity.entries()].sort((a, b) => b[1].count - a[1].count);
          if (cities.length === 0) return null;
          return (
            <div className="mx-auto mb-6 max-w-3xl text-center" data-testid="browse-by-city">
              <p className="text-xs font-black uppercase tracking-wide text-muted">Browse by city</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {cities.map(([slug, c]) => (
                  <Link key={slug} href={`/venues/in/${slug}`} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand-700">
                    {c.label} <span className="text-muted">({c.count})</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}
        {venues.length > 0 && (
          <VenueExplorer venues={cardVenues} retreatCounts={countByVenue} verifiedIds={verifiedIds} enhancedIds={enhancedIds} />
        )}
        {venues.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              href="/venues/all"
              data-testid="see-all-venues"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-brand/40 bg-white px-5 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
            >
              See all venues →
            </Link>
          </div>
        )}
      </section>

      {/* ══ Guides promo — editorial internal links for discovery/search ══ */}
      <GuidesPromo
        slugs={['teacher-led-retreats-and-approved-venues', 'finding-yoga-teachers-in-your-city', 'how-to-choose-a-yoga-teacher']}
        heading="Helpful guides"
        subtitle="Plan a teacher-led retreat, find a teacher in your city, and choose the right teacher — from the NOSTOPS editorial team."
      />

      {/* ══ SECTION E — FAQ (two-column; FAQPage JSON-LD built above) ══ */}
      <section className="container-x mt-16 scroll-mt-4 md:mt-24" aria-label="Venue listing FAQ">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Frequently asked questions</h2>
          <Link href={CONTACT_HREF} data-testid="faq-contact" className="hidden shrink-0 text-sm font-bold text-brand-700 hover:underline sm:inline">More questions? Contact us →</Link>
        </div>
        <div className="mt-8 grid items-start gap-4 md:grid-cols-2">
          {FAQS.map((f) => (
            <details key={f.q} data-testid="faq-item" className="group rounded-xl border border-line bg-white px-4 py-3.5 open:shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                <span>{f.q}</span>
                <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-brand-700 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-4 sm:hidden">
          <Link href={CONTACT_HREF} className="text-sm font-bold text-brand-700 hover:underline">More questions? Contact us →</Link>
        </div>
      </section>

      {/* ══ SECTION F — CLOSING PHOTOGRAPHIC CTA ═══════════════════════ */}
      {/* Full-bleed closing band ends the page: -mb-24 cancels the site footer's
          top margin so no blank strip sits between this band and the footer. */}
      <section aria-label="List your venue today" className="relative -mb-24 mt-16 overflow-hidden md:mt-24">
        <div className="relative min-h-[320px] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ctaImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/45" />
          <div className="container-x relative flex min-h-[320px] flex-col justify-center gap-8 py-14 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-white/70">Be part of a growing teacher-first community</span>
              <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">List Your Venue Today</h2>
              <p className="mt-4 text-base leading-relaxed text-white/85">Open your space to teachers, retreat creators and organisations seeking meaningful places to practise, learn and reconnect.</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link href={SUBMIT_HREF} data-analytics="add_venue_click" data-testid="closing-list" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600">List Your Venue — Free →</Link>
              <Link href={DIRECTORY_ANCHOR} data-analytics="explore_venues_click" data-testid="closing-explore" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-ink shadow-sm transition hover:bg-cream">Explore Venues</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
