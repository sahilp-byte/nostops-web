import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import PageHero from '@/components/PageHero';
import { listGurus, type GuruNode } from '@/lib/server/knowledge';

export const revalidate = 600;
const CANONICAL_URL = canonical('/gurus');

export const metadata: Metadata = {
  title: { absolute: 'The Gurus of Yoga · Ācāryas & Lineage Masters · NOSTOPS' },
  description:
    'Meet the gurus and ācāryas through whom Yoga has passed from teacher to student, from Patañjali and the Nātha masters to Krishnamacharya and Sivananda.',
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    type: 'website', siteName: 'NOSTOPS', url: CANONICAL_URL,
    title: 'The Gurus of Yoga · The Living Lineage · NOSTOPS',
    description: 'The teachers through whom Yoga continues to live, generation after generation.',
  },
  twitter: { card: 'summary_large_image', title: 'The Gurus of Yoga · The Living Lineage · NOSTOPS' },
};

function eraKey(period?: string): string {
  const p = (period || '').toLowerCase();
  if (/\b(1[89]|20|21)th c|18[0-9]{2}|19[0-9]{2}|20[0-9]{2}|b\. 19|b\. 20/.test(p)) return 'Modern (19th c. onward)';
  if (/bce|1st|2nd|3rd|4th|5th|6th|7th|8th/.test(p)) return 'Ancient & Classical';
  return 'Medieval';
}
const ERA_ORDER = ['Ancient & Classical', 'Medieval', 'Modern (19th c. onward)', 'Period undated'];

function initialsOf(name: string): string {
  return name.replace(/[^A-Za-zĀ-ſ ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'ॐ';
}

export default async function GurusHub() {
  const all = await listGurus();
  // Never let a transient backend blip cache an empty hub (stale-while-revalidate
  // would then serve the empty page for a very long time). Throwing keeps the
  // last good render and skips caching the empty one; it self-heals on retry.
  if (all.length === 0) throw new Error('Knowledge graph (gurus) temporarily unavailable — refusing to cache an empty page.');
  const grouped = new Map<string, GuruNode[]>();
  for (const g of all) {
    const era = g.period ? eraKey(g.period) : 'Period undated';
    (grouped.get(era) ?? grouped.set(era, []).get(era)!).push(g);
  }
  const groups = ERA_ORDER.map((e) => ({ e, items: (grouped.get(e) ?? []).sort((a, b) => a.canonical_name.localeCompare(b.canonical_name)) })).filter((g) => g.items.length > 0);

  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: 'The Gurus of Yoga — NOSTOPS Yogic Paramparā Registry',
    numberOfItems: all.length,
    itemListElement: all.slice(0, 100).map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.canonical_name, item: canonical(`/gurus/${g.slug}`) })),
  };

  return (
    <main>
      <JsonLd data={itemList} />
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: 'Gurus of Yoga', path: '/gurus' }]} />
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-soft">Gurus &amp; Ācāryas</span>
        </div>
      </nav>

      <PageHero
        eyebrow="Yogic Paramparā"
        title="The Gurus of Yoga"
        subtitle="Yoga lives because it has been carried, teacher to student, across the generations. Meet the ācāryas and lineage masters through whom the traditions have been transmitted."
        note={
          <>
            Guru–disciple links are shown only where <strong>historically supported</strong>. Traditional or
            mythic attributions are clearly marked and never asserted as fact.
          </>
        }
      />

      <section className="container-x py-14">
        {groups.map((g) => (
          <div key={g.e} className="mb-12">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-ink">{g.e}</h2>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">{g.items.length} gurus</span>
            </div>
            <ul className="mt-6 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((guru) => (
                <li key={guru.slug}>
                  <Link href={`/gurus/${guru.slug}`} className="card group flex h-full flex-col p-5 transition hover:border-brand hover:shadow-md">
                    <div className="flex items-center gap-3">
                      {guru.portrait_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={guru.portrait_url} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full border border-line bg-cream object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-royal-50 text-sm font-black text-royal" aria-hidden="true">{initialsOf(guru.canonical_name)}</div>
                      )}
                      <h3 className="text-base font-extrabold tracking-tight text-ink group-hover:text-brand-700">{guru.canonical_name}</h3>
                      {guru.verification_status === 'Requires Scholarly Verification' && (
                        <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">Debated</span>
                      )}
                    </div>
                    {guru.biography && <p className="clamp-3 mt-2 text-sm leading-relaxed text-muted">{guru.biography}</p>}
                    <dl className="mt-auto pt-3 text-xs text-muted">
                      {guru.period && <div className="flex gap-1.5"><dt className="font-semibold text-ink-soft">Period:</dt><dd>{guru.period}</dd></div>}
                      {guru.tradition && <div className="mt-0.5 flex gap-1.5"><dt className="font-semibold text-ink-soft">Tradition:</dt><dd>{guru.tradition}</dd></div>}
                    </dl>
                    <span className="mt-3 inline-block text-sm font-bold text-brand-700">View lineage →</span>
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
