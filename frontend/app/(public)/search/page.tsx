import type { Metadata } from 'next';
import Link from 'next/link';
import { apiGetSafe } from '@/lib/api';
import { canonical } from '@/lib/site';
import { citySlug } from '@/lib/server/detect-city';
import { isTeacherActivePublic } from '@/lib/public-teacher';
import { getPublicRetreats, type PublicRetreat } from '@/lib/server/retreats';
import { retreatPath } from '@/lib/retreat-url';
import { searchProvisional } from '@/lib/server/discovery';
import PageHero from '@/components/PageHero';

export const dynamic = 'force-dynamic';

const URL = canonical('/search');

// Query-result pages are intentionally noindex (we never want infinite query
// permutations in the index) but remain fully crawlable/followable — and the
// endpoint powers the homepage WebSite SearchAction.
export const metadata: Metadata = {
  title: 'Search NOSTOPS',
  description: 'Search teachers, cities, retreats and Council Gurus across NOSTOPS.',
  alternates: { canonical: URL },
  robots: { index: false, follow: true },
};

type Hit = { id: string; label: string; sub?: string; badge?: string | null; route?: string; thumb?: string | null };
type SearchResponse = { q?: string; results?: Record<string, Hit[]>; total?: number };

// The universal search feed returns app-oriented routes; map each group to its
// public website URL. Groups with no public web page (wellness/orgs/bookings)
// are intentionally omitted so we never link to a page that 404s on the web.
const GROUPS: { key: string; label: string }[] = [
  { key: 'teachers', label: 'Teachers' },
  { key: 'cities', label: 'Cities' },
  { key: 'retreats', label: 'Retreats' },
  { key: 'council_gurus', label: 'Council of Gurus' },
];

function webHref(group: string, h: Hit, teacherHandles: Set<string>, retreats: Map<string, PublicRetreat>): string | null {
  const r = h.route || '';
  switch (group) {
    case 'teachers': {
      const m = /^\/t\/(.+)$/.exec(r);
      // Only link teachers who have a published public web profile (same
      // eligibility the sitemap uses) — imported/unpublished handles 404.
      return m && teacherHandles.has(m[1]) ? `/teachers/${m[1]}` : null;
    }
    case 'council_gurus':
      return r.startsWith('/council/') ? r : null;
    case 'retreats': {
      // Only genuinely public retreats (QA/test/duplicate records are hidden).
      const pr = retreats.get(r.replace(/^\/retreats\//, ''));
      return pr ? retreatPath(pr) : null;
    }
    case 'cities': {
      const slug = citySlug((h.label || '').split(',')[0] || '');
      return slug ? `/yoga-teachers/${slug}` : null;
    }
    default:
      return null;
  }
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q || '').trim();

  let results: Record<string, Hit[]> = {};
  let claimed: { h: Hit; href: string }[] = [];
  if (q) {
    const [data, provisional] = await Promise.all([
      apiGetSafe<SearchResponse>(`/search?q=${encodeURIComponent(q)}&limit=12`, { results: {} }, { noStore: true }),
      searchProvisional(q),
    ]);
    results = data.results || {};
    // Claimed provisional listings (owner rule: claimed = public + indexable) join the Teachers group.
    claimed = provisional
      .filter((p) => p.claim_state === 'CLAIMED' && p.city_slug && p.teacher_slug)
      .map((p) => ({
        h: {
          id: `claimed-${p.city_slug}-${p.teacher_slug}`,
          label: p.name,
          sub: [[p.locality, p.city].filter(Boolean).join(', '), 'Claimed listing · profile in progress'].filter(Boolean).join(' · '),
        },
        href: `/teachers/in/${p.city_slug}/${p.teacher_slug}`,
      }));
  }

  // Publicly-eligible teacher handles — so teacher search links never 404.
  const teacherHandles = new Set<string>();
  if ((results.teachers || []).length > 0) {
    const dir = await apiGetSafe<{ teachers?: any[] }>('/teachers/directory', { teachers: [] }, { revalidate: 3600 });
    for (const t of dir.teachers || []) {
      if (isTeacherActivePublic(t)) teacherHandles.add(String(t.handle));
    }
  }

  // Public retreat projection — hides QA records and retired (demo) host names.
  const retreats = new Map<string, PublicRetreat>();
  if ((results.retreats || []).length > 0) {
    for (const pr of (await getPublicRetreats()).retreats) retreats.set(pr.id, pr);
  }

  const groups = GROUPS.map((grp) => {
    const hits = (results[grp.key] || [])
      .map((h) => {
        const pr = grp.key === 'retreats' ? retreats.get((h.route || '').replace(/^\/retreats\//, '')) : undefined;
        const sub: string | undefined = pr
          ? [pr.guruName, pr.city, pr.state].filter(Boolean).join(' · ') + (pr.startDate ? ` · from ${pr.startDate}` : '')
          : h.sub;
        const hit: Hit = { ...h, sub };
        return { h: hit, href: webHref(grp.key, h, teacherHandles, retreats) };
      })
      .filter((x): x is { h: Hit; href: string } => !!x.href);
    return { ...grp, hits: grp.key === 'teachers' ? [...hits, ...claimed] : hits };
  }).filter((grp) => grp.hits.length > 0);

  const totalShown = groups.reduce((n, grp) => n + grp.hits.length, 0);

  return (
    <main className="pb-20">
      <PageHero
        eyebrow="Search"
        title="Search NOSTOPS"
        subtitle="Find teachers, cities, teacher-led retreats and Council Gurus."
      >
        <form action="/search" method="get" role="search" className="mt-8 flex max-w-xl gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search teachers, cities, retreats…"
            aria-label="Search NOSTOPS"
            autoComplete="off"
            className="min-h-[48px] flex-1 rounded-xl border border-white/30 bg-white/95 px-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-white"
          />
          <button
            type="submit"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-brand-700 transition hover:bg-cream"
          >
            Search
          </button>
        </form>
      </PageHero>

      <div className="container-x py-12">
        {!q ? (
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-ink-soft">Type a name, city, tradition or retreat above to search NOSTOPS.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm font-semibold">
              <Link href="/teachers" className="rounded-full border border-line bg-white px-4 py-2 text-ink hover:border-brand hover:text-brand-700">Teacher Directory</Link>
              <Link href="/yoga-teachers" className="rounded-full border border-line bg-white px-4 py-2 text-ink hover:border-brand hover:text-brand-700">Teachers by city</Link>
              <Link href="/retreats" className="rounded-full border border-line bg-white px-4 py-2 text-ink hover:border-brand hover:text-brand-700">Retreats</Link>
              <Link href="/guides" className="rounded-full border border-line bg-white px-4 py-2 text-ink hover:border-brand hover:text-brand-700">Guides</Link>
            </div>
          </div>
        ) : totalShown === 0 ? (
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-xl font-black tracking-tight text-ink">No results for “{q}”</h2>
            <p className="mt-2 text-ink-soft">Try a different spelling, a city, a tradition, or browse the directory.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm font-semibold">
              <Link href="/teachers" className="rounded-full border border-line bg-white px-4 py-2 text-ink hover:border-brand hover:text-brand-700">Teacher Directory</Link>
              <Link href="/yoga-teachers" className="rounded-full border border-line bg-white px-4 py-2 text-ink hover:border-brand hover:text-brand-700">Teachers by city</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            <p className="text-sm text-muted">{totalShown} result{totalShown === 1 ? '' : 's'} for “{q}”</p>
            {groups.map((grp) => (
              <section key={grp.key}>
                <h2 className="text-xs font-black uppercase tracking-wider text-brand-700">{grp.label}</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {grp.hits.map(({ h, href }) => (
                    <li key={`${grp.key}-${h.id}`}>
                      <Link
                        href={href}
                        className="flex items-start justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 transition hover:border-brand hover:shadow-sm"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-ink">{h.label}</span>
                          {h.sub ? <span className="mt-0.5 block truncate text-sm text-muted">{h.sub}</span> : null}
                        </span>
                        <span aria-hidden className="mt-1 shrink-0 text-brand-700">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
