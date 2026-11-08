import type { Metadata } from 'next';
import { type ReactNode } from 'react';
import Link from 'next/link';
import { normalizeJsonLd } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { resolveEligibleHero, withGoogleCovers } from '@/lib/server/ai-assisted-venues';
import { HeroPhotoCredit } from '@/components/HeroPhotoCredit';
import { getVenues, getBindableVenues, venuePath, type PublicVenue } from '@/lib/server/venues';
import { getPublicRetreats } from '@/lib/server/retreats';
import { getVerifiedMatcher } from '@/lib/server/venue-submissions-local';
import RetreatCard from '@/components/retreats/RetreatCard';
import { titleCase } from '@/lib/format';

export const revalidate = 900;

const PATH = '/retreats/host';
const CANONICAL_URL = canonical(PATH);
const HOME_URL = canonical('/');
const RETREATS_URL = canonical('/retreats');

// Existing NOSTOPS routes ONLY — this landing introduces no new workflow.
const CREATE_HREF = '/app/teacher/retreats/new'; // existing authed Host-a-Retreat wizard (eligibility-gated)
const VENUES_HREF = '/venues';                    // existing venue discovery
const HOW_IT_WORKS_HREF = '/how-it-works';        // existing informational page
const RETREATS_HREF = '/retreats';                // existing retreat discovery
const CONTACT_HREF = '/contact';                  // existing enquiry route

export const metadata: Metadata = {
  title: 'Host a Retreat — Teacher-Led Yoga Retreats',
  description:
    'Host your own teacher-led yoga retreat on NOSTOPS — choose an eligible listed venue, open signups where supported, and publish free after review.',
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    type: 'website',
    siteName: 'NOSTOPS',
    url: CANONICAL_URL,
    title: 'Your Teaching. A Deeper Journey. Host a Retreat. · NOSTOPS',
    description: 'Create and lead a teacher-led yoga retreat at an eligible listed venue. Free to create and publish after review.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Your Teaching. A Deeper Journey. Host a Retreat. · NOSTOPS',
    description: 'Create and lead a teacher-led yoga retreat at an eligible listed venue. Free to create and publish after review.',
  },
};

// Inline stroke icon helper (same visual language as the Venues homepage).
const sv = (d: string, size = 'h-6 w-6'): ReactNode => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={size} aria-hidden>
    <path d={d} />
  </svg>
);

// ── Section E — FAQ (answers grounded in the real workflow; FAQPage JSON-LD) ──
const FAQS: { q: string; a: string }[] = [
  { q: 'Who can host a retreat on NOSTOPS?', a: 'Retreats are created and led by eligible NOSTOPS teachers — Level 2 (Yoga Pracharak), Level 3 (Yoga Guru) and Council Gurus. Hosting opens once your teacher profile meets the existing eligibility criteria.' },
  { q: 'Can I bring my own group?', a: 'Yes, where the retreat’s configuration supports it. You can invite your own students and community alongside any open signups. NOSTOPS helps people discover your retreat but does not guarantee attendance.' },
  { q: 'Is it free to create and publish a retreat?', a: 'Yes. Creating and publishing a basic retreat on NOSTOPS is free (₹0). There is no listing fee, event creation fee or subscription.' },
  { q: 'Can I enable individual signups?', a: 'Where a retreat supports individual signups, participants can reserve a seat or enquire on the retreat’s detail page. A seat is only held once the participant confirms.' },
  { q: 'Do I need to be a verified teacher?', a: 'Hosting is limited to eligible NOSTOPS teachers (Level 2, Level 3 and Council Gurus). You sign in to your teacher account; if you are not yet eligible, you are guided to your teacher dashboard rather than the retreat builder.' },
  { q: 'What information do I need to provide?', a: 'Inside the Host a Retreat workflow you choose an eligible listed venue and complete the supported fields — such as dates, schedule, inclusions, participation options and pricing where applicable.' },
  { q: 'Can I use venues listed by venue owners?', a: 'Yes — once a venue has been reviewed and is an eligible listed venue, any eligible teacher can select it, whether it was submitted by an owner or recommended by another teacher. A pending or unapproved submission cannot be used to publish a retreat.' },
  { q: 'How and when is my retreat published?', a: 'After you submit, NOSTOPS reviews your retreat against the existing eligibility and validation rules. Once it passes, it becomes published and discoverable. Review is not automatic and approval timing is not guaranteed.' },
];

// ── Section A — editorial retreat-experience discovery cards (NOT a backend
//    taxonomy; they link to the existing /retreats discovery surface) ──────────
const EXPERIENCES: { title: string; desc: string }[] = [
  { title: 'Yoga & Wellness Retreats', desc: 'Classic practice, rest and rejuvenation shaped by your teaching.' },
  { title: 'Specialised Retreats', desc: 'Focused formats for specific practices, levels or goals.' },
  { title: 'Immersive & Learning Retreats', desc: 'Deep-dive study and immersive, learning-led experiences.' },
  { title: 'Corporate & Group Retreats', desc: 'Workplace wellbeing and group programmes, where supported.' },
  { title: 'Theme-Based Retreats', desc: 'Experiences built around a season, a place or a guiding theme.' },
];

export default async function HostARetreatPage() {
  // Eligible listed venues first (the real retreat venue picker); fall back to
  // the published venue directory so the showcase always shows real records.
  const [bindable, allVenues, retreatsRes, isVerified] = await Promise.all([
    getBindableVenues({ limit: 8 }).catch(() => [] as PublicVenue[]),
    getVenues(),
    getPublicRetreats(),
    getVerifiedMatcher().catch(() => (() => false)),
  ]);
  const { retreats } = retreatsRes;
  const pool = await withGoogleCovers(bindable.length ? bindable : allVenues);
  const venueCards = [...pool]
    .sort((a, b) => Number(!!b.coverImage) - Number(!!a.coverImage))
    .slice(0, 4);

  // Featured Retreats — genuine published records only, verified-venue first,
  // then topped up with other published retreats to fill the row (max 4).
  const verifiedRetreats = retreats.filter((r) => isVerified({ venuePartnerId: r.venuePartnerId, name: r.venueName, city: r.city }));
  const verifiedSet = new Set(verifiedRetreats.map((r) => r.id));
  const featuredRetreats = [...verifiedRetreats, ...retreats.filter((r) => !verifiedSet.has(r.id))].slice(0, 4);

  // Real images for category cards + the closing CTA (no invented URLs).
  const venueCovers = allVenues.filter((v) => v.coverImage).map((v) => v.coverImage!) as string[];
  const retreatCovers = retreats.map((r) => r.coverImage || r.images[0]).filter(Boolean) as string[];
  const imgPool = [...retreatCovers, ...venueCovers];
  const catFallback = ['/brand/org/hero.jpg', '/brand/org/education.jpg', '/brand/org/startup.jpg', '/brand/org/companies.jpg', '/brand/org/hero.jpg'];
  const catImg = (i: number) => imgPool[i] || catFallback[i] || '/brand/org/hero.jpg';
  const ctaImg = venueCovers[2] || retreatCovers[0] || venueCovers[0] || '/brand/org/hero.jpg';

  const coverSrc = allVenues.find((v) => v.coverImage)?.coverImage || null;
  // Curated hero: a real Google listing photo for an eligible venue (verified by
  // city match). Falls back to a real cover image / gradient when none is confident.
  // Only eligible (grandfathered or paid) venues may supply a Google photo.
  const googleHero = await resolveEligibleHero([...venueCards, ...allVenues]);
  const heroSrc = googleHero ? `/bff/venue-photo/hero?place_id=${encodeURIComponent(googleHero.placeId)}` : coverSrc;

  const jsonld = normalizeJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': CANONICAL_URL,
      url: CANONICAL_URL,
      name: 'Host a Retreat · NOSTOPS',
      description: 'Create and lead a teacher-led yoga retreat at an eligible listed venue on NOSTOPS.',
      isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: HOME_URL },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
        { '@type': 'ListItem', position: 2, name: 'Retreats', item: RETREATS_URL },
        { '@type': 'ListItem', position: 3, name: 'Host a Retreat', item: CANONICAL_URL },
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
    {
      title: 'Teacher-Centric',
      desc: 'You create, you lead, you grow.',
      icon: sv('M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z', 'h-7 w-7'),
    },
    {
      title: 'Choose from Listed Venues',
      desc: 'Use eligible venues submitted by owners or recommended by teachers.',
      icon: sv('M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z', 'h-7 w-7'),
    },
    {
      title: 'Bring Your Own Group',
      desc: 'Invite students, community, or corporate groups where supported.',
      icon: sv('M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z', 'h-7 w-7'),
    },
    {
      title: 'Enable Individual Signups',
      desc: 'Allow individual participation where supported by the existing configuration.',
      icon: sv('M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z', 'h-7 w-7'),
    },
  ];

  const STEPS: { n: number; t: string; d: string; icon: ReactNode }[] = [
    { n: 1, t: 'Find a Venue', d: 'Browse eligible listed venues and pick one that suits your teaching and retreat format.', icon: sv('M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z') },
    { n: 2, t: 'Create Your Retreat', d: 'Open the Host a Retreat workflow and build your retreat around your practice and community.', icon: sv('m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10') },
    { n: 3, t: 'Set Participation Options', d: 'Enable your own group, individual signups, or both — where the retreat configuration supports it.', icon: sv('M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z') },
    { n: 4, t: 'Submit for Review', d: 'NOSTOPS reviews your retreat for eligibility. A pending venue submission is not an eligible, approved venue.', icon: sv('M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z') },
    { n: 5, t: 'Publish and Share', d: 'Once approved, publish your retreat and share it through supported links and channels.', icon: sv('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m-8.716 6h17.432M3.284 15h17.432') },
  ];

  const venueChips = (v: PublicVenue): string[] =>
    [
      typeof v.capacity === 'number' ? `${v.capacity} guests` : '',
      v.sattvicCertified ? 'Sattvic kitchen' : '',
      ...(v.bestForFramings?.slice(0, 1).map((f) => titleCase(f)) || []),
    ].filter(Boolean).slice(0, 3);

  return (
    <main className="pb-20">
      <JsonLd data={jsonld} />

      {/* ── BREADCRUMB — reflects the real route hierarchy ──────────────── */}
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/retreats" className="hover:text-brand-700">Retreats</Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-ink-soft">Host a Retreat</span>
        </div>
      </nav>

      {/* ══ SECTION B — SPLIT HERO (screenshot-matched) ════════════════ */}
      <section aria-label="Host a retreat hero" className="bg-brand-50">
        <div className="container-x lg:grid lg:grid-cols-[46%_54%] lg:items-stretch lg:gap-0">
          <div className="flex flex-col justify-center py-12 lg:py-20 lg:pr-12">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-brand-700">Yoga Retreats — India&apos;s Teachers-First Yoga Collective</span>
            <h1 className="mt-4 max-w-xl text-balance text-4xl font-black leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[2.5rem] xl:text-5xl">Your Teaching. A Deeper Journey. Host a Retreat.</h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-soft sm:text-lg">Create and lead a teacher-led retreat at an eligible listed venue. Bring your own group or open individual signups where supported — you stay at the centre of the experience.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href={CREATE_HREF} data-analytics="create_retreat_click" data-testid="hero-create" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600">Create Your Retreat — Free →</Link>
              <Link href={VENUES_HREF} data-analytics="explore_venues_click" data-testid="hero-explore-venues" className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-brand bg-white px-6 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50">Explore Venues</Link>
            </div>
            <p className="mt-4 text-xs font-semibold text-muted">No listing fee. No event creation fee. No subscription.</p>
          </div>
          <div className="relative -mx-5 min-h-[300px] overflow-hidden sm:min-h-[360px] lg:mx-0 lg:min-h-[560px] lg:mr-[min(-20px,calc(580px_-_50vw))]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroSrc || '/brand/org/hero.jpg'} alt="A serene teacher-led yoga retreat setting in nature" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute bottom-4 left-4 max-w-[16rem] rounded-2xl bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
              <p className="flex items-center gap-2 text-xs font-bold text-ink"><span aria-hidden className="text-brand-700">🧘</span> Teacher-led retreats in inspiring spaces across India.</p>
            </div>
            {googleHero ? (
              <div className="pointer-events-auto absolute bottom-2 right-3 max-w-[70%] truncate text-right text-[10px] font-medium text-white/80">
                <HeroPhotoCredit attributions={googleHero.attributions} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ══ SECTION C — FOUR BENEFITS ══════════════════════════════════ */}
      <section aria-label="Why host on NOSTOPS" className="border-y border-brand/10 bg-brand-50">
        <div className="container-x grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:py-10">
          {BENEFITS.map((b) => (
            <div key={b.title} data-testid="host-benefit" className="flex gap-3">
              <span aria-hidden className="mt-0.5 shrink-0 text-brand-700">{b.icon}</span>
              <div>
                <p className="text-sm font-black text-ink">{b.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ SECTION D — HOW IT WORKS (five steps, mint band) ═══════════ */}
      <section id="how-it-works" className="mt-16 scroll-mt-4 bg-brand-50 py-14 md:mt-24 md:py-20" aria-label="How hosting a retreat works">
        <div className="container-x">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">How it works</h2>
              <p className="mt-3 text-ink-soft">Five simple steps from choosing a venue to sharing your published retreat. Creating and publishing a basic retreat is free.</p>
            </div>
            <Link href={HOW_IT_WORKS_HREF} data-testid="how-it-works-link" className="shrink-0 text-sm font-bold text-brand-700 hover:underline">See how it works →</Link>
          </div>
          <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-start md:gap-0">
            {STEPS.map((s, i, arr) => (
              <div data-testid="how-step" key={s.n} className="relative flex flex-1 flex-col items-start text-left">
                {/* subtle connecting line behind the numbers — the journey as one path */}
                {i < arr.length - 1 && (
                  <div aria-hidden className="pointer-events-none absolute left-[18px] top-[20px] z-0 hidden h-px w-full bg-brand/30 md:block" />
                )}
                <div className="relative z-10 flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-black text-white">{s.n}</div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-brand-700 shadow-sm ring-4 ring-brand-50">{s.icon}</span>
                </div>
                <p className="mt-4 text-sm font-black text-ink">{s.t}</p>
                <p className="mt-1 max-w-[14rem] text-sm leading-relaxed text-ink-soft">{s.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-3xl text-xs text-muted">Venue approval, retreat creation and publication are separate steps. A pending venue submission is not an eligible, approved venue, and approval is not guaranteed.</p>
        </div>
      </section>

      {/* ══ SECTION E — CHOOSE A VENUE FOR YOUR RETREAT ════════════════ */}
      <section aria-label="Choose a venue for your retreat" className="mt-16 scroll-mt-4 bg-brand-50 py-14 md:mt-24 md:py-20">
        <div className="container-x">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Choose a venue for your retreat</h2>
              <p className="mt-3 text-ink-soft">Teachers select eligible listed venues — including approved venues submitted by owners or recommended by other teachers. Viewing or selecting a venue does not confirm a booking.</p>
            </div>
            <Link href={VENUES_HREF} data-testid="browse-all-venues" className="hidden shrink-0 text-sm font-bold text-brand-700 hover:underline sm:inline">Browse all venues →</Link>
          </div>

          {venueCards.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-line bg-white p-10 text-center" data-testid="host-venues-empty">
              <span aria-hidden className="text-4xl">🏡</span>
              <p className="mt-3 text-lg font-bold text-ink">Venues are being added.</p>
              <p className="mt-1 text-ink-soft"><Link href={VENUES_HREF} className="font-bold text-brand-700 hover:underline">Explore venue discovery</Link> to see listed spaces.</p>
            </div>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {venueCards.map((v) => {
                const location = [v.city, v.state].filter(Boolean).join(', ');
                const chips = venueChips(v);
                return (
                  <Link key={v.id} href={venuePath(v)} data-testid="host-venue-card" className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-ink">
                    {v.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.coverImage} alt={v.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-brand-700 to-royal" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-transparent" />
                    {v.coverFromGoogle && <span className="absolute left-3 top-3 rounded bg-ink/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">Photo: Google</span>}
                    <span aria-hidden className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-brand-700 shadow-sm transition group-hover:bg-white">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <p className="text-sm font-black leading-snug text-white">{v.name}</p>
                      {location && <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-white/80"><span aria-hidden>📍</span> {location}</p>}
                      {chips.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {chips.map((c) => (
                            <span key={c} className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          <div className="mt-4 sm:hidden">
            <Link href={VENUES_HREF} className="text-sm font-bold text-brand-700 hover:underline">Browse all venues →</Link>
          </div>
          <p className="mt-6 max-w-3xl text-xs text-muted">Selecting a venue links your retreat to a listed space for discovery. It does not reserve the property or establish the owner&apos;s consent — follow the venue&apos;s own arrangements and booking process.</p>
        </div>
      </section>

      {/* ══ SECTION A — CREATE THE RETREAT EXPERIENCE YOU ENVISION ═════ */}
      <section aria-label="Retreat experiences you can host" className="container-x mt-16 scroll-mt-4 md:mt-24">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Create the retreat experience you envision</h2>
          <p className="text-sm text-ink-soft sm:max-w-xs sm:text-right">Starting points for discovery — explore the kinds of teacher-led retreats you can host.</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {EXPERIENCES.map((c, i) => (
            <Link key={c.title} href={RETREATS_HREF} data-testid="experience-card" className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:border-brand hover:shadow-sm">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-brand-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={catImg(i)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-sm font-black leading-snug text-ink group-hover:text-brand-700">{c.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{c.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ══ SECTION B — BENEFITS FOR YOGA TEACHERS ═════════════════════ */}
      <section aria-label="Benefits for yoga teachers" className="container-x mt-16 scroll-mt-4 md:mt-24">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Benefits for yoga teachers</h2>
          <p className="mt-3 text-ink-soft">A teachers-first platform built around your practice — not guaranteed outcomes.</p>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { t: 'Showcase your teaching', d: 'Present your practice, lineage and style on a dedicated, discoverable retreat page.', c: 'text-brand-700', d_icon: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25' },
            { t: 'Build your community', d: 'Invite your own students and welcome new participants where your retreat supports it.', c: 'text-brand', d_icon: 'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z' },
            { t: 'Enhance your credibility', d: 'Host within a teachers-first collective, linked to your verified NOSTOPS profile.', c: 'text-royal', d_icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
            { t: 'Transparent and fair', d: 'Clear, upfront terms — no listing fee, event creation fee or subscription.', c: 'text-brand-700', d_icon: 'M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
            { t: 'Meaningful impact', d: 'Create experiences that support wellbeing, practice and genuine connection.', c: 'text-accent-600', d_icon: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z' },
          ].map((b) => (
            <div key={b.t} data-testid="teacher-benefit" className="flex flex-col items-start">
              <span aria-hidden className={`grid h-11 w-11 place-items-center rounded-xl bg-brand-50 ${b.c}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d={b.d_icon} /></svg>
              </span>
              <p className="mt-3 text-sm font-black text-ink">{b.t}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ SECTION C — BRAND STATEMENT (no fabricated testimonial) ════ */}
      <section aria-label="Real teachers, real retreats" className="container-x mt-16 scroll-mt-4 md:mt-24">
        <div className="relative overflow-hidden rounded-3xl border border-royal/20 bg-royal-50/50 p-8 text-center sm:p-14" data-testid="brand-statement">
          <span aria-hidden className="text-4xl text-royal">“</span>
          <p className="mx-auto mt-2 max-w-3xl text-2xl font-black leading-tight tracking-tight text-ink sm:text-3xl">Real teachers. Real retreats. Meaningful connections.</p>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-soft">NOSTOPS is a teachers-first yoga collective. We help teachers host their own retreats at eligible listed venues and help participants discover authentic, teacher-led experiences across India.</p>
          <div className="mt-6 flex justify-center">
            <Link href={CREATE_HREF} data-analytics="create_retreat_click" data-testid="statement-create" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-royal px-6 py-3 text-sm font-bold text-white transition hover:opacity-90">Create Your Retreat — Free</Link>
          </div>
        </div>
      </section>

      {/* ══ SECTION D — FEATURED RETREATS (genuine published records) ══ */}
      <section aria-label="Featured retreats" className="container-x mt-16 scroll-mt-4 md:mt-24" data-testid="featured-retreats">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Featured Retreats</h2>
            <p className="mt-2 text-ink-soft">Genuine teacher-led retreats published on NOSTOPS.</p>
          </div>
          <Link href={RETREATS_HREF} data-testid="explore-more-retreats" className="hidden shrink-0 text-sm font-bold text-brand-700 hover:underline sm:inline">Explore more retreats →</Link>
        </div>
        {featuredRetreats.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-line bg-white p-10 text-center" data-testid="retreats-empty">
            <span aria-hidden className="text-4xl">🧘</span>
            <p className="mt-3 text-lg font-bold text-ink">New experiences are on their way.</p>
            <p className="mt-1 text-ink-soft">Retreats appear here as teachers publish them. If you teach, <Link href={CREATE_HREF} className="font-bold text-brand-700 hover:underline">create your retreat</Link>.</p>
          </div>
        ) : (
          <ul className="mt-8 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {featuredRetreats.map((r) => (
              <li key={r.id}><RetreatCard r={r} /></li>
            ))}
          </ul>
        )}
        <div className="mt-4 sm:hidden">
          <Link href={RETREATS_HREF} className="text-sm font-bold text-brand-700 hover:underline">Explore more retreats →</Link>
        </div>
      </section>

      {/* ══ SECTION E — FAQ (two-column; FAQPage JSON-LD built above) ══ */}
      <section className="container-x mt-16 scroll-mt-4 md:mt-24" aria-label="Host a retreat FAQ">
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
      <section aria-label="Host your retreat today" className="relative mt-16 overflow-hidden md:mt-24">
        <div className="relative min-h-[320px] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ctaImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/45" />
          <div className="container-x relative flex min-h-[320px] flex-col justify-center gap-8 py-14 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-white/70">Teachers-first, always</span>
              <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">Host Your Retreat Today</h2>
              <p className="mt-4 text-base leading-relaxed text-white/85">Turn your teaching into meaningful experiences in inspiring venues across India, with your community and beyond.</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link href={CREATE_HREF} data-analytics="create_retreat_click" data-testid="closing-create" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600">Create Your Retreat — Free →</Link>
              <Link href={VENUES_HREF} data-analytics="explore_venues_click" data-testid="closing-explore-venues" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-ink shadow-sm transition hover:bg-cream">Explore Venues</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
