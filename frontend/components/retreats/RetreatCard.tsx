'use client';

import Link from 'next/link';
import type { PublicRetreat } from '@/lib/server/retreats';
import { inr, titleCase } from '@/lib/format';
import SaveRetreatButton from '@/components/retreats/SaveRetreatButton';
import RetreatThumb from '@/components/retreats/RetreatThumb';
import { retreatPath } from '@/lib/retreat-url';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtRange(s?: string, e?: string): string {
  const d = (x?: string) => {
    if (!x) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(x);
    return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || ''}` : '';
  };
  const a = d(s);
  const b = d(e);
  if (a && b) return a === b ? a : `${a} – ${b}`;
  return a || b || '';
}
function statusChip(s: string): { label: string; cls: string } | null {
  if (s === 'sold_out') return { label: 'Sold out', cls: 'bg-ink/70 text-white' };
  if (s === 'filling') return { label: 'Filling fast', cls: 'bg-accent text-white' };
  if (s === 'published') return { label: 'Open', cls: 'bg-brand text-white' };
  return null;
}

// Presentational retreat card. Image-forward but information-efficient — its job
// is to make the user want to open the retreat. Renders only fields that exist.
export default function RetreatCard({ r }: { r: PublicRetreat }) {
  const cover = r.coverImage || r.images[0] || null;
  const chip = statusChip(r.status);
  const location = [r.city, r.state].filter(Boolean).join(', ');
  const soldOut = r.status === 'sold_out' || r.seatsRemaining === 0;

  return (
    <Link
      href={retreatPath(r)}
      className="card group flex h-full flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg"
      data-testid="retreat-card"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-accent/15 via-cream to-brand/15">
        <RetreatThumb id={r.id} cover={cover} venuePartnerId={r.venuePartnerId} theme={r.theme} alt={r.title} />
        {chip && (
          <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${chip.cls}`}>
            {chip.label}
          </span>
        )}
        <SaveRetreatButton
          retreat={{ id: r.id, title: r.title, city: r.city, state: r.state, startDate: r.startDate, endDate: r.endDate, priceInr: r.priceInr, coverImage: cover, guruName: r.guruName, status: r.status, theme: r.theme, venuePartnerId: r.venuePartnerId }}
          className="absolute right-3 top-3 z-10"
        />
        {r.theme && (
          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-ink-soft backdrop-blur">
            {titleCase(r.theme)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-base font-black leading-snug tracking-tight text-ink group-hover:text-accent-600">
          {r.title}
        </h3>
        {location && (
          <p className="mt-1.5 flex items-center gap-1 text-sm text-muted">
            <span aria-hidden>📍</span> {location}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
          {fmtRange(r.startDate, r.endDate) && <span className="font-semibold">{fmtRange(r.startDate, r.endDate)}</span>}
          {r.guruName && <span className="text-muted">· {r.guruName}</span>}
        </div>

        <div className="mt-auto flex items-end justify-between pt-4">
          <div>
            {typeof r.priceInr === 'number' ? (
              <span className="text-lg font-black text-ink">
                ₹{inr(r.priceInr)}
                <span className="text-xs font-medium text-muted"> / seat</span>
              </span>
            ) : (
              <span className="text-sm font-semibold text-brand-700">Enquire for pricing</span>
            )}
          </div>
          {!soldOut && typeof r.seatsRemaining === 'number' && r.seatsRemaining > 0 && (
            <span className="text-xs font-semibold text-muted">{r.seatsRemaining} seats left</span>
          )}
        </div>
      </div>
    </Link>
  );
}
