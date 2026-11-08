import Link from 'next/link';
import type { ClaimedListing } from '@/lib/server/discovery';

// City page: teachers who have CLAIMED their NOSTOPS listing and are finishing their full profile.
// Factual listing details only (name + area). Renders nothing when the city has none.
export default function CityClaimedListings({ listings, cityLabel }: { listings: ClaimedListing[]; cityLabel: string }) {
  if (!listings.length) return null;
  return (
    <section className="container-x pb-12 md:pb-14" data-testid="city-claimed-listings">
      <div className="mb-6">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-700">Profiles in progress</span>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-ink md:text-3xl">More yoga teachers in {cityLabel}</h2>
        <p className="mt-2 max-w-3xl text-ink-soft">
          These teachers have claimed their NOSTOPS listing. Until their full teacher profile is linked here, we show only the
          listing&apos;s name and area.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((c) => {
          const initials = c.name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'N';
          return (
            <li key={`${c.city_slug}/${c.teacher_slug}`}>
              <Link
                href={`/teachers/in/${c.city_slug}/${c.teacher_slug}`}
                className="card flex min-h-[72px] items-center gap-3 p-4 transition hover:border-brand hover:shadow-sm"
                data-testid="city-claimed-card"
              >
                <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-100 text-sm font-black text-amber-800">
                  {initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-black text-ink">{c.name}</span>
                  {c.locality && <span className="block truncate text-sm text-muted">{c.locality}</span>}
                  <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                    {c.profile_done ? 'Claimed listing' : 'Claimed · profile in progress'}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
