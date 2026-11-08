import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canonical } from '@/lib/site';
import { fitDescription } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { getGuru, listGurus, listScriptures, getTraditionExplorer, getGuruLineageChain, isDebatedGuru, type Ref } from '@/lib/server/knowledge';
import TraditionExplorerSection from '@/components/knowledge/TraditionExplorer';
import GuruTimeline from '@/components/knowledge/GuruTimeline';

// Rendered on demand — see yoga-parampara/[slug]/page.tsx (production 500 fix).
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const d = await getGuru(slug);
  const url = canonical(`/gurus/${slug}`);
  if (!d) return { title: { absolute: 'Yoga Guru · NOSTOPS' }, alternates: { canonical: url }, robots: { index: false, follow: true } };
  const g = d.guru;
  const title = `${g.canonical_name} · Yoga Guru · NOSTOPS`;
  const description = fitDescription(g.biography, `Explore the life, lineage and teachings of ${g.canonical_name} on NOSTOPS.`);
  const debated = isDebatedGuru(g);
  return {
    title: { absolute: title },
    description,
    // Phase 4: disputed-history records stay out of search (no canonical on noindex pages).
    ...(debated ? {} : { alternates: { canonical: url } }),
    robots: { index: !debated, follow: true },
    openGraph: { type: 'profile', siteName: 'NOSTOPS', url, title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

function RefChips({ items, hrefBase }: { items: Ref[]; hrefBase: string }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((r) => {
        const label = r.display_name || r.canonical_name || r.name || r.id;
        return r.slug ? (
          <Link key={r.id} href={`${hrefBase}/${r.slug}`} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 hover:underline">{label}</Link>
        ) : (
          <span key={r.id} className="rounded-full bg-cream px-3 py-1 text-sm font-medium text-ink-soft">{label}</span>
        );
      })}
    </div>
  );
}

export default async function GuruPage({ params }: Params) {
  const { slug } = await params;
  const [d, all, allTexts] = await Promise.all([getGuru(slug), listGurus(), listScriptures()]);
  if (!d) notFound();
  const g = d.guru;
  const explorer = await getTraditionExplorer(d.paramparas);
  const lineageChain = await getGuruLineageChain(g.id);
  const url = canonical(`/gurus/${slug}`);
  const debated = isDebatedGuru(g);
  const initials = (g.canonical_name || '').replace(/[^A-Za-zĀ-ſ ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'ॐ';

  // Related gurus — same tradition first, then topped up with other gurus so
  // every profile links onward (no crawl dead-ends).
  const sameTradition = all.filter((x) => x.id !== g.id && x.tradition && x.tradition === g.tradition);
  const related = [
    ...sameTradition,
    ...all.filter((x) => x.id !== g.id && !sameTradition.some((r) => r.id === x.id)),
  ].slice(0, 8);
  // Cross-section flow: scriptures studied in the same tradition.
  const relatedTexts = g.tradition
    ? allTexts.filter((x) => x.tradition && x.tradition === g.tradition).slice(0, 6)
    : [];

  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: canonical('/') },
      { '@type': 'ListItem', position: 2, name: 'Gurus of Yoga', item: canonical('/gurus') },
      { '@type': 'ListItem', position: 3, name: g.canonical_name, item: url },
    ],
  };
  const personLd: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': 'Person', '@id': url, name: g.canonical_name, url,
    description: g.biography || undefined,
    alternateName: g.alternate_names && g.alternate_names.length ? g.alternate_names : undefined,
    knowsAbout: g.tradition || undefined,
  };

  return (
    <main>
      <JsonLd data={[breadcrumbLd, personLd]} />

      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex flex-wrap items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/gurus" className="hover:text-brand-700">Gurus</Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-soft">{g.canonical_name}</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-ink via-royal to-brand">
        <div className="container-x relative flex flex-col items-start gap-7 py-12 md:flex-row md:items-center md:py-16">
          {g.portrait_url ? (
            <figure className="m-0 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.portrait_url} alt={`Portrait of ${g.canonical_name}`} width={168} height={168}
                className="h-32 w-32 rounded-2xl border-2 border-white/30 bg-white/10 object-cover shadow-xl md:h-42 md:w-42" style={{ width: 168, height: 168 }} />
              <figcaption className="mt-2 max-w-[168px] text-[10px] leading-tight text-white/55">
                {g.portrait_source_url ? (
                  <a href={g.portrait_source_url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-white/85 hover:underline">
                    Photo: {g.portrait_source || 'Wikimedia Commons'}{g.portrait_license ? ` · ${g.portrait_license}` : ''}{g.portrait_credit ? ` · ${g.portrait_credit}` : ''}
                  </a>
                ) : (
                  <>Photo: {g.portrait_source || 'Wikimedia Commons'}{g.portrait_license ? ` · ${g.portrait_license}` : ''}</>
                )}
              </figcaption>
            </figure>
          ) : (
            <div className="flex shrink-0 items-center justify-center rounded-2xl border-2 border-white/25 bg-white/10 text-4xl font-black text-white/85" style={{ width: 168, height: 168 }} aria-hidden="true">{initials}</div>
          )}
          <div>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/90 backdrop-blur">Yoga Guru · Ācārya</span>
            <h1 className="mt-5 text-3xl font-black tracking-tight text-white md:text-5xl">{g.canonical_name}</h1>
            {g.alternate_names && g.alternate_names.length > 0 && <p className="mt-1 text-lg text-white/70">Also known as {g.alternate_names.join(', ')}</p>}
            {g.biography && <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/85">{g.biography}</p>}
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/80">
              {g.period && <div><span className="font-bold text-white">Period:</span> {g.period}</div>}
              {g.geographical_association && <div><span className="font-bold text-white">Associated with:</span> {g.geographical_association}</div>}
              {g.tradition && <div><span className="font-bold text-white">Tradition:</span> {g.tradition}</div>}
            </div>
          </div>
        </div>
      </section>

      <div className={`border-b ${debated ? 'border-amber-300/40 bg-amber-50' : 'border-line bg-cream'}`}>
        <div className="container-x flex flex-wrap items-center gap-3 py-3 text-sm">
          <span className="font-bold text-ink">{debated ? '📜 Historicity debated' : '📿 Historically documented'}</span>
          <span className="text-muted">
            {debated
              ? "This figure's dates or identity are debated by scholars. Traditional accounts are presented as such."
              : 'Dates and lineage below reflect scholarly consensus; confidence levels are shown for each link.'}
          </span>
          {g.confidence_level && <span className="ml-auto rounded-full bg-white px-3 py-1 text-xs font-bold text-ink-soft ring-1 ring-line">Confidence: {g.confidence_level}</span>}
        </div>
      </div>

      <div className="container-x grid gap-10 py-14 md:grid-cols-3">
        <div className="space-y-12 md:col-span-2">
          <GuruTimeline current={g} chain={lineageChain} />

          {d.paramparas.length > 0 && (
            <section>
              <h2 className="text-xl font-extrabold tracking-tight">Traditions &amp; lineages</h2>
              <RefChips items={d.paramparas} hrefBase="/yoga-parampara" />
            </section>
          )}

          <TraditionExplorerSection explorer={explorer} lead={`Connect with NOSTOPS teachers carrying the traditions ${g.canonical_name} is associated with.`} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 md:sticky md:top-6 md:self-start">
          {related.length > 0 && (
            <div className="card p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">{g.tradition ? `More gurus in ${g.tradition}` : 'More gurus'}</h2>
              <ul className="mt-3 list-none space-y-2 p-0 text-sm">
                {related.map((r) => (<li key={r.id}><Link href={`/gurus/${r.slug}`} className="text-ink-soft hover:text-brand-700">{r.canonical_name}</Link></li>))}
              </ul>
            </div>
          )}

          {relatedTexts.length > 0 && (
            <div className="card p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Related scriptures</h2>
              <ul className="mt-3 list-none space-y-2 p-0 text-sm">
                {relatedTexts.map((r) => (<li key={r.slug}><Link href={`/scriptures/${r.slug}`} className="text-ink-soft hover:text-brand-700">{r.canonical_name}</Link></li>))}
              </ul>
            </div>
          )}

          <div className="card p-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Explore further</h2>
            <ul className="mt-3 list-none space-y-2 p-0 text-sm">
              <li><Link href="/gurus" className="font-bold text-brand-700 hover:underline">← All gurus</Link></li>
              <li><Link href="/yoga-parampara" className="text-ink-soft hover:text-brand-700">Yoga&apos;s living traditions</Link></li>
              <li><Link href="/scriptures" className="text-ink-soft hover:text-brand-700">Yoga scriptures</Link></li>
              <li><Link href="/teachers" className="text-ink-soft hover:text-brand-700">Find a teacher</Link></li>
            </ul>
          </div>

          {d.sources.length > 0 && (
            <div className="card p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Sources</h2>
              <ul className="mt-3 list-none space-y-2 p-0 text-xs text-muted">
                {d.sources.map((s) => (<li key={s.id}>{s.author ? `${s.author}, ` : ''}<em>{s.title}</em>{s.year ? ` (${s.year})` : ''}</li>))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
