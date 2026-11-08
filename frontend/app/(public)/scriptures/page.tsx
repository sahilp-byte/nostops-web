import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import PageHero from '@/components/PageHero';
import { listScriptures } from '@/lib/server/knowledge';

export const revalidate = 600;
const CANONICAL_URL = canonical('/scriptures');

export const metadata: Metadata = {
  title: { absolute: 'The Scriptures of Yoga · Śāstra & Source Texts · NOSTOPS' },
  description:
    'The foundational texts of Yoga: the Vedas and Upaniṣads, the Bhagavad Gītā and Yoga Sūtras, the Haṭha manuals and the tantric scriptures.',
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    type: 'website', siteName: 'NOSTOPS', url: CANONICAL_URL,
    title: 'The Scriptures of Yoga · NOSTOPS',
    description: 'The śāstra — the source texts that carry the teachings of Yoga.',
  },
  twitter: { card: 'summary_large_image', title: 'The Scriptures of Yoga · NOSTOPS' },
};

export default async function ScripturesHub() {
  const raw = await listScriptures();
  // Never cache an empty hub on a transient backend blip (see gurus hub note).
  if (raw.length === 0) throw new Error('Knowledge graph (scriptures) temporarily unavailable — refusing to cache an empty page.');
  const all = raw.sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));

  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: 'The Scriptures of Yoga — NOSTOPS Yogic Paramparā Registry',
    numberOfItems: all.length,
    itemListElement: all.slice(0, 100).map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.canonical_name, item: canonical(`/scriptures/${s.slug}`) })),
  };

  return (
    <main>
      <JsonLd data={itemList} />
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: 'Yoga Scriptures', path: '/scriptures' }]} />
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-soft">Scriptures &amp; Śāstra</span>
        </div>
      </nav>

      <PageHero
        eyebrow="Yogic Paramparā"
        title="The Scriptures of Yoga"
        subtitle="From the Vedas and Upaniṣads to the Yoga Sūtras and the Haṭha manuals — the source texts (śāstra) through which the teachings of Yoga have been preserved and transmitted."
        note={<>Each text carries its period, language and an honest verification status. Dates reflect scholarly consensus.</>}
      />

      <section className="container-x py-14">
        <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {all.map((s) => (
            <li key={s.slug}>
              <Link href={`/scriptures/${s.slug}`} className="card group flex h-full flex-col p-5 transition hover:border-brand hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-extrabold tracking-tight text-ink group-hover:text-brand-700">{s.canonical_name}</h3>
                  {s.language && s.language !== 'Sanskrit' && (
                    <span className="shrink-0 rounded-full bg-royal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-royal">{s.language}</span>
                  )}
                </div>
                {s.description && <p className="clamp-3 mt-2 text-sm leading-relaxed text-muted">{s.description}</p>}
                <dl className="mt-auto pt-3 text-xs text-muted">
                  {s.period && <div className="flex gap-1.5"><dt className="font-semibold text-ink-soft">Period:</dt><dd>{s.period}</dd></div>}
                  {s.tradition && <div className="mt-0.5 flex gap-1.5"><dt className="font-semibold text-ink-soft">Tradition:</dt><dd>{s.tradition}</dd></div>}
                </dl>
                <span className="mt-3 inline-block text-sm font-bold text-brand-700">Read about this text →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
