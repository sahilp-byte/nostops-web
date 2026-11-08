'use client';

import Link from 'next/link';
import { useSavedRetreats } from '@/lib/saved-retreats';
import SaveRetreatButton from '@/components/retreats/SaveRetreatButton';
import RetreatThumb from '@/components/retreats/RetreatThumb';
import { inr } from '@/lib/format';
import { retreatPath } from '@/lib/retreat-url';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtRange(s?: string, e?: string): string {
  const d = (x?: string) => {
    if (!x) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(x);
    return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || ''}` : '';
  };
  const a = d(s); const b = d(e);
  if (a && b) return a === b ? a : `${a} – ${b}`;
  return a || b || '';
}

// PROMPT 30 — public "Saved retreats" page. Reads the localStorage wishlist.
export default function SavedRetreatsPage() {
  const { saved } = useSavedRetreats();

  return (
    <main>
      <nav aria-label="Breadcrumb" className="border-b border-line bg-white">
        <div className="container-x flex items-center gap-2 py-3 text-sm text-muted">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/retreats" className="hover:text-brand-700">Retreats</Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-ink-soft">Saved</span>
        </div>
      </nav>

      <section className="container-x py-10">
        <h1 className="text-3xl font-black tracking-tight text-ink">Saved retreats</h1>
        <p className="mt-2 text-ink-soft">Retreats you&apos;ve saved to come back to. Kept on this device.</p>

        {saved.length === 0 ? (
          <div className="mt-8 card p-10 text-center">
            <span aria-hidden className="text-4xl">🤍</span>
            <p className="mt-3 text-lg font-semibold text-ink">No saved retreats yet</p>
            <p className="mt-1 text-muted">Tap the ♡ on any retreat to save it here for later.</p>
            <Link href="/retreats" className="mt-5 inline-block rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-600">Browse retreats</Link>
          </div>
        ) : (
          <ul className="mt-8 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3" data-testid="saved-retreats-list">
            {saved.map((r) => {
              const soldOut = r.status === 'sold_out';
              return (
                <li key={r.id} className="relative">
                  <Link href={retreatPath(r)} className="card group flex h-full flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg" data-testid="saved-retreat-card">
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-accent/15 via-cream to-brand/15">
                      <RetreatThumb id={r.id} cover={r.coverImage} venuePartnerId={r.venuePartnerId} theme={r.theme} alt={r.title} />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="line-clamp-2 text-base font-black leading-snug tracking-tight text-ink group-hover:text-accent-600">{r.title}</h3>
                      {[r.city, r.state].filter(Boolean).length > 0 && (
                        <p className="mt-1.5 flex items-center gap-1 text-sm text-muted"><span aria-hidden>📍</span> {[r.city, r.state].filter(Boolean).join(', ')}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-ink-soft">
                        {fmtRange(r.startDate, r.endDate) && <span className="font-semibold">{fmtRange(r.startDate, r.endDate)}</span>}
                        {r.guruName && <span className="text-muted">· {r.guruName}</span>}
                      </div>
                      <div className="mt-auto pt-4">
                        {typeof r.priceInr === 'number' ? (
                          <span className="text-lg font-black text-ink">₹{inr(r.priceInr)}<span className="text-xs font-medium text-muted"> / seat</span></span>
                        ) : (
                          <span className="text-sm font-semibold text-brand-700">Enquire for pricing</span>
                        )}
                        {soldOut && <span className="ml-2 text-xs font-bold text-ink-soft">· Sold out</span>}
                      </div>
                    </div>
                  </Link>
                  <SaveRetreatButton retreat={r} className="absolute right-3 top-3 z-10" />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
