// Public programme detail page (/programmes/{slug}) — one page per catalogue
// programme: what it supports, who it suits, format and who teaches it.
// Indexable (founder choice) while keeping the "pending Council review" note.
// No prices are shown (money lock).
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { fitDescription, pageMetadata } from '@/lib/seo';
import { listProgrammes, type Programme } from '@/lib/server/institutional';
import { pendingCouncilReview, PROGRAMME_DEV_NOTE } from '@/lib/org/programme-status';
import { programmeImage } from '@/lib/org/cohort-landing';
import { COHORT_COPY } from '@/lib/org/cohort-copy';
import ProgrammeDevNote from '@/components/ProgrammeDevNote';
import OrgEnquirySection from '@/components/org/OrgEnquirySection';
import CompareToggle from '@/components/programmes/CompareToggle';
import CompareTray from '@/components/programmes/CompareTray';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';
const CHIP: Record<string, string> = {
  MIND: 'bg-brand-50 text-brand-700',
  BODY: 'bg-emerald-50 text-emerald-700',
  SPECIAL_NEEDS: 'bg-royal-50 text-royal',
};

// Deduped per request (metadata + page share one catalogue fetch).
const load = cache(async (slug: string): Promise<{ p: Programme; all: Programme[] } | null> => {
  const all = (await listProgrammes())?.programmes ?? [];
  const p = all.find((x) => x.slug === slug);
  return p ? { p, all } : null;
});

function sessionLength(p: Programme): string {
  return p.recommended_duration_label || (p.default_duration_minutes ? `${p.default_duration_minutes} minutes per session` : '');
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return { title: 'Programme', robots: { index: false, follow: true } };
  const { p } = d;
  const group = p.recommended_group_size ? ` for ${p.recommended_group_size.replace(/ participants$/, '')} people` : '';
  return pageMetadata({
    title: `${p.name} — ${p.taxonomy_label} Programme`,
    description: fitDescription(`${p.essence} Council-curated ${p.taxonomy_label} programme${group}, led by a verified teacher.`),
    path: `/programmes/${p.slug}`,
  });
}

export default async function ProgrammeDetailPage({ params }: Params) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const { p, all } = d;
  const path = `/programmes/${p.slug}`;
  const photo = programmeImage(p.programme_id, p.taxonomy);
  const related = all.filter((x) => x.taxonomy === p.taxonomy && x.programme_id !== p.programme_id);
  const facts = [
    { label: 'Group size', value: p.recommended_group_size },
    { label: 'How often', value: p.recommended_frequency },
    { label: 'Session length', value: sessionLength(p) },
    { label: 'Level', value: p.level },
    { label: 'Languages', value: (p.languages || []).join(', ') },
  ].filter((f) => f.value);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: p.name,
    description: p.essence,
    url: canonical(path),
    isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: canonical('/') },
    about: { '@type': 'Thing', name: `${p.taxonomy_label} Yoga programme` },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: 'Programmes', path: '/programmes' }, { name: p.name, path }]} />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-cream" data-testid="programme-hero">
        <div className="relative h-56 sm:h-72 lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[45%]">
          <Image src={photo.img} alt={photo.alt} fill priority sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
          <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-r from-cream via-cream/20 to-transparent lg:block" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-cream to-transparent lg:hidden" />
        </div>
        <div className="container-x relative pb-12 pt-6 lg:py-16">
          <div className="lg:max-w-[52%]">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-muted">
              <Link href="/" className={`inline-flex min-h-11 items-center rounded hover:text-ink ${FOCUS}`}>Home</Link>
              <span aria-hidden>/</span>
              <Link href="/programmes" className={`inline-flex min-h-11 items-center rounded hover:text-ink ${FOCUS}`}>Programmes</Link>
              <span aria-hidden>/</span>
              <span aria-current="page" className="text-ink-soft">{p.name}</span>
            </nav>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${CHIP[p.taxonomy] || CHIP.MIND}`} data-testid="programme-pathway">{p.taxonomy_label}</span>
              {p.council_curated && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">✓ Council-Curated</span>}
              {p.version && <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700">{p.version}</span>}
              <ProgrammeDevNote programme={p} />
            </div>
            <h1 className="mt-3 text-4xl font-black leading-[1.08] tracking-tight text-ink sm:text-5xl" data-testid="programme-title">{p.name}</h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">{p.essence}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {/* Plain <a>: sign-in gated target; the organisation starts the form from the beginning. */}
              <a href="/app/org/events/new" data-testid="programme-create"
                className={`inline-flex min-h-[52px] items-center justify-center rounded-xl bg-brand px-7 py-3 text-base font-bold text-white shadow-sm transition hover:bg-brand-600 ${FOCUS}`}>
                Create a Programme →
              </a>
              <a href="#enquire" data-testid="programme-request-proposal"
                className={`inline-flex min-h-[52px] items-center justify-center rounded-xl border border-brand/40 bg-white px-7 py-3 text-base font-bold text-ink transition hover:bg-brand-50 ${FOCUS}`}>
                Request a proposal
              </a>
              <CompareToggle slug={p.slug} name={p.name} size="lg" />
            </div>
          </div>
        </div>
      </section>

      <div className="container-x grid gap-8 py-12 lg:grid-cols-3 lg:grid-rows-[auto_1fr] lg:py-14">
        {/* DOM order = phone order (At a glance first); desktop places it top-right. */}
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm lg:col-start-3 lg:row-start-1 lg:self-start" data-testid="programme-facts">
          <h2 className="text-lg font-black tracking-tight text-ink">At a glance</h2>
          <dl className="mt-3 divide-y divide-line">
            {facts.map((f) => (
              <div key={f.label} className="flex justify-between gap-4 py-2.5 text-sm">
                <dt className="font-semibold text-muted">{f.label}</dt>
                <dd className="text-right font-bold text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="space-y-8 lg:col-span-2 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {pendingCouncilReview(p) && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="programme-dev-disclaimer">
              <span className="font-bold">{PROGRAMME_DEV_NOTE}.</span>{' '}
              {p.disclaimer || 'This programme is still being developed. Its content will be updated once the Council of Gurus has reviewed it.'}
            </p>
          )}

          {p.objectives?.length > 0 && (
            <section aria-labelledby="outcomes-title" data-testid="programme-outcomes">
              <h2 id="outcomes-title" className="text-2xl font-black tracking-tight text-ink">What this programme supports</h2>
              <ul className="mt-4 space-y-3">
                {p.objectives.map((o) => (
                  <li key={o} className="flex gap-3 rounded-xl border border-line bg-white p-4 text-base text-ink">
                    <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-black text-brand-700">✓</span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(p.recommended_audience?.length ?? 0) > 0 && (
            <section aria-labelledby="audience-title" data-testid="programme-audience">
              <h2 id="audience-title" className="text-2xl font-black tracking-tight text-ink">Who it suits</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.recommended_audience!.map((a) => (
                  <span key={a} className="rounded-full bg-cream px-3.5 py-1.5 text-sm font-semibold text-ink-soft ring-1 ring-line">{a}</span>
                ))}
              </div>
            </section>
          )}

          {(p.teacher_competency_requirements?.length ?? 0) > 0 && (
            <section aria-labelledby="teacher-title" data-testid="programme-teacher">
              <h2 id="teacher-title" className="text-2xl font-black tracking-tight text-ink">Who teaches it</h2>
              <p className="mt-2 text-base leading-relaxed text-ink-soft">
                NOSTOPS matches an eligible verified teacher by programme, location, fit and availability. Every teacher for this programme is:
              </p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base text-ink">
                {p.teacher_competency_requirements!.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </section>
          )}
          {p.council_attribution && <p className="text-sm italic text-muted">{p.council_attribution}</p>}
        </div>

        <div className="rounded-2xl bg-cream p-5 ring-1 ring-line lg:col-start-3 lg:row-start-2 lg:self-start" data-testid="programme-cohorts">
          <h2 className="text-lg font-black tracking-tight text-ink">Bring it to your organisation</h2>
          <ul className="mt-2">
            {Object.values(COHORT_COPY).map((c) => (
              <li key={c.key}>
                <Link href={c.path} className={`inline-flex min-h-11 items-center gap-2 rounded text-sm font-bold text-brand-700 hover:underline ${FOCUS}`}>
                  <span aria-hidden>{c.icon}</span>{c.eyebrow} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="border-t border-line bg-white" data-testid="programme-related">
          <div className="container-x py-12">
            <h2 id="related-title" className="text-2xl font-black tracking-tight text-ink">More {p.taxonomy_label} programmes</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <Link key={r.programme_id} href={`/programmes/${r.slug}`} data-testid={`programme-related-${r.slug}`}
                  className={`group flex flex-col rounded-2xl border border-line bg-white p-5 shadow-sm transition hover:shadow-md ${FOCUS}`}>
                  <p className="text-base font-extrabold text-ink">{r.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{r.essence}</p>
                  <span className="mt-auto pt-3 text-sm font-bold text-brand-700 group-hover:underline">View programme →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <OrgEnquirySection sourcePage={path} />
      <CompareTray />
    </>
  );
}
