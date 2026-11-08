'use client';

import { useState } from 'react';
import { sendBff } from '@/lib/auth-client';

// Availability switch on the teacher dashboard hero. Optimistically flips, then
// persists via the BFF (PATCH /teachers/me/profile { is_available }). Reverts
// on failure so the UI never lies about the stored state.
export default function AvailabilityToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !on;
    setOn(next);
    setBusy(true);
    const res = await sendBff('/bff/teacher/profile', 'PATCH', { is_available: next });
    if (!res.ok) setOn(!next);
    setBusy(false);
  }

  return (
    <div className="mt-5 flex items-center justify-between rounded-xl border border-line bg-white p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: on ? '#0D9488' : '#94A3B8' }}
        />
        <div>
          <p className="text-sm font-extrabold text-ink">{on ? 'Available for new batches' : 'Unavailable'}</p>
          <p className="text-xs text-muted">{on ? 'Accepting corporate & 1:1 assignments' : 'Not discoverable for new pilots'}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Toggle availability"
        onClick={toggle}
        disabled={busy}
        className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60"
        style={{ backgroundColor: on ? '#0D9488' : '#CBD5E1' }}
      >
        <span
          className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
          style={{ transform: on ? 'translateX(22px)' : 'translateX(4px)' }}
        />
      </button>
    </div>
  );
}
