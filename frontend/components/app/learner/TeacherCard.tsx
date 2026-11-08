import Link from 'next/link';
import { titleCase, initials, inr } from '@/lib/format';
import { tierToLevel, TEACHER_LEVELS } from '@/lib/teacher-levels';
import type { PublicTeacher } from '@/lib/teacher';
import TrustStrip from '@/components/teachers/TrustStrip';
import { AdaptiveStatus } from '@/components/city/CityTeacherDiscovery';

function Avatar({ t }: { t: PublicTeacher }) {
  const src = t.avatarUrl
    ? t.avatarUrl
    : t.avatarB64
      ? t.avatarB64.startsWith('data:')
        ? t.avatarB64
        : `data:image/jpeg;base64,${t.avatarB64}`
      : null;
  if (src) {
    // Plain <img> keeps this a pure server component (no next/image config).
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote avatar URL / data URI, no next/image loader
      <img
        src={src}
        alt={`${t.name} — NOSTOPS yoga teacher`}
        width={56}
        height={56}
        className="h-14 w-14 shrink-0 rounded-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-50 text-lg font-black text-brand-700"
    >
      {initials(t.name)}
    </div>
  );
}

const MODE_LABELS: Array<[keyof PublicTeacher, string]> = [
  ['offersOnline', 'Online'],
  ['offersPrivate', '1:1'],
  ['offersGroup', 'Group'],
  ['offersCorporate', 'Corporate'],
];

/** Reusable learner-facing teacher card. `href` points at the teacher profile;
 *  a stretched overlay link makes the whole card tap through to the profile,
 *  while the "Book 1:1" action links straight to booking. `international` adds a
 *  note for seekers outside India: the fee is in ₹ and needs an India billing address
 *  for now (no converted $ figure is shown — there is no approved USD price). */
export default function TeacherCard({ t, href, bookHref: bookOverride, international = false, showAdaptiveStatus = false }: { t: PublicTeacher; href: string; bookHref?: string; international?: boolean; showAdaptiveStatus?: boolean }) {
  const modes = MODE_LABELS.filter(([k]) => t[k]).map(([, label]) => label);
  const canBook = !!t.rateInr;
  // Public pages pass a profile href under /teachers but booking always lives
  // in the app (/app/teachers/{handle}/book), so they supply bookHref.
  const bookHref = bookOverride || `${href}/book`;

  return (
    <div className="card group relative flex h-full flex-col p-5 transition hover:border-brand hover:shadow-md">
      {/* Stretched overlay: tapping anywhere on the card opens the full profile. */}
      <Link href={href} aria-label={`View ${t.name}'s profile`} className="absolute inset-0 z-0 rounded-2xl" />

      <div className="flex items-center gap-4">
        <Avatar t={t} />
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-ink group-hover:text-brand-700">{t.name}</h3>
          <p className="truncate text-sm text-muted">
            {t.parampara ? titleCase(t.parampara) : 'Yoga Teacher'}
            {t.city ? ` · ${t.city}` : ''}
          </p>
        </div>
      </div>

      {(t.isEmpanelled || t.isVerified || t.hasPremium || tierToLevel(t.tier)) && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tierToLevel(t.tier) && (
            <span className="rounded-full bg-royal-50 px-2.5 py-1 text-xs font-bold text-royal">{TEACHER_LEVELS[tierToLevel(t.tier)!].levelLabel}</span>
          )}
          {t.isEmpanelled || t.isVerified ? (
            <TrustStrip variant="compact" isVerified={t.isVerified} isEmpanelled={t.isEmpanelled} />
          ) : null}
          {t.hasPremium && (
            <span className="rounded-full bg-cream px-2.5 py-1 text-xs font-semibold text-ink-soft">Premium 1:1</span>
          )}
        </div>
      )}

      {(t.adaptiveVerified || showAdaptiveStatus) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <AdaptiveStatus verified={t.adaptiveVerified} showUnverified={showAdaptiveStatus} />
        </div>
      )}

      {t.styles.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {t.styles.slice(0, 3).map((s) => (
            <span key={s} className="rounded-full bg-cream px-2.5 py-1 text-xs font-medium text-ink-soft">
              {s}
            </span>
          ))}
        </div>
      )}

      {modes.length > 0 && <p className="mt-3 text-xs font-semibold text-muted">{modes.join(' · ')}</p>}
      {t.experienceYears ? (
        <p className="mt-1 text-xs font-semibold text-muted" data-testid="card-experience">{t.experienceYears} yrs teaching</p>
      ) : null}

      <div className="mt-auto flex items-end justify-between pt-4">
        <div className="min-w-0">
          {canBook ? (
            <>
              <p className="text-lg font-black leading-tight text-ink">
                ₹{inr(t.rateInr!)}
                {t.durationMin ? <span className="text-xs font-semibold text-muted"> · {t.durationMin}min</span> : null}
              </p>
              {international && (
                <p className="text-xs font-semibold text-muted" data-testid="card-intl-note">Paid in ₹ · India billing address only for now</p>
              )}
            </>
          ) : (
            <span className="text-xs font-semibold text-muted">Fee on profile</span>
          )}
        </div>
        {t.rating ? (
          <span className="text-xs font-bold text-accent-600" data-testid="discover-teacher-rating">
            ★ {t.rating.toFixed(1)}
            {t.reviewsCount ? <span className="font-semibold text-muted"> ({t.reviewsCount})</span> : null}
          </span>
        ) : null}
      </div>

      <div className="relative z-10 mt-3 flex items-center justify-between gap-2">
        {canBook ? (
          <Link
            href={bookHref}
            data-testid="card-book"
            className="inline-flex items-center gap-1 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600"
          >
            Book a session →
          </Link>
        ) : (
          <span />
        )}
        <span className="pointer-events-none text-xs font-semibold text-brand-700 opacity-80">Tap card for full profile</span>
      </div>
    </div>
  );
}
