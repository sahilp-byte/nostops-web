'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// "Claim Your Free KYC" — the ONLY way a waiver is applied: an authenticated, CSRF-guarded call to
// /bff/teacher/festive-kyc/claim. The backend re-reads every fact and decides; no payment order,
// no gateway. On any answer the page re-renders from the backend status.
export default function FestiveClaimButton({ className = '', testid = 'festive-claim' }: { className?: string; testid?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const inFlight = useRef(false);

  async function claim() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMsg(null);
    const { ok, data } = await postBff('/bff/teacher/festive-kyc/claim', {});
    const d = data as any;
    setBusy(false);
    inFlight.current = false;
    if (ok) {
      setMsg({ ok: true, text: d?.duplicate ? 'Your complimentary KYC was already applied.' : 'Complimentary KYC applied — ₹0.' });
    } else {
      setMsg({ ok: false, text: d?.error || 'Could not claim the offer. Please try again.' });
    }
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={claim}
        disabled={busy}
        data-testid={testid}
        className={`inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#F07A1A] px-6 py-3 text-base font-black text-white shadow-md transition hover:bg-[#DD6A0E] disabled:opacity-60 ${className}`}
      >
        {busy ? 'Claiming…' : 'Claim Your Free KYC'}
      </button>
      {msg && (
        <p role="status" className={`mt-2 text-sm font-semibold ${msg.ok ? 'text-[#0F5E5A]' : 'text-[#B42318]'}`} data-testid={`${testid}-msg`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
