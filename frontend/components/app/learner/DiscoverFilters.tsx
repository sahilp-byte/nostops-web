'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { SORT_KEYS, SORT_LABELS, type Facets, type FacetItem, type SortKey } from '@/lib/teacher';

const HOME_CITY_KEY = 'nostops.homeCity.v1';

type Active = {
  q: string;
  city: string;
  parampara: string;
  style: string;
  specialization: string;
  online: string;
  sort: SortKey;
  near: string;
};

function FacetGroup({
  title,
  param,
  items,
  active,
  onToggle,
  busy,
}: {
  title: string;
  param: string;
  items: FacetItem[];
  active: string;
  onToggle: (param: string, id: string) => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const shown = expanded ? items : items.slice(0, 8);

  return (
    <div className="border-t border-line pt-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{title}</h3>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {shown.map((it) => {
          const selected = active === it.id;
          return (
            <button
              key={it.id}
              type="button"
              disabled={busy}
              aria-pressed={selected}
              onClick={() => onToggle(param, it.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                selected
                  ? 'border-brand bg-brand text-white'
                  : 'border-line bg-white text-ink-soft hover:border-brand hover:text-brand-700'
              }`}
            >
              {it.label}
              <span className={`ml-1 ${selected ? 'text-white/70' : 'text-muted'}`}>{it.count}</span>
            </button>
          );
        })}
        {items.length > 8 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full px-3 py-1.5 text-xs font-bold text-brand-700 hover:underline"
          >
            {expanded ? 'Show less' : `+${items.length - 8} more`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DiscoverFilters({
  facets,
  active,
  resultCount,
}: {
  facets: Facets;
  active: Active;
  resultCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(active.q);
  const [busy, setBusy] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInit = useRef(false);

  // Persist / auto-apply the learner's "home" city once on mount.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (active.near) {
      try {
        localStorage.setItem(HOME_CITY_KEY, active.near);
      } catch {
        /* ignore */
      }
      return;
    }
    let saved = '';
    try {
      saved = localStorage.getItem(HOME_CITY_KEY) || '';
    } catch {
      /* ignore */
    }
    if (saved && facets.cities.some((c) => c.id === saved)) navigate({ near: saved });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigate(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const qs = params.toString();
    setBusy(true);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // Clear the visual pending state shortly after; the RSC swap is fast.
    setTimeout(() => setBusy(false), 400);
  }

  function onSearch(val: string) {
    setQ(val);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => navigate({ q: val.trim() || undefined }), 350);
  }

  function toggle(param: string, id: string) {
    const current = (active as Record<string, string>)[param];
    navigate({ [param]: current === id ? undefined : id });
  }

  function onNear(city: string) {
    try {
      if (city) localStorage.setItem(HOME_CITY_KEY, city);
      else localStorage.removeItem(HOME_CITY_KEY);
    } catch {
      /* ignore */
    }
    navigate({ near: city || undefined });
  }

  function clearAll() {
    if (debounce.current) clearTimeout(debounce.current);
    setQ('');
    setBusy(true);
    // Keep the "near you" personalisation and the seeker's chosen focus
    // (matrices / specific requirements); only reset the explicit chip filters.
    const params = new URLSearchParams();
    if (active.near) params.set('near', active.near);
    const keep = new URLSearchParams(searchParams.toString());
    for (const k of ['dims', 'reqs', 'dimension']) {
      const v = keep.get(k);
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setTimeout(() => setBusy(false), 400);
  }

  const anyActive =
    !!(active.q || active.city || active.parampara || active.style || active.specialization || active.online) ||
    active.sort !== 'recommended';

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          🔍
        </span>
        <input
          type="search"
          inputMode="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search name, city, style…"
          aria-label="Search teachers"
          className="min-h-[44px] w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-[15px] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-50"
        />
      </div>

      {/* Near me personalisation */}
      {facets.cities.length > 0 && (
        <div className="rounded-xl border border-brand/20 bg-brand-50/40 p-3">
          <label htmlFor="near-city" className="text-xs font-bold uppercase tracking-wider text-brand-700">
            📍 Teachers near you
          </label>
          <select
            id="near-city"
            value={active.near}
            onChange={(e) => onNear(e.target.value)}
            className="mt-2 min-h-[40px] w-full rounded-lg border border-line bg-white px-2.5 text-sm font-semibold text-ink outline-none focus:border-brand"
          >
            <option value="">Anywhere in India</option>
            {facets.cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.count})
              </option>
            ))}
          </select>
          {active.near && <p className="mt-1.5 text-xs text-muted">Showing {active.near} teachers first</p>}
        </div>
      )}

      {/* Sort + result count */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted" aria-live="polite">
          {busy ? 'Updating…' : `${resultCount} ${resultCount === 1 ? 'teacher' : 'teachers'}`}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Sort by</span>
          <select
            value={active.sort}
            onChange={(e) => navigate({ sort: e.target.value === 'recommended' ? undefined : e.target.value })}
            className="min-h-[40px] rounded-lg border border-line bg-white px-2.5 text-sm font-semibold text-ink-soft outline-none focus:border-brand"
          >
            {SORT_KEYS.map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Quick filter: online availability */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigate({ online: active.online ? undefined : '1' })}
          aria-pressed={!!active.online}
          data-testid="filter-online"
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${active.online ? 'bg-brand text-white' : 'bg-white text-ink-soft ring-1 ring-line hover:ring-brand'}`}
        >
          🖥️ Online only
        </button>
      </div>

      {anyActive && (
        <button
          type="button"
          onClick={clearAll}
          className="rounded-lg bg-cream px-3 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
        >
          Clear all filters ✕
        </button>
      )}

      <FacetGroup title="City" param="city" items={facets.cities} active={active.city} onToggle={toggle} busy={busy} />
      <FacetGroup
        title="Parampara"
        param="parampara"
        items={facets.paramparas}
        active={active.parampara}
        onToggle={toggle}
        busy={busy}
      />
      <FacetGroup title="Style" param="style" items={facets.styles} active={active.style} onToggle={toggle} busy={busy} />
      <FacetGroup
        title="Specialization"
        param="specialization"
        items={facets.specializations}
        active={active.specialization}
        onToggle={toggle}
        busy={busy}
      />
    </div>
  );
}
