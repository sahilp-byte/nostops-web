'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import RegSteps from '@/components/spaces/RegSteps';

declare global {
  interface Window { Cashfree?: (opts: { mode: string }) => { checkout: (o: Record<string, unknown>) => Promise<unknown> } }
}

function loadCashfree(mode: string) {
  if (window.Cashfree) return Promise.resolve(window.Cashfree({ mode }));
  return new Promise<ReturnType<NonNullable<Window['Cashfree']>>>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    s.onload = () => (window.Cashfree ? resolve(window.Cashfree({ mode })) : reject(new Error('Cashfree unavailable')));
    s.onerror = () => reject(new Error('Cashfree unavailable'));
    document.head.appendChild(s);
  });
}

type Props = {
  eventId: string; title: string; paid: boolean; fee: number; seatsRemaining: number;
  signedIn: boolean; name?: string; email?: string; loginHref: string;
};

// Phase 6 — individual registration for a NOSTOPS Spaces programme. Identity comes from the signed-in account;
// the browser never sends a name, email or amount. Paid places are confirmed only after the server verifies payment.
export default function SpaceRegisterPanel({ eventId, title, paid, fee, seatsRemaining, signedIn, name, email, loginHref }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const termsRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const price = `₹${Math.round(fee).toLocaleString('en-IN')}`;

  // Root cause of the "ticked but Register stays disabled" defect: right after sign-in the page is server-rendered
  // and a tick made before React hydrates changes only the DOM checkbox — React 19 does not replay that change,
  // so `terms` stayed false while the box looked ticked. On mount, adopt whatever the user already did.
  useEffect(() => {
    if (termsRef.current?.checked) setTerms(true);
    if (phoneRef.current?.value) setPhone(phoneRef.current.value);
  }, []);

  async function submit() {
    setBusy(true); setErr(null);
    const r = await postBff('/bff/spaces/registrations', { event_id: eventId, accept_terms: terms, ...(paid ? { phone } : {}) });
    const d = r.data || {};
    if (!r.ok) { setBusy(false); return setErr(d.error || 'Could not register. Please try again.'); }
    const rid = d.registration?.registration_id;
    if (d.checkout?.payment_session_id) {
      try {
        const cf = await loadCashfree(d.checkout.mode === 'sandbox' ? 'sandbox' : 'production');
        await cf.checkout({ paymentSessionId: d.checkout.payment_session_id, redirectTarget: '_self' });
        return;
      } catch {
        setBusy(false);
        return router.push(`/app/spaces/registrations/${rid}`);
      }
    }
    router.push(`/app/spaces/registrations/${rid}`);
  }

  return (
    <div className="rounded-3xl border border-line bg-white p-6 shadow-sm" data-testid="space-register-panel">
      <h2 className="font-serif text-2xl font-semibold text-brand-700">Register for this Programme</h2>
      <div className="mt-4"><RegSteps current={signedIn ? (terms ? 2 : 1) : 1} paid={paid} /></div>

      <div className="mt-5 rounded-2xl border border-amber-100 bg-cream p-4" data-testid="space-register-fee">
        <div className="flex items-center justify-between text-sm"><span className="text-ink-soft">Participant fee (per person)</span><span className="font-black text-ink">{paid ? price : 'Free'}</span></div>
        <div className="mt-2 flex items-center justify-between text-sm"><span className="text-ink-soft">Places left</span><span className="font-bold text-ink" data-testid="space-register-seats">{seatsRemaining}</span></div>
        <div className="mt-3 flex items-center justify-between border-t border-amber-100 pt-3">
          <span className="font-black text-ink">{paid ? 'Total payable' : 'Total'}</span>
          <span className="rounded-full bg-accent px-4 py-1 text-base font-black text-white" data-testid="space-register-total">{paid ? price : '₹0'}</span>
        </div>
        <p className="mt-2 text-xs text-muted">One place for you. Registration is individual — no group bookings.</p>
      </div>

      {!signedIn ? (
        <div className="mt-5" data-testid="space-register-signin">
          <p className="text-sm text-ink-soft">Sign in to your NOSTOPS account to register. Your registration is saved to your account.</p>
          <Link href={loginHref} className="mt-3 flex min-h-[52px] items-center justify-center rounded-xl bg-accent px-5 text-base font-black text-white hover:opacity-95" data-testid="space-register-login">Sign in to register →</Link>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-line p-4 text-sm" data-testid="space-register-identity">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Registering as</p>
            <p className="mt-1 font-black text-ink">{name || 'Your NOSTOPS account'}</p>
            {email && <p className="text-ink-soft">{email}</p>}
          </div>
          {paid && (
            <label className="block text-sm font-bold text-ink">Mobile number (for the payment receipt)
              <input ref={phoneRef} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+91 98200 12345"
                className="mt-1 block min-h-[48px] w-full rounded-xl border border-line px-3 text-sm font-normal" data-testid="space-register-phone" />
            </label>
          )}
          <label className="flex items-start gap-3 text-sm text-ink-soft">
            <input ref={termsRef} type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 h-5 w-5" data-testid="space-register-terms" />
            <span>I agree to the NOSTOPS <Link href="/terms" className="font-bold text-brand-700 underline">Terms</Link>
              {paid ? <> and the cancellation rule: cancel up to 2 days before the start date for a full refund.</> : <>. I can cancel any time before the programme starts.</>}</span>
          </label>
          <button type="button" disabled={busy || !terms || (paid && phone.replace(/\D/g, '').length < 10)} onClick={submit}
            className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-accent px-5 text-base font-black text-white disabled:opacity-50" data-testid="space-register-submit">
            {busy ? 'Please wait…' : paid ? `Pay ${price} securely →` : 'Confirm free registration →'}
          </button>
          {err && <p className="text-sm font-semibold text-red-700" role="alert" data-testid="space-register-error">{err}</p>}
        </div>
      )}
      <p className="mt-4 rounded-xl bg-cream/70 p-3 text-center text-xs text-muted">
        {paid ? 'Secure payment via Cashfree (payments & refunds only). Your place is confirmed only after NOSTOPS verifies the payment.' : `No payment is needed for ${title}.`}
      </p>
    </div>
  );
}
