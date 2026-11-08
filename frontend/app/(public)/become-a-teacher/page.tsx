import type { Metadata } from 'next';
import Link from 'next/link';
import { apiGetSafe } from '@/lib/api';
import { TEACHER_SHARE_SENTENCE, TEACHER_SHARE_OTHER_WORK } from '@/lib/org/pricing';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { getCities, citySlug } from '@/lib/server/cities';
import { getPublicRetreats } from '@/lib/server/retreats';
import RetreatCard from '@/components/retreats/RetreatCard';

const PATH = '/become-a-teacher';
const CANONICAL_URL = canonical(PATH);
const TITLE = 'Become a Yoga Teacher: Join the Founding 1,500';
const OG_TITLE = 'Become a Yoga Teacher · Join the Founding 1,500 · NOSTOPS';
// Prompt 3C: the 70 / 80 / 85% share is stated only for eligible 3-, 6- and 12-month institutional programmes.
const DESC =
  'Join the founding cohort of Indian yoga teachers on NOSTOPS: keep 70–85% on eligible institutional programmes, get Council-empanelled and teach in our cities.';

// Public, SEO-indexed recruitment landing. ISR keeps the founding counter fresh.
export const revalidate = 60;

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESC,
    alternates: { canonical: CANONICAL_URL },
    openGraph: { title: OG_TITLE, description: DESC, url: CANONICAL_URL, type: 'website', siteName: 'NOSTOPS' },
    twitter: { card: 'summary_large_image', title: OG_TITLE, description: DESC },
  };
}

type Intake = { claimed: number; cap: number; remaining: number; percentage: number; next_seat: number; launch_cities: string[] };

const REVENUE = [
  { term: '3-month institutional programme', teacher: 70, nostops: 30, note: 'Prove the fit' },
  { term: '6-month institutional programme', teacher: 80, nostops: 20, note: 'Deepen the practice' },
  { term: '12-month institutional programme', teacher: 85, nostops: 15, note: 'Longest commitment' },
];

const BENEFITS = [
  { icon: '💸', title: 'Keep 70–85% on institutional programmes', desc: TEACHER_SHARE_SENTENCE },
  { icon: '🛡️', title: 'Council empanelment', desc: 'Get verified by the Council of Gurus and wear a credibility badge seekers trust.' },
  { icon: '🏢', title: 'Corporate & group work', desc: 'On-site programmes, workshops and organisation wellness — brought to you, not chased by you.' },
  { icon: '🌐', title: 'A public profile that ranks', desc: 'A verified NOSTOPS profile that shows up when seekers search for teachers like you.' },
  { icon: '🧘', title: 'Guru–Shishya Parampara', desc: 'Your lineage is honoured and displayed — tradition first, marketplace second.' },
  { icon: '💳', title: 'A transparent earnings wallet', desc: 'InstaKYC and a wallet that records your earnings. Withdrawal options will be announced when available.' },
];

const JOURNEY = [
  { n: '1', t: 'Register', d: 'Create your teacher account in minutes.' },
  { n: '2', t: 'Build your profile', d: 'Lineage, styles, specialisations and an AI-assisted bio.' },
  { n: '3', t: 'InstaKYC', d: 'A one-time identity verification for your verified badge and earnings features.' },
  { n: '4', t: 'Empanelment', d: 'Free merit path or fast-track Council interview.' },
  { n: '5', t: 'Active teacher', d: 'Receive bookings, teach, and earn — your share is recorded in your NOSTOPS wallet.' },
];

export default async function BecomeTeacherPage() {
  const [intake, cityList, retreatsData] = await Promise.all([
    apiGetSafe<Intake>('/platform/founding-intake', {
      claimed: 0, cap: 1500, remaining: 1500, percentage: 0, next_seat: 1, launch_cities: [],
    }, { revalidate: 60 }),
    getCities(),
    getPublicRetreats(),
  ]);

  const pct = Math.min(Math.max(intake.percentage || (intake.claimed / (intake.cap || 1500)) * 100, 0), 100);
  const citySet = new Set(cityList.map((c) => c.slug)); // cities with real, content-bearing pages
  const featuredRetreats = retreatsData.retreats.slice(0, 3);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': CANONICAL_URL,
    url: CANONICAL_URL,
    name: TITLE,
    description: DESC,
    isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: canonical('/') },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="container-x py-10 sm:py-14">
        {/* Hero */}
        <section className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">Teacher-first cooperative</span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-5xl">Teach yoga the way it was meant to be taught</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
            NOSTOPS is built <em>with</em> yoga teachers, not on top of them. Join the founding cohort and let your
            lineage lead. {TEACHER_SHARE_SENTENCE}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/signup?role=teacher" className="rounded-xl bg-brand px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600">
              Join the mission — it’s free →
            </Link>
            <Link href="/login" className="rounded-xl border border-line bg-white px-6 py-3.5 text-sm font-bold text-ink-soft transition hover:bg-cream">
              Log in
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink-soft">
            Already teaching and listed online?{' '}
            <Link href="/claim" className="font-bold text-brand-700 underline-offset-2 hover:underline">
              Claim your existing profile →
            </Link>
          </p>
        </section>

        {/* Founding mission counter */}
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
          {intake.launch_cities.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Launch cities</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {intake.launch_cities.map((c) => {
                  const slug = citySlug(c);
                  return citySet.has(slug) ? (
                    <Link key={c} href={`/become-a-teacher/${slug}`} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand/20 transition hover:bg-brand-50">{c}</Link>
                  ) : (
                    <span key={c} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink-soft">{c}</span>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Teacher-first revenue */}
        <section className="mx-auto mt-14 max-w-3xl">
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

        {/* Benefits */}
        <section className="mx-auto mt-14 max-w-4xl">
          <h2 className="text-center text-2xl font-black tracking-tight text-ink">Why teachers join NOSTOPS</h2>
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

        {/* Journey */}
        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="text-center text-2xl font-black tracking-tight text-ink">From seeker to active teacher</h2>
          <div className="mt-6 space-y-3">
            {JOURNEY.map((s) => (
              <div key={s.n} className="flex items-start gap-4 rounded-2xl border border-line bg-white p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-black text-white">{s.n}</span>
                <div><p className="text-sm font-extrabold text-ink">{s.t}</p><p className="text-sm text-ink-soft">{s.d}</p></div>
              </div>
            ))}
          </div>
        </section>

        {/* Explore the NOSTOPS ecosystem — internal links to retreats, venues, cities */}
        <section className="mx-auto mt-14 max-w-4xl">
          <h2 className="text-center text-2xl font-black tracking-tight text-ink">Explore the NOSTOPS ecosystem</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-ink-soft">Teaching on NOSTOPS connects you to retreats, venues and a growing directory across our launch cities.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Link href="/retreats" className="group rounded-2xl border border-line bg-white p-5 transition hover:border-brand hover:shadow-md">
              <p className="text-2xl">🏔️</p>
              <p className="mt-2 text-sm font-extrabold text-ink group-hover:text-brand-700">Retreats</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">Host and lead immersive yoga retreats through the cooperative.</p>
              <span className="mt-3 inline-block text-sm font-bold text-brand-700">Browse retreats →</span>
            </Link>
            <Link href="/venues" className="group rounded-2xl border border-line bg-white p-5 transition hover:border-brand hover:shadow-md">
              <p className="text-2xl">🏛️</p>
              <p className="mt-2 text-sm font-extrabold text-ink group-hover:text-brand-700">Venues</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">Teach at partner studios and spaces, or list your own venue.</p>
              <span className="mt-3 inline-block text-sm font-bold text-brand-700">Discover venues →</span>
            </Link>
            <Link href="/teachers" className="group rounded-2xl border border-line bg-white p-5 transition hover:border-brand hover:shadow-md">
              <p className="text-2xl">🧘</p>
              <p className="mt-2 text-sm font-extrabold text-ink group-hover:text-brand-700">Teacher directory</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">See the verified, empanelled teachers you&apos;ll be joining.</p>
              <span className="mt-3 inline-block text-sm font-bold text-brand-700">View the directory →</span>
            </Link>
          </div>

          {cityList.length > 0 && (
            <div className="mt-6 rounded-2xl border border-line bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Teach in your city</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {cityList.slice(0, 12).map((c) => (
                  <Link key={c.slug} href={`/become-a-teacher/${c.slug}`} className="rounded-full bg-cream px-3 py-1 text-sm font-semibold text-ink-soft transition hover:bg-brand-50 hover:text-brand-700">
                    {c.label}{c.count > 0 ? ` · ${c.count}` : ''}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Upcoming retreats — direct links into the retreat pages */}
        {featuredRetreats.length > 0 && (
          <section className="mx-auto mt-14 max-w-4xl">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-tight text-ink">Upcoming retreats</h2>
              <Link href="/retreats" className="text-sm font-bold text-brand-700 hover:underline">All retreats →</Link>
            </div>
            <ul className="mt-6 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {featuredRetreats.map((rt) => (
                <li key={rt.id}><RetreatCard r={rt} /></li>
              ))}
            </ul>
          </section>
        )}

        {/* Final CTA */}
        <section className="mx-auto mt-14 max-w-2xl rounded-2xl bg-brand p-8 text-center text-white">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Claim your founding seat</h2>
          <p className="mx-auto mt-2 max-w-lg text-white/90">Registration is free. Build your profile today and start teaching with a cooperative that puts you first.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/signup?role=teacher" className="rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-brand-700 transition hover:bg-cream">
              Join as a teacher →
            </Link>
            <Link href="/teachers" className="rounded-xl border border-white/40 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">
              Browse the directory
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
