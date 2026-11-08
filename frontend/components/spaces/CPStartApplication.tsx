'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Explicit start of a Community Partner application: the draft is created only when the applicant presses Start.
export default function CPStartApplication() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true); setErr(null);
    const r = await postBff('/bff/spaces/partners/mine', {});
    if (!r.ok) { setBusy(false); setErr(r.data?.error || 'Could not start the application. Please try again.'); return; }
    router.refresh();
  }

  return (
    <div className="sp-card p-6 lg:p-8" data-testid="cp-start-card">
      <h2 className="text-[24px]">Start your application</h2>
      <p className="mt-2 max-w-2xl text-ink-soft">
        You&apos;ll choose up to two localities, tell us about yourself and your plan, and upload identity and address proof.
        Community Partners have no fees, earnings or commissions on NOSTOPS.
      </p>
      {err ? <p className="mt-3 text-sm font-semibold text-rose-700" data-testid="cp-start-error">{err}</p> : null}
      <button type="button" onClick={start} disabled={busy} className="sp-btn-primary mt-5" data-testid="cp-start-btn">
        {busy ? 'Starting…' : 'Start Application'}
      </button>
    </div>
  );
}
