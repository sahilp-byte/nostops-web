import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTeacherProfile } from '@/lib/server/teacher-profile';
import { getReviews, type Review, type ReviewStats } from '@/lib/server/reviews';
import { getSessionUser } from '@/lib/server/session';
import { displayName } from '@/lib/roles';
import { inr, initials } from '@/lib/format';
import FavoriteButton from '@/components/app/learner/FavoriteButton';
import ReviewComposer from '@/components/app/learner/ReviewComposer';
import TrustStrip from '@/components/teachers/TrustStrip';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const p = await getTeacherProfile(handle);
  return {
    title: p ? p.name : 'Teacher',
    robots: { index: false, follow: false },
  };
}

function Avatar({ name, url, b64 }: { name: string; url?: string | null; b64?: string | null }) {
  const src = url ? url : b64 ? (b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`) : null;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote avatar URL / data URI, no next/image loader
      <img
        src={src}
        alt={`${name} — NOSTOPS yoga teacher`}
        width={88}
        height={88}
        className="h-22 w-22 shrink-0 rounded-2xl object-cover"
      />
    );
  }
  return (
    <div aria-hidden="true" className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-brand-50 text-2xl font-black text-brand-700">
      {initials(name)}
    </div>
  );
}

function Chips({ items, tone = 'cream' }: { items: string[]; tone?: 'cream' | 'brand' }) {
  if (items.length === 0) return null;
  const cls = tone === 'brand' ? 'bg-brand-50 text-brand-700' : 'bg-cream text-ink-soft';
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((s) => (
        <span key={s} className={`rounded-full px-3 py-1 text-sm font-medium ${cls}`}>
          {s}
        </span>
      ))}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span aria-hidden="true" className="text-accent-600">
      {'★'.repeat(Math.max(0, Math.min(5, full)))}
      <span className="text-line">{'★'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  );
}

function ReviewsSection({
  reviews,
  stats,
  fallbackRating,
  fallbackCount,
  teacherFirstName,
  composer,
}: {
  reviews: Review[];
  stats: ReviewStats;
  fallbackRating?: number;
  fallbackCount?: number;
  teacherFirstName: string;
  composer: React.ReactNode;
}) {
  const avg = stats.avg > 0 ? stats.avg : fallbackRating || 0;
  const count = stats.count > 0 ? stats.count : fallbackCount || 0;
  const dist: Array<[number, number]> = [
    [5, stats.five],
    [4, stats.four],
    [3, stats.three],
    [2, stats.two],
    [1, stats.one],
  ];
  const distTotal = dist.reduce((n, [, c]) => n + c, 0);

  if (avg <= 0 && count <= 0 && reviews.length === 0) {
    return (
      <section className="card p-6">
        <h2 className="text-lg font-extrabold tracking-tight text-ink">Reviews</h2>
        {composer}
        <p className="mt-1 text-sm text-muted">
          {teacherFirstName} doesn&apos;t have any reviews yet. Be the first to practise and share your experience.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-extrabold tracking-tight text-ink">Reviews</h2>
      {composer}

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="text-center sm:w-32">
          <div className="text-4xl font-black text-ink">{avg.toFixed(1)}</div>
          <div className="mt-1 text-lg">
            <Stars value={avg} />
          </div>
          <div className="mt-1 text-xs font-semibold text-muted">
            {count} {count === 1 ? 'rating' : 'ratings'}
          </div>
        </div>
        {distTotal > 0 && (
          <div className="flex-1 space-y-1.5">
            {dist.map(([star, c]) => (
              <div key={star} className="flex items-center gap-2">
                <span className="w-8 text-xs font-semibold text-muted">{star}★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-cream">
                  <span
                    className="block h-full rounded-full bg-accent-600"
                    style={{ width: `${distTotal ? (c / distTotal) * 100 : 0}%` }}
                  />
                </span>
                <span className="w-6 text-right text-xs text-muted">{c}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {reviews.length > 0 ? (
        <ul className="mt-6 list-none space-y-4 p-0">
          {reviews.map((r, i) => (
            <li key={r.id || i} className="border-t border-line pt-4 first:border-0 first:pt-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink">{r.author}</span>
                {typeof r.rating === 'number' && (
                  <span className="text-sm">
                    <Stars value={r.rating} />
                  </span>
                )}
              </div>
              {r.text && <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{r.text}</p>}
              {r.reply && (
                <p className="mt-2 rounded-lg bg-cream px-3 py-2 text-sm text-ink-soft">
                  <span className="font-semibold text-brand-700">Teacher&apos;s reply:</span> {r.reply}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">Written reviews will appear here as learners share their experience.</p>
      )}
    </section>
  );
}

export default async function AppTeacherProfilePage({ params }: Params) {
  const { handle } = await params;
  const [p, reviewsData, user] = await Promise.all([getTeacherProfile(handle), getReviews(handle), getSessionUser()]);
  if (!p) notFound();

  const location = [p.city, p.state].filter((x) => x && x !== p.country).join(', ') || p.city || p.country;
  const offerTags = [
    p.offers.online && 'Online',
    p.offers.privateSession && '1:1 Private',
    p.offers.group && 'Group classes',
    p.offers.corporate && 'Corporate',
  ].filter(Boolean) as string[];

  const favSnapshot = {
    handle: p.handle,
    name: p.name,
    city: p.city,
    parampara: p.paramparaLabel,
    rating: p.rating,
    avatarUrl: p.avatarUrl,
    avatarB64: p.avatarB64,
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/discover" className="text-sm font-bold text-brand-700 hover:underline">
        ‹ Back to discover
      </Link>

      {/* Header */}
      <section className="mt-4 rounded-2xl border border-line bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar name={p.name} url={p.avatarUrl} b64={p.avatarB64} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{p.name}</h1>
            <p className="mt-1.5 text-ink-soft">
              {p.paramparaLabel ? `${p.paramparaLabel} tradition` : 'Yoga Teacher'}
              {location ? ` · ${location}` : ''}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {p.isEmpanelled && (
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent-600">Empanelled</span>
              )}
              {p.isVerified && (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">Verified</span>
              )}
              {p.badges.map((b) => (
                <span key={b} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-soft ring-1 ring-line">
                  {b}
                </span>
              ))}
              {p.experienceYears ? (
                <span className="text-sm font-semibold text-muted">{p.experienceYears} yrs experience</span>
              ) : null}
              {p.rating ? (
                <span className="text-sm font-semibold text-ink-soft">
                  ★ {p.rating.toFixed(1)}
                  {p.reviewsCount ? ` (${p.reviewsCount} reviews)` : ''}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FavoriteButton teacher={favSnapshot} showLabel />
          </div>
        </div>
      </section>

      {/* Trust Strip — consolidated verification signals (Verified/Empanelled only) */}
      {(p.isVerified || p.isEmpanelled || p.idChecked) && (
        <div className="mt-6">
          <TrustStrip
            isVerified={p.isVerified}
            isEmpanelled={p.isEmpanelled}
            idChecked={p.idChecked}
            experienceYears={p.experienceYears}
            rating={p.rating}
            reviewsCount={p.reviewsCount}
            lineage={p.paramparaLabel}
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {/* Main */}
        <div className="space-y-8 md:col-span-2">
          {p.bio && (
            <section className="card p-6">
              <h2 className="text-lg font-extrabold tracking-tight text-ink">About {p.name.split(' ')[0]}</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-soft">{p.bio}</p>
            </section>
          )}

          {(p.paramparaLabel || p.paramparaFounder || p.paramparaWords) && (
            <section className="card p-6">
              <h2 className="text-lg font-extrabold tracking-tight text-ink">Lineage &amp; tradition</h2>
              {p.paramparaLabel && <p className="mt-3 font-bold text-ink">{p.paramparaLabel} Parampara</p>}
              {p.paramparaFounder && <p className="mt-1 text-sm text-muted">Founder: {p.paramparaFounder}</p>}
              {p.paramparaWords && <p className="mt-2 text-sm text-ink-soft">{p.paramparaWords}</p>}
              <p className="mt-3 text-sm leading-relaxed text-muted">
                As a NOSTOPS teacher, {p.name.split(' ')[0]} carries forward a living tradition rooted in the
                Guru–Shishya Parampara.
              </p>
            </section>
          )}

          {(p.styles.length > 0 || p.specializations.length > 0) && (
            <section className="card p-6">
              <h2 className="text-lg font-extrabold tracking-tight text-ink">Teaching &amp; expertise</h2>
              {p.styles.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Styles</h3>
                  <Chips items={p.styles} />
                </div>
              )}
              {p.specializations.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Specialisations</h3>
                  <Chips items={p.specializations} tone="brand" />
                </div>
              )}
            </section>
          )}

          <ReviewsSection
            reviews={reviewsData.reviews}
            stats={reviewsData.stats}
            fallbackRating={p.rating}
            fallbackCount={p.reviewsCount}
            teacherFirstName={p.name.split(' ')[0]}
            composer={<ReviewComposer handle={p.handle} defaultName={displayName(user)} />}
          />
        </div>

        {/* Sessions sidebar */}
        <aside className="space-y-6 md:sticky md:top-20 md:self-start">
          <div className="card p-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">1:1 Session</h2>
            {p.premium ? (
              <>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-ink">₹{inr(p.premium.rateInr)}</span>
                  {p.premium.durationMin ? <span className="text-sm text-muted">/ {p.premium.durationMin} min</span> : null}
                </div>
                {p.premium.description && <p className="mt-2 text-sm text-muted">{p.premium.description}</p>}
                <Link
                  href={`/app/teachers/${p.handle}/book`}
                  className="mt-4 flex min-h-[46px] w-full items-center justify-center rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-600"
                >
                  Book a 1:1 session
                </Link>
                {p.timeZone && <p className="mt-2 text-center text-xs text-muted">Times shown in {p.timeZone}</p>}
              </>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-ink-soft">This teacher hasn&apos;t published 1:1 pricing yet.</p>
                <p className="mt-1 text-sm text-muted">Check their group and online offerings below.</p>
              </div>
            )}

            {offerTags.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Also offers</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {offerTags.map((t) => (
                    <span key={t} className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink-soft">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {p.languages.length > 0 && (
            <div className="card p-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Languages</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.languages.map((l) => (
                  <span key={l} className="rounded-full bg-white px-3 py-1 text-sm font-medium text-ink-soft ring-1 ring-line">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {p.sampleVideoUrl && (
            <a
              href={p.sampleVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-line bg-white p-4 text-center text-sm font-bold text-brand-700 hover:border-brand"
            >
              ▶ Watch intro video
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}
