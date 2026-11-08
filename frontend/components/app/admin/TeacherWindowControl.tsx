'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

// §5 — admin control for the configurable teacher offer response window. After
// this many hours an unanswered PROPOSED offer auto-expires, the teacher is
// released and the engine re-offers to the next eligible teacher.
export default function TeacherWindowControl({ current, isDefault }: { current: number; isDefault: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(String(current));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  async function save() {
    setErr(''); setSaved(false);
    const hours = Number(value);
    if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
      setErr('Enter a whole number of hours between 1 and 720.');
      return;
    }
    setBusy(true);
    const res = await sendBff('/bff/institutional/admin/settings', 'PATCH', { teacher_response_window_hours: hours });
    setBusy(false);
    if (!res.ok) { setErr(res.data?.error || 'Could not update.'); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4" data-testid="teacher-window-control">
      <p className="text-sm font-black text-ink">Teacher offer response window</p>
      <p className="mt-1 text-xs text-muted">
        How long a teacher has to accept an offer before it auto-expires and re-offers to the next teacher.
        {isDefault && <span className="ml-1 italic">Currently using the default.</span>}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="number" min={1} max={720} value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false); }}
          data-testid="teacher-window-input"
          className="w-24 rounded-xl border border-line px-3 py-2 text-sm font-bold text-ink focus:border-brand focus:outline-none"
        />
        <span className="text-sm font-semibold text-ink-soft">hours</span>
        <button
          type="button" onClick={save} disabled={busy}
          data-testid="teacher-window-save"
          className="min-h-[44px] rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >{busy ? 'Saving…' : 'Save'}</button>
        {saved && <span className="text-xs font-bold text-emerald-700" data-testid="teacher-window-saved">✓ Saved</span>}
      </div>
      {err && <p className="mt-2 text-xs font-semibold text-red-600" data-testid="teacher-window-error">{err}</p>}
    </div>
  );
}
