import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import PageHero from '@/components/PageHero';
import { listParamparas, isModern, type Classification } from '@/lib/server/knowledge';

export const revalidate = 60;
const CANONICAL_URL = canonical('/yoga-parampara');

// Order traditions from civilizational roots → philosophy → orders → practice →
// modern, so the hub reads as a coherent narrative of transmission.
const ORDER: Classification[] = [
  'Source Tradition', 'Darśana', 'Historical Paramparā', 'Sampradāya',
  'Yogic Practice Tradition', 'Related Contemplative Tradition',
  'Modern Teacher Lineage', 'Modern Methodology', 'Modern Institution',
];

export const metadata: Metadata = {
  title: { absolute: "Yoga's Living Traditions · Yogic Paramparā · NOSTOPS" },
  description:
    'Explore the living traditions of Yoga: the darśanas, sampradāyas, gurus, texts and practices through which Yoga passes from teacher to student.',
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    type: 'website', siteName: 'NOSTOPS', url: CANONICAL_URL,
    title: "Yoga's Living Traditions · NOSTOPS",
    description: 'The traditions, teachers, texts and practices through which Yoga continues to live.',
  },
  twitter: { card: 'summary_large_image', title: "Yoga's Living Traditions · NOSTOPS" },
};

export default async function YogaParamparaHub() {
  const all = await listParamparas();
  // Never cache an empty hub on a transient backend blip (see gurus hub note).
  if (all.length === 0) throw new Error('Knowledge graph (paramparas) temporarily unavailable — refusing to cache an empty page.');
  const groups = ORDER.map((c) => ({ c, items: all.filter((p) => p.classification === c).sort((a, b) => a.display_name.localeCompare(b.display_name)) })).filter((g) => g.items.length > 0);

  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: "Yoga's Living Traditions — NOSTOPS Yogic Paramparā Registry",
    numberOfItems: all.length,
    itemListElement: all.slice(0, 100).map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.display_name, item: canonical(`/yoga-parampara/${p.slug}`) })),
  };

  return (
    <main>
      <JsonLd data={itemList} />
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: "Yoga's Living Traditions", path: '/yoga-parampara' }]} />
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-soft">Yoga&apos;s Living Traditions</span>
        </div>
      </nav>

      <PageHero
        eyebrow="Yogic Paramparā"
        title="Yoga's Living Traditions"
        subtitle="Yoga has been transmitted from teacher to student, generation after generation. Explore the traditions, teachers, texts and practices through which Yoga continues to live."
        note={
          <>
            This knowledge layer distinguishes carefully between <strong>historical traditions</strong> and{' '}
            <strong>modern teaching methodologies</strong>. Every entry carries an explicit classification and an
            honest verification status — we never present a modern method as an ancient lineage.
          </>
        }
      />

      <section className="container-x py-14">
        {groups.map((g) => (
          <div key={g.c} className="mb-12">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-ink">{g.c}</h2>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                {isModern(g.c) ? 'Modern teaching tradition' : g.c === 'Related Contemplative Tradition' ? 'Related contemplative tradition' : 'Historical tradition'} · {g.items.length}
              </span>
            </div>
            <ul className="mt-6 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((p) => (
                <li key={p.slug}>
                  <Link href={`/yoga-parampara/${p.slug}`} className="card group flex h-full flex-col p-5 transition hover:border-brand hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-extrabold tracking-tight text-ink group-hover:text-brand-700">{p.display_name}</h3>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isModern(p.classification) ? 'bg-accent/15 text-accent-700' : 'bg-royal-50 text-royal'}`}>
                        {isModern(p.classification) ? 'Modern' : 'Historical'}
                      </span>
                    </div>
                    {p.description && <p className="clamp-3 mt-2 text-sm leading-relaxed text-muted">{p.description}</p>}
                    <dl className="mt-auto pt-3 text-xs text-muted">
                      {p.origin_period && <div className="flex gap-1.5"><dt className="font-semibold text-ink-soft">Origin:</dt><dd>{p.origin_period}</dd></div>}
                      {p.geographical_root && <div className="mt-0.5 flex gap-1.5"><dt className="font-semibold text-ink-soft">Roots:</dt><dd>{p.geographical_root}</dd></div>}
                    </dl>
                    <span className="mt-3 inline-block text-sm font-bold text-brand-700">Explore tradition →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}
