import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical, toWww } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { normalizeJsonLd } from '@/lib/seo';
import { getVenues, venuePath } from '@/lib/server/venues';
import { withGoogleCovers } from '@/lib/server/ai-assisted-venues';

const CANONICAL_URL = canonical('/list-your-venue');
const TITLE = 'List Your Venue';
const DESCRIPTION =
  'List your yoga or wellness venue free on NOSTOPS, create and share your retreat, and reach participants through a trusted teacher-first community.';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: CANONICAL_URL },
    openGraph: { type: 'website', siteName: 'NOSTOPS', url: CANONICAL_URL, title: `${TITLE} · NOSTOPS`, description: DESCRIPTION },
    twitter: { card: 'summary_large_image', title: `${TITLE} · NOSTOPS`, description: DESCRIPTION },
  };
}

const VALUE_PROPS: { icon: string; title: string; tint: string }[] = [
  { icon: '🌿', title: 'For Yoga Teachers and Facilitators', tint: 'bg-emerald-50 text-emerald-700' },
  { icon: '👥', title: 'Greater Visibility and Reach', tint: 'bg-indigo-50 text-indigo-700' },
  { icon: '📊', title: 'Connect with Aligned Audiences', tint: 'bg-sky-50 text-sky-700' },
  { icon: '❤️', title: 'Support Meaningful Retreat Experiences', tint: 'bg-orange-50 text-orange-700' },
];

const TIER1_POINTS = [
  'Manual profile creation (no auto-import)',
  'Fill in all onboarding fields manually',
  'Upload 1–2 photos of your space',
  'Retreat dates, capacity, facilities and pricing',
  'Public listing page with enquiry / contact options',
  'Discovery through NOSTOPS city and category pages',
  'Connect with yoga teachers and organisers',
  'Basic listing performance indicators (where available)',
];

const TIER2_POINTS = [
  'Import permitted information from your website or Google Business / Maps link',
  'NOSTOPS AI analyses available public information using our algorithms',
  'Generates a real-time report on venue suitability',
  'Shows an analysis of online reputation (from publicly available information)',
  'AI-assisted venue description and structured amenities',
  'Auto-matches the most relevant venues and retreats to assist teachers',
  'Facility-completeness and retreat-readiness assessment',
  'Structured information for better matching with retreat requirements',
  'Owner review, corrections and assisted completion',
  'Deep, cross-linked, owner-approved public pages with SEO-based meta tags',
];

const TIER3_POINTS = [
  'Retreat positioning and audience definition',
  'Compelling copywriting and listing enhancement',
  'Landing page and registration-flow support',
  'Social media content packs and promotional calendars',
  'Email and WhatsApp campaign setup',
  'Partner and community outreach',
  'PR and media outreach (as needed)',
  'Campaign performance reporting (enquiries, registrations and conversions)',
];

const TRUST = [
  { icon: '🛡️', title: 'Trusted Community', desc: 'For yoga teachers, venues and organisers', tint: 'bg-sky-50 text-sky-600' },
  { icon: '🤝', title: 'Meaningful Connections', desc: 'Retreats, institutions and global seekers', tint: 'bg-emerald-50 text-emerald-600' },
  { icon: '🌱', title: 'Purpose-Driven Growth', desc: 'Wellness, learning and community impact', tint: 'bg-orange-50 text-orange-600' },
  { icon: '🌐', title: 'Pan-India and Global', desc: 'Support for local and international audiences', tint: 'bg-teal-50 text-teal-600' },
];

function Check({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span aria-hidden className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white ${color}`}>✓</span>
      <span>{children}</span>
    </li>
  );
}

export default async function ListYourVenuePage() {
  // 5 most recently listed venues (newest directory additions first) that have a
  // cover image, for the "Recently listed venues" showcase. Fail-open.
  let recentVenues: Awaited<ReturnType<typeof getVenues>> = [];
  try {
    const all = await withGoogleCovers(await getVenues({ limit: 100 }));
    recentVenues = all.filter((v) => v.coverImage).slice(0, 5);
  } catch {
    recentVenues = [];
  }

  const jsonld = normalizeJsonLd([
    { '@context': 'https://schema.org', '@type': 'WebPage', '@id': CANONICAL_URL, url: CANONICAL_URL, name: TITLE, description: DESCRIPTION },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: toWww(canonical('/')) },
        { '@type': 'ListItem', position: 2, name: 'Venues', item: toWww(canonical('/venues')) },
        { '@type': 'ListItem', position: 3, name: 'List Your Venue', item: toWww(CANONICAL_URL) },
      ],
    },
  ]);

  return (
    <main className="bg-white pb-20" data-testid="lyv-landing">
      <JsonLd data={jsonld} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex flex-wrap items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/venues" className="hover:text-brand-700">Venues</Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-ink-soft">List Your Venue</span>
        </div>
      </nav>

      {/* Hero — misty-dawn approximation (light left, warm sunset right) */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-50 via-cream to-amber-100" />
        <div className="pointer-events-none absolute -right-24 top-6 h-72 w-72 rounded-full bg-gradient-to-br from-amber-300 via-orange-300 to-rose-300 opacity-70 blur-2xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-brand-200/50 blur-2xl" />
        <div className="container-x relative py-14 md:py-20">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-700">Yoga — India&apos;s Teachers-First Yoga Collective</p>
          <h1 className="mt-4 max-w-4xl text-3xl font-black leading-[1.08] tracking-tight text-ink md:text-5xl">
            For Venue Owners, Retreat Creators
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
            List your venue, create and share your retreat, and reach participants through a trusted teacher-first community.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/venues/submit" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-brand-600" data-analytics="lyv_hero_submit">
              List your venue free →
            </Link>
            <Link href="/venues" className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-brand/40 bg-white/70 px-6 py-3 text-sm font-bold text-brand-700 backdrop-blur transition hover:bg-white" data-analytics="lyv_hero_browse">
              Explore the directory
            </Link>
          </div>

          {/* Value props */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_PROPS.map((v) => (
              <div key={v.title} className="flex items-center gap-3">
                <span aria-hidden className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${v.tint}`}>{v.icon}</span>
                <span className="text-sm font-bold leading-snug text-ink-soft">{v.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="container-x py-14">
        <div className="grid gap-6 md:grid-cols-3">

          {/* TIER 1 — green */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm" data-testid="lyv-tier-tier-1">
            <div className="relative flex h-32 items-end justify-between bg-gradient-to-br from-emerald-400 via-brand-500 to-brand-700 p-4">
              <span className="text-xs font-black uppercase tracking-wide text-white/90">Tier 1</span>
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-emerald-700">Free Forever</span>
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h3 className="text-xl font-black leading-tight text-ink">Free Discovery &amp; Publishing</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                List your venue or create your retreat at no cost. Connect with a community of yoga teachers, organisers and destination seekers.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-ink-soft">
                {TIER1_POINTS.map((p) => <Check key={p} color="bg-emerald-500">{p}</Check>)}
              </ul>
              <div className="mt-auto pt-6">
                <p className="text-3xl font-black text-emerald-700">₹0</p>
                <p className="text-sm text-muted">No hidden fees. Get started today.</p>
                <Link href="/venues/submit" data-analytics="lyv_tier1_submit" className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700">
                  List your venue free →
                </Link>
              </div>
            </div>
          </div>

          {/* TIER 2 — purple / AI-assisted */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-md ring-1 ring-indigo-100" data-testid="lyv-tier-tier-2">
            <div className="relative flex h-32 items-start justify-between bg-gradient-to-br from-indigo-500 via-violet-500 to-indigo-600 p-4">
              <span className="text-xs font-black uppercase tracking-wide text-white/90">Tier 2</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-indigo-700">✨ AI-Assisted</span>
              <span aria-hidden className="pointer-events-none absolute bottom-3 left-4 text-4xl">🤖</span>
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h3 className="text-xl font-black leading-tight text-ink">AI-Assisted Onboarding</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Let our AI help you create a complete, high-quality venue listing with a retreat suitability assessment.
              </p>
              <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">Optional · one-time</span>
              <ul className="mt-4 space-y-2.5 text-sm text-ink-soft">
                {TIER2_POINTS.map((p) => <Check key={p} color="bg-indigo-500">{p}</Check>)}
              </ul>
              <div className="mt-auto pt-6">
                <p className="text-3xl font-black text-indigo-700">₹1,999 <span className="text-base font-bold text-ink-soft">+ GST</span></p>
                <p className="text-sm text-muted">India one-time · International US$30 — international checkout is temporarily unavailable while PayPal checkout is being prepared. Optional — the free listing is never gated behind it.</p>
                <Link href="/venues/ai-onboarding" data-analytics="lyv_tier2_onboard" className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700">
                  Get AI-Assisted Onboarding →
                </Link>
              </div>
            </div>
          </div>

          {/* TIER 3 — orange / Marketing & PR */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm" data-testid="lyv-tier-tier-3">
            <div className="relative flex h-32 items-start justify-between bg-gradient-to-br from-amber-400 via-orange-400 to-orange-600 p-4">
              <span className="text-xs font-black uppercase tracking-wide text-white/90">Tier 3</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-orange-700">📣 Marketing &amp; PR</span>
              <span aria-hidden className="pointer-events-none absolute bottom-3 left-4 text-3xl">🌅</span>
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h3 className="text-xl font-black leading-tight text-ink">Retreat Marketing &amp; PR Support</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Get expert support to position, promote and grow your retreat. We help you reach the right audience and increase enquiries and bookings.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-ink-soft">
                {TIER3_POINTS.map((p) => <Check key={p} color="bg-orange-500">{p}</Check>)}
              </ul>
              <div className="mt-auto pt-6">
                <p className="text-2xl font-black text-ink">Custom Quote</p>
                <p className="text-sm text-muted">Pricing based on your requirements and scope.</p>
                <Link href="/list-your-venue/enquire?interest=marketing-pr" data-analytics="lyv_tier3_enquire" className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600">
                  Request a quote
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recently listed venues — real records, newest first */}
      {recentVenues.length > 0 && (
        <section className="container-x pb-4" aria-label="Recently listed venues" data-testid="lyv-recent-venues">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Recently listed venues</h2>
              <p className="mt-2 text-ink-soft">Spaces that recently joined the NOSTOPS venue directory.</p>
            </div>
            <Link href="/venues" className="hidden shrink-0 text-sm font-bold text-brand-700 hover:underline sm:inline">Explore all venues →</Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {recentVenues.map((v) => (
              <Link
                key={v.id}
                href={venuePath(v)}
                data-testid="lyv-recent-venue"
                className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:border-brand hover:shadow-md"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.coverImage!} alt={v.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  {v.coverFromGoogle && <span className="absolute bottom-2 right-2 rounded bg-ink/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">Photo: Google</span>}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-sm font-black leading-snug text-ink group-hover:text-brand-700">{v.name}</p>
                  {(v.city || v.state) && (
                    <p className="mt-0.5 text-xs font-semibold text-muted">{[v.city, v.state].filter(Boolean).join(', ')}</p>
                  )}
                  {v.summary && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-soft">{v.summary}</p>}
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4 sm:hidden">
            <Link href="/venues" className="text-sm font-bold text-brand-700 hover:underline">Explore all venues →</Link>
          </div>
        </section>
      )}

      {/* Trust bar */}
      <section className="border-t border-line bg-cream">
        <div className="container-x py-10">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((t) => (
              <div key={t.title} className="flex items-start gap-3">
                <span aria-hidden className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${t.tint}`}>{t.icon}</span>
                <div>
                  <p className="text-sm font-black text-ink">{t.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
