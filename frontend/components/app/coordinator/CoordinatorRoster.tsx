'use client';

import { useMemo, useState } from 'react';

type RosterTeacher = { teacherId: string; handle: string; name: string; city: string; isEmpanelled: boolean };
type Filter = 'all' | 'empanelled' | 'onboarding';
type Sort = 'attention' | 'az';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'empanelled', label: 'Empanelled' },
  { key: 'onboarding', label: 'Onboarding' },
];

const SORTS: Array<{ key: Sort; label: string }> = [
  { key: 'attention', label: 'Needs attention' },
  { key: 'az', label: 'Name A–Z' },
];

export default function CoordinatorRoster({ teachers, city }: { teachers: RosterTeacher[]; city: string }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('attention');

  const counts = useMemo(() => {
    const empanelled = teachers.filter((t) => t.isEmpanelled).length;
    return { all: teachers.length, empanelled, onboarding: teachers.length - empanelled };
  }, [teachers]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = teachers.filter((t) => {
      if (filter === 'empanelled' && !t.isEmpanelled) return false;
      if (filter === 'onboarding' && t.isEmpanelled) return false;
      if (!needle) return true;
      return t.name.toLowerCase().includes(needle) || t.city.toLowerCase().includes(needle);
    });
    return list.sort((a, b) => {
      // "Needs attention" surfaces onboarding teachers first; ties break A–Z.
      if (sort === 'attention' && a.isEmpanelled !== b.isEmpanelled) return a.isEmpanelled ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [teachers, q, filter, sort]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search teachers${city ? ` in ${city}` : ''} by name or city`}
          data-testid="roster-search"
          className="w-full rounded-xl border border-line bg-white py-2.5 pl-10 pr-3.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {/* Filter chips + sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              data-testid={`roster-filter-${f.key}`}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-bold transition ${
                filter === f.key ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand hover:text-brand-700'
              }`}
            >
              {f.label} <span className={filter === f.key ? 'text-white/80' : 'text-muted'}>· {counts[f.key]}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          <span className="font-bold text-muted">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            data-testid="roster-sort"
            className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm font-bold text-ink outline-none transition focus:border-brand"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Results */}
      <section className="rounded-2xl border border-line bg-white">
        {results.length === 0 ? (
          <div className="p-8 text-center">
            <span className="text-3xl">🧘</span>
            <p className="mt-2 text-sm font-semibold text-ink">No teachers match your search.</p>
            <p className="mt-1 text-sm text-muted">
              {teachers.length === 0
                ? 'New empanelled teachers within 25 km of your pin auto-attach on their next login.'
                : 'Try a different name, city, or status.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {results.map((t) => (
              <div key={t.teacherId} className="flex items-center gap-3 p-4" data-testid="roster-row">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-black text-brand-700">
                  {(t.name || '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-ink">{t.name}</p>
                  <p className="truncate text-xs text-muted">{t.city || 'City TBD'}</p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                  style={{ backgroundColor: t.isEmpanelled ? '#10B981' : '#F59E0B' }}
                >
                  {t.isEmpanelled ? 'Empanelled' : 'Onboarding'}
                </span>
                {t.handle && (
                  <a href={`/teachers/${t.handle}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-bold text-brand-700 hover:underline">
                    View →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="text-center text-xs italic text-muted">Onboarding teachers become Empanelled once they clear KYC and the empanelment protocol.</p>
    </div>
  );
}
