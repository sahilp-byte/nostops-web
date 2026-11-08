import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import { normalizeJsonLd } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import PageHero from '@/components/PageHero';
import { GUIDES } from '@/lib/guides';

export const revalidate = 86400;

const PATH = '/guides';
const URL = canonical(PATH);
const TITLE = 'Yoga Guides: Teachers, Paramparā & Retreats · NOSTOPS';
const DESC =
  'Practical, editorially reviewed NOSTOPS guides: choosing a yoga teacher, the Guru–Shishya Paramparā, yoga at work and school, and teacher-led retreats.';

export function generateMetadata(): Metadata {
  return {
    title: { absolute: TITLE },
    description: DESC,
    alternates: { canonical: URL },
    openGraph: { title: TITLE, description: DESC, url: URL, type: 'website', siteName: 'NOSTOPS' },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
    robots: { index: true, follow: true },
  };
}

export default function GuidesHubPage() {
  const jsonld = normalizeJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${URL}#page`,
      url: URL,
      name: TITLE,
      description: DESC,
      inLanguage: 'en-IN',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: GUIDES.map((g, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: canonical(`/guides/${g.slug}`),
        name: g.title,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: canonical('/') },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: URL },
      ],
    },
  ]);

  return (
    <main className="pb-20">
      <JsonLd data={jsonld} />
      <PageHero
        eyebrow="NOSTOPS Guides"
        title="Yoga, explained — clearly and honestly"
        subtitle={
          <>
            Practical guides to choosing a teacher, understanding the Guru–Shishya Paramparā, bringing yoga to your
            organisation, and finding teacher-led retreats — reviewed by the NOSTOPS Editorial Team.
          </>
        }
      />
      <div className="container-x py-14">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {GUIDES.map((g) => (
            <Link
              key={g.slug}
              href={`/guides/${g.slug}`}
              data-testid="guide-card"
              className="group flex flex-col rounded-2xl border border-line bg-white p-6 transition hover:border-brand hover:shadow-md"
            >
              <span className="text-xs font-black uppercase tracking-wider text-brand-700">{g.topic}</span>
              <h2 className="mt-2 text-lg font-black leading-snug tracking-tight text-ink group-hover:text-brand-700">
                {g.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{g.description}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700">
                Read guide <span aria-hidden>→</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
