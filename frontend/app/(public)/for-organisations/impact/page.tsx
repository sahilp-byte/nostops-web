import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import PageHero from '@/components/PageHero';
import { listProgrammes } from '@/lib/server/institutional';
import { getPublicStats, missionPct } from '@/lib/server/public-stats';
import OrgSubNav from '@/components/org/OrgSubNav';

export const revalidate = 1800;

const PATH = '/for-organisations/impact';
const TITLE = 'Our Impact for Organisations · NOSTOPS';
const DESC =
  'The reach of NOSTOPS for organisations: organisations onboarded, Council-vetted teachers, cities and programmes, and how we measure outcomes.';

export function generateMetadata(): Metadata {
  const url = canonical(PATH);
  const og = '/brand/org/hero-og.jpg';
  return {
    // absolute: the title already carries the brand, so skip the " · NOSTOPS" template.
    title: { absolute: TITLE },
    description: DESC,
    alternates: { canonical: url },
    openGraph: { title: TITLE, description: DESC, url, type: 'website', siteName: 'NOSTOPS', images: [{ url: og, width: 1200, height: 630, type: 'image/jpeg', alt: 'NOSTOPS — For Organisations · Impact' }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: [og] },
  };
}

const nf = (n: number) => new Intl.NumberFormat('en-IN').format(n);

// What the Institutional Engine actually records for every programme — presented
// as our measurement methodology, never as invented results.
const MEASURES = [
  { icon: '🙋', title: 'Participation', desc: 'Every registration and confirmed participant is recorded per event — real reach, not estimates.' },
  { icon: '✅', title: 'Attendance', desc: 'Teachers mark attendance on the day, so each organisation sees who actually showed up.' },
  { icon: '⭐', title: 'Participant feedback', desc: 'Participants rate and comment after each session; themes roll up for the Council to review.' },
  { icon: '🔁', title: 'Repeat participation', desc: 'We track how many participants come back for later sessions and programmes — the clearest signal a programme is working.' },
  { icon: '🧘', title: 'Teacher experience', desc: 'Teachers rate each engagement too, keeping the model fair and sustainable for them.' },
  { icon: '🪔', title: 'Council oversight', desc: 'The Council of Gurus reviews programme quality on these signals — not on vanity metrics.' },
];

export default async function OrgImpactPage() {
  const [ps, catalogue] = await Promise.all([getPublicStats(), listProgrammes()]);

  const programmeCount = catalogue?.count ?? 0;
  const taxCounts = {
    MIND: catalogue?.by_taxonomy?.MIND?.length ?? 0,
    BODY: catalogue?.by_taxonomy?.BODY?.length ?? 0,
    SPECIAL_NEEDS: catalogue?.by_taxonomy?.SPECIAL_NEEDS?.length ?? 0,
  };

  const onboarded = ps.organisations;
  const target = ps.organisationTarget;
  const missionPctValue = missionPct(ps);

  // Only verifiable numbers (single approved source, lib/server/public-stats).
  // Render a card only when it's backed by a real number (> 0).
  const stats: { value: string; label: string }[] = [];
  if (onboarded > 0) stats.push({ value: nf(onboarded), label: 'Organisations onboarded' });
  if (ps.registeredTeachers) stats.push({ value: nf(ps.registeredTeachers), label: 'Registered teachers' });
  if (ps.publicProfiles) stats.push({ value: nf(ps.publicProfiles), label: 'Teachers with public profiles' });
  if (ps.empanelledTeachers) stats.push({ value: nf(ps.empanelledTeachers), label: 'Council-empanelled teachers' });
  if (ps.cities) stats.push({ value: nf(ps.cities), label: 'Cities with NOSTOPS teachers' });
  if (programmeCount > 0) stats.push({ value: nf(programmeCount), label: 'Council-curated programmes' });
  if (ps.councilMembers) stats.push({ value: nf(ps.councilMembers), label: 'Council Gurus' });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: TITLE,
    description: DESC,
    url: canonical(PATH),
    isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: canonical('/') },
  };

  return (
    <>
      <JsonLd data={jsonLd} />

      <PageHero
        eyebrow="For Organisations · Impact"
        title={<>Impact that honours <span className="text-accent">people and tradition</span></>}
        subtitle="Authentic Yoga, delivered to real organisations by Council-vetted teachers. Here is the movement so far — and exactly how we measure the outcomes of every programme."
        imageSrc="/brand/org/hero.jpg"
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/app/org/events/new"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-ink shadow-sm transition hover:bg-white/90"
          >
            Create a Programme →
          </Link>
          <Link
            href="/for-organisations"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/40 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            Back to For Organisations
          </Link>
        </div>
      </PageHero>

      <OrgSubNav active="/for-organisations/impact" />

      {/* ── MISSION PROGRESS ─────────────────────────────────── */}
      <section className="bg-cream">
        <div className="container-x py-12 sm:py-16">
          <div className="mx-auto max-w-3xl rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-accent-600">The Mission</span>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
              A 12-Month, 100-Organisation Movement
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              We set out to bring authentic, teacher-led Yoga to 100 Indian organisations. Here is where that stands today.
            </p>
            <div className="mt-6">
              <div className="flex items-end justify-between">
                <span className="text-3xl font-black text-ink sm:text-4xl">{nf(onboarded)} <span className="text-lg text-muted">/ {nf(target)}</span></span>
                <span className="text-sm font-bold text-brand-700">{Math.round(missionPctValue)}%</span>
              </div>
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-cream" role="progressbar" aria-valuenow={Math.round(missionPctValue)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-all" style={{ width: `${Math.max(missionPctValue, 3)}%` }} />
              </div>
              <p className="mt-3 text-xs font-semibold text-muted">Organisations that have joined the wellness movement.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS GRID ───────────────────────────────────────── */}
      {stats.length > 0 && (
        <section className="container-x py-12 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-accent-600">Our reach</span>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">The network behind every programme</h2>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="impact-stats">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-line bg-white p-5 text-center shadow-sm">
                <p className="text-3xl font-black tracking-tight text-brand-700 sm:text-4xl">{s.value}</p>
                <p className="mt-1.5 text-xs font-bold text-ink-soft">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-xs font-semibold text-muted">Live figures you can check across the site — the teacher directory, city pages and the Council.</p>
        </section>
      )}

      {/* ── PROGRAMME BREADTH ────────────────────────────────── */}
      {programmeCount > 0 && (
        <section className="bg-white">
          <div className="container-x py-12 sm:py-16">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-accent-600">Breadth of practice</span>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
                {nf(programmeCount)} Council-curated programmes
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Every programme is designed and reviewed by the Council of Gurus across three pillars.
              </p>
            </div>
            <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-3">
              {[
                { icon: '🧠', label: 'Mind', count: taxCounts.MIND, slug: 'mind' },
                { icon: '🧘', label: 'Body', count: taxCounts.BODY, slug: 'body' },
                { icon: '🤝', label: 'Special Needs', count: taxCounts.SPECIAL_NEEDS, slug: 'special-needs' },
              ].map((t) => (
                <Link
                  key={t.slug}
                  href={`/programmes#${t.slug}`}
                  className="flex flex-col items-center rounded-2xl border border-line bg-cream/50 p-6 text-center transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="text-3xl" aria-hidden>{t.icon}</span>
                  <span className="mt-3 text-2xl font-black text-ink">{t.count}</span>
                  <span className="mt-0.5 text-sm font-bold text-ink-soft">{t.label}</span>
                </Link>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link href="/programmes" className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline">
                Explore all programmes →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── HOW WE MEASURE ───────────────────────────────────── */}
      <section className="bg-cream">
        <div className="container-x py-12 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-accent-600">How we measure impact</span>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">Honest signals, not vanity metrics</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              The Institutional Engine records real signals for every event, so impact is something you can see — not something we claim.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MEASURES.map((m) => (
              <div key={m.title} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                <span className="text-2xl" aria-hidden>{m.icon}</span>
                <p className="mt-3 text-base font-black text-ink">{m.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TEACHER-FIRST BAND ───────────────────────────────── */}
      <section className="bg-gradient-to-br from-ink via-royal to-brand">
        <div className="container-x py-14 text-center sm:py-20">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white/70">Teacher-First. Always.</span>
          <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
            Impact that respects the teacher is impact that lasts.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-white/85">
            Every programme pays and protects its teacher fairly. That is the foundation of our outcomes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/app/org/events/new"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-7 py-3 text-sm font-bold text-ink shadow-sm transition hover:bg-white/90"
            >
              Create a Programme →
            </Link>
            <Link
              href="/trust"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/40 px-7 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              How we verify
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
