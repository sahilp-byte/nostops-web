import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGetSafe } from '@/lib/api';
import { TEACHER_SHARE_SENTENCE, TEACHER_SHARE_OTHER_WORK } from '@/lib/org/pricing';
import { canonical } from '@/lib/site';
import { titleCase, inr } from '@/lib/format';
import { fmtKm } from '@/lib/geo';
import { JsonLd } from '@/components/JsonLd';
import { fitDescription, normalizeJsonLd } from '@/lib/seo';
import { fmtRange } from '@/lib/server/retreats';
import { getCities, getCityEcosystem, cityEcosystemFaqs, type CityEcosystem } from '@/lib/server/cities';
import TeacherCard from '@/components/app/learner/TeacherCard';
import RetreatCard from '@/components/retreats/RetreatCard';
import { retreatPath } from '@/lib/retreat-url';
import RetreatThumb from '@/components/retreats/RetreatThumb';
import VenueCard from '@/components/venues/VenueCard';
import { venuePath } from '@/lib/server/venues';
import { withGoogleCovers } from '@/lib/server/ai-assisted-venues';
import RetreatFaq from '@/components/retreats/RetreatFaq';

// City-scoped, SEO-indexed teacher-recruitment landing (local search capture).
// Mirrors /become-a-teacher but anchored to a specific launch city. ISR keeps
// the founding counter fresh; city slugs are prerendered from the live directory.
export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  const cities = await getCities();
  return cities.map((c) => ({ city: c.slug }));
}

type Intake = { claimed: number; cap: number; remaining: number; percentage: number; next_seat: number; launch_cities: string[] };

const HOME_URL = canonical('/');

// SEO copy enriched with REAL ecosystem counts when available; falls back to the
// evergreen recruitment message for brand-new cities. Kept under ~160 chars.
function copy(label: string, eco?: CityEcosystem | null) {
  const title = `Become a Yoga Teacher in ${label}`;
  let desc = `Teach yoga in ${label} with NOSTOPS, a teacher-first cooperative. Keep 70–85% on eligible institutional programmes and get Council-empanelled. Free to join.`;
  if (eco && eco.teacherCount > 0) {
    const bits: string[] = [`Join ${eco.teacherCount} yoga ${eco.teacherCount === 1 ? 'teacher' : 'teachers'} in ${label}`];
    if (eco.traditionCount > 0) bits.push(`across ${eco.traditionCount} ${eco.traditionCount === 1 ? 'tradition' : 'traditions'}`);
    if (eco.retreatCount > 0) bits.push(`${eco.retreatCount} ${eco.retreatCount === 1 ? 'retreat' : 'retreats'}`);
    desc = `${bits.join(', ')} on NOSTOPS. Keep 70–85% on eligible institutional programmes and get Council-empanelled. Free to join.`;
  }
  return { title, desc: fitDescription(desc) };
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const eco = await getCityEcosystem(city);
  if (!eco) return { title: 'City not found · NOSTOPS', robots: { index: false, follow: false } };
  const url = canonical(`/become-a-teacher/${city}`);
  const { title, desc } = copy(eco.label, eco);
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title: `${title} · NOSTOPS`, description: desc, url, type: 'website', siteName: 'NOSTOPS' },
    twitter: { card: 'summary_large_image', title: `${title} · NOSTOPS`, description: desc },
  };
}

const REVENUE = [
  { term: '3-month institutional programme', teacher: 70, nostops: 30, note: 'Prove the fit' },
  { term: '6-month institutional programme', teacher: 80, nostops: 20, note: 'Deepen the practice' },
  { term: '12-month institutional programme', teacher: 85, nostops: 15, note: 'Longest commitment' },
];

const BENEFITS = [
  { icon: '💸', title: 'Keep 70–85% on institutional programmes', desc: TEACHER_SHARE_SENTENCE },
  { icon: '🛡️', title: 'Council empanelment', desc: 'Get verified by the Council of Gurus and wear a badge seekers trust.' },
  { icon: '🏢', title: 'Corporate & group work', desc: 'On-site programmes and organisation wellness — brought to you, not chased by you.' },
  { icon: '🌐', title: 'A profile that ranks', desc: 'A verified NOSTOPS profile that shows up when seekers search in your city.' },
  { icon: '🧘', title: 'Guru–Shishya Parampara', desc: 'Your lineage is honoured and displayed — tradition first, marketplace second.' },
  { icon: '💳', title: 'A transparent earnings wallet', desc: 'InstaKYC and a wallet that records your earnings. Withdrawal options will be announced when available.' },
];

// ── Small presentational helpers (server-safe) ───────────────────────────────
function Metric({ value, label, href }: { value: number; label: string; href?: string }) {
  const inner = (
    <>
      <p className="text-3xl font-black text-brand-700">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-muted">{label}</p>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-2xl border border-line bg-white p-5 text-center transition hover:border-brand hover:shadow-sm" data-analytics="city_metric_click">{inner}</Link>
  ) : (
    <div className="rounded-2xl border border-line bg-white p-5 text-center">{inner}</div>
  );
}

function SectionHead({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{eyebrow}</p>}
      <h2 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-2 max-w-2xl text-ink-soft">{subtitle}</p>}
    </div>
  );
}

export default async function BecomeTeacherCityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const eco = await getCityEcosystem(city);
  if (!eco) notFound();
  const label = eco.label;
  const url = canonical(`/become-a-teacher/${city}`);
  const { title, desc } = copy(label, eco);

  const intake = await apiGetSafe<Intake>('/platform/founding-intake', {
    claimed: 0, cap: 1500, remaining: 1500, percentage: 0, next_seat: 1, launch_cities: [],
  }, { revalidate: 60 });
  const pct = Math.min(Math.max(intake.percentage || (intake.claimed / (intake.cap || 1500)) * 100, 0), 100);

  const featuredTeachers = eco.teachers.slice(0, 6);
  const featuredRetreats = eco.retreats.slice(0, 6);
  const featuredVenues = await withGoogleCovers(eco.venues.slice(0, 6));
  const traditionChips = [...eco.paramparas, ...eco.styles].slice(0, 12);
  const hasEcosystem = eco.retreatCount > 0 || eco.venueCount > 0;
  const emerging = eco.teacherCount <= 2;
  // Next timely experience: the soonest upcoming (non-past) retreat in the city.
  const todayIso = new Date().toISOString().slice(0, 10);
  const nextRetreat = eco.retreats.find((r) => !r.startDate || r.startDate >= todayIso) || null;

  // ── Structured data: WebPage + Breadcrumb, plus ItemLists that mirror the
  // ── ACTUAL visible content (teachers / retreats / venues). Never emit an
  // ── ItemList for a section that isn't shown.
  const jsonLd: any[] = [
    { '@context': 'https://schema.org', '@type': 'WebPage', '@id': url, url, name: `${title} · NOSTOPS`, description: desc, isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: HOME_URL } },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
        { '@type': 'ListItem', position: 2, name: 'Become a Teacher', item: canonical('/become-a-teacher') },
        { '@type': 'ListItem', position: 3, name: label, item: url },
      ],
    },
  ];
  if (featuredTeachers.length > 0) {
    jsonLd.push({
      '@context': 'https://schema.org', '@type': 'ItemList', name: `Yoga teachers in ${label}`, numberOfItems: eco.teacherCount,
      itemListElement: featuredTeachers.map((t, i) => {
        const turl = canonical(`/teachers/${t.handle}`);
        return { '@type': 'ListItem', position: i + 1, item: { '@type': 'Person', '@id': turl, name: t.name, url: turl, jobTitle: 'Yoga Teacher', address: { '@type': 'PostalAddress', addressLocality: label, addressCountry: 'IN' } } };
      }),
    });
  }
  if (featuredRetreats.length > 0) {
    jsonLd.push({
      '@context': 'https://schema.org', '@type': 'ItemList', name: `Yoga retreats in ${label}`, numberOfItems: eco.retreatCount,
      itemListElement: featuredRetreats.map((r, i) => {
        const rurl = canonical(retreatPath(r));
        const ev: any = { '@type': 'EducationEvent', '@id': rurl, name: r.title, url: rurl };
        if (r.startDate) ev.startDate = r.startDate;
        if (r.endDate) ev.endDate = r.endDate;
        return { '@type': 'ListItem', position: i + 1, item: ev };
      }),
    });
  }
  if (featuredVenues.length > 0) {
    jsonLd.push({
      '@context': 'https://schema.org', '@type': 'ItemList', name: `Yoga venues in ${label}`, numberOfItems: eco.venueCount,
      itemListElement: featuredVenues.map((v, i) => {
        const vurl = canonical(venuePath(v));
        return { '@type': 'ListItem', position: i + 1, item: { '@type': 'LocalBusiness', '@id': vurl, name: v.name, url: vurl, address: { '@type': 'PostalAddress', addressLocality: v.city || label, addressRegion: v.state, addressCountry: 'IN' } } };
      }),
    });
  }

  const faqs = cityEcosystemFaqs(eco);
  if (faqs.length > 0) {
    jsonLd.push({
      '@context': 'https://schema.org', '@type': 'FAQPage', '@id': `${url}#faq`,
      mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }

  return (
    <>
      <JsonLd data={normalizeJsonLd(jsonLd)} />
      <div className="container-x py-10 sm:py-14">
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl text-center">
          <nav className="mb-4 text-xs text-muted" aria-label="Breadcrumb">
            <Link href="/become-a-teacher" className="hover:text-brand-700">Become a teacher</Link> <span className="px-1">/</span> <span className="text-ink-soft">{label}</span>
          </nav>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">A living yoga community in {label}</span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-5xl">Become a yoga teacher in {label}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Join a growing community of yoga teachers in {label} preserving and carrying forward the living tradition of yoga. {desc}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/join" className="rounded-xl bg-brand px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600" data-analytics="become_teacher_click">
              Become a NOSTOPS teacher — it’s free →
            </Link>
            <Link href={`/yoga-teachers/${city}`} className="rounded-xl border border-line bg-white px-6 py-3.5 text-sm font-bold text-ink-soft transition hover:bg-cream" data-analytics="city_teacher_profile_click">
              Meet the teachers of {label}
            </Link>
          </div>
          {eco.teacherCount > 0 && (
            <p className="mt-4 text-sm text-muted">{eco.teacherCount} {eco.teacherCount === 1 ? 'teacher is' : 'teachers are'} already carrying the tradition forward in {label}.</p>
          )}
        </section>

        {/* ── NEXT RETREAT SPOTLIGHT (timely — seen first) ─────────────── */}
        {nextRetreat && (
          <section className="mx-auto mt-10 max-w-4xl" data-testid="city-retreat-spotlight">
            <Link href={retreatPath(nextRetreat)} className="group grid overflow-hidden rounded-2xl border border-line bg-white transition hover:border-accent hover:shadow-lg sm:grid-cols-[1.1fr_1fr]" data-analytics="retreat_click">
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-accent/15 via-cream to-brand/15 sm:aspect-auto">
                <RetreatThumb id={nextRetreat.id} cover={nextRetreat.coverImage || nextRetreat.images[0] || null} venuePartnerId={nextRetreat.venuePartnerId} theme={nextRetreat.theme} alt={nextRetreat.title} />
              </div>
              <div className="flex flex-col justify-center p-6">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent-600">🗓️ Next retreat in {label}</span>
                <h2 className="mt-3 text-xl font-black tracking-tight text-ink group-hover:text-accent-600 sm:text-2xl">{nextRetreat.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                  {fmtRange(nextRetreat.startDate, nextRetreat.endDate) && <span className="font-semibold">{fmtRange(nextRetreat.startDate, nextRetreat.endDate)}</span>}
                  {nextRetreat.guruName && <span className="text-muted">· with {nextRetreat.guruName}</span>}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  {typeof nextRetreat.priceInr === 'number' ? (
                    <span className="text-lg font-black text-ink">₹{inr(nextRetreat.priceInr)}<span className="text-xs font-medium text-muted"> / seat</span></span>
                  ) : (
                    <span className="text-sm font-semibold text-brand-700">Enquire for pricing</span>
                  )}
                  <span className="ml-auto text-sm font-bold text-accent-600">View retreat →</span>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* ── FOUNDING COUNTER ─────────────────────────────────────────── */}
        <section className="mx-auto mt-12 max-w-2xl rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-50 to-cream p-6 sm:p-7">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-extrabold text-ink">The Founding 1,500</h2>
            <span className="text-sm font-bold text-brand-700">{Math.round(pct)}%</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-semibold text-ink"><span className="text-lg font-black text-brand-700">{intake.claimed}</span> of {intake.cap} seats claimed</p>
            {intake.next_seat > 0 && <p className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-700">You’d be teacher #{intake.next_seat}</p>}
          </div>
        </section>

        {/* ── TEACHER COMMUNITY METRICS ────────────────────────────────── */}
        <section className="mx-auto mt-14 max-w-4xl">
          <SectionHead eyebrow="The community" title={`The NOSTOPS teacher community in ${label}`} subtitle={emerging ? `Be among the first yoga teachers to shape the NOSTOPS community in ${label}.` : `Real teachers, real traditions — every one a custodian of knowledge received from their own teacher.`} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric value={eco.teacherCount} label={eco.teacherCount === 1 ? 'Teacher' : 'Teachers'} href={`/yoga-teachers/${city}`} />
            {eco.verifiedCount > 0 && <Metric value={eco.verifiedCount} label="Verified" href={`/yoga-teachers/${city}`} />}
            {eco.empanelledCount > 0 && <Metric value={eco.empanelledCount} label="Council empanelled" href={`/yoga-teachers/${city}`} />}
            {eco.traditionCount > 0 && <Metric value={eco.traditionCount} label="Traditions & styles" />}
          </div>
        </section>

        {/* ── MEET THE TEACHERS ────────────────────────────────────────── */}
        {featuredTeachers.length > 0 && (
          <section className="mx-auto mt-16 max-w-5xl">
            <div className="flex items-end justify-between gap-4">
              <SectionHead eyebrow="Custodians of the tradition" title={`Meet the teachers of ${label}`} />
              <Link href={`/yoga-teachers/${city}`} className="mb-6 shrink-0 text-sm font-bold text-brand-700 hover:text-brand-600" data-analytics="city_teacher_profile_click">Meet all {eco.teacherCount} →</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredTeachers.map((t) => <TeacherCard key={t.handle} t={t} href={`/teachers/${t.handle}`} bookHref={`/app/teachers/${t.handle}/book`} />)}
            </div>
          </section>
        )}

        {/* ── TRADITIONS ───────────────────────────────────────────────── */}
        {traditionChips.length > 0 && (
          <section className="mx-auto mt-16 max-w-4xl">
            <SectionHead eyebrow="Lineage first" title={`Yoga traditions in ${label}`} subtitle="The paramparas and styles carried forward by teachers here." />
            <div className="flex flex-wrap gap-2">
              {traditionChips.map((s) => (
                <Link key={s.id} href={`/yoga-teachers/${city}`} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand-700" data-analytics="tradition_click">
                  {titleCase(s.id)} <span className="text-muted">· {s.count}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── RETREATS IN & AROUND ─────────────────────────────────────── */}
        <section className="mx-auto mt-16 max-w-5xl">
          <div className="flex items-end justify-between gap-4">
            <SectionHead eyebrow="Experiences" title={`Yoga retreats in ${label} & nearby`} />
            {(featuredRetreats.length > 0 || eco.nearbyRetreats.length > 0) && (
              <Link href={featuredRetreats.length > 0 ? `/retreats/in/${city}` : '/retreats'} className="mb-6 shrink-0 text-sm font-bold text-brand-700 hover:text-brand-600" data-analytics="retreat_click">Explore all retreats →</Link>
            )}
          </div>

          {featuredRetreats.length > 0 && (
            <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {featuredRetreats.map((r) => <li key={r.id}><RetreatCard r={r} /></li>)}
            </ul>
          )}

          {featuredRetreats.length === 0 && eco.nearbyRetreats.length === 0 && (
            <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-dashed border-brand/30 bg-brand-50/40 p-6 text-center sm:flex-row sm:text-left">
              <div>
                <p className="text-lg font-extrabold text-ink">Retreat opportunities are coming to {label}.</p>
                <p className="mt-1 text-sm text-ink-soft">Turn your teaching into an experience your students can carry with them — be the first to host one here.</p>
              </div>
              <Link href="/app/teacher/retreats/new" className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600" data-analytics="host_retreat_click">Host your retreat →</Link>
            </div>
          )}

          {eco.nearbyRetreats.length > 0 && (
            <div className={featuredRetreats.length > 0 ? 'mt-8' : ''} data-testid="city-nearby-retreats">
              <p className="mb-3 text-sm font-bold text-ink">
                {featuredRetreats.length > 0 ? `More retreats near ${label}` : `No retreats in ${label} yet — here’s what’s happening close by`}
              </p>
              <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {eco.nearbyRetreats.map((r) => (
                  <li key={r.id} className="relative">
                    {typeof r.distanceKm === 'number' && <span className="absolute left-3 top-3 z-10 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm" data-testid="nearby-retreat-distance">{fmtKm(r.distanceKm)}</span>}
                    <RetreatCard r={r} />
                  </li>
                ))}
              </ul>
              {featuredRetreats.length === 0 && (
                <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl border border-dashed border-brand/30 bg-brand-50/40 p-5 text-center sm:flex-row sm:text-left">
                  <p className="text-sm text-ink-soft">Have a retreat idea for {label}? Turn your teaching into an experience your students can carry with them.</p>
                  <Link href="/app/teacher/retreats/new" className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600" data-analytics="host_retreat_click">Host your retreat →</Link>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── HOST YOUR OWN RETREAT ────────────────────────────────────── */}
        <section className="mx-auto mt-16 max-w-4xl">
          <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-line bg-white p-6 sm:flex-row">
            <div>
              <p className="text-xl font-black tracking-tight text-ink">Have a retreat idea?</p>
              <p className="mt-1 max-w-xl text-sm text-ink-soft">Turn your teaching into an experience your students can carry with them. NOSTOPS handles the venue, seats and participant payments, and records your share in your wallet under that retreat’s own terms.</p>
            </div>
            <Link href="/app/teacher/retreats/new" className="shrink-0 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600" data-analytics="host_retreat_click">Host your retreat →</Link>
          </div>
        </section>

        {/* ── VENUES ───────────────────────────────────────────────────── */}
        <section className="mx-auto mt-16 max-w-5xl">
          <div className="flex items-end justify-between gap-4">
            <SectionHead eyebrow="Where to teach" title={`Yoga & retreat venues in ${label}`} subtitle="Places where teachers can hold workshops, trainings and retreats." />
            {featuredVenues.length > 0 && (
              <Link href="/venues" className="mb-6 shrink-0 text-sm font-bold text-brand-700 hover:text-brand-600" data-analytics="venue_click">Explore venues →</Link>
            )}
          </div>
          {featuredVenues.length > 0 ? (
            <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {featuredVenues.map((v) => <li key={v.id}><VenueCard v={v} /></li>)}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-dashed border-line bg-cream/50 p-6 text-center sm:flex-row sm:text-left">
              <div>
                <p className="text-lg font-extrabold text-ink">Looking for a place to teach or host a retreat?</p>
                <p className="mt-1 text-sm text-ink-soft">Discover NOSTOPS venues across India — vetted for yoga, workshops and retreats.</p>
              </div>
              <Link href="/venues" className="shrink-0 rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-cream" data-analytics="venue_click">Discover venues →</Link>
            </div>
          )}
        </section>

        {/* ── CORPORATE & GROUP (teacher-facing) ───────────────────────── */}
        <section className="mx-auto mt-16 max-w-4xl">
          <div className="rounded-2xl border border-brand/15 bg-brand-50/50 p-6 sm:p-7">
            <SectionHead eyebrow="Brought to you, not chased by you" title={`Corporate & group yoga in ${label}`} subtitle="Organisations and groups looking for yoga in your city are routed to NOSTOPS teachers — on-site programmes and workplace wellness, without the cold outreach." />
            <div className="flex flex-wrap gap-3">
              <Link href="/join" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600" data-analytics="corporate_opportunity_click">Become a teacher to receive work →</Link>
              <Link href="/for-organisations" className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream" data-analytics="corporate_opportunity_click">For organisations →</Link>
            </div>
          </div>
        </section>

        {/* ── ECOSYSTEM SNAPSHOT (only once there's more than teachers) ─── */}
        {hasEcosystem && (
          <section className="mx-auto mt-16 max-w-4xl">
            <SectionHead eyebrow="The living ecosystem" title={`Yoga in ${label}`} subtitle="This page grows on its own — as teachers join, retreats are published and venues open up, the ecosystem here deepens." />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric value={eco.teacherCount} label={eco.teacherCount === 1 ? 'Teacher' : 'Teachers'} href={`/yoga-teachers/${city}`} />
              {eco.traditionCount > 0 && <Metric value={eco.traditionCount} label="Traditions" />}
              {eco.retreatCount > 0 && <Metric value={eco.retreatCount} label="Retreats" href={`/retreats/in/${city}`} />}
              {eco.venueCount > 0 && <Metric value={eco.venueCount} label="Venues" href="/venues" />}
            </div>
          </section>
        )}

        {/* ── TEACHER-FIRST REVENUE ────────────────────────────────────── */}
        <section className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-center text-2xl font-black tracking-tight text-ink">Teacher shares on eligible institutional programmes</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-ink-soft" data-testid="teacher-share-scope">{TEACHER_SHARE_SENTENCE} {TEACHER_SHARE_OTHER_WORK}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {REVENUE.map((r) => (
              <div key={r.term} className="rounded-2xl border border-line bg-white p-5 text-center">
                <p className="text-4xl font-black text-brand-700">{r.teacher}%</p>
                <p className="text-xs font-semibold text-muted">to you · {r.nostops}% to NOSTOPS</p>
                <p className="mt-3 text-sm font-extrabold text-ink">{r.term}</p>
                <p className="text-xs text-muted">{r.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── BENEFITS ─────────────────────────────────────────────────── */}
        <section className="mx-auto mt-16 max-w-4xl">
          <h2 className="text-center text-2xl font-black tracking-tight text-ink">Why teachers in {label} join NOSTOPS</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl border border-line bg-white p-5">
                <p className="text-2xl">{b.icon}</p>
                <p className="mt-2 text-sm font-extrabold text-ink">{b.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── NEARBY CITIES ────────────────────────────────────────────── */}
        {eco.nearbyCities.length > 0 && (
          <section className="mx-auto mt-16 max-w-4xl">
            <SectionHead eyebrow="Explore further" title={`Explore yoga around ${label}`} />
            <div className="flex flex-wrap gap-2">
              {eco.nearbyCities.map((c) => (
                <Link key={c.slug} href={`/become-a-teacher/${c.slug}`} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand-700" data-analytics="nearby_city_click">
                  {c.label} <span className="text-muted">· {c.count}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── LOCAL SEARCH FAQ (+ FAQPage JSON-LD) ─────────────────────── */}
        {faqs.length > 0 && (
          <section className="mx-auto mt-16 max-w-4xl">
            <RetreatFaq items={faqs} />
          </section>
        )}

        {/* ── FINAL CTA ────────────────────────────────────────────────── */}
        <section className="mx-auto mt-16 max-w-2xl rounded-2xl bg-brand p-8 text-center text-white">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{label} needs teachers. Yoga needs custodians.</h2>
          <p className="mx-auto mt-2 max-w-lg text-white/90">A teacher does not merely offer a service — they carry something received from another teacher. Help that knowledge continue to live in {label}. Registration is free.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/join" className="rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-brand-700 transition hover:bg-cream" data-analytics="become_teacher_click">
              Become a NOSTOPS teacher →
            </Link>
            <Link href="/become-a-teacher" className="rounded-xl border border-white/40 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">
              How it works
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
