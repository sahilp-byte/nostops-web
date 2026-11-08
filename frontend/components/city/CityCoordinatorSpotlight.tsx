import { COORDINATOR_ENABLED } from '@/lib/city-coordinator-cities';
import Link from 'next/link';
import type { CityCoordinator } from '@/lib/server/city-coordinator';
import { initials } from '@/lib/format';

function Avatar({ c }: { c: CityCoordinator }) {
  const src = c.avatarUrl
    ? c.avatarUrl
    : c.avatarB64
      ? c.avatarB64.startsWith('data:')
        ? c.avatarB64
        : `data:image/jpeg;base64,${c.avatarB64}`
      : null;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={c.name} width={72} height={72} className="h-16 w-16 shrink-0 rounded-full object-cover" loading="lazy" />;
  }
  return (
    <div aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-50 text-2xl font-black text-brand-700">
      {initials(c.name)}
    </div>
  );
}

// Renders the local City Coordinator's name, story and (if they teach) a link to
// their public profile. PII-safe fields only. Rendered by the city page ONLY when
// getCityCoordinator returns non-null.
export default function CityCoordinatorSpotlight({ coordinator, cityLabel, cityTeacherCount }: { coordinator: CityCoordinator; cityLabel: string; cityTeacherCount?: number }) {
  if (!COORDINATOR_ENABLED) return null;
  const c = coordinator;
  // Prefer the backend-reported figure; fall back to the city's real teacher
  // count (a city coordinator supports the teachers in their city).
  const supportCount = c.teacherCount ?? (cityTeacherCount && cityTeacherCount > 0 ? cityTeacherCount : undefined);
  return (
    <div className="flex flex-col items-start gap-5 rounded-3xl border border-line bg-white p-6 md:flex-row md:items-center md:p-8" data-testid="city-coordinator-spotlight">
      <Avatar c={c} />
      <div className="min-w-0 flex-1">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-700">Your {cityLabel} City Coordinator</span>
        <p className="mt-1 text-xl font-black tracking-tight text-ink">{c.name}</p>
        {supportCount && (
          <span
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-700"
            data-testid="coordinator-count-badge"
          >
            <span aria-hidden>🧑‍🏫</span>
            Supports {supportCount} {supportCount === 1 ? 'teacher' : 'teachers'} in {cityLabel}
          </span>
        )}
        {c.since && (
          <p className="mt-1 text-sm text-muted">Coordinating since {c.since}</p>
        )}
        {c.story && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{c.story}</p>}
        {/* Contact via the existing on-platform NOSTOPS flow — no personal
            contact details are ever exposed. */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {c.teacherHandle && (
            <Link
              href={`/app/teachers/${c.teacherHandle}/book`}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600"
              data-testid="coordinator-connect-cta"
            >
              Connect with {c.name} →
            </Link>
          )}
          {c.teacherHandle && (
            <Link href={`/teachers/${c.teacherHandle}`} className="text-sm font-bold text-brand-700 hover:underline" data-testid="coordinator-profile-link">
              View teacher profile
            </Link>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          Bringing yoga to a studio or company in {cityLabel}?{' '}
          <Link href="/for-organisations" className="font-bold text-brand-700 hover:underline" data-testid="coordinator-corporate-cta">
            Talk to the NOSTOPS team →
          </Link>
        </p>
      </div>
    </div>
  );
}
