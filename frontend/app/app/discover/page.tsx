import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getDiscover } from '@/lib/server/discover';
import { getNearbyVenues } from '@/lib/server/venues';
import { fmtKm } from '@/lib/geo';
import DiscoverFilters from '@/components/app/learner/DiscoverFilters';
import LocationButton from '@/components/app/learner/LocationButton';
import NearbyPanel from '@/components/app/learner/NearbyPanel';
import TeacherCard from '@/components/app/learner/TeacherCard';
import VenueCard from '@/components/venues/VenueCard';
import FavoriteButton from '@/components/app/learner/FavoriteButton';
import { SORT_KEYS, type SortKey } from '@/lib/teacher';
import { DIMENSION_BY_ID, isDimensionId, type DimensionId } from '@/lib/yoga-dimensions';
import { withGoogleCovers } from '@/lib/server/ai-assisted-venues';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Discover Teachers',
  robots: { index: false, follow: false },
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';
const numOr = (v: string, min: number, max: number): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const international = (await cookies()).get('nostops_region')?.value === 'intl';
  const sortRaw = one(sp.sort) as SortKey;
  const lat = numOr(one(sp.lat), -90, 90);
  const lng = numOr(one(sp.lng), -180, 180);
  // Selected matrices come via ?dims=mind,body (canonical) or legacy ?dimension=;
  // optional specific requirements via ?reqs=sleep,back.
  const dimsRaw = `${one(sp.dims) || ''},${one(sp.dimension) || ''}`;
  const dims = Array.from(
    new Set(dimsRaw.split(',').map((s) => s.trim()).filter((s): s is DimensionId => isDimensionId(s))),
  );
  const reqs = (one(sp.reqs) || '').split(',').map((s) => s.trim()).filter(Boolean);
  const online = one(sp.online) === '1';
  const active = {
    q: one(sp.q),
    city: one(sp.city),
    parampara: one(sp.parampara),
    style: one(sp.style),
    specialization: one(sp.specialization),
    online: one(sp.online),
    sort: (SORT_KEYS.includes(sortRaw) ? sortRaw : 'recommended') as SortKey,
    near: one(sp.near),
    lat,
    lng,
  };

  const { facets, teachers, total, sortedByDistance } = await getDiscover({ ...active, dims, reqs, online });
  const activeDims = dims.map((d) => DIMENSION_BY_ID[d]);
  const wantsAdaptive = dims.includes('special_needs');
  const nearbyVenues = sortedByDistance ? await withGoogleCovers(await getNearbyVenues(lat!, lng!, { limit: 6 })) : [];

  return (
    <div className="mx-auto max-w-6xl">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Discover teachers</h1>
        <p className="mt-2 text-ink-soft">
          Find empanelled, lineage-verified teachers
          {total > 0 ? ` — ${total} across the network` : ''}. Search, filter and book your practice.
        </p>
      </header>

      {activeDims.length > 0 && (
        <div
          className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line px-4 py-3"
          data-testid="dimension-active"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Your focus</span>
          {activeDims.map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
              style={{ background: `${d.color}14`, color: d.color }}
            >
              {d.emoji} {d.short}
            </span>
          ))}
          <Link href="/app/book-journey" className="ml-auto text-xs font-bold text-brand-700 underline hover:text-brand-600">Change focus</Link>
        </div>
      )}

      {wantsAdaptive && (
        <p className="mt-3 rounded-xl border border-line bg-cream/60 px-4 py-3 text-xs leading-relaxed text-ink-soft" data-testid="adaptive-explainer">
          <strong className="text-ink">Special Needs:</strong> teachers marked &ldquo;✓ Adaptive practice verified&rdquo; have had their adaptive-practice competence reviewed by NOSTOPS. Others have declared this pathway but are not yet verified. Suitability depends on your situation; a yoga teacher does not replace your healthcare professional.
        </p>
      )}

      {sp.book ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand/25 bg-brand-50/50 px-4 py-2.5" data-testid="book-intent">
          <span className="text-sm font-bold text-brand-700">🧘 Book a 1:1 session</span>
          <span className="text-sm text-ink-soft">Pick a teacher below to see their availability and pricing.</span>
        </div>
      ) : null}

      <LocationButton />

      {/* Distance mode: active when the learner shared their location. */}
      {sortedByDistance && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand/25 bg-brand-50/50 px-4 py-2.5" data-testid="distance-active">
          <span className="text-sm font-bold text-brand-700">📍 Nearest first</span>
          {active.near && <span className="text-sm text-ink-soft">around <strong className="text-ink">{active.near}</strong></span>}
          <Link href="/app/discover" className="ml-auto text-xs font-bold text-brand-700 underline hover:text-brand-600">Clear</Link>
        </div>
      )}

      {/* Venues near you — only in distance mode. */}
      {sortedByDistance && (
        <section className="mt-4" aria-label="Venues near you" data-testid="nearby-venues">
          <h2 className="text-sm font-black uppercase tracking-wider text-brand-700">🏡 Venues near you</h2>
          {nearbyVenues.length > 0 ? (
            <ul className="mt-3 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {nearbyVenues.map((v) => (
                <li key={v.id} className="relative">
                  <span className="absolute left-3 top-3 z-10 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm" data-testid="venue-distance">{fmtKm(v.distanceKm)}</span>
                  <VenueCard v={v} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted" data-testid="nearby-venues-empty">No NOSTOPS venues have shared a location near you yet — <Link href="/venues" className="text-brand-700 underline">browse all venues</Link>.</p>
          )}
        </section>
      )}

      <NearbyPanel />

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Filters */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="card p-4">
            <DiscoverFilters facets={facets} active={active} resultCount={teachers.length} />
          </div>
        </aside>

        {/* Results */}
        <section aria-label="Teacher results">
          {teachers.length === 0 ? (
            <div className="card p-8 text-center" data-testid="discover-empty">
              {activeDims.length > 0 ? (
                <>
                  <p className="text-lg font-semibold text-ink">
                    At the moment, we couldn&apos;t find a teacher matching all of your selected requirements.
                  </p>
                  <p className="mt-2 text-muted">Broaden your search to see teachers across all focuses.</p>
                  <Link
                    href="/app/discover?book=1"
                    data-testid="broaden-search"
                    className="mt-4 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600"
                  >
                    Broaden your search
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-ink">No teachers match your filters</p>
                  <p className="mt-2 text-muted">Try removing a filter or searching a different city or style.</p>
                  <Link
                    href="/app/discover"
                    className="mt-4 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600"
                  >
                    Reset filters
                  </Link>
                </>
              )}
            </div>
          ) : (
            <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {teachers.map((t) => (
                <li key={t.handle} className="relative">
                  {typeof t.distanceKm === 'number' && (
                    <span className="absolute left-3 top-3 z-10 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm" data-testid="teacher-distance">{fmtKm(t.distanceKm)}</span>
                  )}
                  <TeacherCard t={t} href={`/app/teachers/${t.handle}`} international={international} showAdaptiveStatus={wantsAdaptive} />
                  <FavoriteButton
                    className="absolute right-3 top-3 z-10"
                    teacher={{
                      handle: t.handle,
                      name: t.name,
                      city: t.city,
                      parampara: t.parampara,
                      rating: t.rating,
                      avatarUrl: t.avatarUrl,
                      avatarB64: t.avatarB64,
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
