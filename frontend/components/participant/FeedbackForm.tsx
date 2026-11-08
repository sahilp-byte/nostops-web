'use client';

import { useState } from 'react';
import { postBff } from '@/lib/auth-client';

export default function FeedbackForm({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle?: string | null;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  async function submit() {
    setErr('');
    if (rating < 1) { setErr('Please pick a rating.'); return; }
    setBusy(true);
    const res = await postBff('/bff/institutional/participant/feedback', { event_id: eventId, rating, comment: comment.trim() || null });
    setBusy(false);
    if (!res.ok) { setErr(res.data?.error || 'Could not submit feedback.'); return; }
    setDone(true);
  }

  if (done) {
    return <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700" data-testid="feedback-thanks">🙏 Thank you for your feedback!</p>;
  }

  return (
    <div className="rounded-xl border border-line bg-cream/60 p-3" data-testid="feedback-form">
      <p className="text-xs font-bold text-ink-soft">How was {eventTitle || 'this session'}?</p>
      <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label="rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n} type="button" aria-label={`${n} star`}
            onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
            className="text-2xl leading-none transition"
            data-testid={`star-${n}`}
          >
            <span className={(hover || rating) >= n ? 'text-amber-400' : 'text-line'}>★</span>
          </button>
        ))}
      </div>
      <textarea
        value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={1000}
        placeholder="Share a few words (optional)"
        className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        data-testid="feedback-comment"
      />
      {err && <p className="mt-2 text-xs font-semibold text-red-600" data-testid="feedback-error">{err}</p>}
      <button
        type="button" onClick={submit} disabled={busy}
        className="mt-2 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
        data-testid="feedback-submit"
      >{busy ? 'Submitting…' : 'Submit feedback'}</button>
    </div>
  );
}
