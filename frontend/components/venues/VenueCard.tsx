import Link from 'next/link';
import type { PublicVenue } from '@/lib/server/venues';
import { venuePath } from '@/lib/venue-url';
import { titleCase } from '@/lib/format';
import SaveVenueButton from '@/components/venues/SaveVenueButton';
import EnhancedBadge from '@/components/venues/EnhancedBadge';
import VenuePhotoPlaceholder from '@/components/venues/VenuePhotoPlaceholder';

// Presentational venue card for the /venues directory and "other venues" lists.
// The heart (save/shortlist) is a sibling of the Link so tapping it never
// triggers navigation.
export default function VenueCard({ v, retreatCount, enhanced }: { v: PublicVenue; retreatCount?: number; enhanced?: boolean }) {
  const location = [v.city, v.state].filter(Boolean).join(', ');
  return (
    <div className="relative h-full">
      <Link
        href={venuePath(v)}
        className="card group flex h-full flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg"
        data-testid="venue-card"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-brand/15 via-cream to-accent/15">
          {v.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.coverImage} alt={v.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          ) : (
            <VenuePhotoPlaceholder name={v.name} />
          )}
          {v.coverFromGoogle && (
            <span className="absolute bottom-2 right-2 rounded bg-ink/60 px-1.5 py-0.5 text-[10px] font-semibold text-white" data-testid="venue-card-google-credit">Photo: Google</span>
          )}
          {(enhanced || v.sattvicCertified) && (
            <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
              {enhanced && <EnhancedBadge size="sm" testId="venue-card-enhanced" />}
              {v.sattvicCertified && <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">Sattvic certified</span>}
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col p-5">
          <h3 className="line-clamp-2 text-base font-black leading-snug tracking-tight text-ink group-hover:text-brand-700">{v.name}</h3>
          {location && <p className="mt-1.5 flex items-center gap-1 text-sm text-muted"><span aria-hidden>📍</span> {location}</p>}
          {v.summary && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{v.summary}</p>}
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-xs font-semibold text-muted">
            {typeof v.capacity === 'number' && <span>{v.capacity} guests</span>}
            {v.bestForFramings.slice(0, 1).map((f) => <span key={f} className="rounded-full bg-cream px-2 py-0.5 text-ink-soft">{titleCase(f)}</span>)}
            {typeof retreatCount === 'number' && retreatCount > 0 && (
              <span className="ml-auto text-brand-700">{retreatCount} retreat{retreatCount === 1 ? '' : 's'} →</span>
            )}
          </div>
        </div>
      </Link>
      <SaveVenueButton id={v.id} name={v.name} className="absolute right-3 top-3 z-10 shadow-sm" />
    </div>
  );
}
