'use client';

import { useState } from 'react';
import Link from 'next/link';
import { inr } from '@/lib/format';
import { postBff } from '@/lib/auth-client';
import { saveReservation } from '@/lib/reservations';
import AddToCalendar from '@/components/AddToCalendar';
import CancellationPolicy from '@/components/retreats/CancellationPolicy';
import BillingCountryField, { DomesticOnlyNotice, HoldNotOfferedNotice, holdButtonLabel, routingButtonLabel } from '@/components/payments/BillingCountryField';
import HoldAlternatives, { retreatHostHref } from '@/components/payments/HoldAlternatives';
import { billingRegion, ROUTING_MESSAGES } from '@/lib/payment-routing';

type Props = {
  retreatId: string;
  retreatTitle: string;
  priceInr?: number;
  startISO?: string;
  endISO?: string;
  defaultName: string;
  defaultEmail: string;
  defaultPhone: string;
  cohort?: string;
  via?: string;
};

type Reserved = {
  reservationId: string;
  nextStep: string | null;
  instructions: string | null;
  whatsappLink: string | null;
  expiresAt: string | null;
};

function fmtExpiry(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function RetreatReserve({ retreatId, retreatTitle, priceInr, startISO, endISO, defaultName, defaultEmail, defaultPhone, cohort, via }: Props) {
  const [name, setName] = useState(defaultName || '');
  const [email, setEmail] = useState(defaultEmail || '');
  const [phone, setPhone] = useState(defaultPhone || '');
  const [notes, setNotes] = useState('');
  const [dietary, setDietary] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [payCountry, setPayCountry] = useState('');
  const payRegion = billingRegion(payCountry);
  const [err, setErr] = useState<string | null>(null);
  const [reserved, setReserved] = useState<Reserved | null>(null);
  // Prompt 2C — billing country BEFORE a seat is held (India only for now; re-checked server-side).
  const [country, setCountry] = useState('');
  const region = billingRegion(country);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (name.trim().length < 2) return setErr('Please enter your name.');
    if (!email.includes('@')) return setErr('Please enter a valid email.');
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    if (cleanPhone.length < 5) return setErr('Please enter a valid phone number to hold your seat.');
    if (region !== 'IN') return setErr(region ? ROUTING_MESSAGES.hold_not_offered : ROUTING_MESSAGES.billing_country_required);
    if (!ack) return setErr('Please accept the cancellation & refund policy to continue.');

    setBusy(true);
    const r = await postBff(`/bff/retreats/${retreatId}/reserve`, {
      name: name.trim(),
      email: email.trim(),
      phone: cleanPhone,
      notes: notes.trim() || undefined,
      dietary: dietary.trim() || undefined,
      cohort: cohort || undefined,
      via: via || undefined,
      billing_country: country,
    });
    setBusy(false);
    if (!r.ok || !(r.data as any)?.reservation_id) {
      setErr((r.data as any)?.error || 'Could not reserve your seat. Please try again.');
      return;
    }
    const d = r.data as any;
    saveReservation({
      reservationId: String(d.reservation_id),
      retreatId,
      title: retreatTitle,
      kind: 'individual',
      amountInr: typeof priceInr === 'number' ? priceInr : undefined,
      expiresAt: d.expires_at ?? null,
      createdAt: Date.now(),
    });
    setPayCountry(country);
    setReserved({
      reservationId: String(d.reservation_id),
      nextStep: d.next_step ?? null,
      instructions: d.instructions ?? null,
      whatsappLink: d.whatsapp_link ?? null,
      expiresAt: d.expires_at ?? null,
    });
  }

  async function payNow() {
    if (!reserved) return;
    setErr(null);
    if (payRegion !== 'IN') {
      setErr(payRegion ? ROUTING_MESSAGES.international_not_offered : ROUTING_MESSAGES.billing_country_required);
      return;
    }
    setPayBusy(true);
    const r = await postBff(`/bff/retreats/${retreatId}/reservations/${reserved.reservationId}/pay`, { billing_country: payCountry });
    if (!r.ok || !(r.data as any)?.short_url) {
      setPayBusy(false);
      setErr((r.data as any)?.error || 'Could not start the payment. You can still confirm off-platform below.');
      return;
    }
    window.location.href = (r.data as any).short_url;
  }

  if (reserved) {
    const expiry = fmtExpiry(reserved.expiresAt);
    const offPlatform = reserved.nextStep === 'off_platform_payment';
    return (
      <div className="card p-6" data-testid="reservation-confirmed">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-2xl">🧘</div>
        <h2 className="mt-4 text-xl font-black tracking-tight text-ink">Your seat is held</h2>
        <p className="mt-1 text-ink-soft">{retreatTitle}</p>
        {expiry && (
          <p className="mt-2 rounded-lg bg-cream/70 px-3 py-2 text-sm text-ink-soft">
            We&apos;re holding your seat until <span className="font-bold text-ink">{expiry}</span>. Complete payment to confirm.
          </p>
        )}

        <div className="mt-5 rounded-xl border border-brand/20 bg-brand-50/50 p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-bold text-brand-700">Pay securely to confirm</p>
            {typeof priceInr === 'number' && <span className="text-lg font-black text-ink">₹{inr(priceInr)}</span>}
          </div>
          <p className="mt-1 text-sm text-ink-soft">You&apos;ll pay on a secure hosted checkout, then return to NOSTOPS.</p>
          <div className="mt-3">
            <BillingCountryField value={payCountry} onChange={(v) => { setPayCountry(v); setErr(null); }} testId="reservation-billing-country" />
            {payRegion === 'INTL' && <DomesticOnlyNotice testId="reservation-intl-not-offered" />}
          </div>
          <button
            type="button"
            onClick={payNow}
            disabled={payBusy || payRegion !== 'IN'}
            data-testid="reservation-pay"
            className="mt-3 w-full rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700"
          >
            {payBusy ? 'Starting secure checkout…' : routingButtonLabel(payRegion) || (typeof priceInr === 'number' ? `Pay ₹${inr(priceInr)} now →` : 'Pay now →')}
          </button>
        </div>

        <div className="mt-4">
          <CancellationPolicy compact startDate={startISO} pricePaidInr={typeof priceInr === 'number' ? priceInr : undefined} />
        </div>

        {offPlatform && reserved.whatsappLink && (
          <div className="mt-4 rounded-xl border border-line bg-white p-4">
            <p className="text-sm font-bold text-ink">Prefer UPI / bank transfer?</p>
            {reserved.instructions && <p className="mt-1 text-sm text-ink-soft">{reserved.instructions}</p>}
            <a
              href={reserved.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="reservation-whatsapp"
              className="mt-3 inline-block rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:border-brand"
            >
              Message the host on WhatsApp →
            </a>
          </div>
        )}

        {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{err}</p>}

        {startISO && !Number.isNaN(Date.parse(startISO)) && (
          <div className="mt-4">
            <AddToCalendar
              title={retreatTitle}
              start={Date.parse(startISO)}
              end={endISO && !Number.isNaN(Date.parse(endISO)) ? Date.parse(endISO) : undefined}
              allDay
              location={retreatTitle}
              details="Your NOSTOPS retreat"
            />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/app/reservations" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
            My reservations
          </Link>
          <Link href={`/retreats/${retreatId}`} className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">
            View retreat page
          </Link>
          <Link href="/retreats" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">
            Explore more retreats
          </Link>
        </div>
      </div>
    );
  }

  const field =
    'min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50';

  return (
    <form onSubmit={onSubmit} noValidate className="card p-6" data-testid="reserve-form">
      <h2 className="text-lg font-extrabold tracking-tight text-ink">Reserve your seat</h2>
      <p className="mt-1 text-sm text-muted">We&apos;ll hold your seat while you complete payment.</p>

      {cohort && (
        <div className="mt-4 rounded-xl border border-brand/25 bg-brand-50/50 px-4 py-3" data-testid="cohort-banner">
          <p className="text-sm font-black text-ink">You&apos;re joining the “{cohort}” cohort</p>
          <p className="mt-0.5 text-xs text-ink-soft">{via ? `${via} invited you. ` : ''}You&apos;ll be part of this group for this retreat — your NOSTOPS account always stays your own.</p>
        </div>
      )}

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Full name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={field} data-testid="reserve-name" />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} data-testid="reserve-email" />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Phone</span>
        <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="For your booking confirmation" className={field} data-testid="reserve-phone" />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Dietary needs <span className="font-normal text-muted">· optional</span></span>
        <input type="text" value={dietary} onChange={(e) => setDietary(e.target.value)} placeholder="e.g. Jain, vegan, no onion/garlic" maxLength={200} className={field} />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Anything for the host <span className="font-normal text-muted">· optional</span></span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} placeholder="Injuries, arrival plans, or what you hope to gain." className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50" />
      </label>

      <div className="mt-4">
        <BillingCountryField
          value={country}
          onChange={(v) => { setCountry(v); setErr(null); }}
          testId="reserve-billing-country"
          hint="Needed before we hold a seat. Only an India billing address can book for now."
        />
        {region === 'INTL' && (
          <HoldNotOfferedNotice testId="reserve-intl-not-offered">
            <HoldAlternatives askHref={retreatHostHref(retreatId, retreatTitle)} testId="reserve-alternatives" />
          </HoldNotOfferedNotice>
        )}
      </div>

      <div className="mt-5">
        <CancellationPolicy compact startDate={startISO} pricePaidInr={typeof priceInr === 'number' ? priceInr : undefined} />
        <label className="mt-3 flex items-start gap-2.5" htmlFor="reserve-ack">
          <input id="reserve-ack" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4 accent-accent" data-testid="reserve-ack" />
          <span className="text-sm text-ink-soft">I&apos;ve read and accept the cancellation &amp; refund policy above.</span>
        </label>
      </div>

      {/* Next to the button, so a refusal is seen where the buyer tapped (mobile). */}
      {err && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" data-testid="reserve-error">
          {err}
        </p>
      )}

      <button type="submit" disabled={busy || !ack || region !== 'IN'} className="mt-6 flex min-h-[46px] w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700" data-testid="reserve-submit">
        {busy ? 'Holding your seat…' : holdButtonLabel(region) || (typeof priceInr === 'number' ? `Reserve & continue to payment (₹${inr(priceInr)})` : 'Reserve & continue to payment')}
      </button>
      <p className="mt-3 text-xs text-muted">You&apos;ll only be charged after confirming payment on the next step.</p>
    </form>
  );
}
