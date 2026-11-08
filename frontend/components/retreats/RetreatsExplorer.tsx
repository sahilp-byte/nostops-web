'use client';

import { useMemo, useState } from 'react';
import type { PublicRetreat } from '@/lib/server/retreats';
import { titleCase } from '@/lib/format';
import RetreatCard from '@/components/retreats/RetreatCard';

type Sort = 'soonest' | 'price_low' | 'price_high';

function track(event: string, params: Record<string, any>) {
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
    (window as any).gtag('event', event, params);
  }
}

// Client discovery surface: search + location/theme/status filters + sort, run
// over the full server-fetched dataset (no thin partial fetches). Responsive:
// a sticky toolbar on mobile, an inline elegant toolbar on desktop.
export default function RetreatsExplorer({ retreats, verifiedIds = [] }: { retreats: PublicRetreat[]; verifiedIds?: string[] }) {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [theme, setTheme] = useState('');
  const [status, setStatus] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('soonest');
  const verifiedSet = useMemo(() => new Set(verifiedIds), [verifiedIds]);

  const cities = useMemo(
    () => Array.from(new Set(retreats.map((r) => r.city).filter(Boolean) as string[])).sort(),
    [retreats],
  );
  const countries = useMemo(
    () => Array.from(new Set(retreats.map((r) => r.country).filter(Boolean) as string[])).sort(),
    [retreats],
  );
  const themes = useMemo(
    () => Array.from(new Set(retreats.map((r) => r.theme).filter(Boolean) as string[])).sort(),
    [retreats],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = retreats.filter((r) => {
      if (verifiedOnly && !verifiedSet.has(r.id)) return false;
      if (country && r.country !== country) return false;
      if (city && r.city !== city) return false;
      if (theme && r.theme !== theme) return false;
      if (status && r.status !== status) return false;
      if (needle) {
        const hay = [r.title, r.city, r.state, r.country, r.venueName, r.guruName, r.theme].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    list = list.slice().sort((a, b) => {
      if (sort === 'price_low') return (a.priceInr ?? Infinity) - (b.priceInr ?? Infinity);
      if (sort === 'price_high') return (b.priceInr ?? -1) - (a.priceInr ?? -1);
      return (a.startDate || '9999').localeCompare(b.startDate || '9999');
    });
    return list;
  }, [retreats, q, city, country, theme, status, sort, verifiedOnly, verifiedSet]);

  const activeCount = [city, country, theme, status].filter(Boolean).length + (q ? 1 : 0) + (verifiedOnly ? 1 : 0);

  function reset() {
    setQ('');
    setCity('');
    setCountry('');
    setTheme('');
    setStatus('');
    setVerifiedOnly(false);
    setSort('soonest');
  }

  const selectCls =
    'min-h-[44px] rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink-soft outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

  return (
    <div>
      {/* Toolbar */}
      <div className="sticky top-0 z-30 -mx-4 mb-8 border-b border-line bg-cream/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:px-4 sm:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">🔍</span>
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (e.target.value.length > 2) track('retreat_search', { query: e.target.value });
              }}
              placeholder="Search retreats, places, teachers…"
              aria-label="Search retreats"
              className="min-h-[44px] w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {countries.length > 1 && (
              <select value={country} onChange={(e) => { setCountry(e.target.value); track('retreat_filter', { type: 'country', value: e.target.value }); }} aria-label="Filter by country" data-testid="retreat-filter-country" className={selectCls}>
                <option value="">All countries</option>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select value={city} onChange={(e) => { setCity(e.target.value); track('retreat_filter', { type: 'city', value: e.target.value }); }} aria-label="Filter by location" className={selectCls}>
              <option value="">All locations</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={theme} onChange={(e) => { setTheme(e.target.value); track('retreat_filter', { type: 'theme', value: e.target.value }); }} aria-label="Filter by type" className={selectCls}>
              <option value="">All types</option>
              {themes.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by availability" className={selectCls}>
              <option value="">Any availability</option>
              <option value="published">Open</option>
              <option value="filling">Filling fast</option>
              <option value="sold_out">Sold out</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className={selectCls}>
              <option value="soonest">Soonest</option>
              <option value="price_low">Price: low to high</option>
              <option value="price_high">Price: high to low</option>
            </select>
            {verifiedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setVerifiedOnly((v) => !v)}
                aria-pressed={verifiedOnly}
                data-testid="retreat-filter-verified"
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 text-sm font-bold transition ${verifiedOnly ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`}
              >
                🛡️ Verified only
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? 'retreat' : 'retreats'}
          {activeCount > 0 ? ' match your filters' : ''}
        </p>
        {activeCount > 0 && (
          <button type="button" onClick={reset} className="text-sm font-bold text-accent-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 card p-10 text-center">
          <span aria-hidden className="text-4xl">🧘</span>
          <p className="mt-3 text-lg font-bold text-ink">No retreats match your search.</p>
          <p className="mt-1 text-muted">Try clearing a filter or widening your dates.</p>
        </div>
      ) : (
        <ul className="mt-6 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <li key={r.id}>
              <RetreatCard r={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
