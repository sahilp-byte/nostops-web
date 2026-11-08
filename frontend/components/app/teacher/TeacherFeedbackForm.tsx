'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// §12 — teacher's post-delivery feedback on the programme. Feeds the Council
// quality layer only; never shown to participants.
export default function TeacherFeedbackForm({
  eventId,
  initialRating,
  initialComment,
}: {
  eventId: string;
  initialRating?: number;
  initialComment?: string | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(initialRating || 0);
  const [comment, setComment] = useState<string>(initialComment || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(!!initialRating);

  async function save() {
    setErr('');
    if (rating < 1) { setErr('Pick a rating from 1 to 5.'); return; }
    setBusy(true);
    const res = await postBff('/bff/institutional/teacher/feedback', { event_id: eventId, rating, comment });
    setBusy(false);
    if (!res.ok) { setErr(res.data?.error || 'Could not save your feedback.'); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5" data-testid="teacher-feedback-form">
      <p className="text-xs text-muted">Shared privately with the NOSTOPS Council to improve the programme — never shown to participants.</p>
      <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Programme rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n} type="button" onClick={() => { setRating(n); setSaved(false); }}
            data-testid={`tf-star-${n}`} aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className={`min-h-[40px] min-w-[40px] text-2xl transition ${n <= rating ? 'text-amber-500' : 'text-line hover:text-amber-300'}`}
          >★</button>
        ))}
      </div>
      <textarea
        value={comment} onChange={(e) => { setComment(e.target.value); setSaved(false); }}
        data-testid="tf-comment" rows={3} maxLength={2000}
        placeholder="How did the programme land? Venue, cohort engagement, pacing, anything the Council should know…"
        className="mt-3 w-full rounded-xl border border-line bg-cream/40 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
      />
      {err && <p className="mt-2 text-sm font-semibold text-red-600" data-testid="tf-error">{err}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button" onClick={save} disabled={busy}
          data-testid="tf-save"
          className="min-h-[44px] rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >{busy ? 'Saving…' : saved ? 'Update feedback' : 'Submit feedback'}</button>
        {saved && !busy && <span className="text-sm font-semibold text-emerald-700" data-testid="tf-saved">Saved ✓</span>}
      </div>
    </div>
  );
}
