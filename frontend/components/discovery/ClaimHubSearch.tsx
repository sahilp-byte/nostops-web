'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Name + city search for the claim hub. Submitting navigates to /claim?q=&city=
// so results are server-rendered (indexable) — no client data fetching needed.
export default function ClaimHubSearch({
  cities,
  initialQuery = '',
  initialCity = '',
}: {
  cities: string[];
  initialQuery?: string;
  initialCity?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [city, setCity] = useState(initialCity);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (city) params.set('city', city);
    // Remember the chosen city so the next visit pre-selects it ("feels instant").
    if (city) {
      document.cookie = `nostops_city=${encodeURIComponent(city)}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
    }
    router.push(`/claim${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row" data-testid="claim-hub-search">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Your name or studio (e.g. Priya Yoga)"
        aria-label="Your name or studio"
        data-testid="claim-hub-q"
        className="min-h-[46px] flex-1 rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-brand"
      />
      <select
        value={city}
        onChange={(e) => setCity(e.target.value)}
        aria-label="City"
        data-testid="claim-hub-city"
        className="min-h-[46px] rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-brand"
      >
        <option value="">All cities</option>
        {cities.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <button
        type="submit"
        data-testid="claim-hub-submit"
        className="min-h-[46px] rounded-xl bg-brand px-6 text-sm font-black text-white hover:bg-brand-600"
      >
        Find my profile
      </button>
    </form>
  );
}
