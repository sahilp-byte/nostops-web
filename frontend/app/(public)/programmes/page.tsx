import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import PageHero from '@/components/PageHero';
import { ogImages, DEFAULT_OG_IMAGE } from '@/lib/seo';
import { listProgrammes } from '@/lib/server/institutional';
import { INTERESTS } from '@/lib/org/enquiry';
import OrgEnquirySection from '@/components/org/OrgEnquirySection';
import ProgrammeDevNote from '@/components/ProgrammeDevNote';
import CompareToggle from '@/components/programmes/CompareToggle';
import CompareTray from '@/components/programmes/CompareTray';
import { PROGRAMME_DEV_NOTE } from '@/lib/org/programme-status';

export const dynamic = 'force-dynamic';

const PATH = '/programmes';
const TITLE = 'Council-Curated Yoga Programmes — Mind, Body & Special Needs · NOSTOPS';
const DESC = 'Explore NOSTOPS Council-curated Yoga programmes across Mind, Body and Special Needs — teacher-led and designed for institutions.';

export function generateMetadata(): Metadata {
  const url = canonical(PATH);
  return {
    // absolute: the title already carries the brand, so skip the " · NOSTOPS" template.
    title: { absolute: TITLE },
    description: DESC,
    alternates: { canonical: url },
    openGraph: { title: TITLE, description: DESC, url, type: 'website', siteName: 'NOSTOPS', images: ogImages() },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: [DEFAULT_OG_IMAGE] },
  };
}

const TAX_ICON: Record<string, string> = { MIND: '🧠', BODY: '🧘', SPECIAL_NEEDS: '🤝' };

export default async function ProgrammesPage() {
  const cat = await listProgrammes();
  const groups = cat?.taxonomy || [
    { key: 'MIND', label: 'Mind', slug: 'mind' }, { key: 'BODY', label: 'Body', slug: 'body' }, { key: 'SPECIAL_NEEDS', label: 'Special Needs', slug: 'special-needs' },
  ];
  const by = (cat?.by_taxonomy as any) || { MIND: [], BODY: [], SPECIAL_NEEDS: [] };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'NOSTOPS Council-Curated Programmes',
    description: DESC,
    url: canonical(PATH),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: 'Programmes', path: '/programmes' }]} />
      <PageHero eyebrow="Council-curated" title="Yoga Programmes" subtitle="Council-curated, teacher-led programmes across Mind, Body and Special Needs — ready to bring to your organisation.">
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/for-organisations" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-700 shadow-sm transition hover:bg-cream">Create a Programme →</Link>
          <a href="#enquire" data-testid="programmes-request-proposal" className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/40 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10">Request a proposal</a>
        </div>
      </PageHero>

      <div className="container-x py-10 sm:py-14">
        <p className="mx-auto mb-8 max-w-4xl rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="programmes-dev-note">
          <span className="font-bold">{PROGRAMME_DEV_NOTE}.</span> These Council-curated programmes are still being developed. Their content will be updated once the Council of Gurus has reviewed it.
        </p>
        <p className="mx-auto -mt-4 mb-8 max-w-4xl text-sm text-ink-soft" data-testid="programmes-compare-hint">
          ⚖️ Tick <span className="font-bold text-ink">Compare</span> on two or three programmes to see them side by side.
        </p>
        {groups.map((g: any) => {
          const items = by[g.key] || [];
          if (!items.length) return null;
          const desc = INTERESTS.find((i) => i.key === g.key)?.desc;
          return (
            <section key={g.key} id={g.slug} className="mx-auto mb-12 max-w-4xl scroll-mt-24">
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden>{TAX_ICON[g.key]}</span>
                <h2 className="text-2xl font-black tracking-tight text-ink">{g.label}</h2>
              </div>
              {desc && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft" data-testid={`pillar-desc-${g.key}`}>{desc}</p>}
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {items.map((p: any) => (
                  <div key={p.programme_id} data-testid={`programme-card-${p.slug}`}
                    className="group relative flex flex-col rounded-2xl border border-line bg-white p-5 shadow-sm transition hover:shadow-md focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">✓ Council-Curated</span>
                      {p.version && <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700">{p.version}</span>}
                      <ProgrammeDevNote programme={p} />
                    </div>
                    {/* Stretched link: the whole card opens the programme; the Compare tick sits above it. */}
                    <Link href={`/programmes/${p.slug}`} data-testid={`programme-link-${p.slug}`}
                      className="mt-2 text-base font-extrabold text-ink after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">
                      {p.name}
                    </Link>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{p.essence}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-muted">
                      {p.recommended_group_size && <span className="rounded-md bg-cream px-2 py-0.5">👥 {p.recommended_group_size}</span>}
                      {p.recommended_frequency && <span className="rounded-md bg-cream px-2 py-0.5">🔁 {p.recommended_frequency}</span>}
                      {p.recommended_duration_label && <span className="rounded-md bg-cream px-2 py-0.5">⏱ {p.recommended_duration_label}</span>}
                    </div>
                    {p.council_attribution && <p className="mt-2 text-[11px] italic text-muted">{p.council_attribution}</p>}
                    <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                      <span aria-hidden className="text-sm font-bold text-brand-700 group-hover:underline">View programme →</span>
                      <CompareToggle slug={p.slug} name={p.name} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <section className="mx-auto max-w-2xl rounded-2xl bg-ink p-8 text-center text-white">
          <h2 className="text-2xl font-black tracking-tight">Bring a programme to your organisation</h2>
          <p className="mx-auto mt-2 max-w-lg text-white/80">Companies, educational institutions and startup networks can self-create an event in minutes.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/for-organisations" className="rounded-xl bg-brand px-6 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600">Create a Programme →</Link>
            <a href="#enquire" className="rounded-xl border border-white/30 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">Request a proposal</a>
            <Link href="/contact" className="rounded-xl border border-white/30 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">Request Assistance</Link>
          </div>
        </section>
      </div>
      <OrgEnquirySection sourcePage={PATH} />
      <CompareTray />
    </>
  );
}
