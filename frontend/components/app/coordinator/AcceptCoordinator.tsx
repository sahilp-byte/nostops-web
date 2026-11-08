'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Accept the coordinator agreement → activate (self-assign). Idempotent for
// existing coordinators.
export default function AcceptCoordinator({ active }: { active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (active) {
    return (
      <div className="rounded-xl border border-brand/25 bg-brand-50/60 px-4 py-3 text-sm font-semibold text-brand-700" data-testid="coord-active">
        ✓ You&apos;ve accepted the agreement — your City Coordinator role is active.
      </div>
    );
  }

  async function accept() {
    setBusy(true);
    setMsg(null);
    const r = await postBff('/bff/coordinator/assign-me');
    setBusy(false);
    if (r.ok && r.data?.coordinator) {
      setMsg('Welcome aboard! Your City Coordinator role is now active.');
      router.refresh();
    } else {
      setMsg(r.data?.error || r.data?.reason || 'You are not eligible yet. Empanelled teachers with a set location auto-qualify.');
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={accept}
        disabled={busy}
        className="w-full rounded-xl bg-brand px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
        data-testid="coord-accept"
      >
        {busy ? 'Activating…' : 'I accept — activate my City Coordinator role'}
      </button>
      {msg && <p className="mt-2 text-sm font-semibold text-ink-soft">{msg}</p>}
    </div>
  );
}
