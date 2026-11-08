'use client';

import { useEffect, useRef, useState } from 'react';

// A teacher's PRIVATE practice note for a past session with a student. Stored
// ONLY on this device (localStorage) and never transmitted anywhere — a
// deliberate Teacher-First / anti-poaching choice: a student's practice detail
// belongs to their teacher alone and must not become platform-shared data.
const KEY = (bookingId: string) => `nostops.practicenote.v1.${bookingId}`;

export default function PracticeNote({ bookingId, studentName }: { bookingId: string; studentName: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState<'idle' | 'saved'>('idle');
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY(bookingId)) || '';
      setValue(v);
      if (v) setOpen(true);
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, [bookingId]);

  function save() {
    try {
      localStorage.setItem(KEY(bookingId), value);
      setSaved('saved');
      setTimeout(() => setSaved('idle'), 1800);
    } catch {
      /* ignore quota errors */
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="practice-note-open"
        className="mt-3 text-xs font-bold text-brand-700 hover:underline"
      >
        ＋ Add a private practice note
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-cream/40 p-3" data-testid="practice-note">
      <label htmlFor={`pn-${bookingId}`} className="block text-xs font-extrabold text-ink">
        Private note · {studentName.split(' ')[0]}
      </label>
      <textarea
        id={`pn-${bookingId}`}
        value={value}
        onChange={(e) => { setValue(e.target.value); setSaved('idle'); }}
        rows={3}
        maxLength={1000}
        placeholder="Postures worked on, what to focus on next time, any care notes…"
        className="mt-1.5 w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        data-testid="practice-note-input"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted">🔒 Saved on this device · private to you</p>
        <button
          type="button"
          onClick={save}
          data-testid="practice-note-save"
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600"
        >
          {saved === 'saved' ? 'Saved ✓' : 'Save note'}
        </button>
      </div>
    </div>
  );
}
