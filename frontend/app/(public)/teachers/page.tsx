import type { Metadata } from 'next';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { normalizeJsonLd } from '@/lib/seo';
import { canonical } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { titleCase } from '@/lib/format';
import { isTeacherActivePublic, publicTrust } from '@/lib/public-teacher';
import { citySlug } from '@/lib/server/cities';
import { TeacherDirectoryGrid, type PublicTeacher } from '@/components/teachers/TeacherDirectoryGrid';
import { TeacherSpotlight } from '@/components/teachers/TeacherSpotlight';
import { getPublicStats } from '@/lib/server/public-stats';

// Public SEO content -> ISR. Short revalidate so the network reflects new,
// updated and unpublished profiles automatically (no manual page edits).
export const revalidate = 60;

const TEACHERS_PATH = '/teachers';
const CANONICAL_URL = canonical(TEACHERS_PATH); // https://www.nostops.org/teachers
const HOME_URL = canonical('/');

// Existing teacher registration / onboarding entry — do NOT create a new one.
const JOIN_HREF = '/join';
const LOGIN_HREF = '/login';

// "Why join" — framed as network belonging, not marketplace features.
const WHY_JOIN: Array<{ icon: string; title: string; body: string }> = [
  { icon: '🔍', title: 'Become discoverable', body: 'Seekers looking for your tradition, style or city can find you — you are present where a practice begins.' },
  { icon: '🧘', title: 'Build a public professional profile', body: 'A dignified page carrying your lineage, experience, styles and voice — a real home for your teaching online.' },
  { icon: '🤝', title: 'Reach Yoga Seekers', body: 'Meet practitioners genuinely seeking guidance, matched to what they need rather than the loudest listing.' },
  { icon: '🎯', title: 'Participate in one-to-one sessions', body: 'Offer 1:1 sessions with secure payments and clear pricing you set — your terms, your practice.' },
  { icon: '🌱', title: 'Discover opportunities', body: 'Retreats, corporate programmes and collaborations surface as the network grows around you.' },
  { icon: '👥', title: 'Connect with fellow teachers', body: 'Stand alongside other empanelled teachers — a community, not competitors in a feed.' },
  { icon: '💬', title: 'Participate in teacher discussions', body: 'Join conversations with peers who understand the craft — share, ask and learn together.' },
  { icon: '📈', title: 'Understand trends in the Yoga ecosystem', body: 'See what seekers are asking for and where the practice is moving, so you can grow with intent.' },
  { icon: '✨', title: 'Build visibility without losing individual identity', body: 'Gain reach and trust while your name, path and way of teaching remain unmistakably your own.' },
];

// ---- Public-safe teacher shape (private/admin fields are intentionally dropped) ----
// The `PublicTeacher` type is defined in the client grid component and shared
// here so the projection below and the rendered cards can never diverge.

function isPublic(t: any): boolean {
  // Public-listing policy (Hybrid): list every teacher with a PUBLISHED public
  // profile — active, visible and not suspended. Empanelment is surfaced as a
  // badge, not a gate, so the network reflects every real teacher while
  // Council-empanelled teachers stay clearly distinguished. Identical to the
  // profile-page gate, so a card never links to a page that 404s.
  return isTeacherActivePublic(t);
}

function toPublicTeacher(t: any): PublicTeacher | null {
  const handle = String(t?.handle || '').trim();
  if (!handle) return null;
  return {
    handle,
    name: t.name || 'NOSTOPS Teacher',
    city: t.city || undefined,
    country: t.country || undefined,
    parampara: t.parampara || undefined,
    experienceYears: typeof t.experience_years === 'number' && t.experience_years > 0 ? t.experience_years : undefined,
    styles: Array.isArray(t.styles) ? t.styles.filter(Boolean) : [],
    // Areas of expertise (public). Prefer the richer display names when present;
    // both come straight from the public profile record — never invented.
    specializations: (Array.isArray(t.specializations_full) && t.specializations_full.length
      ? t.specializations_full.map((s: any) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
      : Array.isArray(t.specializations)
        ? t.specializations.filter(Boolean)
        : []) as string[],
    badges: Array.isArray(t.badges) ? t.badges.filter(Boolean) : [],
    badgePrimary: t.badge_primary || undefined,
    tier: t.tier || undefined,
    isEmpanelled: !!t.is_empanelled,
    // B4.7 — one public trust rule: "Verified" = ID check passed AND empanelled.
    isVerified: publicTrust(t).verified,
    idChecked: publicTrust(t).idChecked,
    isFeatured: !!t.is_featured,
    rating: typeof t.rating === 'number' && t.rating > 0 ? t.rating : undefined,
    reviewsCount: typeof t.reviews_count === 'number' && t.reviews_count > 0 ? t.reviews_count : undefined,
    avatarUrl: typeof t.avatar_url === 'string' && t.avatar_url ? t.avatar_url : null,
    avatarB64: typeof t.avatar_base64 === 'string' && t.avatar_base64 ? t.avatar_base64 : null,
    languages: Array.isArray(t.languages_spoken) ? t.languages_spoken.filter(Boolean) : [],
  };
}

async function getTeachers(): Promise<{ teachers: PublicTeacher[]; error: boolean }> {
  try {
    // Fetch the FULL network (high limit) so pagination can never cap the list.
    const data = await apiGet<{ teachers?: any[] }>('/teachers/directory?limit=1000', { revalidate: 60 });
    const raw = Array.isArray(data?.teachers) ? data.teachers : [];
    const teachers = raw
      .filter(isPublic)
      .map(toPublicTeacher)
      .filter((t): t is PublicTeacher => t !== null);
    // Surface Council-empanelled, then verified, then featured/higher-rated
    // teachers first (no data invented); listed members follow.
    teachers.sort((a, b) => {
      const score = (x: PublicTeacher) => (x.isFeatured ? 4 : 0) + (x.isEmpanelled ? 2 : 0) + (x.isVerified ? 1 : 0);
      const s = score(b) - score(a);
      if (s) return s;
      const r = (b.rating ?? 0) - (a.rating ?? 0);
      if (r) return r;
      return a.name.localeCompare(b.name);
    });
    return { teachers, error: false };
  } catch {
    return { teachers: [], error: true };
  }
}

function describe(): string {
  // Suggested marketing description — used for meta description, OG and JSON-LD.
  return 'Discover Yoga Teachers joining the NOSTOPS Empanelled Yoga Teachers Network and become part of a growing community of teachers carrying Yoga forward.';
}

export async function generateMetadata(): Promise<Metadata> {
  const description = describe();
  const ogTitle = 'NOSTOPS Empanelled Yoga Teachers Network';
  return {
    // Absolute title so the layout's "%s · NOSTOPS" template isn't appended
    // (the suggested title already carries the brand).
    title: { absolute: 'Empanelled Yoga Teachers Network · NOSTOPS' },
    description,
    alternates: { canonical: CANONICAL_URL },
    openGraph: {
      type: 'website',
      siteName: 'NOSTOPS',
      url: CANONICAL_URL,
      title: ogTitle,
      description,
      images: [{ url: '/brand/og-card.png', width: 1200, height: 630, alt: 'NOSTOPS' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: ['/brand/og-card.png'],
    },
  };
}

export default async function TeachersPage() {
  const [{ teachers, error }, ps] = await Promise.all([getTeachers(), getPublicStats()]);

  const paramparas = Array.from(new Set(teachers.map((t) => t.parampara).filter(Boolean))) as string[];
  // Headline figures come from the single approved source (lib/server/public-stats,
  // NST-008) so /teachers, /yoga-teachers and the impact page always agree.
  const networkCount = ps.registeredTeachers > 0 ? ps.registeredTeachers : teachers.length;
  const publicCount = ps.publicProfiles;
  const empanelledCount = ps.empanelledTeachers;

  // Cross-links to the wider NOSTOPS ecosystem — real cities where the listed
  // teachers practise (same data as the list; generic buckets excluded).
  const NON_CITY = new Set(['india', 'online', '', 'remote']);
  const cityMap = new Map<string, { label: string; count: number }>();
  for (const t of teachers) {
    const c = (t.city || '').trim();
    if (!c || NON_CITY.has(c.toLowerCase())) continue;
    const slug = citySlug(c);
    const cur = cityMap.get(slug);
    if (cur) cur.count += 1;
    else cityMap.set(slug, { label: c, count: 1 });
  }
  const cityChips = Array.from(cityMap.entries())
    .map(([slug, v]) => ({ slug, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  // Attach a city-page slug so each teacher card can link its city to /yoga-teachers/{slug}.
  const teachersWithCity: PublicTeacher[] = teachers.map((t) => {
    const c = (t.city || '').trim();
    const slug = c && !NON_CITY.has(c.toLowerCase()) ? citySlug(c) : undefined;
    return slug ? { ...t, citySlug: slug } : t;
  });

  // ---- JSON-LD: CollectionPage -> ItemList -> Person, plus BreadcrumbList ----
  const collectionPage = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${CANONICAL_URL}#directory`,
    url: CANONICAL_URL,
    name: 'NOSTOPS Empanelled Yoga Teachers Network',
    description: describe(),
    isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: HOME_URL },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: teachers.length,
      itemListElement: teachers.map((t, i) => {
        const url = canonical(`/teachers/${t.handle}`);
        const person: Record<string, any> = {
          '@type': 'Person',
          '@id': url,
          name: t.name,
          url,
          jobTitle: 'Yoga Teacher',
        };
        if (t.city) {
          person.address = {
            '@type': 'PostalAddress',
            addressLocality: t.city,
            ...(t.country ? { addressCountry: t.country } : {}),
          };
        }
        if (t.parampara) person.knowsAbout = titleCase(t.parampara);
        return { '@type': 'ListItem', position: i + 1, item: person };
      }),
    },
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: HOME_URL },
      { '@type': 'ListItem', position: 2, name: 'Teachers', item: CANONICAL_URL },
    ],
  };

  const jsonld = normalizeJsonLd([collectionPage, breadcrumb]);

  return (
    <div>
      <JsonLd data={jsonld} />

      {/* Hero — positioning + an invitation to teachers */}
      <section className="relative overflow-hidden bg-gradient-to-br from-ink via-royal to-brand">
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="container-x relative py-16 md:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/90 backdrop-blur">
            Empanelled Yoga Teachers Network
          </span>
          <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.08] tracking-tight text-white md:text-6xl">
            Building India&apos;s largest Empanelled Yoga Teachers Network
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/85">
            This is more than a directory. NOSTOPS is a living network of India&apos;s yoga teachers —
            where your practice is seen, your presence is professional, and Yoga Seekers discover you
            for who you truly are. Teach, be found, meet fellow teachers, and help shape a growing ecosystem.
          </p>
          <ul className="mt-7 flex max-w-3xl list-none flex-wrap gap-2 p-0">
            {['Teacher visibility', 'Discovery by Yoga Seekers', 'A professional presence', 'Fellow teachers', 'New opportunities', 'A growing network'].map((h) => (
              <li key={h} className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white/90 ring-1 ring-white/15">{h}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={JOIN_HREF}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-black text-ink shadow-lg transition hover:bg-cream"
            >
              Become an empanelled teacher →
            </Link>
            <a
              href="#teachers"
              className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Meet the teachers
            </a>
          </div>
          <p className="mt-4 text-sm text-white/80">
            Already teaching and listed online?{' '}
            <Link href="/claim" className="font-bold text-white underline underline-offset-2 hover:text-cream">
              Claim your profile →
            </Link>
          </p>
          {networkCount > 0 && (
            <p className="mt-6 text-sm font-semibold text-white/70">
              {networkCount} {networkCount === 1 ? 'teacher' : 'teachers'} in the network
              {publicCount > 0 && networkCount > publicCount ? ` · ${publicCount} with public profiles` : ''}
              {empanelledCount > 0 ? ` · ${empanelledCount} Council-empanelled` : ''}
              {ps.cities > 0 ? ` · ${ps.cities} ${ps.cities === 1 ? 'city' : 'cities'}` : ''}
              {paramparas.length > 0 ? ` · ${paramparas.length} ${paramparas.length === 1 ? 'parampara' : 'paramparas'}` : ''}
            </p>
          )}
        </div>
      </section>

      {/* How discovery works — suitability & relevance, not price ranking */}
      <section className="bg-cream">
        <div className="container-x py-14 md:py-16">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700">How Yoga Seekers find a teacher</span>
          <h2 className="mt-3 max-w-3xl text-2xl font-black tracking-tight text-ink md:text-3xl">
            Matched by relevance, not ranked by price
          </h2>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-soft">
            NOSTOPS helps seekers find a teacher who genuinely fits — by teaching experience, areas of
            expertise, teaching approach and their own yoga requirements. Teachers are surfaced on
            suitability and relevance, never ordered by who charges the most or the least. The aim is
            the right guidance, offered with the respect the teaching profession deserves.
          </p>
          <div className="mt-7 grid gap-4 sm:grid-cols-4">
            {[
              { t: 'Experience', d: 'Years of teaching and the depth behind them.' },
              { t: 'Expertise', d: 'The needs and focus areas a teacher works with.' },
              { t: 'Approach', d: 'Tradition, style and how they teach.' },
              { t: 'Your requirements', d: 'What you are seeking, matched thoughtfully.' },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border border-line bg-white p-5">
                <h3 className="text-sm font-bold text-ink">{c.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Directory — the dynamic, self-updating teacher network */}
      <section id="teachers" className="container-x py-14">
        <h2 className="text-2xl font-black tracking-tight text-ink md:text-3xl">Meet the NOSTOPS Empanelled Yoga Teachers</h2>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-ink-soft">
          The teachers below are part of our growing network. This is a living directory — it updates on
          its own as new public teacher profiles are published, so the community you see here keeps
          growing over time. Teachers reviewed and empanelled by the NOSTOPS Council of Gurus carry the{' '}
          <span className="font-bold text-accent-600">★ Empanelled</span> badge; others are members
          building toward empanelment.
        </p>
        <p className="mt-3 text-sm font-semibold italic text-brand-700">
          The network grows with every teacher who joins.
        </p>

        {!error && teachers.length > 0 && (
          <div className="mt-8">
            <TeacherSpotlight teachers={teachersWithCity} />
          </div>
        )}

        {error ? (
          <div className="mt-8 card p-8 text-center">
            <p className="text-lg font-semibold text-ink">The teacher directory is temporarily unavailable.</p>
            <p className="mt-2 text-muted">Please try again shortly.</p>
          </div>
        ) : teachers.length === 0 ? (
          /* Empty state — an invitation to be the first, never a dead end. */
          <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-ink via-royal to-brand p-8 text-center md:p-12">
            <span aria-hidden="true" className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-3xl ring-1 ring-white/20">🧘</span>
            <h3 className="mx-auto mt-6 max-w-2xl text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">
              Be the first teacher in the network
            </h3>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/85">
              No public teacher profiles are live just yet. This directory grows with every teacher who
              joins — register today and help shape India&apos;s Empanelled Yoga Teachers Network from
              the very beginning.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={JOIN_HREF}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 text-sm font-black uppercase tracking-wide text-ink shadow-lg transition hover:bg-cream"
              >
                Become an empanelled yoga teacher →
              </Link>
              <Link
                href={LOGIN_HREF}
                className="text-sm font-bold text-white/80 underline-offset-4 transition hover:text-white hover:underline"
              >
                Already teaching with us? Sign in
              </Link>
            </div>
          </div>
        ) : (
          <TeacherDirectoryGrid teachers={teachersWithCity} />
        )}
      </section>

      {/* Explore the NOSTOPS ecosystem — cross-links to Retreats, Venues & City pages */}
      {!error && (
        <section className="container-x py-14 md:py-16">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700">One network, many ways in</span>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-ink md:text-3xl">Explore the NOSTOPS ecosystem</h2>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-ink-soft">
            Teachers are part of a wider living network. Discover immersive retreats, the venues that host
            practice, and the city communities where NOSTOPS teachers gather.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Link
              href="/retreats"
              className="group flex items-start gap-4 rounded-2xl border border-line bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg"
            >
              <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-2xl">🏔️</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-lg font-black tracking-tight text-ink group-hover:text-brand-700">
                  Yoga Retreats
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" /></svg>
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                  Immersive residential retreats led by NOSTOPS teachers — deepen your practice over days, not minutes.
                </span>
              </span>
            </Link>
            <Link
              href="/venues"
              className="group flex items-start gap-4 rounded-2xl border border-line bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg"
            >
              <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-2xl">🏛️</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-lg font-black tracking-tight text-ink group-hover:text-brand-700">
                  Venues
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" /></svg>
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                  Studios, shalas and spaces that host NOSTOPS teachers and sessions near you.
                </span>
              </span>
            </Link>
          </div>

          {cityChips.length > 0 && (
            <div className="mt-10">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Find teachers in your city</h3>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {cityChips.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/yoga-teachers/${c.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink transition hover:border-brand hover:bg-brand-50/50 hover:text-brand-700"
                  >
                    {titleCase(c.label)}
                    <span className="rounded-full bg-brand-50 px-1.5 text-xs font-bold text-brand-700">{c.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Teacher-first philosophy */}
      <section className="bg-cream">
        <div className="container-x py-16 md:py-20">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700">Our teacher-first philosophy</span>
          <p className="mt-4 max-w-4xl text-2xl font-black leading-snug tracking-tight text-ink md:text-3xl">
            A yoga teacher is not merely a service provider. A yoga teacher is a custodian of a living tradition.
          </p>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink-soft">
            NOSTOPS exists to build the infrastructure <em>around</em> teachers — the visibility, the
            professional presence, the tools and the payments — while your identity, experience,
            knowledge and contribution remain entirely your own. The technology serves the teaching;
            the teacher always leads.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { t: 'We build the infrastructure', d: 'Discovery, profiles, bookings and payments — handled, so you can focus on teaching.' },
              { t: 'You keep your identity', d: 'Your name, your lineage, your voice and your way of teaching stay yours. We add reach, not a mould.' },
              { t: 'Experience leads', d: 'Standing in the network is earned through verification and empanelment — it is never bought.' },
            ].map((c) => (
              <div key={c.t} className="card p-6">
                <h3 className="text-base font-bold text-ink">{c.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why join NOSTOPS */}
      <section className="container-x py-16 md:py-20">
        <h2 className="text-3xl font-black tracking-tight text-ink">Why join NOSTOPS?</h2>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          Not marketplace features — the shared benefits of belonging to a growing teachers&apos; network.
        </p>
        <ul className="mt-8 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {WHY_JOIN.map((b) => (
            <li key={b.title} className="card h-full p-6">
              <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-xl">{b.icon}</span>
              <h3 className="mt-4 text-base font-bold text-ink">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{b.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand via-royal to-ink">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="container-x relative py-16 text-center md:py-24">
          <h2 className="mx-auto max-w-3xl text-3xl font-black leading-tight tracking-tight text-white md:text-4xl">
            Join us in building India&apos;s largest Empanelled Yoga Teachers Network
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/85">
            Your experience matters. Your voice matters. Your tradition matters. The way you carry
            yoga forward matters.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={JOIN_HREF}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 text-sm font-black uppercase tracking-wide text-ink shadow-lg transition hover:bg-cream"
            >
              Become an empanelled yoga teacher →
            </Link>
            <Link
              href={LOGIN_HREF}
              className="text-sm font-bold text-white/80 underline-offset-4 transition hover:text-white hover:underline"
            >
              Already teaching with us? Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
