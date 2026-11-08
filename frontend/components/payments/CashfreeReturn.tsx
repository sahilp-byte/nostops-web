'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Status = 'PAID' | 'SUCCESS' | 'ACTIVE' | 'PENDING' | 'FAILED' | 'EXPIRED' | 'UNKNOWN' | string;

const PAID = new Set(['PAID', 'SUCCESS']);
const PENDING = new Set(['ACTIVE', 'PENDING', 'CREATED', 'UNKNOWN']);

// Result screen the Cashfree hosted checkout redirects back to
// (backend web_return_url = /cashfree-return?order_id=...). Confirms the real
// order status via the BFF (never trusts the URL) with a short poll.
export default function CashfreeReturn({ orderId }: { orderId: string }) {
  const [status, setStatus] = useState<Status>('UNKNOWN');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!orderId) { setDone(true); return; }
    let tries = 0;
    let alive = true;
    const tick = async () => {
      tries += 1;
      try {
        const r = await fetch(`/bff/payments/cashfree/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
        const d = await r.json().catch(() => null);
        const s: Status = (d?.status || 'UNKNOWN').toUpperCase();
        if (!alive) return;
        setStatus(s);
        if (PAID.has(s) || (!PENDING.has(s))) { setDone(true); return; }
      } catch {
        /* keep polling */
      }
      if (tries >= 6) { if (alive) setDone(true); return; }
      setTimeout(tick, 1200);
    };
    tick();
    return () => { alive = false; };
  }, [orderId]);

  const paid = PAID.has(status);
  const pending = !done && PENDING.has(status);

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
            <h1 className="mt-3 text-xl font-black text-ink" data-testid="cashfree-paid">Payment successful</h1>
            <p className="mt-1 text-sm text-ink-soft">Thank you — your payment has been received.</p>
            <p className="mt-1 break-all text-[11px] text-muted">Order {orderId}</p>
          </>
        ) : (
          <>
            <span className="text-4xl">⚠️</span>
            <h1 className="mt-3 text-xl font-black text-ink" data-testid="cashfree-failed">Payment not completed</h1>
            <p className="mt-1 text-sm text-ink-soft">Status: {status}. If money was debited it will be auto-refunded.</p>
            <p className="mt-1 break-all text-[11px] text-muted">Order {orderId}</p>
          </>
        )}
        <Link href="/app" className="mt-6 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
          Return to dashboard →
        </Link>
      </div>
    </div>
  );
}
