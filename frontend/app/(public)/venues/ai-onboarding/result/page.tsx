'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getBff, postBff } from '@/lib/auth-client';
import { AI_ONBOARDING_TOKEN_KEY } from '@/components/venues/AiOnboardingPurchase';
import SandboxPaymentBanner from '@/components/payments/SandboxPaymentBanner';

type State = 'checking' | 'paid' | 'pending' | 'failed' | 'error';
type StatusAnswer = { paid?: boolean; status?: string; venue_name?: string; last_payment_status?: string | null; sandbox?: boolean };

function ResultInner() {
  const sp = useSearchParams();
  const orderId = sp.get('order_id') || '';
  // Prompt 4F — back from PayPal: approved (capture it) or cancelled on PayPal's page.
  const paypal = sp.get('provider') === 'paypal';
  const cancelled = sp.get('cancelled') === '1';
  const [state, setState] = useState<State>('checking');
  const [sandbox, setSandbox] = useState(false);
  const [venueName, setVenueName] = useState('');
  const [editHref, setEditHref] = useState('/venues/submit/edit');
  // One capture request per page visit (the server is idempotent anyway).
  const captureSent = useRef(false);

  useEffect(() => {
    try {
      const t = sessionStorage.getItem(AI_ONBOARDING_TOKEN_KEY);
      if (t) setEditHref(`/venues/submit/edit?token=${encodeURIComponent(t)}`);
    } catch { /* private mode */ }
  }, []);

  useEffect(() => {
    if (!/^vob_/.test(orderId)) {
      setState('error');
      return;
    }
    if (cancelled) {
      setState('failed');
      return;
    }
    let stop = false;
    let tries = 0;
    function apply(ok: boolean, data: StatusAnswer | null | undefined): boolean {
      if (data?.venue_name) setVenueName(data.venue_name);
      setSandbox(!!data?.sandbox);
      if (ok && data?.paid) {
        setState('paid');
        return true;
      }
      // A cancelled or failed attempt is final for this visit — say so, never "processing".
      if (ok && ['FAILED', 'USER_DROPPED', 'CANCELLED', 'VOID'].includes(String(data?.last_payment_status || ''))) {
        setState('failed');
        return true;
      }
      return false;
    }
    async function check() {
      const { ok, data } = await getBff<StatusAnswer>(`/bff/venue-onboarding/status?order_id=${encodeURIComponent(orderId)}`);
      if (stop || apply(ok, data)) return;
      tries += 1;
      if (tries >= 5) {
        setState(ok ? 'pending' : 'error');
        return;
      }
      setTimeout(check, 2000);
    }
    async function start() {
      if (paypal && !captureSent.current) {
        captureSent.current = true;
        // The buyer approved on PayPal; the server takes the payment once (idempotent) and confirms it.
        const { ok, data } = await postBff<StatusAnswer>('/bff/venue-onboarding/paypal-capture', { order_id: orderId });
        if (stop || apply(ok, data)) return;
      }
      check();
    }
    start();
    return () => {
      stop = true;
    };
  }, [orderId, paypal, cancelled]);

  return (
    <section className="container-x py-16 md:py-24">
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <SandboxPaymentBanner show={sandbox} />
        {state === 'failed' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-2xl">✖️</div>
            <h1 className="mt-6 text-2xl font-black text-ink" data-testid="ai-result-failed">Payment didn&apos;t go through</h1>
            <p className="mt-2 text-sm text-ink-soft">
              The payment was cancelled or declined, so nothing was charged and AI-assisted onboarding is not active yet.
              You can try again whenever you like.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href={editHref}
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-indigo-700"
              >
                Back to my venue
              </Link>
            </div>
          </>
        )}
        {state === 'checking' && (
          <>
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <h1 className="mt-6 text-2xl font-black text-ink">Confirming your payment…</h1>
            <p className="mt-2 text-sm text-ink-soft">This only takes a moment. Please don&apos;t close this tab.</p>
          </>
        )}

        {state === 'paid' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">✅</div>
            <h1 className="mt-6 text-2xl font-black text-ink">Payment confirmed — you&apos;re all set!</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Thank you. AI-assisted onboarding is now active for{' '}
              {venueName ? <strong data-testid="ai-result-venue">{venueName}</strong> : 'your venue listing'}. Return to your
              venue&apos;s edit page to generate suggestions — you&apos;ll review and approve every detail before it goes live.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href={editHref}
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-indigo-700"
                data-testid="ai-result-continue"
              >
                Continue with my venue →
              </Link>
              <Link
                href="/venues"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-ink-soft transition hover:bg-cream"
              >
                Explore venues
              </Link>
            </div>
          </>
        )}

        {state === 'pending' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">⏳</div>
            <h1 className="mt-6 text-2xl font-black text-ink">Payment is being processed</h1>
            <p className="mt-2 text-sm text-ink-soft">
              We haven&apos;t received confirmation yet. If you completed the payment, it can take a minute to settle —
              you&apos;ll get a confirmation on your email. You can safely refresh this page.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/venues/ai-onboarding"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-ink-soft transition hover:bg-cream"
              >
                Back to onboarding
              </Link>
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-2xl">⚠️</div>
            <h1 className="mt-6 text-2xl font-black text-ink">We couldn&apos;t confirm this payment</h1>
            <p className="mt-2 text-sm text-ink-soft">
              {paypal
                ? 'We couldn\u2019t confirm this PayPal payment. PayPal only takes the money once the payment is confirmed here, so if this page doesn\u2019t confirm it you have not been charged. Please try again.'
                : 'The payment reference is missing or invalid. If money was deducted, it will be auto-refunded by the gateway. Please try again.'}
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/venues/ai-onboarding"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-indigo-700"
              >
                Back to onboarding
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default function AiOnboardingResultPage() {
  return (
    <main className="bg-white">
      <Suspense
        fallback={
          <section className="container-x py-16 md:py-24">
            <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            </div>
          </section>
        }
      >
        <ResultInner />
      </Suspense>
    </main>
  );
}
