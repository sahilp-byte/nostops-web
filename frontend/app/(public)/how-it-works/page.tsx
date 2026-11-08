import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import { normalizeJsonLd } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import PageHero from '@/components/PageHero';
import GroupBookingFlywheel from '@/components/marketing/GroupBookingFlywheel';

export const revalidate = 3600;

const PATH = '/how-it-works';
const URL = canonical(PATH);
const TITLE = 'How NOSTOPS Works: The Retreat Flywheel';
const DESC =
  'How a NOSTOPS retreat comes together: a teacher picks a venue, agrees the economics, sets a price, builds a cohort and invites their group.';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESC,
    alternates: { canonical: URL },
    openGraph: { title: TITLE, description: DESC, url: URL, type: 'website' },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
    robots: { index: true, follow: true },
  };
}

const STEPS = [
  'Teacher selects a venue',
  'Teacher negotiates venue economics',
  'Teacher creates a retreat',
  'Teacher sets the participant price',
  'Teacher creates a cohort',
  'Teacher invites students / their group',
  'Participants book',
  'Venue receives occupancy + service revenue',
  'Teacher earns teaching + retreat income',
  'NOSTOPS earns its platform fee',
  'Participants experience the retreat',
  'Reviews are generated',
  'Teacher and venue reputation increase',
  'Teacher returns and the venue hosts more retreats',
];

function Persona({ icon, title, points, cta }: { icon: string; title: string; points: string[]; cta: { href: string; label: string } }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <span className="text-2xl" aria-hidden>{icon}</span>
      <h3 className="mt-2 text-lg font-black tracking-tight text-ink">{title}</h3>
      <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
        {points.map((p) => <li key={p} className="flex gap-2"><span className="text-brand-700" aria-hidden>✓</span>{p}</li>)}
      </ul>
      <Link href={cta.href} className="mt-4 inline-block text-sm font-bold text-brand-700 hover:underline">{cta.label} →</Link>
    </div>
  );
}

export default function HowItWorksPage() {
  const jsonld = normalizeJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      '@id': `${URL}#howto`,
      name: 'How a NOSTOPS retreat comes together',
      description: DESC,
      step: STEPS.map((text, i) => ({ '@type': 'HowToStep', position: i + 1, name: text })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: canonical('/') },
        { '@type': 'ListItem', position: 2, name: 'How it works', item: URL },
      ],
    },
  ]);

  return (
    <main className="pb-20">
      <JsonLd data={jsonld} />

      {/* Hero — unified public-marketing gradient */}
      <PageHero
        eyebrow="How it works"
        title="One retreat feeds the next"
        subtitle={
          <>
            A teacher picks a venue, agrees the economics, sets a fair price, builds a cohort and invites their own group.
            Participants book, the venue fills, the teacher earns, reputations grow — and the whole loop spins faster each time.
          </>
        }
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/app/teacher/retreats/new" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-700 shadow-sm transition hover:bg-cream">Host a retreat</Link>
          <Link href="/retreats" className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/40 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10">Browse retreats</Link>
          <Link href="/venues" className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/40 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10">Partner your venue</Link>
        </div>
      </PageHero>

      <div className="container-x space-y-14 py-14">
        {/* Personas */}
        <section>
          <h2 className="text-2xl font-black tracking-tight text-ink">Everyone wins</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Persona icon="🧘" title="Teachers" points={['Bring your own students', 'Set your own price', 'Keep private economics private', 'Build a lasting reputation']} cta={{ href: '/app/teacher/retreats/new', label: 'Host a retreat' }} />
            <Persona icon="🏡" title="Venues" points={['Fill rooms with aligned groups', 'Earn occupancy + service revenue', 'Build a hosting track record', 'Get discovered by more teachers']} cta={{ href: '/venues', label: 'Partner your venue' }} />
            <Persona icon="👥" title="Participants" points={['Practise with a teacher you trust', 'Travel with your own group', 'Better rates together', 'A real, rooted experience']} cta={{ href: '/retreats', label: 'Find a retreat' }} />
            <Persona icon="🧘" title="NOSTOPS" points={['Secure participant payments', 'Fair, transparent platform fee', 'Teacher-first, always', 'A growing yoga ecosystem']} cta={{ href: '/about', label: 'About NOSTOPS' }} />
          </div>
        </section>

        {/* The flywheel */}
        <GroupBookingFlywheel variant="full" />

        {/* Closing CTA */}
        <section className="rounded-3xl bg-cream/70 p-8 text-center">
          <h2 className="text-2xl font-black tracking-tight text-ink">Start your flywheel</h2>
          <p className="mx-auto mt-2 max-w-xl text-ink-soft">Create a retreat around your teaching and your students — NOSTOPS handles the venue economics and participant payments.</p>
          <Link href="/app/teacher/retreats/new" className="mt-5 inline-block rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">Host a retreat →</Link>
        </section>
      </div>
    </main>
  );
}
