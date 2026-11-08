import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canonical } from '@/lib/site';
import { fitDescription } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { titleCase } from '@/lib/format';
import {
  getParampara, getParamparaCities, listParamparas,
  isModern, traditionKindLabel,
  type Ref,
} from '@/lib/server/knowledge';
import { getTraditionTeachers, getTraditionCitySegments } from '@/lib/server/tradition-teachers';
import { getCities } from '@/lib/server/cities';

// Rendered on demand. These pages were prerendered as static ISR and then 500'd
// in production ("Page changed from static to dynamic at runtime") because the
// shared layout/teacher data makes uncached fetches at request time. Data
// fetches keep their own `next.revalidate` caching (honoured under force-dynamic).
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const d = await getParampara(slug);
  const url = canonical(`/yoga-parampara/${slug}`);
  if (!d) return { title: { absolute: 'Yogic Paramparā · NOSTOPS' }, alternates: { canonical: url }, robots: { index: false, follow: true } };
  const p = d.parampara;
  const kind = traditionKindLabel(p.classification);
  const title = `${p.display_name} · ${kind} · NOSTOPS`;
  const description = fitDescription(p.description, `Explore the lineage, texts and teachers of ${p.display_name} on NOSTOPS.`);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { type: 'article', siteName: 'NOSTOPS', url, title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

function VerifBadge({ status }: { status: string }) {
  const needs = status === 'Requires Scholarly Verification';
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${needs ? 'bg-amber-100 text-amber-800' : status === 'Verified' ? 'bg-brand-50 text-brand-700' : 'bg-cream text-ink-soft'}`}>
      {status}
    </span>
  );
}

function RefChips({ items, hrefBase }: { items: Ref[]; hrefBase?: string }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((r) => {
        const label = r.display_name || r.name || r.canonical_name || r.id;
        return hrefBase && r.slug ? (
          <Link key={r.id} href={`${hrefBase}/${r.slug}`} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 hover:underline">{label}</Link>
        ) : (
          <span key={r.id} className="rounded-full bg-cream px-3 py-1 text-sm font-medium text-ink-soft">{label}</span>
        );
      })}
    </div>
  );
}

export default async function ParamparaKnowledgePage({ params }: Params) {
  const { slug } = await params;
  const d = await getParampara(slug);
  if (!d) notFound();
  const p = d.parampara;
  const [teacherMatch, kgCities, all, cityLinks, publicCities] = await Promise.all([
    getTraditionTeachers({ slug: p.slug, name: p.display_name, canonicalName: p.canonical_name }),
    getParamparaCities(slug),
    listParamparas(),
    getTraditionCitySegments({ slug: p.slug, name: p.display_name, canonicalName: p.canonical_name }),
    getCities().catch(() => []),
  ]);
  // Only link cities that have a public /yoga-teachers/{city} page (never a 404).
  const liveCities = new Set(publicCities.map((c) => c.slug));
  const cities = kgCities.filter((c) => liveCities.has(c.city_id));
  const teachers = teacherMatch.teachers;
  const teacherTotal = teacherMatch.total;
  const modern = isModern(p.classification);
  const kind = traditionKindLabel(p.classification);
  const url = canonical(`/yoga-parampara/${slug}`);

  const related: Ref[] = [d.parent, d.sampradaya, d.darshana, d.civilizational_root].filter(Boolean) as Ref[];
  const children = all.filter((x) => x.parent_id === p.id).map((x) => ({ id: x.id, slug: x.slug, display_name: x.display_name }));
  const siblings = all.filter((x) => x.id !== p.id && x.classification === p.classification).slice(0, 8).map((x) => ({ id: x.id, slug: x.slug, display_name: x.display_name }));

  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: canonical('/') },
      { '@type': 'ListItem', position: 2, name: "Yoga's Living Traditions", item: canonical('/yoga-parampara') },
      { '@type': 'ListItem', position: 3, name: p.display_name, item: url },
    ],
  };
  const definedTermLd = {
    '@context': 'https://schema.org', '@type': 'DefinedTerm', '@id': url, name: p.display_name,
    description: p.description || undefined, url,
    inDefinedTermSet: { '@type': 'DefinedTermSet', name: 'NOSTOPS Yogic Paramparā Registry', url: canonical('/yoga-parampara') },
  };

  return (
    <main>
      <JsonLd data={[breadcrumbLd, definedTermLd]} />

      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex flex-wrap items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/yoga-parampara" className="hover:text-brand-700">Yoga&apos;s Living Traditions</Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink-soft">{p.display_name}</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-ink via-royal to-brand">
        <div className="container-x relative py-12 md:py-16">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/90 backdrop-blur">{p.classification}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${modern ? 'bg-accent text-white' : 'bg-white/15 text-white ring-1 ring-white/25'}`}>{modern ? 'Modern teaching tradition' : kind}</span>
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-white md:text-5xl">{p.display_name}</h1>
          {p.canonical_name !== p.display_name && <p className="mt-1 text-lg text-white/70">{p.canonical_name}</p>}
          {p.description && <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/85">{p.description}</p>}
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/80">
            {p.origin_period && <div><span className="font-bold text-white">Origin:</span> {p.origin_period}</div>}
            {p.geographical_root && <div><span className="font-bold text-white">Geographical roots:</span> {p.geographical_root}</div>}
          </div>
        </div>
      </section>

      {/* Honest historical/modern distinction banner */}
      <div className={`border-b ${modern ? 'border-accent/30 bg-accent/5' : 'border-line bg-cream'}`}>
        <div className="container-x flex flex-wrap items-center gap-3 py-3 text-sm">
          <span className="font-bold text-ink">{modern ? '🌱 Modern teaching methodology / lineage' : '📜 Historical tradition'}</span>
          <span className="text-muted">
            {modern
              ? 'A 19th–21st-century method or lineage — related to, but distinct from, the classical traditions it draws on.'
              : 'A pre-modern tradition. Content reflects scholarly consensus; uncertain points are marked accordingly.'}
          </span>
          <span className="ml-auto"><VerifBadge status={p.verification_status} /></span>
        </div>
      </div>

      <div className="container-x grid gap-10 py-14 md:grid-cols-3">
        <div className="space-y-12 md:col-span-2">
          {p.description && (
            <section>
              <h2 className="text-xl font-extrabold tracking-tight">Historical development</h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">{p.description}</p>
              {p.evidence_summary && <p className="mt-3 text-sm text-muted">{p.evidence_summary}</p>}
            </section>
          )}

          {d.gurus.length > 0 && (
            <section>
              <h2 className="text-xl font-extrabold tracking-tight">Principal Gurus &amp; Ācāryas</h2>
              <ul className="mt-4 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
                {d.gurus.map((g) => (
                  <li key={g.id} className="card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={g.slug ? `/gurus/${g.slug}` : `/gurus`} className="font-bold text-ink hover:text-brand-700">{g.canonical_name}</Link>
                      {g.role && <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{g.role}</span>}
                    </div>
                    {g.confidence_level && <span className="mt-1 block text-xs text-muted">Confidence: {g.confidence_level}{g.verification_status === 'Requires Scholarly Verification' ? ' · requires scholarly verification' : ''}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">Guru–disciple links are shown only where historically supported; traditional attributions are marked as such and never asserted as fact.</p>
            </section>
          )}

          {d.scriptures.length > 0 && (
            <section>
              <h2 className="text-xl font-extrabold tracking-tight">Key scriptures (Śāstra)</h2>
              <RefChips items={d.scriptures} hrefBase="/scriptures" />
            </section>
          )}

          {d.practices.length > 0 && (
            <section>
              <h2 className="text-xl font-extrabold tracking-tight">Core practices</h2>
              <RefChips items={d.practices} />
            </section>
          )}

          {(p.contemporary_description || d.institutions.length > 0 || d.methodologies.length > 0) && (
            <section>
              <h2 className="text-xl font-extrabold tracking-tight">Modern transmission</h2>
              {p.contemporary_description && <p className="mt-4 text-lg leading-relaxed text-ink-soft">{p.contemporary_description}</p>}
              {d.methodologies.length > 0 && (<><h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">Methodologies</h3><RefChips items={d.methodologies} /></>)}
              {d.institutions.length > 0 && (
                <><h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">Institutions</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {d.institutions.map((i) => i.website ? (
                      <a key={i.id} href={`https://${String(i.website).replace(/^https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full bg-cream px-3 py-1 text-sm font-medium text-ink-soft hover:text-brand-700">{i.name} ↗</a>
                    ) : <span key={i.id} className="rounded-full bg-cream px-3 py-1 text-sm font-medium text-ink-soft">{i.name}</span>)}
                  </div></>
              )}
            </section>
          )}

          {/* NOSTOPS teachers associated with the tradition */}
          <section data-testid="parampara-teachers">
            <h2 className="text-xl font-extrabold tracking-tight">NOSTOPS teachers in this tradition</h2>
            {teachers.length === 0 ? (
              <p className="mt-4 text-muted">No NOSTOPS teacher has declared this tradition yet. <Link href="/become-a-teacher" className="font-bold text-brand-700 hover:underline">Teach in this tradition →</Link></p>
            ) : (
              <ul className="mt-4 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
                {teachers.map((t) => (
                  <li key={t.handle} className="card p-4">
                    <Link href={`/teachers/${t.handle}`} className="font-bold text-brand-700 hover:underline">{t.name}</Link>
                    {t.city && <span className="mt-1 block text-xs text-muted">{t.city}</span>}
                  </li>
                ))}
              </ul>
            )}
            {teacherTotal > teachers.length && (
              <p className="mt-3"><Link href="/teachers" className="text-sm font-bold text-brand-700 hover:underline">View all {teacherTotal} teachers →</Link></p>
            )}
            <p className="mt-3 text-xs text-muted">Teachers are matched from their self-declared tradition / style; a self-declared affiliation is never presented as a verified lineage.</p>
          </section>

          {/* City × Tradition cross-links to the local city segment pages */}
          {cityLinks.length > 0 && (
            <section data-testid="parampara-city-links">
              <h2 className="text-xl font-extrabold tracking-tight">{p.display_name} teachers by city</h2>
              <p className="mt-2 text-sm text-muted">Find teachers carrying forward {p.display_name} in your city and book directly.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {cityLinks.map((c) => (
                  <Link
                    key={`${c.citySlug}/${c.segment}`}
                    href={`/yoga-teachers/${c.citySlug}/${c.segment}`}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand-700"
                  >
                    <span>{p.display_name} teachers in {titleCase(c.cityLabel)}</span>
                    <span className="text-xs text-muted">{c.count} →</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 md:sticky md:top-6 md:self-start">
          {(related.length > 0 || children.length > 0) && (
            <div className="card p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Related traditions</h2>
              {related.length > 0 && <RefChips items={related} hrefBase="/yoga-parampara" />}
              {children.length > 0 && (<><h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">Sub-traditions</h3><RefChips items={children} hrefBase="/yoga-parampara" /></>)}
            </div>
          )}

          {cities.length > 0 && (
            <div className="card p-6" data-testid="parampara-cities">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Cities with teachers</h2>
              <div className="mt-3 flex flex-col gap-2">
                {cities.map((c) => (
                  <Link key={c.city_id} href={`/yoga-teachers/${c.city_id}`} className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand-700">
                    <span>{titleCase(c.city_id)}</span>
                    <span className="text-xs text-muted">{c.teacher_count ? `${c.teacher_count} teacher${c.teacher_count === 1 ? '' : 's'}` : 'available'} →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {siblings.length > 0 && (
            <div className="card p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">More in {p.classification}</h2>
              <ul className="mt-3 list-none space-y-2 p-0 text-sm">
                {siblings.map((s) => (<li key={s.id}><Link href={`/yoga-parampara/${s.slug}`} className="text-ink-soft hover:text-brand-700">{s.display_name}</Link></li>))}
              </ul>
            </div>
          )}

          <div className="card p-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Explore further</h2>
            <ul className="mt-3 list-none space-y-2 p-0 text-sm">
              <li><Link href="/yoga-parampara" className="font-bold text-brand-700 hover:underline">← All living traditions</Link></li>
              <li><Link href="/gurus" className="text-ink-soft hover:text-brand-700">Gurus &amp; ācāryas</Link></li>
              <li><Link href="/scriptures" className="text-ink-soft hover:text-brand-700">Yoga scriptures</Link></li>
              <li><Link href="/paramparas" className="text-ink-soft hover:text-brand-700">Recognised paramparas</Link></li>
              <li><Link href="/council" className="text-ink-soft hover:text-brand-700">Council of Gurus</Link></li>
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
