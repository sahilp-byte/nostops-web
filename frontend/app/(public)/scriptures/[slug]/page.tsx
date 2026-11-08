import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canonical } from '@/lib/site';
import { fitDescription } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { getScripture, listScriptures, listGurus, getTraditionExplorer, type Ref } from '@/lib/server/knowledge';
import TraditionExplorerSection from '@/components/knowledge/TraditionExplorer';

// Rendered on demand — see yoga-parampara/[slug]/page.tsx (production 500 fix).
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const d = await getScripture(slug);
  const url = canonical(`/scriptures/${slug}`);
  if (!d) return { title: { absolute: 'Yoga Scripture · NOSTOPS' }, alternates: { canonical: url }, robots: { index: false, follow: true } };
  const s = d.scripture;
  const title = `${s.canonical_name} · Yoga Scripture · NOSTOPS`;
  const description = fitDescription(s.description, `Explore the ${s.canonical_name}: its teachings, traditions and sources on NOSTOPS.`);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { type: 'book', siteName: 'NOSTOPS', url, title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ScripturePage({ params }: Params) {
  const { slug } = await params;
  const [d, all, allGurus] = await Promise.all([getScripture(slug), listScriptures(), listGurus()]);
  if (!d) notFound();
  const s = d.scripture;
  const explorer = await getTraditionExplorer(d.paramparas);
  const url = canonical(`/scriptures/${slug}`);
  // Related texts — same tradition first, topped up with others so every page
  // links onward (no crawl dead-ends); plus gurus of the same tradition.
  const sameTradition = all.filter((x) => x.slug !== s.slug && x.tradition && x.tradition === s.tradition);
  const related = [
    ...sameTradition,
    ...all.filter((x) => x.slug !== s.slug && !sameTradition.some((r) => r.slug === x.slug)),
  ].slice(0, 8);
  const relatedGurus = s.tradition
    ? allGurus.filter((x) => x.tradition && x.tradition === s.tradition).slice(0, 6)
    : [];

  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: canonical('/') },
      { '@type': 'ListItem', position: 2, name: 'Scriptures of Yoga', item: canonical('/scriptures') },
      { '@type': 'ListItem', position: 3, name: s.canonical_name, item: url },
    ],
  };
  const bookLd: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': 'Book', '@id': url, name: s.canonical_name, url,
    description: s.description || undefined,
    alternateName: s.alternate_names && s.alternate_names.length ? s.alternate_names : undefined,
    inLanguage: s.language || undefined,
    about: s.tradition || undefined,
  };

  return (
    <main>
      <JsonLd data={[breadcrumbLd, bookLd]} />

      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex flex-wrap items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/scriptures" className="hover:text-brand-700">Scriptures</Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-soft">{s.canonical_name}</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-ink via-royal to-brand">
        <div className="container-x relative py-12 md:py-16">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/90 backdrop-blur">Yoga Scripture · Śāstra</span>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-white md:text-5xl">{s.canonical_name}</h1>
          {s.alternate_names && s.alternate_names.length > 0 && <p className="mt-1 text-lg text-white/70">{s.alternate_names.join(', ')}</p>}
          {s.description && <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/85">{s.description}</p>}
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/80">
            {s.period && <div><span className="font-bold text-white">Period:</span> {s.period}</div>}
            {s.language && <div><span className="font-bold text-white">Language:</span> {s.language}</div>}
            {s.tradition && <div><span className="font-bold text-white">Tradition:</span> {s.tradition}</div>}
          </div>
        </div>
      </section>

      <div className="border-b border-line bg-cream">
        <div className="container-x flex flex-wrap items-center gap-3 py-3 text-sm">
          <span className="font-bold text-ink">📖 Source text (Śāstra)</span>
          <span className="text-muted">Dating and attribution reflect scholarly consensus; uncertain points are marked accordingly.</span>
          <span className="ml-auto rounded-full bg-white px-3 py-1 text-xs font-bold text-ink-soft ring-1 ring-line">{s.verification_status}{s.confidence_level ? ` · ${s.confidence_level}` : ''}</span>
        </div>
      </div>

      <div className="container-x grid gap-10 py-14 md:grid-cols-3">
        <div className="space-y-12 md:col-span-2">
          {s.description && (
            <section>
              <h2 className="text-xl font-extrabold tracking-tight">About this text</h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">{s.description}</p>
            </section>
          )}

          <section data-testid="scripture-traditions">
            <h2 className="text-xl font-extrabold tracking-tight">Traditions that hold this text</h2>
            {d.paramparas.length === 0 ? (
              <p className="mt-4 text-muted">No tradition in the registry lists this as a key text yet.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {d.paramparas.map((r: Ref) => (
                  <Link key={r.id} href={`/yoga-parampara/${r.slug}`} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 hover:underline">{r.display_name || r.canonical_name || r.id}</Link>
                ))}
              </div>
            )}
          </section>

          <TraditionExplorerSection explorer={explorer} lead={`Learn from NOSTOPS teachers rooted in the traditions that study the ${s.canonical_name}.`} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 md:sticky md:top-6 md:self-start">
          {related.length > 0 && (
            <div className="card p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">{s.tradition ? `More texts in ${s.tradition}` : 'More texts'}</h2>
              <ul className="mt-3 list-none space-y-2 p-0 text-sm">
                {related.map((r) => (<li key={r.slug}><Link href={`/scriptures/${r.slug}`} className="text-ink-soft hover:text-brand-700">{r.canonical_name}</Link></li>))}
              </ul>
            </div>
          )}

          {relatedGurus.length > 0 && (
            <div className="card p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Related gurus</h2>
              <ul className="mt-3 list-none space-y-2 p-0 text-sm">
                {relatedGurus.map((r) => (<li key={r.slug}><Link href={`/gurus/${r.slug}`} className="text-ink-soft hover:text-brand-700">{r.canonical_name}</Link></li>))}
              </ul>
            </div>
          )}

          <div className="card p-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Explore further</h2>
            <ul className="mt-3 list-none space-y-2 p-0 text-sm">
              <li><Link href="/scriptures" className="font-bold text-brand-700 hover:underline">← All scriptures</Link></li>
              <li><Link href="/yoga-parampara" className="text-ink-soft hover:text-brand-700">Yoga&apos;s living traditions</Link></li>
              <li><Link href="/gurus" className="text-ink-soft hover:text-brand-700">Gurus &amp; ācāryas</Link></li>
              <li><Link href="/teachers" className="text-ink-soft hover:text-brand-700">Find a teacher</Link></li>
            </ul>
          </div>

          {d.sources.length > 0 && (
            <div className="card p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Sources</h2>
              <ul className="mt-3 list-none space-y-2 p-0 text-xs text-muted">
                {d.sources.map((src) => (<li key={src.id}>{src.author ? `${src.author}, ` : ''}<em>{src.title}</em>{src.year ? ` (${src.year})` : ''}</li>))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
