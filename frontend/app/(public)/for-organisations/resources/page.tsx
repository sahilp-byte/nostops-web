import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import PageHero from '@/components/PageHero';
import OrgSubNav from '@/components/org/OrgSubNav';

export const revalidate = 86400;

const PATH = '/for-organisations/resources';
const TITLE = 'Resources for Organisations · NOSTOPS';
const DESC =
  'Guides for HR, campus and community leads bringing authentic Yoga to their organisation: how it works, programmes, trust, cohorts and a planning checklist.';

export function generateMetadata(): Metadata {
  const url = canonical(PATH);
  const og = '/brand/org/hero-og.jpg';
  return {
    // absolute: the title already carries the brand, so skip the " · NOSTOPS" template.
    title: { absolute: TITLE },
    description: DESC,
    alternates: { canonical: url },
    openGraph: { title: TITLE, description: DESC, url, type: 'website', siteName: 'NOSTOPS', images: [{ url: og, width: 1200, height: 630, type: 'image/jpeg', alt: 'NOSTOPS — For Organisations · Resources' }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: [og] },
  };
}

type ResLink = { href: string; title: string; desc: string; icon: string };

const GROUPS: { heading: string; blurb: string; links: ResLink[] }[] = [
  {
    heading: 'Get started',
    blurb: 'Go from idea to a live programme.',
    links: [
      { href: '/how-it-works', icon: '🧭', title: 'How it works', desc: 'The four steps from choosing a programme to a live session.' },
      { href: '/app/org/events/new', icon: '✨', title: 'Create a programme', desc: 'Open the Event Creator and set up your first event.' },
      { href: '/contact', icon: '💬', title: 'Request assistance', desc: 'Talk to the NOSTOPS team about your organisation’s needs.' },
    ],
  },
  {
    heading: 'Understand the model',
    blurb: 'What makes NOSTOPS programmes authentic and safe.',
    links: [
      { href: '/programmes', icon: '📚', title: 'Council-curated programmes', desc: 'Browse programmes across Mind, Body and Special Needs.' },
      { href: '/trust', icon: '🛡️', title: 'Trust & verification', desc: 'What our badges mean and how teachers are verified.' },
      { href: '/for-organisations/impact', icon: '📈', title: 'Our impact', desc: 'The movement so far and how we measure outcomes.' },
    ],
  },
  {
    heading: 'Choose your path',
    blurb: 'The same engine, tuned to your cohort.',
    links: [
      { href: '/for-organisations/companies', icon: '🏢', title: 'For companies', desc: 'On-site programmes for employees and teams.' },
      { href: '/for-organisations/educational-institutions', icon: '🎓', title: 'For educational institutions', desc: 'Yoga for students, faculty and campus life.' },
      { href: '/for-organisations/startup-networking-groups', icon: '👥', title: 'For startup & networking groups', desc: 'Shared programmes for founders, members and their teams.' },
    ],
  },
  {
    heading: 'Learn more',
    blurb: 'Common questions and the philosophy behind it all.',
    links: [
      { href: '/faq', icon: '❓', title: 'Frequently asked questions', desc: 'Answers on programmes, teachers, pricing and logistics.' },
      { href: '/council', icon: '🪔', title: 'The Council of Gurus', desc: 'The stewards who curate and safeguard every programme.' },
      { href: '/about', icon: '🌿', title: 'About NOSTOPS', desc: 'Our teacher-first mission for a healthier India.' },
    ],
  },
];

// Factual process guidance for planning a programme — not metrics or claims.
const CHECKLIST = [
  'Pick the area you care about most (focus, stress, energy, inclusion).',
  'Choose a Council-curated programme whose objectives match that area.',
  'Decide your date, time, venue and participant capacity.',
  'Let NOSTOPS match an eligible, verified teacher for your city.',
  'Share the invite link and open registration to your people.',
  'Review attendance and feedback, then renew or create again.',
];

export default function OrgResourcesPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: TITLE,
    description: DESC,
    url: canonical(PATH),
    isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: canonical('/') },
    hasPart: GROUPS.flatMap((g) =>
      g.links.map((l) => ({ '@type': 'WebPage', name: l.title, url: canonical(l.href) })),
    ),
  };

  return (
    <>
      <JsonLd data={jsonLd} />

      <PageHero
        eyebrow="For Organisations · Resources"
        title={<>Everything you need to <span className="text-accent">get started</span></>}
        subtitle="A simple hub for HR, campus and community leads — understand the model, pick a programme, and bring authentic Yoga to your organisation."
        imageSrc="/brand/org/hero.jpg"
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/app/org/events/new"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-ink shadow-sm transition hover:bg-white/90"
          >
            Create a Programme →
          </Link>
          <Link
            href="/for-organisations"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/40 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            Back to For Organisations
          </Link>
        </div>
      </PageHero>

      <OrgSubNav active="/for-organisations/resources" />

      {/* ── RESOURCE GROUPS ──────────────────────────────────── */}
      <section className="container-x py-12 sm:py-16">
        <div className="space-y-12">
          {GROUPS.map((g) => (
            <div key={g.heading}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="text-2xl font-black tracking-tight text-ink">{g.heading}</h2>
                <p className="text-sm font-semibold text-muted">{g.blurb}</p>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    data-testid={`resource-${l.href}`}
                    className="group flex gap-3 rounded-2xl border border-line bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <span className="text-2xl" aria-hidden>{l.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-base font-black text-ink group-hover:text-brand-700">{l.title}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{l.desc}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PLANNING CHECKLIST ───────────────────────────────── */}
      <section className="bg-cream">
        <div className="container-x py-12 sm:py-16">
          <div className="mx-auto max-w-3xl rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-accent-600">Planning checklist</span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">Plan your programme in six steps</h2>
            <ol className="mt-6 space-y-3">
              {CHECKLIST.map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-black text-white">{i + 1}</span>
                  <span className="text-sm leading-relaxed text-ink-soft">{step}</span>
                </li>
              ))}
            </ol>
            <Link
              href="/app/org/events/new"
              className="mt-7 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600"
            >
              Start your programme →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
