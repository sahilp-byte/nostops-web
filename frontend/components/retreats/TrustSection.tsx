import VenueReviews from '@/components/retreats/VenueReviews';
import { titleCase } from '@/lib/format';
import type { VenueReview } from '@/lib/server/retreats';

// PROMPT 26 — Trust. Each source is clearly separated & badged so they are never
// mistaken for one another: Google reviews (venue), NOSTOPS participant reviews
// (about the teacher), and verified signals. Media galleries are labelled by
// source separately in the page. No source is ever merged.
export default function TrustSection({
  googleRating,
  googleReviewCount,
  googleReviews,
  mapsUri,
  hostReviews,
  teacherName,
  verifiedTeacher,
}: {
  googleRating?: number;
  googleReviewCount?: number;
  googleReviews: VenueReview[];
  mapsUri?: string;
  hostReviews: { items: { rating: number; text: string; name: string; role: string }[]; avg: number; count: number };
  teacherName?: string;
  verifiedTeacher?: boolean;
}) {
  const hasGoogle = typeof googleRating === 'number' || googleReviews.length > 0;
  const hasHost = hostReviews.items.length > 0;
  if (!hasGoogle && !hasHost && !verifiedTeacher) return null;

  return (
    <section id="trust" className="scroll-mt-20">
      <h2 className="text-xl font-black tracking-tight text-ink sm:text-2xl">Trust &amp; reviews</h2>

      {/* Verified signals */}
      <div className="mt-4 flex flex-wrap gap-2" data-testid="trust-signals">
        {verifiedTeacher && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-800">✓ NOSTOPS-verified teacher</span>
        )}
        {typeof googleRating === 'number' && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-ink ring-1 ring-line"><span aria-hidden className="text-amber-500">★</span>{googleRating.toFixed(1)}{googleReviewCount ? ` · ${googleReviewCount} Google reviews` : ''}</span>
        )}
        {hostReviews.avg > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-ink ring-1 ring-line"><span aria-hidden className="text-brand-700">🧘</span>{hostReviews.avg.toFixed(1)} · {hostReviews.count} NOSTOPS reviews</span>
        )}
      </div>

      {/* NOSTOPS participant reviews (about the teacher) */}
      {hasHost && (
        <div className="mt-6" data-testid="trust-nostops-reviews">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-brand-700">NOSTOPS participant reviews</span>
            {teacherName && <span className="text-sm text-muted">about {teacherName}</span>}
          </div>
          <ul className="mt-3 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
            {hostReviews.items.map((rv, i) => (
              <li key={i} className="rounded-2xl border border-line bg-white p-4">
                <div className="text-sm" aria-label={`${rv.rating} out of 5`}>
                  <span className="text-amber-500">{'★'.repeat(rv.rating)}</span>
                  <span className="text-line">{'★'.repeat(5 - rv.rating)}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">“{rv.text}”</p>
                <p className="mt-2 text-xs font-semibold text-muted">— {rv.name}{rv.role ? `, ${titleCase(rv.role)}` : ''}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">Collected by NOSTOPS from verified participants of this teacher.</p>
        </div>
      )}

      {/* Google reviews (about the venue) */}
      {googleReviews.length > 0 && (
        <div className="mt-6" data-testid="trust-google-reviews">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-ink-soft">Google reviews</span>
            <span className="text-sm text-muted">about the venue{mapsUri ? '' : ''}</span>
            {mapsUri && <a href={mapsUri} target="_blank" rel="noopener noreferrer nofollow" className="text-sm font-bold text-brand-700 hover:underline">View on Google ↗</a>}
          </div>
          <div className="mt-3"><VenueReviews reviews={googleReviews} /></div>
          <p className="mt-2 text-[11px] text-muted">Venue reviews provided by Google — independent of NOSTOPS.</p>
        </div>
      )}
    </section>
  );
}
