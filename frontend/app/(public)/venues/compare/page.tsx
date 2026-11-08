import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getVenues, fmtOpenMonths, type PublicVenue } from '@/lib/server/venues';
import { venuePath, parseVenueIds } from '@/lib/venue-url';
import { titleCase } from '@/lib/format';
import SaveVenueButton from '@/components/venues/SaveVenueButton';
import VenuePhotoPlaceholder from '@/components/venues/VenuePhotoPlaceholder';
import { withGoogleCovers } from '@/lib/server/ai-assisted-venues';

// Side-by-side comparison of 2–4 venues (?ids=a,b,c). Visitor-specific → noindex.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Compare Venues',
  description: 'Compare shortlisted NOSTOPS yoga venues side by side.',
  robots: { index: false, follow: true },
};

const MAX = 4;
const dash = <span className="text-muted">—</span>;

function bullets(items: string[]): ReactNode {
  if (!items.length) return dash;
  return (
    <ul className="m-0 list-none space-y-1 p-0">
      {items.map((a) => <li key={a}>• {a}</li>)}
    </ul>
  );
}

const ROWS: { label: string; value: (v: PublicVenue) => ReactNode }[] = [
  { label: 'Location', value: (v) => [v.city, v.state].filter(Boolean).join(', ') || dash },
  { label: 'Capacity', value: (v) => (typeof v.capacity === 'number' ? `Up to ${v.capacity} guests` : dash) },
  { label: 'Best for', value: (v) => bullets(v.bestForFramings.map(titleCase)) },
  { label: 'Best season', value: (v) => fmtOpenMonths(v.openMonths) || dash },
  { label: 'Climate', value: (v) => v.weatherBand || dash },
  { label: 'Sattvic kitchen', value: (v) => (v.sattvicCertified ? <span className="font-bold text-brand-700">✓ Certified</span> : dash) },
  { label: 'Amenities', value: (v) => bullets(v.amenities ?? []) },
  { label: 'Nearest airport', value: (v) => v.gettingThere?.nearestAirport || dash },
  { label: 'Nearest railway', value: (v) => v.gettingThere?.nearestRailway || dash },
];

export default async function CompareVenuesPage({ searchParams }: { searchParams: Promise<{ ids?: string | string[] }> }) {
  const wanted = parseVenueIds((await searchParams).ids, MAX);
  const all = wanted.length ? await getVenues() : [];
  const byId = new Map(all.map((v) => [v.id, v]));
  const venues = await withGoogleCovers(wanted.map((id) => byId.get(id)).filter(Boolean) as PublicVenue[]);
  const without = (id: string) => `/venues/compare?ids=${venues.filter((v) => v.id !== id).map((v) => v.id).join(',')}`;

  return (
    <>
      <nav aria-label="Breadcrumb" className="container-x pt-6">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <li><Link href="/" className="hover:text-brand-700">Home</Link></li>
          <li aria-hidden>/</li>
          <li><Link href="/venues" className="hover:text-brand-700">Venues</Link></li>
          <li aria-hidden>/</li>
          <li><Link href="/venues/saved" className="hover:text-brand-700">Saved</Link></li>
          <li aria-hidden>/</li>
          <li className="font-semibold text-ink-soft" aria-current="page">Compare</li>
        </ol>
      </nav>

      <header className="container-x mt-6">
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">Compare Venues</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">See capacity, season, facilities and how to get there for your shortlisted venues side by side.</p>
      </header>

      <section className="container-x mb-16 mt-8" aria-label="Venue comparison">
        {venues.length < 2 ? (
          <div className="rounded-2xl border border-line bg-white p-10 text-center" data-testid="compare-empty">
            <span aria-hidden className="text-4xl">⚖️</span>
            <p className="mt-3 text-lg font-bold text-ink">Pick at least two venues to compare</p>
            <p className="mt-1 text-ink-soft">Save venues with the heart, then tick the ones you want to compare on your shortlist.</p>
            <Link href="/venues/saved" className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600">
              Go to my shortlist →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white" data-testid="compare-table">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 w-32 bg-white p-4"><span className="sr-only">Detail</span></th>
                  {venues.map((v) => (
                    <th key={v.id} scope="col" className="min-w-[200px] p-4 align-top font-normal" data-testid="compare-col">
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gradient-to-br from-brand/15 via-cream to-accent/15">
                        {v.coverImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.coverImage} alt={v.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                        ) : (
                          <VenuePhotoPlaceholder name={v.name} />
                        )}
                        {v.coverFromGoogle && <span className="absolute bottom-2 right-2 rounded bg-ink/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">Photo: Google</span>}
                        <SaveVenueButton id={v.id} name={v.name} className="absolute right-2 top-2 shadow-sm" />
                      </div>
                      <Link href={venuePath(v)} className="mt-3 block text-base font-black leading-snug text-ink hover:text-brand-700">{v.name}</Link>
                      {venues.length > 2 && (
                        <Link href={without(v.id)} className="mt-1 inline-block text-xs font-semibold text-muted hover:text-brand-700" data-testid="compare-remove">
                          Remove from comparison
                        </Link>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.label} className="border-t border-line">
                    <th scope="row" className="sticky left-0 z-10 bg-cream p-4 align-top text-xs font-bold uppercase tracking-wider text-muted">{r.label}</th>
                    {venues.map((v) => (
                      <td key={v.id} className="p-4 align-top text-ink-soft">{r.value(v)}</td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-line">
                  <th scope="row" className="sticky left-0 z-10 bg-cream p-4"><span className="sr-only">Link</span></th>
                  {venues.map((v) => (
                    <td key={v.id} className="p-4">
                      <Link href={venuePath(v)} className="inline-flex min-h-[44px] items-center rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600">
                        View venue →
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
