'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

export default function ReviewComposer({ handle, defaultName }: { handle: string; defaultName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(searchParams.get('review') === '1');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [name, setName] = useState(defaultName || '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) return setError('Please tap a star to rate your experience.');
    if (text.trim().length < 10) return setError('Please write at least 10 characters.');
    if (name.trim().length < 2) return setError('Please enter your name.');
    setBusy(true);
    const res = await sendBff(`/bff/reviews/${handle}`, 'POST', {
      rating,
      text: text.trim(),
      reviewer_name: name.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      setError((res.data as any)?.error || 'Could not submit your review. Please try again.');
      return;
    }
    setDone(true);
    setOpen(false);
    setText('');
    setRating(0);
    router.refresh(); // re-render the server Reviews section with the new review
  }

  if (done) {
    return (
      <div className="mb-5 rounded-xl border border-brand/20 bg-brand-50/50 p-4 text-sm font-semibold text-brand-700">
        🙏 Thank you — your review has been published.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-5 rounded-xl border border-brand bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
      >
        ✍️ Write a review
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mb-6 rounded-xl border border-line bg-cream/40 p-4">
      <p className="text-sm font-bold text-ink">Share your experience</p>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            aria-label={`${s} star${s > 1 ? 's' : ''}`}
            aria-checked={rating === s}
            role="radio"
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(s)}
            className="text-3xl leading-none transition"
          >
            <span className={(hover || rating) >= s ? 'text-accent-600' : 'text-line'}>★</span>
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="What was your session like? (min 10 characters)"
        className="mt-3 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50"
      />
      <div className="mt-1 text-right text-xs text-muted">{text.length}/500</div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50"
      />

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {busy ? 'Posting…' : 'Post review'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
