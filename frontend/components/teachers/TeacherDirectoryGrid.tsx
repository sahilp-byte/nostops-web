'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { titleCase, initials } from '@/lib/format';

// ---- Public-safe teacher shape (private/admin fields are intentionally dropped) ----
// This is the ONLY teacher data that ever reaches the client. No email, phone,
// whatsapp, user_id, teacher_id, payout, KYC or geo fields exist on this type by design.
export type PublicTeacher = {
  handle: string;
  name: string;
  city?: string;
  citySlug?: string;
  country?: string;
  parampara?: string;
  experienceYears?: number;
  styles: string[];
  specializations: string[];
  badges: string[];
  badgePrimary?: string;
  tier?: string;
  isEmpanelled: boolean;
  isVerified: boolean;
  idChecked?: boolean;
  isFeatured: boolean;
  rating?: number;
  reviewsCount?: number;
  avatarUrl?: string | null;
  avatarB64?: string | null;
  languages: string[];
};

// How many cards are revealed per "Load More" tap (and shown initially).
const CHUNK = 12;

// Generic buckets that are not real cities (mirrors lib/server/cities.ts).
const NON_CITY = new Set(['india', 'online', '', 'remote']);

function TeacherAvatar({ t }: { t: PublicTeacher }) {
  const src = t.avatarUrl
    ? t.avatarUrl
    : t.avatarB64
      ? (t.avatarB64.startsWith('data:') ? t.avatarB64 : `data:image/jpeg;base64,${t.avatarB64}`)
      : null;
  // Ring colour signals standing at a glance (warm/premium, not loud).
  const ring = t.isEmpanelled ? 'ring-accent/40' : t.isVerified ? 'ring-brand/30' : 'ring-line';
  const cls = `h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-offset-2 ring-offset-white ${ring}`;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote avatar URL / data URI, no next/image loader
      <img
        src={src}
        alt={`${t.name} — NOSTOPS yoga teacher`}
        width={64}
        height={64}
        className={cls}
        loading="lazy"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`grid place-items-center bg-brand-50 text-xl font-black text-brand-700 ${cls}`}
    >
      {initials(t.name)}
    </div>
  );
}

function TeacherCard({ t }: { t: PublicTeacher }) {
  const tradition = t.parampara ? `${titleCase(t.parampara)} tradition` : 'Yoga Teacher';
  const location = t.city ? titleCase(t.city) : '';
  return (
    // Whole card is one accessible link (stretched-link pattern): the photo,
    // name, card body and CTA all open the canonical profile. Screen readers
    // announce a single link named after the teacher.
    <article className="group relative flex h-full flex-col rounded-2xl border border-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2">
      <div className="absolute right-4 top-4">
        {t.isVerified ? (
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-brand-700" data-testid="badge-verified">✓ Verified</span>
        ) : t.isEmpanelled ? (
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-accent-600" data-testid="badge-empanelled">★ Empanelled</span>
        ) : t.idChecked ? (
          <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft" data-testid="badge-id-checked">ID checked</span>
        ) : (
          <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-muted" data-testid="badge-listed">Listed</span>
        )}
      </div>

      <div className="flex items-start gap-4 pr-24">
        <TeacherAvatar t={t} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black leading-tight tracking-tight text-ink">
            <Link
              href={`/teachers/${t.handle}`}
              className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] group-hover:text-brand-700 focus-visible:underline"
            >
              <span className="line-clamp-2">{t.name}</span>
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-sm font-semibold text-ink-soft">{tradition}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-muted">
            {t.experienceYears ? <span>{t.experienceYears} yrs teaching</span> : null}
            {t.experienceYears && location ? <span aria-hidden="true">·</span> : null}
            {location ? (
              t.citySlug ? (
                <Link
                  href={`/yoga-teachers/${t.citySlug}`}
                  className="relative z-10 rounded-sm hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {location}
                </Link>
              ) : (
                <span>{location}</span>
              )
            ) : null}
            {t.rating ? (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true" className="text-amber-500">★</span>
                <span className="text-ink-soft">
                  {t.rating.toFixed(1)}
                  {t.reviewsCount ? ` (${t.reviewsCount})` : ''}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {t.styles.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {t.styles.slice(0, 3).map((s) => (
            <span key={s} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
              {titleCase(s)}
            </span>
          ))}
        </div>
      )}

      {t.specializations.length > 0 && (
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          <span className="font-bold text-ink">Expertise:</span>{' '}
          {t.specializations.slice(0, 3).map((s) => titleCase(s)).join(' · ')}
        </p>
      )}

      <div className="mt-auto pt-5">
        <span
          aria-hidden="true"
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-brand/30 bg-brand-50/60 px-4 py-3 text-sm font-black text-brand-700 transition group-hover:border-brand group-hover:bg-brand group-hover:text-white"
        >
          View Teacher Profile
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>
    </article>
  );
}

// Build the lowercase haystack a teacher is matched against for free-text search.
function searchable(t: PublicTeacher): string {
  return [
    t.name,
    t.city,
    t.country,
    titleCase(t.parampara),
    ...t.styles,
    ...t.specializations,
    ...t.languages,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Scalable teacher directory grid with search + city / tradition / style filters.
 *
 * SEO: on the initial (unfiltered) server render EVERY card and its canonical
 * /teachers/{handle} link are in the HTML (cards beyond the visible chunk are
 * display:none, never removed), so crawlers discover all profiles. Search and
 * filtering are client-only refinements applied after hydration; the initial
 * visible count matches on server + client (deterministic, no hydration mismatch).
 */
export function TeacherDirectoryGrid({ teachers }: { teachers: PublicTeacher[] }) {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [parampara, setParampara] = useState('');
  const [style, setStyle] = useState('');
  const [visible, setVisible] = useState(Math.min(CHUNK, teachers.length));

  // Deep-link support: `/teachers?city=<slug>` (e.g. from a City page's
  // "See teachers here →") opens the directory pre-filtered to that city.
  // Read after hydration so the server render stays deterministic (no mismatch).
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('city');
    if (!slug) return;
    const match = teachers.find((t) => t.citySlug === slug);
    if (match?.city) setCity(match.city);
  }, [teachers]);

  // ---- Facets derived from the SAME set that renders, so options never drift ----
  const cityOptions = useMemo(
    () =>
      Array.from(
        new Set(teachers.map((t) => t.city).filter((c): c is string => !!c && !NON_CITY.has(c.toLowerCase()))),
      ).sort((a, b) => a.localeCompare(b)),
    [teachers],
  );
  const paramparaOptions = useMemo(
    () =>
      Array.from(new Set(teachers.map((t) => t.parampara).filter((p): p is string => !!p))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [teachers],
  );
  const styleOptions = useMemo(
    () => Array.from(new Set(teachers.flatMap((t) => t.styles).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [teachers],
  );

  // ---- Apply search + filters (all client-side, in-memory) ----
  const query = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    return teachers.filter((t) => {
      if (city && t.city !== city) return false;
      if (parampara && t.parampara !== parampara) return false;
      if (style && !t.styles.includes(style)) return false;
      if (query && !searchable(t).includes(query)) return false;
      return true;
    });
  }, [teachers, city, parampara, style, query]);

  const hasFilters = !!(query || city || parampara || style);

  // Reset pagination whenever the result set changes.
  useEffect(() => {
    setVisible(Math.min(CHUNK, filtered.length));
  }, [filtered.length]);

  function clearAll() {
    setQ('');
    setCity('');
    setParampara('');
    setStyle('');
  }

  const remaining = Math.max(0, filtered.length - visible);
  const selectCls =
    'min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30';

  return (
    <div>
      {/* Search + filter toolbar */}
      <div className="mt-8 rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-5">
        <label htmlFor="teacher-search" className="sr-only">Search teachers by name or expertise</label>
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.472 9.77l3.879 3.88a.75.75 0 1 0 1.06-1.06l-3.879-3.88A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" />
            </svg>
          </span>
          <input
            id="teacher-search"
            type="search"
            inputMode="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, expertise, style or city…"
            data-testid="teacher-search-input"
            className="min-h-[48px] w-full rounded-xl border border-line bg-cream/40 pl-11 pr-4 text-sm font-semibold text-ink outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/30"
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select aria-label="Filter by city" value={city} onChange={(e) => setCity(e.target.value)} data-testid="filter-city" className={selectCls}>
            <option value="">All cities</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>{titleCase(c)}</option>
            ))}
          </select>
          <select aria-label="Filter by tradition" value={parampara} onChange={(e) => setParampara(e.target.value)} data-testid="filter-parampara" className={selectCls}>
            <option value="">All traditions</option>
            {paramparaOptions.map((p) => (
              <option key={p} value={p}>{titleCase(p)}</option>
            ))}
          </select>
          <select aria-label="Filter by style" value={style} onChange={(e) => setStyle(e.target.value)} data-testid="filter-style" className={selectCls}>
            <option value="">All styles</option>
            {styleOptions.map((s) => (
              <option key={s} value={s}>{titleCase(s)}</option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink-soft" data-testid="teacher-result-count" aria-live="polite">
            {hasFilters
              ? `${filtered.length} of ${teachers.length} ${teachers.length === 1 ? 'teacher' : 'teachers'} match`
              : `${teachers.length} ${teachers.length === 1 ? 'teacher' : 'teachers'} with public profiles`}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              data-testid="clear-filters"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-bold text-brand-700 underline-offset-2 transition hover:underline"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="mt-8 card p-8 text-center" data-testid="no-matches">
          <span aria-hidden="true" className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-2xl">🔍</span>
          <p className="mt-4 text-lg font-semibold text-ink">No teachers match your search.</p>
          <p className="mt-2 text-muted">Try a different keyword, or widen your filters.</p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-brand/30 bg-brand-50/60 px-5 py-2.5 text-sm font-black text-brand-700 transition hover:border-brand hover:bg-brand hover:text-white"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <ul className="mt-8 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t, i) => {
              const isHidden = i >= visible;
              return (
                <li key={t.handle} className={`h-full ${isHidden ? 'hidden' : ''}`}>
                  <TeacherCard t={t} />
                </li>
              );
            })}
          </ul>

          {remaining > 0 && (
            <div className="mt-10 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setVisible((v) => Math.min(v + CHUNK, filtered.length))}
                data-testid="load-more-teachers"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-brand/30 bg-brand-50/60 px-7 py-3.5 text-sm font-black uppercase tracking-wide text-brand-700 transition hover:border-brand hover:bg-brand hover:text-white"
              >
                Load more teachers
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                  +{Math.min(CHUNK, remaining)}
                </span>
              </button>
              <p className="text-sm font-semibold text-muted">
                Showing {visible} of {filtered.length} teachers
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
