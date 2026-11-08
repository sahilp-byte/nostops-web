'use client';

import { useState } from 'react';
import { sendBff } from '@/lib/auth-client';

export default function StopClaimReminders({ token, name, initiallyStopped }: { token: string; name: string; initiallyStopped: boolean }) {
  const [stopped, setStopped] = useState(initiallyStopped);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function stop() {
    setBusy(true);
    setError('');
    const r = await sendBff<{ stopped?: boolean; error?: string }>('/bff/discovery/claim-reminders/stop', 'POST', { token });
    setBusy(false);
    if (r.ok) setStopped(true);
    else setError(r.data?.error || 'Could not update your reminders. Please try again.');
  }

  if (stopped) {
    return (
      <div data-testid="claim-reminders-stopped">
        <p className="text-4xl" aria-hidden>🙏</p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">Reminders stopped</h1>
        <p className="mt-2 text-ink-soft">
          We won&apos;t send more “finish your profile” emails about {name || 'your listing'}. Your claim stays safe — finish
          your profile whenever you are ready.
        </p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-ink">Stop profile reminders?</h1>
      <p className="mt-2 text-ink-soft">
        We send up to three short reminders to finish your NOSTOPS teacher profile for {name || 'your listing'}.
      </p>
      <button
        type="button"
        onClick={stop}
        disabled={busy}
        className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
        data-testid="claim-reminders-stop"
      >
        {busy ? 'Stopping…' : 'Stop the reminders'}
      </button>
      {error && <p className="mt-3 text-sm font-semibold text-red-700" data-testid="claim-reminders-error">{error}</p>}
    </div>
  );
}
