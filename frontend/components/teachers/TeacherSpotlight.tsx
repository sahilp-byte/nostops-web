'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { titleCase, initials } from '@/lib/format';
import type { PublicTeacher } from '@/components/teachers/TeacherDirectoryGrid';

const ROTATE_MS = 6000;
const MAX_SPOTLIGHT = 5;

// Choose who to spotlight: Council-empanelled teachers first (true to
// "Featured empanelled teacher"); if none are empanelled yet, fall back to
// featured, then verified, then top-rated so the banner is never empty while
// the network has real teachers. Capped so rotation stays tight.
function pickSpotlight(teachers: PublicTeacher[]): PublicTeacher[] {
  const empanelled = teachers.filter((t) => t.isEmpanelled);
  const pool = empanelled.length
    ? empanelled
    : teachers.filter((t) => t.isFeatured || t.isVerified || (t.rating ?? 0) > 0);
  const chosen = (pool.length ? pool : teachers).slice();
  chosen.sort((a, b) => {
    const score = (x: PublicTeacher) => (x.isFeatured ? 4 : 0) + (x.isEmpanelled ? 2 : 0) + (x.isVerified ? 1 : 0);
    const s = score(b) - score(a);
    if (s) return s;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });
  return chosen.slice(0, MAX_SPOTLIGHT);
}

function SpotlightAvatar({ t }: { t: PublicTeacher }) {
  const src = t.avatarUrl
    ? t.avatarUrl
    : t.avatarB64
      ? (t.avatarB64.startsWith('data:') ? t.avatarB64 : `data:image/jpeg;base64,${t.avatarB64}`)
      : null;
  const cls = 'h-24 w-24 shrink-0 rounded-2xl object-cover ring-4 ring-white/20 md:h-28 md:w-28';
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`${t.name} — NOSTOPS yoga teacher`} width={112} height={112} className={cls} loading="lazy" />;
  }
  return (
    <div aria-hidden="true" className={`grid place-items-center bg-white/10 text-3xl font-black text-white ring-4 ring-white/20 ${cls}`}>
      {initials(t.name)}
    </div>
  );
}

export function TeacherSpotlight({ teachers }: { teachers: PublicTeacher[] }) {
  const items = useMemo(() => pickSpotlight(teachers), [teachers]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fade, setFade] = useState(true);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Auto-rotate (paused on hover/focus, when reduced-motion, or a single item).
  useEffect(() => {
    if (paused || reduced.current || items.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, items.length]);

  // Gentle cross-fade when the slide changes.
  useEffect(() => {
    setFade(false);
    const id = requestAnimationFrame(() => setFade(true));
    return () => cancelAnimationFrame(id);
  }, [index]);

  if (items.length === 0) return null;
  const safeIndex = index % items.length;
  const t = items[safeIndex];
  const empanelledSpotlight = t.isEmpanelled;
  const tradition = t.parampara ? `${titleCase(t.parampara)} tradition` : 'Yoga Teacher';
  const location = t.city ? titleCase(t.city) : '';

  const go = (i: number) => setIndex((i + items.length) % items.length);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured teacher spotlight"
      data-testid="teacher-spotlight"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink via-royal to-brand p-6 shadow-lg md:p-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

      <div className="relative flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white/90 backdrop-blur">
          {empanelledSpotlight ? '★ Featured empanelled teacher' : '★ Featured teacher'}
        </span>
        {items.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous featured teacher"
              onClick={() => go(safeIndex - 1)}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/25 text-white transition hover:bg-white/15"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clipRule="evenodd" /></svg>
            </button>
            <button
              type="button"
              aria-label="Next featured teacher"
              onClick={() => go(safeIndex + 1)}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/25 text-white transition hover:bg-white/15"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" /></svg>
            </button>
          </div>
        )}
      </div>

      <div className={`relative mt-5 flex flex-col gap-5 transition-opacity duration-500 sm:flex-row sm:items-center ${fade ? 'opacity-100' : 'opacity-0'}`}>
        <SpotlightAvatar t={t} />
        <div className="min-w-0 flex-1">
          <h3 className="text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">
            <Link href={`/teachers/${t.handle}`} className="rounded-sm outline-none transition hover:text-white/90 focus-visible:underline">
              {t.name}
            </Link>
          </h3>
          <p className="mt-1 text-sm font-semibold text-white/80">{tradition}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-white/70">
            {t.experienceYears ? <span>{t.experienceYears} yrs teaching</span> : null}
            {location ? <span>{location}</span> : null}
            {t.rating ? (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true" className="text-amber-300">★</span>
                {t.rating.toFixed(1)}{t.reviewsCount ? ` (${t.reviewsCount})` : ''}
              </span>
            ) : null}
          </div>
          {t.styles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {t.styles.slice(0, 4).map((s) => (
                <span key={s} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/15">{titleCase(s)}</span>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0">
          <Link
            href={`/teachers/${t.handle}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white px-5 py-3 text-sm font-black text-ink shadow transition hover:bg-cream"
          >
            View profile
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" /></svg>
          </Link>
        </div>
      </div>

      {items.length > 1 && (
        <div className="relative mt-5 flex items-center gap-2">
          {items.map((it, i) => (
            <button
              key={it.handle}
              type="button"
              aria-label={`Show featured teacher ${i + 1} of ${items.length}`}
              aria-current={i === safeIndex ? 'true' : undefined}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all ${i === safeIndex ? 'w-6 bg-white' : 'w-2 bg-white/30 hover:bg-white/50'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
