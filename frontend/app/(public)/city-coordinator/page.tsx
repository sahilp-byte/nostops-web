import type { Metadata } from 'next';
import Link from 'next/link';
import { normalizeJsonLd } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { citySlug } from '@/lib/server/cities';
import { COORDINATOR_CITIES, COORDINATOR_LAUNCH_CITIES } from '@/lib/city-coordinator-cities';
import { getCityCoordinator, type CityCoordinator } from '@/lib/server/city-coordinator';
import { initials } from '@/lib/format';
import { JsonLd } from '@/components/JsonLd';
import PageHero from '@/components/PageHero';
import ApplyCoordinatorButton from '@/components/city/ApplyCoordinatorButton';

export const dynamic = 'force-dynamic';

const PATH = '/city-coordinator';
const CANONICAL_URL = canonical(PATH);
const HOME_URL = canonical('/');
const APPLY_HREF = 'https://form.jotform.com/262701751986061';

const TITLE = 'Lead the Teacher-First Yoga Movement in Your City · NOSTOPS';
const DESC =
  'Empanelled yoga teachers (Level 2 & 3) can become NOSTOPS City Coordinators, starting with Mumbai, Navi Mumbai, Pune and Nashik. Lead the movement locally.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  keywords: [
    'NOSTOPS City Coordinator',
    'yoga City Coordinator',
    'empanelled yoga teachers',
    'yoga teacher leadership India',
    'City Coordinator Mumbai Pune Nashik',
    'become a City Coordinator',
  ],
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    type: 'website',
    siteName: 'NOSTOPS',
    url: CANONICAL_URL,
    title: TITLE,
    description: DESC,
    locale: 'en_IN',
    // og:image is supplied automatically by ./opengraph-image.tsx (branded
    // City Coordinator card) — kept here so social scrapers get a real https URL.
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
};

const NINE_CITIES = COORDINATOR_CITIES;
const LAUNCH_CITIES = new Set<string>(COORDINATOR_LAUNCH_CITIES);

const DO_POINTS = [
  'Welcome and guide genuine yoga teachers into KYC-verified empanelment',
  'Help maintain quality standards alongside the Council of Yoga Gurus',
  'Introduce NOSTOPS to companies, colleges, schools and startup groups in your city',
  'Organise workshops, demonstrations and teacher meets',
  'Connect local teachers with mentors, and report progress monthly',
];

// Short, glanceable version of the role shown in the hero so teachers know
// what they're signing up for before they tap Apply.
const ROLE_SNAPSHOT = [
  'Welcome & guide genuine teachers into verified empanelment',
  'Bring NOSTOPS to local companies, colleges & studios',
  'Host workshops, demos and teacher meet-ups',
  'Mentor local teachers and share monthly progress',
];

const STEPS = [
  { n: 1, title: 'Log in', desc: 'Log in to your NOSTOPS teacher account.' },
  { n: 2, title: 'Apply', desc: 'Fill in the short application.' },
  { n: 3, title: 'Conversation', desc: 'Speak with the NOSTOPS team.' },
  { n: 4, title: 'Onboarding', desc: 'Selected coordinators receive a Coordinator Agreement and onboarding.' },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Who can become a NOSTOPS City Coordinator?',
    a: 'The role is open to existing NOSTOPS empanelled yoga teachers at Yoga Level 2 (Yoga Pracharak) or Level 3 (Yoga Guru) who are KYC-verified and in good standing, with goodwill in their city and a commitment to teacher-first values.',
  },
  {
    q: 'Which cities is NOSTOPS appointing City Coordinators in?',
    a: 'Nine cities: Delhi, Gurgaon, Bangalore, Mumbai, Navi Mumbai, Pune, Nashik, Chandigarh and Hyderabad. NOSTOPS is beginning with Mumbai, Navi Mumbai, Pune and Nashik.',
  },
  {
    q: 'What does a City Coordinator do?',
    a: 'You welcome and guide genuine teachers into KYC-verified empanelment, help maintain quality standards alongside the Council of Yoga Gurus, introduce NOSTOPS to companies, colleges, schools and startup groups, organise workshops, demonstrations and teacher meets, and connect local teachers with mentors while reporting progress monthly.',
  },
  {
    q: 'Is this a paid role?',
    a: 'It is a leadership role with real standing in your city and earning opportunities linked to the teachers you onboard, the programmes you bring in, and local events and retreats. Full terms are set out in the Coordinator Agreement.',
  },
  {
    q: 'Can Level 1 teachers apply?',
    a: 'No. The City Coordinator role is for empanelled teachers at Yoga Level 2 and Level 3 only.',
  },
  {
    q: 'How do I apply to become a City Coordinator?',
    a: 'Log in to your NOSTOPS teacher account, fill in the short application, and speak with the NOSTOPS team. Selected coordinators receive a Coordinator Agreement and onboarding.',
  },
];

function CoordinatorAvatar({ c }: { c: CityCoordinator }) {
  const src = c.avatarUrl || (c.avatarB64 ? (c.avatarB64.startsWith('data:') ? c.avatarB64 : `data:image/jpeg;base64,${c.avatarB64}`) : null);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={c.name} width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-cover" loading="lazy" />;
  }
  return (
    <div aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-50 text-base font-black text-brand-700">
      {initials(c.name)}
    </div>
  );
}

function CtaBlock({ testid }: { testid: string }) {
  return (
    <div>
      <ApplyCoordinatorButton href={APPLY_HREF} testid={testid} />
      <p className="mt-3 text-sm font-semibold text-white/80">Open to empanelled teachers. Selection is at NOSTOPS&apos;s discretion.</p>
    </div>
  );
}

export default async function CityCoordinatorPage() {
  // Each city's current coordinator, fetched live (contract-first). Today the
  // backend endpoint 404s → every entry is null → cards show an "open" state;
  // the moment coordinators ship, this section lights up automatically.
  const cities = NINE_CITIES.map((label) => ({ label, slug: citySlug(label), launching: LAUNCH_CITIES.has(label) }));
  const coordinators = await Promise.all(cities.map((c) => getCityCoordinator(c.slug).catch(() => null)));
  const cityCoordinators = cities.map((c, i) => ({ ...c, coordinator: coordinators[i] }));
  const anyLive = cityCoordinators.some((c) => c.coordinator);

  const jsonld = normalizeJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': CANONICAL_URL,
      url: CANONICAL_URL,
      name: TITLE,
      description: DESC,
      inLanguage: 'en-IN',
      isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: HOME_URL },
      primaryImageOfPage: canonical('/brand/og.png'),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
        { '@type': 'ListItem', position: 2, name: 'Become a City Coordinator', item: CANONICAL_URL },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ]);

  return (
    <main className="pb-20">
      <JsonLd data={jsonld} />

      {/* ===================== HERO ===================== */}
      <PageHero
        eyebrow="City Coordinator Programme"
        title="Lead the Teacher-First Yoga Movement in Your City"
        subtitle="NOSTOPS is inviting our empanelled yoga teachers to apply as City Coordinators across nine cities: Delhi, Gurgaon, Bangalore, Mumbai, Navi Mumbai, Pune, Nashik, Chandigarh and Hyderabad. We begin with Mumbai, Navi Mumbai, Pune and Nashik."
        size="tall"
      >
        <div className="mt-8" data-testid="cc-role-snapshot">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/70">What a City Coordinator does</p>
          <ul className="mt-3 grid max-w-2xl gap-2.5 sm:grid-cols-2">
            {ROLE_SNAPSHOT.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm font-semibold text-white/90">
                <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20 text-[11px] font-black text-white">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8">
          <CtaBlock testid="cc-hero-apply" />
        </div>

        {/* Nine cities — launch four marked */}
        <div className="mt-10">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/70">Nine cities</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {NINE_CITIES.map((c) => {
              const launching = LAUNCH_CITIES.has(c);
              return (
                <span
                  key={c}
                  className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-bold ${
                    launching ? 'bg-white text-brand-700' : 'border border-white/25 bg-white/10 text-white/90'
                  }`}
                >
                  {c}
                </span>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-white/70">Highlighted cities are where NOSTOPS is beginning first.</p>
        </div>
      </PageHero>

      {/* ===================== WHY THIS ROLE, WHY NOW ===================== */}
      <section className="border-b border-line bg-white">
        <div className="container-x py-14 md:py-20">
          <div className="mx-auto max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">Why this role, why now</p>
            <span aria-hidden className="mt-2 block h-0.5 w-16 rounded bg-brand" />
            <p className="mt-6 text-lg leading-relaxed text-ink-soft">
              Demand for genuine, verified yoga teachers is growing across companies, educational institutions and
              startup communities. India&apos;s yoga talent deserves a strong home network built on trust, mentorship
              and fair reward. City Coordinators are the local face of that network.
            </p>
          </div>
        </div>
      </section>

      {/* ===================== WHAT YOU WILL DO ===================== */}
      <section className="border-b border-line bg-cream">
        <div className="container-x py-14 md:py-20">
          <h2 className="font-serif text-3xl font-black tracking-tight text-ink sm:text-4xl">What you will do</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DO_POINTS.map((p, i) => (
              <div key={i} className="flex gap-4 rounded-2xl border border-line bg-white p-6">
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-black text-brand-700">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-ink-soft">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== WHO CAN APPLY + WHAT YOU GAIN ===================== */}
      <section className="border-b border-line bg-white">
        <div className="container-x py-14 md:py-20">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-3xl border border-line bg-cream/50 p-8">
              <h2 className="text-2xl font-black tracking-tight text-ink">Who can apply</h2>
              <p className="mt-4 leading-relaxed text-ink-soft">
                Existing NOSTOPS empanelled teachers at{' '}
                <span className="font-bold text-ink">Yoga Level 2 (Yoga Pracharak)</span> or{' '}
                <span className="font-bold text-ink">Level 3 (Yoga Guru)</span>, KYC-verified and in good standing, with
                goodwill in their city&apos;s yoga community and a commitment to teacher-first values.
              </p>
              <p className="mt-4 rounded-xl border border-brand/20 bg-brand-50/60 px-4 py-3 text-sm font-semibold text-brand-700">
                For Empanelled Yoga Teachers — Level 2 and Level 3 only.
              </p>
            </div>

            <div className="rounded-3xl border border-line bg-cream/50 p-8">
              <h2 className="text-2xl font-black tracking-tight text-ink">What you gain</h2>
              <p className="mt-4 leading-relaxed text-ink-soft">
                A leadership role with real standing in your city, and earning opportunities linked to the teachers you
                onboard, the programmes you bring in, and local events and retreats. Terms are set out in the
                Coordinator Agreement. Founding coordinators shape how the model works in their city.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== MEET YOUR CITY COORDINATORS ===================== */}
      <section className="border-b border-line bg-cream">
        <div className="container-x py-14 md:py-20">
          <h2 className="font-serif text-3xl font-black tracking-tight text-ink sm:text-4xl">Meet your City Coordinators</h2>
          <p className="mt-3 max-w-2xl text-ink-soft">
            {anyLive
              ? 'The empanelled teachers leading the NOSTOPS network in their city. More cities open as founding coordinators come on board.'
              : 'Founding coordinators are being appointed city by city. Each city will be led by an empanelled NOSTOPS teacher — and the seat could be yours.'}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cityCoordinators.map(({ label, coordinator }) => (
              <div key={label} className="rounded-2xl border border-line bg-white p-5" data-testid="cc-city-card">
                <p className="text-base font-black text-ink">{label}</p>
                {coordinator ? (
                  <div className="mt-4" data-testid="cc-city-has-coordinator">
                    <div className="flex items-center gap-3">
                      <CoordinatorAvatar c={coordinator} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">{coordinator.name}</p>
                        <p className="text-xs text-muted">
                          {[
                            coordinator.since ? `Since ${coordinator.since}` : null,
                            coordinator.teacherCount ? `${coordinator.teacherCount} ${coordinator.teacherCount === 1 ? 'teacher' : 'teachers'}` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'City Coordinator'}
                        </p>
                      </div>
                    </div>
                    {coordinator.story && (
                      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-soft" data-testid="cc-city-story">{coordinator.story}</p>
                    )}
                    {coordinator.teacherHandle && (
                      <Link href={`/teachers/${coordinator.teacherHandle}`} className="mt-3 inline-flex text-sm font-bold text-brand-700 hover:underline">
                        View profile →
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="mt-3" data-testid="cc-city-open">
                    <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-black text-brand-700">Coordinator seat open</span>
                    <a href={APPLY_HREF} target="_blank" rel="noopener noreferrer" className="mt-3 block text-sm font-bold text-brand-700 hover:underline">Could this be you? Apply →</a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== HOW TO APPLY ===================== */}
      <section className="border-b border-line bg-white">
        <div className="container-x py-14 md:py-20">
          <h2 className="font-serif text-3xl font-black tracking-tight text-ink sm:text-4xl">How to apply</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-line bg-white p-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand text-base font-black text-white">{s.n}</span>
                <h3 className="mt-4 text-base font-black text-ink">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== FAQ ===================== */}
      <section className="border-b border-line bg-cream">
        <div className="container-x py-14 md:py-20">
          <h2 className="font-serif text-3xl font-black tracking-tight text-ink sm:text-4xl">Frequently asked questions</h2>
          <div className="mx-auto mt-8 max-w-3xl divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {FAQS.map((f, i) => (
              <details key={i} className="group px-6 py-5" data-testid="cc-faq-item">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold text-ink">
                  <span>{f.q}</span>
                  <span aria-hidden className="shrink-0 text-xl leading-none text-brand-700 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mx-auto mt-6 flex max-w-3xl flex-col items-center gap-2 text-center">
            <p className="text-sm text-ink-soft">Still have a question about the role?</p>
            <p className="text-sm text-ink-soft">Tap <span className="font-bold text-brand-700">✨ Ask AI Guru</span> below — it can raise a support request to our team if needed.</p>
          </div>
        </div>
      </section>

      {/* ===================== FINAL CTA ===================== */}
      <section className="bg-gradient-to-br from-ink via-royal to-brand">
        <div className="container-x py-16 text-center md:py-20">
          <h2 className="mx-auto max-w-2xl font-serif text-3xl font-black tracking-tight text-white sm:text-4xl">
            Be a founding City Coordinator
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-white/85">
            Carry the teacher-first movement forward in your city. NOSTOPS begins with Mumbai, Navi Mumbai, Pune and
            Nashik.
          </p>
          <div className="mt-8 flex justify-center">
            <CtaBlock testid="cc-final-apply" />
          </div>
        </div>
      </section>
    </main>
  );
}
