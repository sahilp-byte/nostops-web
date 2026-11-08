import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import { normalizeJsonLd } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import ProgressionLadder from '@/components/marketing/ProgressionLadder';
import { LEVELS_ORDERED, PROGRESSION_INTRO } from '@/lib/teacher-levels';

export const revalidate = 3600;

const PATH = '/levels';
const URL = canonical(PATH);
const TITLE = 'Yoga Teacher Levels: The Progression Path';
const DESC =
  'The NOSTOPS progression path for yoga teachers: Yoga Shikshak, Yoga Pracharak and Yoga Guru. Merit-based, built on teaching hours and student outcomes.';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESC,
    alternates: { canonical: URL },
    openGraph: { title: TITLE, description: DESC, url: URL, type: 'website', siteName: 'NOSTOPS' },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
    robots: { index: true, follow: true },
  };
}

export default function PublicLevelsPage() {
  const jsonld = normalizeJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${URL}#page`,
      url: URL,
      name: TITLE,
      description: DESC,
      isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: canonical('/') },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'NOSTOPS Yoga Teacher Levels',
      itemListElement: LEVELS_ORDERED.map((m, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: `${m.badgeLabel} — ${m.name}`,
        description: m.whoFor,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: canonical('/') },
        { '@type': 'ListItem', position: 2, name: 'Teacher levels', item: URL },
      ],
    },
  ]);

  return (
    <main className="pb-20">
      <JsonLd data={jsonld} />

      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-700 via-ink to-royal">
        <div className="container-x py-16 md:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur">{PROGRESSION_INTRO.eyebrow}</span>
          <h1 className="mt-5 max-w-3xl text-3xl font-black leading-[1.1] tracking-tight text-white md:text-5xl">{PROGRESSION_INTRO.headline}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/85">{PROGRESSION_INTRO.blurb}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/join" className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-brand-700 transition hover:bg-white/90">Join as a teacher — it&apos;s free →</Link>
            <Link href="/become-a-teacher" className="rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">Why teach on NOSTOPS</Link>
          </div>
        </div>
      </section>

      <div className="container-x py-14">
        <div className="mx-auto max-w-4xl">
          <ProgressionLadder empanelHref="/become-a-teacher" />

          {/* Closing CTA */}
          <section className="mt-10 rounded-3xl bg-cream/70 p-8 text-center">
            <h2 className="text-2xl font-black tracking-tight text-ink">Start at Level 1 today</h2>
            <p className="mx-auto mt-2 max-w-xl text-ink-soft">Registration is free. Build your verified profile and begin your progression on a cooperative that puts teachers first.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link href="/join" className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">Join as a teacher →</Link>
              <Link href="/council" className="rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-ink-soft transition hover:bg-cream">Who certifies these levels?</Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
