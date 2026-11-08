'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicVenue } from '@/lib/server/venues';
import { titleCase } from '@/lib/format';
import VenueCard from '@/components/venues/VenueCard';

function track(event: string, params: Record<string, unknown>) {
  if (typeof window !== 'undefined' && typeof (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag === 'function') {
    (window as unknown as { gtag: (...a: unknown[]) => void }).gtag('event', event, params);
  }
}

// Client discovery surface for the public /venues directory: search + location
// & suitability filters over the full server-fetched set (no partial fetches).
// Mobile-first: the toolbar sticks to the top on small screens; on desktop it
// becomes an inline card. Touch targets are ≥44px.
export default function VenueExplorer({ venues, retreatCounts, verifiedIds = [], enhancedIds = [], pageSize = 9 }: { venues: PublicVenue[]; retreatCounts: Record<string, number>; verifiedIds?: string[]; enhancedIds?: string[]; pageSize?: number }) {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [framing, setFraming] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [enhancedOnly, setEnhancedOnly] = useState(false);
  const verifiedSet = useMemo(() => new Set(verifiedIds), [verifiedIds]);
  const enhancedSet = useMemo(() => new Set(enhancedIds), [enhancedIds]);

  const cities = useMemo(() => Array.from(new Set(venues.map((v) => v.city).filter(Boolean) as string[])).sort(), [venues]);
  const countries = useMemo(() => Array.from(new Set(venues.map((v) => v.country).filter(Boolean) as string[])).sort(), [venues]);
  const framings = useMemo(() => Array.from(new Set(venues.flatMap((v) => v.bestForFramings))).sort(), [venues]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return venues.filter((v) => {
      if (verifiedOnly && !verifiedSet.has(v.id)) return false;
      if (enhancedOnly && !enhancedSet.has(v.id)) return false;
      if (country && v.country !== country) return false;
      if (city && v.city !== city) return false;
      if (framing && !v.bestForFramings.includes(framing)) return false;
      if (needle) {
        const hay = [v.name, v.city, v.state, v.country, v.summary, ...v.bestForFramings].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [venues, q, city, country, framing, verifiedOnly, verifiedSet, enhancedOnly, enhancedSet]);

  const activeCount = [city, country, framing].filter(Boolean).length + (q ? 1 : 0) + (verifiedOnly ? 1 : 0) + (enhancedOnly ? 1 : 0);

  // Pagination over the filtered set (client-side; no partial fetches).
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [q, city, country, framing, verifiedOnly, enhancedOnly]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const pageItems = filtered.slice((pageClamped - 1) * pageSize, (pageClamped - 1) * pageSize + pageSize);
  const topRef = useRef<HTMLDivElement>(null);
  function goToPage(p: number) {
    setPage(Math.min(Math.max(1, p), totalPages));
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function reset() {
    setQ('');
    setCity('');
    setCountry('');
    setFraming('');
    setVerifiedOnly(false);
    setEnhancedOnly(false);
  }

  const selectCls =
    'min-h-[44px] rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink-soft outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

  return (
    <div>
      {/* Toolbar — sticky on mobile, inline card on desktop */}
      <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-line bg-cream/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:px-4 sm:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">🔍</span>
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (e.target.value.length > 2) track('venue_search', { query: e.target.value });
              }}
              placeholder="Search venues, places…"
              aria-label="Search venues"
              data-testid="venue-search"
              className="min-h-[44px] w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {countries.length > 1 && (
              <select
                value={country}
                onChange={(e) => { setCountry(e.target.value); track('venue_filter', { type: 'country', value: e.target.value }); }}
                aria-label="Filter by country"
                data-testid="venue-filter-country"
                className={selectCls}
              >
                <option value="">All countries</option>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select
              value={city}
              onChange={(e) => { setCity(e.target.value); track('venue_filter', { type: 'city', value: e.target.value }); }}
              aria-label="Filter by location"
              data-testid="venue-filter-city"
              className={selectCls}
            >
              <option value="">All locations</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {framings.length > 0 && (
              <select
                value={framing}
                onChange={(e) => { setFraming(e.target.value); track('venue_filter', { type: 'framing', value: e.target.value }); }}
                aria-label="Filter by suitability"
                data-testid="venue-filter-framing"
                className={selectCls}
              >
                <option value="">All types</option>
                {framings.map((f) => <option key={f} value={f}>{titleCase(f)}</option>)}
              </select>
            )}
            {verifiedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setVerifiedOnly((v) => !v)}
                aria-pressed={verifiedOnly}
                data-testid="venue-filter-verified"
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 text-sm font-bold transition ${verifiedOnly ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`}
              >
                🛡️ Verified only
              </button>
            )}
            {enhancedIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setEnhancedOnly((on) => !on);
                  track('venue_filter', { type: 'enhanced', value: enhancedOnly ? 'off' : 'on' });
                }}
                aria-pressed={enhancedOnly}
                title="Show only venues with an upgraded profile: AI-assisted onboarding and Google photos & reviews"
                data-testid="venue-filter-enhanced"
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 text-sm font-bold transition ${enhancedOnly ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-line bg-white text-ink-soft hover:border-indigo-400'}`}
              >
                <span aria-hidden>✦</span> Enhanced listings only
              </button>
            )}
          </div>
        </div>
      </div>

      <div ref={topRef} className="flex items-center justify-between scroll-mt-20">
        <p className="text-sm font-semibold text-muted" aria-live="polite" data-testid="venue-count">
          {filtered.length} {filtered.length === 1 ? 'venue' : 'venues'}{activeCount > 0 ? ' match your search' : ''}
        </p>
        {activeCount > 0 && (
          <button type="button" onClick={reset} className="text-sm font-bold text-brand-700 hover:underline" data-testid="venue-clear">
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 card p-10 text-center">
          <span aria-hidden className="text-4xl">🏡</span>
          <p className="mt-3 text-lg font-bold text-ink">No venues match your search.</p>
          <p className="mt-1 text-muted">Try clearing a filter — or add a space you know.</p>
        </div>
      ) : (
        <>
          <ul className="mt-6 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((v) => (
              <li key={v.id}><VenueCard v={v} retreatCount={retreatCounts[v.id]} enhanced={enhancedSet.has(v.id)} /></li>
            ))}
          </ul>
          {totalPages > 1 && (
            <nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5" aria-label="Venue pages" data-testid="venue-pagination">
              <button
                type="button"
                onClick={() => goToPage(pageClamped - 1)}
                disabled={pageClamped <= 1}
                aria-label="Previous page"
                className="min-h-[40px] rounded-lg border border-line bg-white px-3 text-sm font-bold text-ink-soft transition hover:border-brand hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Prev
              </button>
              {pageNumbers(pageClamped, totalPages).map((p, i) =>
                p === '…' ? (
                  <span key={`gap-${i}`} className="px-1 text-sm text-muted" aria-hidden>…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goToPage(p)}
                    aria-current={p === pageClamped ? 'page' : undefined}
                    data-testid={`venue-page-${p}`}
                    className={`min-h-[40px] min-w-[40px] rounded-lg border px-3 text-sm font-bold transition ${p === pageClamped ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand hover:text-brand-700'}`}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() => goToPage(pageClamped + 1)}
                disabled={pageClamped >= totalPages}
                aria-label="Next page"
                className="min-h-[40px] rounded-lg border border-line bg-white px-3 text-sm font-bold text-ink-soft transition hover:border-brand hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

// Compact page-number window with ellipses for long lists.
function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) out.push('…');
  for (let p = left; p <= right; p++) out.push(p);
  if (right < total - 1) out.push('…');
  out.push(total);
  return out;
}
