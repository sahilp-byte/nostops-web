import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { searchProvisional, getProvisionalProfile } from '@/lib/server/discovery';
import { getCityCoordinator, type CityCoordinator } from '@/lib/server/city-coordinator';
import ClaimHubSearch from '@/components/discovery/ClaimHubSearch';
import CoordinatorsNearYou from '@/components/discovery/CoordinatorsNearYou';
import NetworkVideo from '@/components/discovery/NetworkVideo';
import { canonical } from '@/lib/site';
import { COORDINATOR_ENABLED } from '@/lib/city-coordinator-cities';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';

// The single, SEARCH-VISIBLE "Claim your teaching profile" hub. Teachers reach
// this from search or a shared link, look up their name/city, find their
// provisional entry and start the claim. Individual scraped provisional pages
// stay noindex — only this hub and the claim funnel are indexed.
export const dynamic = 'force-dynamic';

const LAUNCH_CITIES = [
  'Delhi', 'Gurgaon', 'Bangalore', 'Mumbai', 'Navi Mumbai',
  'Pune', 'Nashik', 'Chandigarh', 'Hyderabad',
];

function slugify(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Map common Indian city-name variants (from a cookie or an edge/CDN geo header)
// to the exact launch-city label used in the dropdown + search filter.
const CITY_ALIASES: Record<string, string> = {
  bengaluru: 'Bangalore', bangalore: 'Bangalore',
  gurugram: 'Gurgaon', gurgaon: 'Gurgaon',
  bombay: 'Mumbai', mumbai: 'Mumbai', 'navi mumbai': 'Navi Mumbai',
  'new delhi': 'Delhi', delhi: 'Delhi',
  nasik: 'Nashik', nashik: 'Nashik',
  pune: 'Pune', chandigarh: 'Chandigarh', hyderabad: 'Hyderabad',
};

function toLaunchCity(raw?: string | null): string {
  if (!raw) return '';
  let key = raw.trim();
  try { key = decodeURIComponent(key); } catch { /* raw already decoded */ }
  key = key.toLowerCase();
  const mapped = CITY_ALIASES[key];
  if (mapped) return mapped;
  return LAUNCH_CITIES.find((c) => c.toLowerCase() === key) || '';
}

export const metadata: Metadata = {
  title: 'Claim your yoga teaching profile',
  description:
    'Are you a yoga teacher? Search your name and city to find and claim your free NOSTOPS teaching profile — no payment, no credit card.',
  alternates: { canonical: canonical('/claim') },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: canonical('/claim'),
    title: 'Claim your yoga teaching profile',
    description:
      'Search your name and city to find and claim your free NOSTOPS teaching profile — no payment, no credit card.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Claim your yoga teaching profile',
    description:
      'Search your name and city to find and claim your free NOSTOPS teaching profile — no payment, no credit card.',
  },
};

const BUILD_CHIPS = [
  'Teaching experience', 'Qualifications', 'Traditions', 'Specialisations', 'Locations',
  'Languages', 'Teaching styles', 'Group classes', 'Corporate yoga', 'Retreats',
  'Companies', 'Educational Institutions', 'Start-up Networking Groups',
];

export default async function ClaimHubPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; city?: string; claim?: string }>;
}) {
  const { q = '', city = '', claim = '' } = await searchParams;
  const term = q.trim();
  const cityLabel = LAUNCH_CITIES.find((c) => c === city) || '';

  // ── Smart Claim (direct): a shared "claim your profile" link can target a
  // specific provisional profile via ?claim=<city-slug>/<teacher-slug>. If it
  // resolves, send the teacher straight to their claim page.
  const claimTarget = claim.trim();
  if (claimTarget.includes('/')) {
    const [cSlug, tSlug] = claimTarget.split('/', 2).map((s) => s.trim());
    if (cSlug && tSlug && (await getProvisionalProfile(cSlug, tSlug))) {
      redirect(`/teachers/in/${cSlug}/${tSlug}`);
    }
  }

  // ── City Preselect: pre-fill the search's city dropdown from (1) the URL,
  // else (2) a remembered choice (cookie), else (3) an edge/CDN geo header. This
  // only sets the dropdown default — it never forces a city-scoped search on an
  // empty query, so the default hero stays unchanged until the teacher searches.
  let preselectCity = cityLabel;
  if (!preselectCity) {
    const jar = await cookies();
    preselectCity = toLaunchCity(jar.get('nostops_city')?.value);
  }
  if (!preselectCity) {
    const h = await headers();
    preselectCity = toLaunchCity(
      h.get('cf-ipcity') || h.get('x-vercel-ip-city') || h.get('x-geo-city') ||
      h.get('cloudfront-viewer-city') || h.get('x-appengine-city'),
    );
  }

  // Coordinators block: resolve the coordinator for the chosen city (falls open
  // to none → "Talk to the NOSTOPS team"). Only resolved when a city is picked.
  let coordinators: CityCoordinator[] = [];
  if (cityLabel) {
    const c = await getCityCoordinator(slugify(cityLabel));
    if (c) coordinators = [c];
  }

  const results = term.length >= 2 ? await searchProvisional(term, cityLabel || undefined) : [];

  // ── Smart Claim (search link): a shared /claim?q=<exact name>&city=<city>
  // that resolves to exactly one provisional profile whose name matches the
  // query opens it directly — so a teacher clicking their own link lands on
  // their claim page instantly. Ambiguous/partial searches still show the list.
  if (results.length === 1 && results[0].name.trim().toLowerCase() === term.toLowerCase()) {
    redirect(`/teachers/in/${results[0].city_slug}/${results[0].teacher_slug}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: 'Claim your profile', path: '/claim' }]} />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
        {/* MAIN COLUMN */}
        <div className="min-w-0 space-y-7">
          {/* INTRO */}
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-brand-700">For yoga teachers</p>
            <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-ink sm:text-4xl">
              Claim your teaching profile
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
              NOSTOPS is mapping the yoga community across India. If we’ve found your public
              listing, you can claim your profile — free — and build a professional NOSTOPS
              presence that seekers, studios, retreats and organisations can discover.
            </p>
          </div>

          {/* WE FOUND A PUBLIC LISTING */}
          <div className="flex items-start gap-3 rounded-2xl border border-brand/20 bg-brand-50/50 p-4 sm:p-5" data-testid="found-listing">
            <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
              <FoundIcon />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-ink">We found a public listing for you</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                This appears to be your profile based on publicly available information.
                It is currently a provisional (unclaimed) profile.
              </p>
            </div>
          </div>

          {/* WHY */}
          <section>
            <h2 className="text-lg font-black text-ink">Why is NOSTOPS creating these profiles?</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              Yoga teachers are at the heart of the living tradition of Yoga. NOSTOPS is building a
              Teacher’s First Yoga Cooperative to make it easier for people and organisations to
              discover genuine yoga teachers — while giving teachers a professional presence they
              can own and develop.
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              Your initial profile may have been created from publicly available information.
              Claiming it allows you to confirm that it belongs to you and take control of your
              NOSTOPS presence.
            </p>
          </section>

          {/* WHAT YOU CAN BUILD — chips */}
          <section>
            <h2 className="text-lg font-black text-ink">What you can build after claiming?</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              Complete your profile with the details that matter. Here’s what you can add:
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {BUILD_CHIPS.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink-soft">
                  <CheckBadge />
                  {c}
                </span>
              ))}
            </div>
          </section>

          {/* YOUR TEACHING ALREADY EXISTS */}
          <div className="flex gap-3 rounded-2xl border border-brand/20 bg-brand-50/40 p-5 sm:p-6" data-testid="teaching-exists">
            <span aria-hidden className="shrink-0 text-brand-600"><SunIcon /></span>
            <div className="min-w-0 border-l-2 border-brand/30 pl-4">
              <p className="text-base font-black leading-snug text-ink">
                Your teaching already exists. NOSTOPS helps people discover it.
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                Your profile can be discovered by yoga seekers, studios, retreat organisers and
                organisations including Companies, Educational Institutions and Start-up Networking
                Groups looking for teachers. We do not guarantee bookings, income or opportunities.
              </p>
            </div>
          </div>

          {/* CLAIM — FREE */}
          <div className="rounded-2xl border border-line bg-white p-5 sm:p-6" data-testid="claim-cta">
            <div className="flex items-start gap-3">
              <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                <ShieldIcon />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-black text-ink">Claim your profile — FREE</p>
                <p className="mt-0.5 text-[14px] leading-relaxed text-ink-soft">
                  No payment. No credit card. Just confirm it’s you and complete your profile.
                </p>
              </div>
            </div>
            <a href="#find" className="mt-4 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-white transition hover:bg-brand-600" data-testid="claim-cta-button">
              Claim my profile — FREE <span aria-hidden>→</span>
            </a>
          </div>

          {/* PUBLIC-LISTING SOURCE NOTE */}
          <div className="flex items-start gap-2" data-testid="claim-source-note">
            <span aria-hidden className="mt-0.5 shrink-0 text-muted"><InfoIcon /></span>
            <p className="text-[12px] leading-relaxed text-muted">
              This profile was found through a public listing (e.g. Google, website or other public
              sources). If you believe this is not your profile, please contact our team.
            </p>
          </div>
        </div>

        {/* SIDEBAR — video + help (unchanged) */}
        <div className="space-y-4 lg:sticky lg:top-6">
          <NetworkVideo maxWidthClass="max-w-[200px]" />
          {COORDINATOR_ENABLED && <CoordinatorsNearYou coordinators={coordinators} cityLabel={cityLabel || null} />}
        </div>
      </div>

      {/* FULL-WIDTH — FIND YOUR PROFILE */}
      <section id="find" className="mt-8 scroll-mt-24 rounded-2xl border border-line bg-cream/40 p-5 sm:p-6" data-testid="find-your-profile">
        <h2 className="text-lg font-black text-ink">Find your profile</h2>
        <p className="mt-1 text-sm text-ink-soft">Search your name or studio, select your city, and see if NOSTOPS has already created a profile for you.</p>
        <div className="mt-4">
          <ClaimHubSearch cities={LAUNCH_CITIES} initialQuery={term} initialCity={preselectCity} />
        </div>

        {/* RESULTS */}
        {term.length >= 2 && (
          <div className="mt-5" data-testid="claim-hub-results">
            {results.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-white p-6 text-center">
                <p className="text-sm font-bold text-ink">No match for “{term}”{cityLabel ? ` in ${cityLabel}` : ''}.</p>
                <p className="mt-1 text-[13px] text-ink-soft">
                  Try a shorter search or a different city. Can’t find yourself? Use the
                  “Talk to the NOSTOPS team” button and we’ll help.
                </p>
              </div>
            ) : (
              <>
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted">
                  {results.length} match{results.length === 1 ? '' : 'es'}
                </p>
                <ul className="space-y-2">
                  {results.map((r) => {
                    const place = [r.locality, r.city].filter(Boolean).join(', ');
                    const claimed = r.claim_state === 'CLAIMED';
                    return (
                      <li key={`${r.city_slug}/${r.teacher_slug}`}>
                        <Link
                          href={`/teachers/in/${r.city_slug}/${r.teacher_slug}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-3 transition hover:border-brand"
                          data-testid="claim-hub-result"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-black text-ink">{r.name}</span>
                            {place && <span className="block truncate text-[12px] text-muted">{place}</span>}
                          </span>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${claimed ? 'bg-cream text-muted' : 'bg-brand-50 text-brand-700'}`}>
                            {claimed ? 'Claimed' : 'Claim →'}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      <p className="mx-auto mt-8 max-w-2xl text-center text-[11px] leading-relaxed text-muted">
        Provisional listings are created by NOSTOPS from public location information (via Google)
        to help map the local yoga community. They are not affiliated with, sponsored by, or
        endorsed by Google, and do not indicate that a teacher has joined NOSTOPS.
      </p>
    </div>
  );
}

// ── Inline icons (dependency-free; match the teal line/badge style) ───────────
function CheckBadge() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden className="shrink-0 text-brand-600">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="M7 12.5l3.2 3.2L17 8.6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FoundIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="10" cy="8" r="3.3" />
      <path d="M3.8 20c0-3.5 2.8-5.8 6.2-5.8 1.2 0 2.3.3 3.2.8" />
      <path d="M14.5 18.4l1.9 1.9 3.3-3.8" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 2.4v5.3c0 4.3-3 7.8-7 9.3-4-1.5-7-5-7-9.3V5.4L12 3z" />
      <path d="M8.8 12l2.2 2.2 4.2-4.7" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.6h.01" />
    </svg>
  );
}
