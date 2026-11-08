'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Phase 6 — after returning from checkout, ask the SERVER to re-check the payment with the gateway (a few times while
// it is still pending). The page only ever shows the status the server reports. Also: participant cancellation.
export default function SpaceRegistrationActions({ id, pending, canCancel, rule, paid }: { id: string; pending: boolean; canCancel: boolean; rule?: string; paid: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tries = useRef(0);

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(async () => {
      tries.current += 1;
      const r = await postBff(`/bff/spaces/registrations/${id}/verify`, {});
      if (r.ok && r.data?.registration?.status !== 'PENDING_PAYMENT') { clearInterval(t); router.refresh(); }
      if (tries.current >= 6) clearInterval(t);
    }, 4000);
    return () => clearInterval(t);
  }, [id, pending, router]);

  async function cancel() {
    setBusy(true); setErr(null);
    const r = await postBff(`/bff/spaces/registrations/${id}/cancel`, {});
    setBusy(false); setConfirming(false);
    if (!r.ok) return setErr(r.data?.error || 'Could not cancel. Please try again.');
    router.refresh();
  }

  return (
    <div className="space-y-2" data-testid="reg-actions">
      {pending && <p className="text-sm text-ink-soft" data-testid="reg-verifying">Checking your payment with the payment gateway…</p>}
      {rule && <p className="text-xs text-muted" data-testid="reg-cancel-rule">{rule}</p>}
      {canCancel && !confirming && (
        <button type="button" onClick={() => setConfirming(true)} className="min-h-[48px] rounded-xl border border-red-300 px-5 text-sm font-black text-red-700" data-testid="reg-cancel">
          {pending ? 'Cancel reservation' : 'Cancel registration'}
        </button>
      )}
      {confirming && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
          <p className="font-bold text-ink">{paid && !pending ? 'Cancel and request a full refund?' : 'Cancel this registration?'}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} onClick={cancel} className="min-h-[44px] rounded-xl bg-red-700 px-4 font-black text-white" data-testid="reg-cancel-confirm">Yes, cancel</button>
            <button type="button" onClick={() => setConfirming(false)} className="min-h-[44px] rounded-xl border border-line bg-white px-4 font-bold">Keep it</button>
          </div>
        </div>
      )}
      {err && <p className="text-sm font-semibold text-red-700" role="alert" data-testid="reg-action-error">{err}</p>}
    </div>
  );
}
