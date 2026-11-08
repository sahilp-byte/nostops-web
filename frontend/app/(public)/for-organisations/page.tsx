import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import OrgSubNav from '@/components/org/OrgSubNav';
import GuidesPromo from '@/components/GuidesPromo';
import OrgEnquirySection from '@/components/org/OrgEnquirySection';

export const revalidate = 3600;

const PATH = '/for-organisations';
const TITLE = 'Authentic Yoga Programmes for Organisations · NOSTOPS';
const DESC =
  'Bring Council-curated yoga programmes to your organisation — for companies, educational institutions and startup & networking groups. Teacher-first.';

export function generateMetadata(): Metadata {
  const url = canonical(PATH);
  const og = '/brand/org/hero-og.jpg';
  return {
    // absolute: the title already carries the brand, so skip the " · NOSTOPS" template.
    title: { absolute: TITLE },
    description: DESC,
    alternates: { canonical: url },
    openGraph: { title: TITLE, description: DESC, url, type: 'website', siteName: 'NOSTOPS', images: [{ url: og, width: 1200, height: 630, type: 'image/jpeg', alt: 'NOSTOPS — For Organisations' }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: [og] },
  };
}

// Three front doors into ONE Institutional Engine. Card CTAs route to the shared
// Event Creator with the cohort pre-selected (verified in Prompt 2).
const COHORTS: {
  key: string;
  href: string;
  showcaseHref: string;
  img: string;
  icon: string;
  accent: string; // decorative per-cohort badge colour, mirrors the reference
  title: string;
  tagline: string;
  taglineClass: string;
  desc: string;
  tags: string[];
}[] = [
  {
    key: 'COMPANY',
    href: '/app/org/events/new?cohort=COMPANY',
    showcaseHref: '/for-organisations/companies',
    img: '/brand/org/companies.jpg',
    icon: '🏢',
    accent: 'bg-blue-600',
    title: 'For Companies',
    tagline: 'Work Better. Live Better.',
    taglineClass: 'text-blue-700',
    desc: 'Build resilient teams and high-performance workplaces with structured Yoga programmes designed around real organisational needs.',
    tags: ['Focus & Attention', 'Stress Resilience', 'Posture & Back Care', 'Better Sleep', 'Energy & Stamina'],
  },
  {
    key: 'EDUCATIONAL_INSTITUTION',
    href: '/app/org/events/new?cohort=EDUCATIONAL_INSTITUTION',
    showcaseHref: '/for-organisations/educational-institutions',
    img: '/brand/org/education.jpg',
    icon: '🎓',
    accent: 'bg-emerald-600',
    title: 'For Educational Institutions',
    tagline: 'Learn Better. Grow Better.',
    taglineClass: 'text-emerald-700',
    desc: 'Bring authentic Yoga to students, faculty and staff. Accessible programmes for stronger minds, brighter futures and healthier communities.',
    tags: ['Focus & Attention', 'Stress Resilience', 'Emotional Wellbeing', 'Better Sleep', 'Strength & Mobility'],
  },
  {
    key: 'STARTUP_NETWORK',
    href: '/app/org/events/new?cohort=STARTUP_NETWORK',
    showcaseHref: '/for-organisations/startup-networking-groups',
    img: '/brand/org/startup.jpg',
    icon: '👥',
    accent: 'bg-amber-500',
    title: 'For Startup & Networking Groups',
    tagline: 'Build Better. Scale Better.',
    taglineClass: 'text-amber-700',
    desc: 'Support founders, teams and professional communities with Yoga programmes that build resilience, clarity and sustained energy.',
    tags: ['Stress Resilience', 'Focus & Attention', 'Energy & Stamina', 'Better Sleep', 'Emotional Wellbeing'],
  },
];

const STEPS = [
  { n: '1', title: 'Choose a Programme', desc: 'Choose from Council-curated programmes for your organisation.' },
  { n: '2', title: 'Create Your Event', desc: 'Set your date, time, venue, participant capacity and preferences.' },
  { n: '3', title: 'We Match Your Teacher', desc: 'NOSTOPS recommends an eligible teacher based on programme, location, availability, fit and continuity.' },
  { n: '4', title: 'Publish & Participate', desc: 'Share your event, invite participants and let your teacher lead the experience.' },
];

const TRUST = [
  { icon: '🪔', label: 'Council-Curated Programmes' },
  { icon: '🧘', label: 'Verified Teachers' },
  { icon: '⚙️', label: 'Technology Enabled' },
  { icon: '🤝', label: 'People Centered' },
  { icon: '📈', label: 'Real Impact' },
];

export default function ForOrganisationsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: TITLE,
    description: DESC,
    url: canonical(PATH),
    isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: canonical('/') },
  };

  return (
    <>
      <JsonLd data={jsonLd} />

      <OrgSubNav active="/for-organisations" />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="bg-cream">
        <div className="container-x grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-2 lg:gap-12">
          <div>
            <span className="text-xs font-black uppercase tracking-[0.18em] text-accent-600">For Organisations</span>
            <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Authentic Yoga<br className="hidden sm:block" /> for a <span className="text-accent-600">Healthy Nervous System Intelligence</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              Bring Council-curated Yoga programmes to your organisation. People participate. Communities grow. A healthier, more resilient India.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/app/org/events/new"
                data-testid="hero-create-programme"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600"
              >
                Create a Programme →
              </Link>
              <Link
                href="/programmes"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-ink transition hover:bg-white/60"
              >
                Explore Programmes
              </Link>
              <a
                href="#enquire"
                data-testid="hero-request-proposal"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-brand/40 bg-white px-6 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
              >
                Request a proposal
              </a>
              <Link
                href="/contact"
                className="inline-flex min-h-[48px] items-center justify-center px-2 py-3 text-sm font-bold text-brand-700 transition hover:underline"
              >
                Request Assistance
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="relative aspect-[16/11] overflow-hidden rounded-3xl shadow-lg ring-1 ring-black/5">
              <Image
                src="/brand/org/hero.jpg"
                alt="Professionals in a calm group meditation session inside a bright modern Indian workplace"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="mx-4 -mt-10 rounded-2xl border border-line bg-white/95 p-4 shadow-md backdrop-blur sm:absolute sm:bottom-5 sm:right-5 sm:mx-0 sm:mt-0 sm:max-w-[16rem]">
              <p className="text-sm font-black leading-snug text-ink">
                Calmer minds. Better focus.<br />Happier people.<br />
                <span className="text-accent-600">Stronger organisations.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── THREE COHORT CARDS ───────────────────────────────── */}
      <section className="container-x py-12 sm:py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {COHORTS.map((c) => (
            <div
              key={c.key}
              data-testid={`cohort-card-${c.key}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={c.img}
                  alt={`${c.title} — Yoga programme`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                />
                <span className={`absolute -bottom-5 left-5 grid h-11 w-11 place-items-center rounded-full text-xl text-white shadow-md ring-4 ring-white ${c.accent}`} aria-hidden>
                  {c.icon}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5 pt-7">
                <h2 className="text-lg font-black tracking-tight text-ink">{c.title}</h2>
                <p className={`mt-0.5 text-sm font-extrabold ${c.taglineClass}`}>{c.tagline}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{c.desc}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {c.tags.map((t) => (
                    <span key={t} className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-ink-soft">{t}</span>
                  ))}
                </div>
                <Link
                  href={c.href}
                  data-testid={`cohort-cta-${c.key}`}
                  className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-brand-700 transition group-hover:gap-1.5"
                >
                  Create a Programme
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
                  </svg>
                </Link>
                <Link
                  href={c.showcaseHref}
                  data-testid={`cohort-showcase-${c.key}`}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-ink-soft transition hover:text-ink"
                >
                  See NOSTOPS in action →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SEE NOSTOPS IN ACTION ───────────────────────────── */}
      <section className="border-t border-line bg-cream">
        <div className="container-x py-10 sm:py-12">
          <div className="rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-accent-600">See NOSTOPS in action</span>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">Don&rsquo;t just read how it works — see it</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Explore demonstration organisations and illustrative programme events across all three cohorts — from Council-curated programme to verified teacher to an example public event page.
                </p>
              </div>
              <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap lg:flex-col">
                {COHORTS.map((c) => (
                  <Link key={c.key} href={c.showcaseHref} data-testid={`see-in-action-${c.key}`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-line bg-cream px-4 py-2.5 text-sm font-bold text-ink transition hover:border-brand hover:bg-brand-50">
                    <span aria-hidden>{c.icon}</span>{c.title.replace('For ', '')} →
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section id="how-it-works" className="bg-white">
        <div className="container-x py-12 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-accent-600">How it works</span>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">From idea to a live programme in four steps</h2>
          </div>
          <ol className="mt-10 grid gap-6 md:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-2xl border border-line bg-cream/60 p-5" data-testid={`how-step-${s.n}`}>
                <div className="grid h-10 w-10 place-items-center rounded-full bg-brand text-base font-black text-white">{s.n}</div>
                <p className="mt-3 text-sm font-black uppercase tracking-wide text-ink">{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.desc}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-bold text-ink-soft">
            <span>Attendance</span><span className="text-muted" aria-hidden>→</span>
            <span>Feedback</span><span className="text-muted" aria-hidden>→</span>
            <span>Create Again</span><span className="text-muted" aria-hidden>→</span>
            <span>Renew</span>
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ──────────────────────────────────────── */}
      <section className="border-y border-line bg-cream">
        <div className="container-x py-6">
          <ul className="grid grid-cols-2 gap-4 text-center sm:grid-cols-3 lg:grid-cols-5" data-testid="trust-strip">
            {TRUST.map((t) => (
              <li key={t.label} className="flex flex-col items-center gap-1.5">
                <span className="text-2xl" aria-hidden>{t.icon}</span>
                <span className="text-xs font-bold text-ink">{t.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── REQUEST A PROPOSAL ──────────────────────────────── */}
      <OrgEnquirySection sourcePage={PATH} />

      {/* ── PROGRAMME GUIDES — editorial internal links ──────── */}
      <GuidesPromo
        slugs={['corporate-yoga-programmes', 'yoga-for-educational-institutions', 'yoga-for-startups-and-networking-groups']}
        heading="Programme guides"
        subtitle="How authentic, teacher-led yoga programmes work for companies, educational institutions and startup & networking groups."
      />

      {/* ── LOWER BRAND CTA ──────────────────────────────────── */}
      <section className="bg-gradient-to-br from-ink via-royal to-brand">
        <div className="container-x py-14 text-center sm:py-20">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white/70">A healthier, more resilient India</span>
          <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl">
            Invest in People. Invest in Possibilities.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-white/85">
            Yoga for individuals, stronger communities and a more resilient India.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/app/org/events/new"
              data-testid="lower-cta-create"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-7 py-3 text-sm font-bold text-ink shadow-sm transition hover:bg-white/90"
            >
              Create a Programme →
            </Link>
            <a
              href="#enquire"
              data-testid="lower-cta-proposal"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/40 px-7 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Request a proposal
            </a>
            <Link
              href="/how-it-works"
              data-testid="lower-cta-learn"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/40 px-7 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
