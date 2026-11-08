import type { Metadata } from 'next';
import Link from 'next/link';
import { normalizeJsonLd } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import PageHero from '@/components/PageHero';
import PublicSubmitForm from '@/components/venues/PublicSubmitForm';

export const dynamic = 'force-dynamic';

const PATH = '/venues/submit';
const CANONICAL_URL = canonical(PATH);
const HOME_URL = canonical('/');
const VENUES_URL = canonical('/venues');

export const metadata: Metadata = {
  title: 'Suggest a Venue — Add a space to NOSTOPS',
  description:
    'Know a great space for yoga, retreats, workshops or wellness programmes? Suggest a venue to NOSTOPS in a minute — no account needed. Every space is reviewed for suitability before it becomes publicly discoverable.',
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    type: 'website', siteName: 'NOSTOPS', url: CANONICAL_URL,
    title: 'Suggest a Venue · NOSTOPS',
    description: 'Add a space suited to yoga and retreats to the NOSTOPS ecosystem — owners, managers, hosts, teachers and community members all welcome.',
    images: ['/brand/og-card.png'],
  },
  twitter: { card: 'summary_large_image', title: 'Suggest a Venue · NOSTOPS', description: 'Add a space suited to yoga and retreats to the NOSTOPS ecosystem.', images: ['/brand/og-card.png'] },
};

const STEPS: { n: number; title: string; desc: string }[] = [
  { n: 1, title: 'Submit', desc: 'Share the venue name, place and a few details — takes a minute.' },
  { n: 2, title: 'Review', desc: 'NOSTOPS reviews it for suitability.' },
  { n: 3, title: 'Enrich', desc: 'Where appropriate, we add maps, photos, reviews and facilities.' },
  { n: 4, title: 'Publish', desc: 'Only suitable venues become publicly discoverable.' },
];

export default function SubmitVenuePage() {
  const jsonld = normalizeJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': CANONICAL_URL,
      url: CANONICAL_URL,
      name: 'Suggest a Venue · NOSTOPS',
      description: 'Suggest a space suited to yoga, retreats and workshops to the NOSTOPS ecosystem for review.',
      isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: HOME_URL },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
        { '@type': 'ListItem', position: 2, name: 'Venues', item: VENUES_URL },
        { '@type': 'ListItem', position: 3, name: 'Suggest a venue', item: CANONICAL_URL },
      ],
    },
  ]);

  return (
    <main className="pb-20">
      <JsonLd data={jsonld} />

      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/venues" className="hover:text-brand-700">Venues</Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-ink-soft">Suggest a venue</span>
        </div>
      </nav>

      <PageHero
        eyebrow="🌿 Add to the ecosystem"
        title="Suggest a venue"
        subtitle="Own, manage, host at, teach at or simply know a space suited to yoga, retreats or workshops? Bring it to NOSTOPS. Anyone can submit — no account needed."
      />

      <div className="container-x mt-10 grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
        <section aria-label="Suggest a venue">
          <PublicSubmitForm />
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="rounded-2xl border border-brand/15 bg-brand-50/40 p-5">
            <p className="text-sm font-black uppercase tracking-wide text-brand-700">🛡️ A submission isn&apos;t a publication</p>
            <ol className="mt-3 list-none space-y-3 p-0">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-black text-white">{s.n}</span>
                  <div>
                    <p className="text-sm font-extrabold text-ink">{s.title}</p>
                    <p className="text-xs leading-relaxed text-ink-soft">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-sm font-extrabold text-ink">Own or manage a venue?</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">Empanelled teachers and venue partners can manage their venues, connect Google and partner with hosts in the Venue Studio.</p>
            <Link href="/app/venue" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline">Open Venue Studio →</Link>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5" data-testid="edit-submission-cta">
            <p className="text-sm font-extrabold text-ink">Already suggested a venue?</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">You can edit your submission without an account — we&apos;ll email you a secure link.</p>
            <Link href="/venues/submit/edit" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline" data-testid="edit-submission-link">Edit your submission →</Link>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-sm font-extrabold text-ink">Need a hand?</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Tap <span className="font-bold text-brand-700">✨ Ask AI Guru</span> for help with your venue submission — it can
              raise a support request to our team if you need a person.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
