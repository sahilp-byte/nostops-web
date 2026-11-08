'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { PublicTeacher } from '@/lib/teacher';
import { titleCase, initials } from '@/lib/format';
import { dimensionsOf, DIMENSIONS, type DimensionId } from '@/lib/yoga-dimensions';
import { tierToLevel, TEACHER_LEVELS, type TeacherLevel } from '@/lib/teacher-levels';

// ── Teacher card ─────────────────────────────────────────────────────────────
// Shows ONLY fields that actually exist on the record (no fabricated data):
// photo (when available), name, tradition/lineage, verification/empanelment,
// experience, languages, specialisations, teaching formats + link to profile.
function Avatar({ t }: { t: PublicTeacher }) {
  const src = t.avatarUrl
    ? t.avatarUrl
    : t.avatarB64
      ? t.avatarB64.startsWith('data:')
        ? t.avatarB64
        : `data:image/jpeg;base64,${t.avatarB64}`
      : null;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={t.name} width={56} height={56} className="h-14 w-14 shrink-0 rounded-full object-cover" loading="lazy" />;
  }
  return (
    <div aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-50 text-lg font-black text-brand-700">
      {initials(t.name)}
    </div>
  );
}

function formatsOf(t: PublicTeacher): string[] {
  const out: string[] = [];
  if (t.offersOnline) out.push('Online');
  if (t.offersInPerson) out.push('In-person');
  if (t.offersPrivate) out.push('1:1');
  if (t.offersGroup) out.push('Group');
  if (t.offersCorporate) out.push('Corporate');
  return out;
}

// "Adaptive practice verified" ONLY when NOSTOPS holds a reviewed verification
// record. When the visitor is specifically looking for Special Needs, teachers
// without one are clearly marked as not yet verified (never hidden).
export function AdaptiveStatus({ verified, showUnverified }: { verified?: boolean; showUnverified?: boolean }) {
  if (verified) {
    return (
      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700" data-testid="badge-adaptive-verified">
        ✓ Adaptive practice verified
      </span>
    );
  }
  if (!showUnverified) return null;
  return (
    <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-muted" data-testid="badge-adaptive-unverified">
      Adaptive practice not yet verified by NOSTOPS
    </span>
  );
}

export function CityTeacherCard({ t, showAdaptiveStatus = false }: { t: PublicTeacher; showAdaptiveStatus?: boolean }) {
  const level = tierToLevel(t.tier);
  const formats = formatsOf(t);
  const tradition = t.parampara ? `${titleCase(t.parampara)} tradition` : t.styles[0] ? `${titleCase(t.styles[0])} teacher` : 'Yoga teacher';
  return (
    <Link
      href={`/teachers/${t.handle}`}
      className="card group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md"
      data-testid="city-teacher-card"
    >
      <div className="flex items-start gap-4">
        <Avatar t={t} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-bold text-ink group-hover:text-brand-700">{t.name}</p>
            {t.isVerified ? (
              <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700" data-testid="badge-verified">
                ✓ Verified
              </span>
            ) : t.isEmpanelled ? (
              <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent-600" data-testid="badge-empanelled">
                ★ Empanelled
              </span>
            ) : null}
            <AdaptiveStatus verified={t.adaptiveVerified} showUnverified={showAdaptiveStatus} />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted">
            {[tradition, t.experienceYears ? `${t.experienceYears}y exp` : null, level ? TEACHER_LEVELS[level].levelLabel : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {t.rating ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-accent-600">
              <span aria-hidden>★</span> {t.rating.toFixed(1)}
              {t.reviewsCount ? <span className="font-semibold text-muted"> ({t.reviewsCount})</span> : null}
            </p>
          ) : null}
        </div>
      </div>

      {t.styles.length > 0 && (
        <p className="mt-3 line-clamp-1 text-xs font-semibold text-ink-soft">{t.styles.slice(0, 4).map(titleCase).join(' · ')}</p>
      )}
      {t.specializations.length > 0 && (
        <p className="mt-1 line-clamp-1 text-xs text-muted">{t.specializations.slice(0, 3).map(titleCase).join(' · ')}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        {t.languages.slice(0, 3).map((l) => (
          <span key={l} className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-ink-soft">{l}</span>
        ))}
        {formats.slice(0, 3).map((f) => (
          <span key={f} className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-brand-700">{f}</span>
        ))}
      </div>
    </Link>
  );
}

// ── Filter primitives ────────────────────────────────────────────────────────
function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand hover:text-brand-700'
      }`}
    >
      {children}
      {typeof count === 'number' && (
        <span className={`rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-700'}`}>{count}</span>
      )}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const EXP_BANDS: { v: number; label: string }[] = [
  { v: 3, label: '3+ yrs' },
  { v: 5, label: '5+ yrs' },
  { v: 10, label: '10+ yrs' },
];
const FORMATS: { v: string; label: string }[] = [
  { v: 'online', label: 'Online' },
  { v: 'in_person', label: 'In-person' },
  { v: 'private', label: '1:1 / Private' },
  { v: 'group', label: 'Group' },
  { v: 'corporate', label: 'Corporate' },
];

type State = {
  q: string;
  style: string;
  lineage: string;
  purpose: '' | DimensionId;
  level: 0 | TeacherLevel;
  verified: boolean;
  empanelled: boolean;
  minExp: number;
  language: string;
  format: string;
  spec: string;
};

const EMPTY: State = {
  q: '', style: '', lineage: '', purpose: '', level: 0, verified: false, empanelled: false, minExp: 0, language: '', format: '', spec: '',
};

// ── Discovery ────────────────────────────────────────────────────────────────
// Server-renders EVERY teacher card in the initial HTML (SEO); the filters are
// client-only refinements applied over the same real dataset after hydration.
export default function CityTeacherDiscovery({ teachers, cityLabel }: { teachers: PublicTeacher[]; cityLabel: string }) {
  const [s, setS] = useState<State>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));
  const toggle = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: p[k] === v ? (EMPTY[k] as State[K]) : v }));

  // Facet options derived from the real city set (counts = visible results).
  const opts = useMemo(() => {
    const tally = (rows: string[]) => {
      const m = new Map<string, number>();
      for (const r of rows) if (r) m.set(r, (m.get(r) || 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    };
    const styles = tally(teachers.flatMap((t) => t.styles));
    const lineages = tally(teachers.map((t) => t.parampara || '').filter(Boolean));
    const languages = tally(teachers.flatMap((t) => t.languages));
    const specs = tally(teachers.flatMap((t) => t.specializations));
    const levels = new Set<TeacherLevel>();
    for (const t of teachers) {
      const l = tierToLevel(t.tier);
      if (l) levels.add(l);
    }
    const purposes = DIMENSIONS.map((d) => ({
      d,
      count: teachers.filter((t) => dimensionsOf(t).has(d.id)).length,
    })).filter((p) => p.count > 0);
    return {
      styles,
      lineages,
      languages,
      specs: specs.slice(0, 16),
      levels: [...levels].sort(),
      purposes,
      verifiedCount: teachers.filter((t) => t.isVerified || t.isEmpanelled).length,
      empanelledCount: teachers.filter((t) => t.isEmpanelled).length,
    };
  }, [teachers]);

  const results = useMemo(() => {
    let r = teachers;
    if (s.style) r = r.filter((t) => t.styles.includes(s.style));
    if (s.lineage) r = r.filter((t) => t.parampara === s.lineage);
    if (s.purpose) r = r.filter((t) => dimensionsOf(t).has(s.purpose as DimensionId));
    if (s.level) r = r.filter((t) => tierToLevel(t.tier) === s.level);
    if (s.empanelled) r = r.filter((t) => t.isEmpanelled);
    else if (s.verified) r = r.filter((t) => t.isVerified || t.isEmpanelled);
    if (s.minExp) r = r.filter((t) => (t.experienceYears ?? 0) >= s.minExp);
    if (s.language) r = r.filter((t) => t.languages.includes(s.language));
    if (s.format) {
      r = r.filter((t) =>
        s.format === 'online' ? t.offersOnline
        : s.format === 'in_person' ? t.offersInPerson
        : s.format === 'private' ? t.offersPrivate
        : s.format === 'group' ? t.offersGroup
        : s.format === 'corporate' ? t.offersCorporate
        : true,
      );
    }
    if (s.spec) r = r.filter((t) => t.specializations.includes(s.spec));
    if (s.q.trim()) {
      const n = s.q.trim().toLowerCase();
      r = r.filter((t) =>
        [t.name, t.parampara, ...t.styles, ...t.specializations, ...t.languages].filter(Boolean).join(' ').toLowerCase().includes(n),
      );
    }
    return r;
  }, [teachers, s]);

  const activeCount =
    (s.style ? 1 : 0) + (s.lineage ? 1 : 0) + (s.purpose ? 1 : 0) + (s.level ? 1 : 0) +
    (s.verified || s.empanelled ? 1 : 0) + (s.minExp ? 1 : 0) + (s.language ? 1 : 0) + (s.format ? 1 : 0) + (s.spec ? 1 : 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Filters — sticky sidebar on desktop, collapsible panel on mobile */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="search"
              value={s.q}
              onChange={(e) => set('q', e.target.value)}
              placeholder={`Search teachers in ${cityLabel}`}
              aria-label="Search teachers"
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand"
              data-testid="city-search"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="shrink-0 rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-bold text-ink-soft transition hover:border-brand lg:hidden"
            aria-expanded={showFilters}
            data-testid="city-filters-toggle"
          >
            Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
        </div>

        <div className={`${showFilters ? 'block' : 'hidden'} mt-4 space-y-5 rounded-2xl border border-line bg-white p-4 lg:block`} data-testid="city-filter-panel">
          {(activeCount > 0 || s.q) && (
            <button type="button" onClick={() => setS(EMPTY)} className="text-xs font-bold text-brand-700 hover:underline" data-testid="city-clear-filters">
              Clear all filters
            </button>
          )}

          {/* Status */}
          <Group title="Status">
            <Chip active={s.empanelled} onClick={() => set('empanelled', !s.empanelled)} count={opts.empanelledCount}>Empanelled</Chip>
            <Chip active={s.verified} onClick={() => set('verified', !s.verified)} count={opts.verifiedCount}>Verified</Chip>
          </Group>

          {opts.purposes.length > 0 && (
            <Group title="Yoga by purpose">
              {opts.purposes.map((p) => (
                <Chip key={p.d.id} active={s.purpose === p.d.id} onClick={() => toggle('purpose', p.d.id)} count={p.count}>
                  {p.d.emoji} {p.d.short}
                </Chip>
              ))}
            </Group>
          )}

          {opts.styles.length > 0 && (
            <Group title="Tradition / style">
              {opts.styles.map(([v, c]) => (
                <Chip key={v} active={s.style === v} onClick={() => toggle('style', v)} count={c}>{titleCase(v)}</Chip>
              ))}
            </Group>
          )}

          {opts.lineages.length > 0 && (
            <Group title="Lineage (parampara)">
              {opts.lineages.map(([v, c]) => (
                <Chip key={v} active={s.lineage === v} onClick={() => toggle('lineage', v)} count={c}>{titleCase(v)}</Chip>
              ))}
            </Group>
          )}

          {opts.levels.length > 0 && (
            <Group title="Teacher level">
              {opts.levels.map((l) => (
                <Chip key={l} active={s.level === l} onClick={() => toggle('level', l)}>{TEACHER_LEVELS[l].levelLabel} · {TEACHER_LEVELS[l].badgeLabel}</Chip>
              ))}
            </Group>
          )}

          <Group title="Experience">
            {EXP_BANDS.map((b) => (
              <Chip key={b.v} active={s.minExp === b.v} onClick={() => toggle('minExp', b.v)}>{b.label}</Chip>
            ))}
          </Group>

          <Group title="Teaching format">
            {FORMATS.map((f) => (
              <Chip key={f.v} active={s.format === f.v} onClick={() => toggle('format', f.v)}>{f.label}</Chip>
            ))}
          </Group>

          {opts.languages.length > 0 && (
            <Group title="Language">
              {opts.languages.map(([v, c]) => (
                <Chip key={v} active={s.language === v} onClick={() => toggle('language', v)} count={c}>{v}</Chip>
              ))}
            </Group>
          )}

          {opts.specs.length > 0 && (
            <Group title="Specialisation">
              {opts.specs.map(([v, c]) => (
                <Chip key={v} active={s.spec === v} onClick={() => toggle('spec', v)} count={c}>{titleCase(v)}</Chip>
              ))}
            </Group>
          )}
        </div>
      </aside>

      {/* Results */}
      <div>
        <p className="mb-4 text-sm font-semibold text-ink-soft" aria-live="polite" data-testid="city-result-count">
          {results.length} {results.length === 1 ? 'teacher' : 'teachers'} in {cityLabel}
          {activeCount > 0 ? ' match your filters' : ''}
        </p>
        {results.length === 0 ? (
          <div className="card p-8 text-center" data-testid="city-no-results">
            <p className="text-lg font-bold text-ink">No teachers match these filters.</p>
            <p className="mt-2 text-sm text-muted">Try removing a filter to see more teachers in {cityLabel}.</p>
            <button type="button" onClick={() => setS(EMPTY)} className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((t) => (
              <CityTeacherCard key={t.handle} t={t} showAdaptiveStatus={s.purpose === 'special_needs'} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
