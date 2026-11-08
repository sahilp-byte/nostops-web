// Cohort landing ("Work Better. Live Better." — the founder-approved mockup
// composition) for the three /for-organisations/* cohort pages. Server component;
// uses the site theme tokens (teal primary buttons, saffron accent touches).
// The kept sections (demonstration details, pricing, FAQ, Request a Proposal)
// render below the new design.
//
// Accuracy rules: programme cards show REAL catalogue programmes (with the
// "pending Council review" chip while in development); demonstration
// organisations are clearly labelled illustrative, link only to their in-page
// demonstration details, and carry no logo (neutral icon only).
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { CohortCopy } from '@/lib/org/cohort-copy';
import type { ProgrammeCatalogue, ShowcaseCohort } from '@/lib/server/institutional';
import { COHORT_LANDING, type CohortLandingConfig } from '@/lib/org/cohort-landing';
import { INTERESTS, type InterestKey } from '@/lib/org/enquiry';
import ProgrammeDevNote from '@/components/ProgrammeDevNote';
import OrgPricing from '@/components/org/OrgPricing';
import OrgEnquirySection from '@/components/org/OrgEnquirySection';
import { CohortInAction, CohortFaq } from '@/components/org/CohortShowcase';
import { ICON, Svg } from '@/components/ui/LineIcon';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';
const BTN_PRIMARY = `inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-brand px-7 py-3 text-base font-bold text-white shadow-sm transition hover:bg-brand-600 ${FOCUS}`;
const BTN_OUTLINE = `inline-flex min-h-[52px] items-center justify-center rounded-xl border border-brand/40 bg-white px-7 py-3 text-base font-bold text-ink transition hover:bg-brand-50 ${FOCUS}`;

const STEP_ICONS = [ICON.programme, ICON.event, ICON.teacher, ICON.publish];

// The three canonical pathways (fixed taxonomy): label, /programmes anchor, chip tint.
const PATHWAY_STYLE: Record<InterestKey, { label: string; slug: string; chip: string }> = {
  MIND: { label: 'MIND', slug: 'mind', chip: 'bg-brand-50 text-brand-700' },
  BODY: { label: 'BODY', slug: 'body', chip: 'bg-emerald-50 text-emerald-700' },
  SPECIAL_NEEDS: { label: 'SPECIAL NEEDS', slug: 'special-needs', chip: 'bg-royal-50 text-royal' },
};

function createHref(copy: CohortCopy): string {
  return `/app/org/events/new?cohort=${copy.key}`;
}

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{children}</h2>;
}

function Hero({ copy, cfg }: { copy: CohortCopy; cfg: CohortLandingConfig }) {
  return (
    <section aria-labelledby={`${cfg.tid}-hero-title`} className="relative overflow-hidden bg-cream" data-testid={`${cfg.tid}-hero`}>
      {/* Photo: full-bleed band on phones/tablets; right ~55% fading into cream on desktop. */}
      <div className="relative h-56 sm:h-80 lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[55%]">
        <Image src={cfg.heroImg} alt={cfg.heroAlt} fill priority sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover object-center" />
        <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-r from-cream via-cream/30 to-transparent lg:block" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-cream to-transparent lg:hidden" />
        <div aria-hidden className="absolute right-6 top-6 hidden rounded-xl bg-white/75 px-5 py-4 backdrop-blur-sm xl:block">
          <p className="text-xl font-semibold leading-snug text-ink-soft">
            {cfg.heroWords.map((w, i) => (
              <span key={w}>{i > 0 && <br />}{w}</span>
            ))}
          </p>
          <span className="mt-3 block h-0.5 w-8 rounded-full bg-accent-600" />
        </div>
      </div>

      <div className="container-x relative pb-12 pt-6 lg:py-20 xl:py-24">
        <div className="lg:max-w-[50%]">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-black uppercase tracking-[0.18em] text-accent-600">
            <Link href="/for-organisations" className={`inline-flex min-h-11 items-center rounded hover:underline ${FOCUS}`}>For Organisations</Link>
            <span aria-hidden className="h-px w-6 bg-accent-600" />
            <span aria-current="page">{cfg.crumb}</span>
          </nav>
          <h1 id={`${cfg.tid}-hero-title`} className="mt-3 text-4xl font-black leading-[1.05] tracking-tight text-ink sm:text-5xl xl:text-[3.5rem]">
            {copy.title}
          </h1>
          <p className="mt-4 text-xl leading-snug text-ink sm:text-2xl">{copy.tagline}</p>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft">{cfg.intro}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {/* Plain <a>: the target is sign-in gated, so a full navigation avoids client-router
                prefetch/redirect caching (and works before hydration finishes). */}
            <a href={createHref(copy)} className={BTN_PRIMARY} data-testid="cohort-create-programme">
              Create a Programme <Svg d={ICON.arrow} className="h-5 w-5" />
            </a>
            <Link href="/programmes" className={BTN_OUTLINE} data-testid={`${cfg.tid}-explore-programmes`}>
              Explore Programmes
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink-soft">
            Prefer to talk first?{' '}
            <a href="#enquire" className={`inline-flex min-h-11 items-center rounded font-bold text-brand-700 underline-offset-2 hover:underline ${FOCUS}`} data-testid="cohort-request-proposal">
              Request a proposal
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

function Steps({ copy, tid }: { copy: CohortCopy; tid: string }) {
  return (
    <section aria-labelledby={`${tid}-how-title`} className="border-t border-line bg-cream" data-testid={`${tid}-steps`}>
      <div className="container-x py-8 lg:py-10">
        <h2 id={`${tid}-how-title`} className="sr-only">How it works</h2>
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {copy.how.map((s, i) => (
            <li key={s.n} className="relative flex gap-4 lg:pr-6">
              <div className="relative shrink-0">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-accent-600 shadow-sm ring-1 ring-line">
                  <Svg d={STEP_ICONS[i] || ICON.programme} className="h-7 w-7" />
                </span>
                <span className="absolute -left-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-accent-600 text-xs font-black text-white ring-2 ring-cream">
                  {s.n}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.desc}</p>
              </div>
              {i < copy.how.length - 1 && (
                <span aria-hidden className="absolute right-0 top-4 hidden text-muted lg:block">
                  <Svg d={ICON.arrow} className="h-4 w-4" />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Programmes({ cfg, catalogue }: { cfg: CohortLandingConfig; catalogue: ProgrammeCatalogue | null }) {
  const all = catalogue?.programmes ?? [];
  return (
    <section aria-labelledby={`${cfg.tid}-programmes-title`} className="bg-white" data-testid={`${cfg.tid}-programmes`}>
      <div className="container-x py-12 lg:py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading id={`${cfg.tid}-programmes-title`}>{cfg.programmesTitle}</SectionHeading>
          <Link href="/programmes" className={`inline-flex min-h-11 items-center gap-1.5 rounded text-sm font-bold text-brand-700 hover:underline ${FOCUS}`}>
            View all programmes <Svg d={ICON.arrow} className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {cfg.pathways.map((pw) => {
            const st = PATHWAY_STYLE[pw.key];
            const interest = INTERESTS.find((x) => x.key === pw.key);
            const p = all.find((x) => x.programme_id === pw.programmeId) || null;
            const title = p?.name || `${interest?.label ?? st.label} programmes`;
            const desc = p?.essence || interest?.desc || '';
            return (
              <Link
                key={pw.key}
                href={p ? `/programmes/${p.slug}` : `/programmes#${st.slug}`}
                data-testid={`${cfg.tid}-pathway-${st.slug}`}
                className={`group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:shadow-md sm:flex-row lg:flex-col xl:flex-row ${FOCUS}`}
              >
                <div className="relative aspect-[16/10] w-full shrink-0 sm:aspect-auto sm:min-h-[200px] sm:w-[46%] lg:aspect-[16/10] lg:w-full lg:min-h-0 xl:aspect-auto xl:w-[48%]">
                  <Image src={pw.img} alt={pw.alt} fill sizes="(min-width: 1280px) 360px, (min-width: 1024px) 33vw, (min-width: 640px) 46vw, 100vw" className="object-cover" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col p-5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black tracking-wide ${st.chip}`}>{st.label}</span>
                    <ProgrammeDevNote programme={p} size="xs" />
                  </div>
                  <h3 className="mt-3 text-lg font-black leading-snug tracking-tight text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{desc}</p>
                  <span className="mt-auto flex justify-end pt-3 text-brand-700 transition group-hover:translate-x-0.5">
                    <Svg d={ICON.arrow} className="h-5 w-5" />
                    <span className="sr-only">View {p?.name || `${st.label} programmes`}</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DemoOrganisations({ cohort, tid }: { cohort: ShowcaseCohort | null; tid: string }) {
  const orgs = cohort?.organisations ?? [];
  if (orgs.length === 0) return null;
  const tints = ['bg-accent/10 text-accent-600', 'bg-royal-50 text-royal'];
  return (
    <section aria-labelledby={`${tid}-demo-title`} className="bg-white" data-testid={`${tid}-demo-orgs`}>
      <div className="container-x pb-14">
        <SectionHeading id={`${tid}-demo-title`}>Demonstration organisations</SectionHeading>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-ink-soft">
          Illustrative profiles NOSTOPS created to show the journey end to end. They are not real client organisations.
        </p>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {orgs.map((o, i) => (
            <a
              key={o.organisation_id}
              href={`#demo-${o.slug}`}
              data-testid={`${tid}-demo-${o.slug}`}
              className={`group flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-sm transition hover:shadow-md ${FOCUS}`}
            >
              <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${tints[i % tints.length]}`}>
                <Svg d={ICON.building} className="h-7 w-7" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-black leading-snug text-ink">{o.short_name || o.name}</span>
                {o.city && <span className="mt-0.5 block text-sm text-muted">{o.city}</span>}
                <span className="mt-2 inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">Demonstration Organisation</span>
              </span>
              <span className="text-brand-700 transition group-hover:translate-x-0.5">
                <Svg d={ICON.arrow} className="h-5 w-5" />
                <span className="sr-only">See the demonstration programmes for {o.short_name || o.name}</span>
              </span>
            </a>
          ))}
          <div className="flex items-start gap-3 rounded-2xl bg-cream p-5 ring-1 ring-line" data-testid={`${tid}-demo-disclosure`}>
            <span className="mt-0.5 shrink-0 text-brand-700"><Svg d={ICON.info} className="h-6 w-6" /></span>
            <p className="text-sm leading-relaxed text-ink-soft">
              Demonstration profiles illustrate the NOSTOPS journey. They are not endorsements, client testimonials or evidence of paid engagements.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ClosingCta({ copy, cfg }: { copy: CohortCopy; cfg: CohortLandingConfig }) {
  return (
    <section aria-labelledby={`${cfg.tid}-cta-title`} className="border-y border-line bg-accent/10" data-testid={`${cfg.tid}-closing-cta`}>
      <div className="container-x flex flex-col gap-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-2xl shadow-sm">🧘</span>
          <div>
            <h2 id={`${cfg.tid}-cta-title`} className="text-xl font-black tracking-tight text-ink sm:text-2xl">{cfg.ctaTitle}</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">{cfg.ctaText}</p>
          </div>
        </div>
        <a href={createHref(copy)} className={`${BTN_PRIMARY} shrink-0`} data-testid={`${cfg.tid}-cta-create`}>
          Create a Programme <Svg d={ICON.arrow} className="h-5 w-5" />
        </a>
      </div>
    </section>
  );
}

export default function CohortLanding({
  copy,
  cohort,
  catalogue,
}: {
  copy: CohortCopy;
  cohort: ShowcaseCohort | null;
  catalogue: ProgrammeCatalogue | null;
}) {
  const cfg = COHORT_LANDING[copy.key];
  return (
    <>
      <Hero copy={copy} cfg={cfg} />
      <Steps copy={copy} tid={cfg.tid} />
      <Programmes cfg={cfg} catalogue={catalogue} />
      <DemoOrganisations cohort={cohort} tid={cfg.tid} />
      <ClosingCta copy={copy} cfg={cfg} />
      {/* Existing sections kept below the new design. */}
      <CohortInAction cohort={cohort} />
      <OrgPricing cohort={copy.key} audienceWord={copy.audienceWord} />
      <CohortFaq copy={copy} />
      <OrgEnquirySection sourcePage={copy.path} cohort={copy.key} />
    </>
  );
}
