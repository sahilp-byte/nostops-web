'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { postBff } from '@/lib/auth-client';

type Status = string;
const PAID = new Set(['PAID', 'SUCCESS']);
const PENDING = new Set(['ACTIVE', 'PENDING', 'CREATED', 'UNKNOWN']);

// Result screen the Cashfree hosted checkout redirects a PARTICIPANT back to
// (return_url = /participant/payment/return?order_id=...). Re-verifies the real
// order status via the participant confirm BFF (never trusts the URL) and shows
// the final booking state. `initialConfirmed` lets the SSR page short-circuit
// the poll when it already confirmed server-side (robust to blocked cookies).
export default function ParticipantPaymentReturn({
  orderId,
  initialStatus = 'UNKNOWN',
  initialConfirmed = false,
}: {
  orderId: string;
  initialStatus?: string;
  initialConfirmed?: boolean;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [confirmed, setConfirmed] = useState(initialConfirmed);
  const [done, setDone] = useState(initialConfirmed || PAID.has(String(initialStatus).toUpperCase()));

  useEffect(() => {
    if (!orderId) { setDone(true); return; }
    if (initialConfirmed) { setDone(true); return; }
    let tries = 0;
    let alive = true;
    const tick = async () => {
      tries += 1;
      try {
        const { ok, data } = await postBff('/bff/institutional/participant/payment/confirm', { order_id: orderId });
        if (!alive) return;
        if (ok) {
          const s = String((data as any)?.status || 'UNKNOWN').toUpperCase();
          setStatus(s);
          if ((data as any)?.confirmed) { setConfirmed(true); setDone(true); return; }
          if (PAID.has(s) || !PENDING.has(s)) { setDone(true); return; }
        }
      } catch {
        /* keep polling */
      }
      if (tries >= 6) { if (alive) setDone(true); return; }
      setTimeout(tick, 1400);
    };
    tick();
    return () => { alive = false; };
  }, [orderId, initialConfirmed]);

  const paid = confirmed || PAID.has(String(status).toUpperCase());
  const pending = !done && PENDING.has(String(status).toUpperCase());

  return (
    <div className="container-x flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-7 text-center">
        {!orderId ? (
          <>
            <span className="text-4xl">❔</span>
            <h1 className="mt-3 text-xl font-black text-ink">No payment reference</h1>
            <p className="mt-1 text-sm text-ink-soft">We couldn&apos;t find an order to confirm.</p>
          </>
        ) : pending ? (
          <>
            <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden />
            <h1 className="mt-4 text-xl font-black text-ink">Confirming your payment…</h1>
            <p className="mt-1 break-all text-xs text-muted">Order {orderId}</p>
          </>
        ) : paid ? (
          <>
            <span className="text-4xl">✅</span>
            <h1 className="mt-3 text-xl font-black text-ink" data-testid="participant-paid">You&apos;re registered!</h1>
            <p className="mt-1 text-sm text-ink-soft">Payment received — your seat is confirmed. We&apos;ve saved it to your NOSTOPS programmes.</p>
            <p className="mt-1 break-all text-[11px] text-muted">Order {orderId}</p>
          </>
        ) : (
          <>
            <span className="text-4xl">⚠️</span>
            <h1 className="mt-3 text-xl font-black text-ink" data-testid="participant-payment-failed">Payment not completed</h1>
            <p className="mt-1 text-sm text-ink-soft">Status: {status}. If money was debited it will be auto-refunded. You can try again from My programmes.</p>
            <p className="mt-1 break-all text-[11px] text-muted">Order {orderId}</p>
          </>
        )}
        <Link href="/participant" className="mt-6 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700">
          View my programmes →
        </Link>
      </div>
    </div>
  );
}
