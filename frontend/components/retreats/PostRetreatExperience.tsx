'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sendBff } from '@/lib/auth-client';
import { getRetreatReview, saveRetreatReview } from '@/lib/retreat-reviews';
import CopyLinkButton from '@/components/CopyLinkButton';
import { retreatPath } from '@/lib/retreat-url';

export type MiniRetreat = { id: string; title: string; city?: string; state?: string; startDate?: string; coverImage?: string | null };
export type PostRetreatData = {
  id: string;
  title: string;
  guruName?: string;
  guruHandle?: string;
  city?: string;
  state?: string;
  venueName?: string;
  coverImage?: string | null;
  images: string[];
  endDate?: string;
  shareUrl: string;
  waTeacherUrl?: string;
};

function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          aria-label={`${s} star${s > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
          className="text-2xl leading-none"
        >
          <span className={(hover || value) >= s ? 'text-accent-600' : 'text-line'}>★</span>
        </button>
      ))}
    </div>
  );
}

// A single, self-contained review card. Each dimension (teacher / retreat / venue) is
// its own card and its own record — never merged (PROMPT 43).
function ReviewCard({
  testid,
  eyebrow,
  title,
  hint,
  submitLabel,
  initialRating,
  initialText,
  submitted,
  onSubmit,
}: {
  testid: string;
  eyebrow: string;
  title: string;
  hint: string;
  submitLabel: string;
  initialRating: number;
  initialText: string;
  submitted: boolean;
  onSubmit: (rating: number, text: string) => Promise<string | null>;
}) {
  const [rating, setRating] = useState(initialRating);
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(submitted);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setErr(null);
    if (rating < 1) return setErr('Tap a star to rate.');
    if (text.trim().length < 10) return setErr('Please write at least 10 characters.');
    setBusy(true);
    const e = await onSubmit(rating, text.trim());
    setBusy(false);
    if (e) setErr(e);
    else setDone(true);
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5" data-testid={testid}>
      <p className="text-[11px] font-black uppercase tracking-wide text-muted">{eyebrow}</p>
      <h3 className="mt-0.5 text-base font-black text-ink">{title}</h3>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
      {done ? (
        <p className="mt-3 rounded-xl bg-brand-50/60 px-3 py-2 text-sm font-semibold text-brand-700">🙏 Thank you — your review is saved.</p>
      ) : (
        <>
          <Stars value={rating} onChange={setRating} label={title} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Share a few honest words (min 10 characters)"
            className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50"
          />
          {err && <p role="alert" className="mt-1 text-xs font-semibold text-red-600">{err}</p>}
          <button type="button" onClick={go} disabled={busy} className="mt-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
            {busy ? 'Saving…' : submitLabel}
          </button>
        </>
      )}
    </div>
  );
}

function MiniCard({ r }: { r: MiniRetreat }) {
  return (
    <Link href={retreatPath(r)} className="block rounded-2xl border border-line bg-white p-4 transition hover:border-brand hover:shadow-sm">
      <p className="font-black text-ink">{r.title}</p>
      <p className="mt-0.5 text-xs text-muted">{[r.city, r.state].filter(Boolean).join(', ')}</p>
    </Link>
  );
}

export default function PostRetreatExperience({
  data,
  completed,
  teacherNext,
  future,
  reviewerName,
}: {
  data: PostRetreatData;
  completed: boolean;
  teacherNext: MiniRetreat[];
  future: MiniRetreat[];
  reviewerName: string;
}) {
  const [rev, setRev] = useState<{ retreatRating?: number; retreatText?: string; venueRating?: number; venueText?: string; teacherSubmitted?: boolean }>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const r = getRetreatReview(data.id);
    if (r) setRev({ retreatRating: r.retreatRating, retreatText: r.retreatText, venueRating: r.venueRating, venueText: r.venueText, teacherSubmitted: r.teacherSubmitted });
    setHydrated(true);
  }, [data.id]);

  const endDateStr = data.endDate ? new Date(data.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div className="mx-auto max-w-3xl space-y-8" data-testid="post-retreat-experience">
      {/* Thank you */}
      <section className="rounded-3xl bg-gradient-to-br from-brand-700 via-ink to-royal p-8 text-white">
        <span className="text-3xl" aria-hidden>🙏</span>
        <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Thank you for practising with us</h1>
        <p className="mt-2 max-w-xl text-white/85">
          We hope <span className="font-bold text-white">{data.title}</span>
          {data.guruName ? ` with ${data.guruName}` : ''} left you lighter and more rooted.
          {completed ? ' Your reflections help the whole community.' : ''}
        </p>
      </section>

      {/* Reviews — three distinct dimensions, never merged */}
      <section>
        <h2 className="text-xl font-black tracking-tight text-ink">Share your experience</h2>
        <p className="mt-1 text-sm text-muted">Three separate reflections — a teacher&apos;s teaching, the retreat itself, and the venue&apos;s hospitality are rated independently.</p>
        {!completed ? (
          <div className="mt-4 rounded-2xl border border-line bg-cream/50 p-6 text-center" data-testid="review-locked">
            <p className="font-bold text-ink">Reviews open after your retreat finishes{endDateStr ? ` on ${endDateStr}` : ''}.</p>
            <p className="mt-1 text-sm text-ink-soft">Come back once you&apos;ve experienced it — only real participants review.</p>
          </div>
        ) : !hydrated ? (
          <div className="mt-4 h-24 animate-pulse rounded-2xl bg-cream" />
        ) : (
          <div className="mt-4 grid gap-3">
            {data.guruHandle && (
              <ReviewCard
                testid="review-teacher"
                eyebrow="Teaching"
                title={`${data.guruName || 'Your teacher'}'s teaching`}
                hint="How was the teaching — presence, clarity, care? (kept separate from the venue)"
                submitLabel="Post teacher review"
                initialRating={0}
                initialText=""
                submitted={!!rev.teacherSubmitted}
                onSubmit={async (rating, text) => {
                  const res = await sendBff(`/bff/reviews/${data.guruHandle}`, 'POST', { rating, text, reviewer_name: reviewerName || 'A seeker' });
                  if (!res.ok) return (res.data as any)?.error || 'Could not post your teacher review.';
                  saveRetreatReview(data.id, { teacherSubmitted: true });
                  return null;
                }}
              />
            )}
            <ReviewCard
              testid="review-retreat"
              eyebrow="The retreat"
              title="The retreat overall"
              hint="Pace, flow, the experience as a whole."
              submitLabel="Save retreat review"
              initialRating={rev.retreatRating || 0}
              initialText={rev.retreatText || ''}
              submitted={typeof rev.retreatRating === 'number' && rev.retreatRating > 0}
              onSubmit={async (rating, text) => {
                saveRetreatReview(data.id, { retreatRating: rating, retreatText: text });
                return null;
              }}
            />
            {data.venueName && (
              <ReviewCard
                testid="review-venue"
                eyebrow="The venue"
                title={`${data.venueName} — stay & hospitality`}
                hint="Rooms, food, cleanliness, the setting (kept separate from the teaching)."
                submitLabel="Save venue review"
                initialRating={rev.venueRating || 0}
                initialText={rev.venueText || ''}
                submitted={typeof rev.venueRating === 'number' && rev.venueRating > 0}
                onSubmit={async (rating, text) => {
                  saveRetreatReview(data.id, { venueRating: rating, venueText: text });
                  return null;
                }}
              />
            )}
          </div>
        )}
      </section>

      {/* Media */}
      {data.images.length > 0 && (
        <section data-testid="post-retreat-media">
          <h2 className="text-xl font-black tracking-tight text-ink">Moments</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.images.slice(0, 6).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={`${data.title} moment ${i + 1}`} className="aspect-square w-full rounded-xl object-cover" />
            ))}
          </div>
        </section>
      )}

      {/* Save teacher + share */}
      <section className="rounded-2xl border border-line bg-cream/40 p-5" data-testid="post-retreat-actions">
        <div className="flex flex-wrap items-center gap-3">
          {data.guruHandle && (
            <Link href={`/teachers/${data.guruHandle}`} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600" data-testid="save-teacher">
              ❤️ Follow {data.guruName || 'your teacher'}
            </Link>
          )}
          <CopyLinkButton path={retreatPath(data)} label="Copy link" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:border-brand hover:text-brand-700" />
          <a href={`https://wa.me/?text=${encodeURIComponent(`I just did ${data.title}${data.guruName ? ` with ${data.guruName}` : ''} on NOSTOPS 🙏 ${data.shareUrl}`)}`} target="_blank" rel="noopener noreferrer" data-testid="share-experience" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:border-brand">Share on WhatsApp →</a>
        </div>
      </section>

      {/* Teacher's next retreat */}
      {teacherNext.length > 0 && (
        <section data-testid="teacher-next-retreat">
          <h2 className="text-xl font-black tracking-tight text-ink">{data.guruName ? `${data.guruName}'s next retreat` : 'Your teacher’s next retreat'}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">{teacherNext.map((r) => <MiniCard key={r.id} r={r} />)}</div>
        </section>
      )}

      {/* Future retreats */}
      {future.length > 0 && (
        <section data-testid="future-retreats">
          <h2 className="text-xl font-black tracking-tight text-ink">More retreats you might love</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{future.map((r) => <MiniCard key={r.id} r={r} />)}</div>
          <Link href="/retreats" className="mt-3 inline-block text-sm font-bold text-brand-700 hover:underline">Browse all retreats →</Link>
        </section>
      )}
    </div>
  );
}
