'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { inr } from '@/lib/format';
import { getBff, postBff } from '@/lib/auth-client';
import { saveReservation } from '@/lib/reservations';
import AddToCalendar from '@/components/AddToCalendar';
import PricingHierarchy from '@/components/retreats/PricingHierarchy';
import CancellationPolicy from '@/components/retreats/CancellationPolicy';
import { resolveBooking } from '@/lib/pricing';
import GroupTiersReference from '@/components/retreats/GroupTiersReference';
import BillingCountryField, { HoldNotOfferedNotice, holdButtonLabel } from '@/components/payments/BillingCountryField';
import HoldAlternatives, { retreatHostHref } from '@/components/payments/HoldAlternatives';
import { billingRegion, ROUTING_MESSAGES } from '@/lib/payment-routing';

// Prompt 3C (founder decision): the main backend's group quote is read for seats and the listed
// total only. Its tier discount is UNAPPROVED and unverified, so no discount line, discounted
// total or payable amount from it is shown; the tiers appear only as reference tiers.
type Quote = {
  group_size: number;
  seats_remaining: number;
  price_per_seat_inr: number;
  min_group_size: number;
  tiers: { min_seats: number; discount_pct: number }[];
  list_total_inr: number;
};

type Booked = {
  reservationId: string;
  instructions: string | null;
  whatsappLink: string | null;
  expiresAt: string | null;
};

export default function GroupBook({
  retreatId,
  retreatTitle,
  startISO,
  endISO,
  defaultName,
  defaultEmail,
  defaultPhone,
  standardInr,
}: {
  retreatId: string;
  retreatTitle: string;
  startISO?: string;
  endISO?: string;
  defaultName: string;
  defaultEmail: string;
  defaultPhone: string;
  standardInr?: number;
}) {
  const [size, setSize] = useState(5);
  const [groupName, setGroupName] = useState('');
  const [name, setName] = useState(defaultName || '');
  const [email, setEmail] = useState(defaultEmail || '');
  const [phone, setPhone] = useState(defaultPhone || '');
  const [notes, setNotes] = useState('');
  const [ack, setAck] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [booked, setBooked] = useState<Booked | null>(null);
  const [copied, setCopied] = useState(false);
  // Prompt 2C — billing country BEFORE the group is held (India only for now; re-checked server-side).
  const [country, setCountry] = useState('');
  const region = billingRegion(country);
  const shareLink = typeof window !== 'undefined' ? `${window.location.origin}/retreats/${retreatId}` : `/retreats/${retreatId}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(`Join me for ${retreatTitle}! Reserve your seat here: ${shareLink}`)}`;
  async function copyLink() {
    try { await navigator.clipboard.writeText(shareLink); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!Number.isFinite(size) || size < 1) { setQuote(null); return; }
    let live = true;
    const t = setTimeout(async () => {
      const r = await getBff<Quote>(`/bff/retreats/${retreatId}/group-quote?size=${size}`);
      if (!live) return;
      if (r.ok && r.data && typeof (r.data as any).price_per_seat_inr === 'number') {
        setQuote(r.data as Quote);
        setQuoteErr(null);
      } else {
        setQuote(null);
        setQuoteErr((r.data as any)?.error || null);
      }
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [retreatId, size]);

  const minSize = quote?.min_group_size ?? 2;
  const seatsRemaining = quote?.seats_remaining;
  const tooFew = quote != null && size < minSize;
  const tooMany = typeof seatsRemaining === 'number' && size > seatsRemaining;

  const resolved = quote && typeof standardInr === 'number' && standardInr > 0 && size >= 1
    ? resolveBooking({ standardInr, groupSize: size, minGroupSize: quote.min_group_size })
    : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (groupName.trim().length < 2) return setErr('Give your group a name.');
    if (name.trim().length < 2) return setErr('Enter the lead contact name.');
    if (!email.includes('@')) return setErr('Enter a valid contact email.');
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    if (cleanPhone.length < 5) return setErr('Enter a valid contact phone.');
    if (tooFew) return setErr(`This retreat needs at least ${minSize} seats for a group.`);
    if (tooMany) return setErr(`Only ${seatsRemaining} seats remain.`);
    if (region !== 'IN') return setErr(region ? ROUTING_MESSAGES.hold_not_offered : ROUTING_MESSAGES.billing_country_required);
    if (!ack) return setErr('Please accept the cancellation & refund policy to continue.');

    setBusy(true);
    const r = await postBff(`/bff/retreats/${retreatId}/group-book`, {
      group_size: size,
      organisation_name: groupName.trim(),
      organisation_type: 'friends_family',
      contact_name: name.trim(),
      contact_email: email.trim(),
      contact_phone: cleanPhone,
      notes: notes.trim() || undefined,
      billing_country: country,
    });
    setBusy(false);
    if (!r.ok || !(r.data as any)?.reservation_id) {
      setErr((r.data as any)?.error || 'Could not reserve your group. Please try again.');
      return;
    }
    const d = r.data as any;
    saveReservation({
      reservationId: String(d.reservation_id),
      retreatId,
      title: retreatTitle,
      kind: 'group',
      groupSize: size,
      expiresAt: d.expires_at ?? null,
      createdAt: Date.now(),
    });
    setBooked({
      reservationId: String(d.reservation_id),
      instructions: d.instructions ?? null,
      whatsappLink: d.whatsapp_link ?? null,
      expiresAt: d.expires_at ?? null,
    });
  }

  if (booked) {
    const startTs = startISO ? Date.parse(startISO) : NaN;
    const endTs = endISO ? Date.parse(endISO) : NaN;
    return (
      <div className="card p-6" data-testid="group-confirmed">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-2xl">👥</div>
        <h2 className="mt-4 text-xl font-black tracking-tight text-ink">Your group is reserved</h2>
        <p className="mt-1 text-ink-soft">{retreatTitle} · {size} seats</p>
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900" data-testid="group-final-amount-note">
          The host confirms the final group amount before any payment is requested.
        </p>
        <p className="mt-3 rounded-lg bg-cream/70 px-3 py-2 text-sm text-ink-soft">
          {booked.instructions || 'Your group is held. The host will share payment details (a secure payment link or bank transfer) shortly.'}
        </p>

        <div className="mt-4 rounded-xl border border-brand/20 bg-brand-50/40 p-4" data-testid="group-invite">
          <p className="text-sm font-extrabold text-brand-700">Invite your group</p>
          <p className="mt-1 text-xs text-ink-soft">Share this link so each friend can reserve &amp; pay for their own seat.</p>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs text-ink-soft" data-testid="group-invite-link">{shareLink}</span>
            <button type="button" onClick={copyLink} data-testid="group-invite-copy" className="shrink-0 rounded-lg bg-brand px-2.5 py-1 text-xs font-bold text-white transition hover:bg-brand-600">{copied ? 'Copied ✓' : 'Copy'}</button>
          </div>
          <a href={waHref} target="_blank" rel="noopener noreferrer" data-testid="group-invite-whatsapp" className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-brand-700 transition hover:border-brand">Share on WhatsApp →</a>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {booked.whatsappLink && (
            <a href={booked.whatsappLink} target="_blank" rel="noopener noreferrer" data-testid="group-whatsapp" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:border-brand">
              Message the host on WhatsApp →
            </a>
          )}
          {!Number.isNaN(startTs) && (
            <AddToCalendar title={retreatTitle} start={startTs} end={Number.isNaN(endTs) ? undefined : endTs} allDay location={retreatTitle} details={`Group of ${size} · NOSTOPS retreat`} />
          )}
          <Link href="/app/reservations" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">My reservations</Link>
        </div>
      </div>
    );
  }

  const field = 'min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50';

  return (
    <form onSubmit={onSubmit} noValidate className="card p-6" data-testid="group-form">
      <h2 className="text-lg font-extrabold tracking-tight text-ink">Book for a group</h2>
      <p className="mt-1 text-sm text-muted">Reserve several seats together at the listed price per seat.</p>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">How many seats?</span>
        <input type="number" min={2} max={200} value={size} onChange={(e) => setSize(Math.floor(Number(e.target.value)) || 0)} className={field} data-testid="group-size" />
      </label>

      {quote && (
        <div className="mt-3 rounded-xl border border-brand/20 bg-brand-50/50 p-4 text-sm" data-testid="group-quote">
          <div className="flex justify-between"><span className="text-ink-soft">{size} × ₹{inr(quote.price_per_seat_inr)} listed price</span><span className="font-semibold text-ink">₹{inr(quote.list_total_inr)}</span></div>
          <p className="mt-1 text-xs text-muted">Listed total. The amount payable is confirmed when your group is held. {quote.seats_remaining} seats left.</p>
          <GroupTiersReference tiers={quote.tiers?.length ? quote.tiers : undefined} />
        </div>
      )}
      {quoteErr && <p className="mt-2 text-xs font-semibold text-red-600">{quoteErr}</p>}
      {resolved && (
        <div className="mt-3" data-testid="group-hierarchy">
          <PricingHierarchy resolved={resolved} title="How this group is priced" />
        </div>
      )}
      {tooFew && <p className="mt-2 text-xs font-semibold text-red-600">This retreat needs at least {minSize} seats for a group booking.</p>}
      {tooMany && <p className="mt-2 text-xs font-semibold text-red-600">Only {seatsRemaining} seats remain.</p>}

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Group name</span>
        <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Sharma family, Weekend crew" maxLength={120} className={field} data-testid="group-name" />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Lead contact name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={field} data-testid="group-contact-name" />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Contact email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} data-testid="group-contact-email" />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Contact phone</span>
        <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={field} data-testid="group-contact-phone" />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Notes <span className="font-normal text-muted">· optional</span></span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder="Anything the host should know about your group." className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50" />
      </label>

      <div className="mt-4">
        <BillingCountryField
          value={country}
          onChange={(v) => { setCountry(v); setErr(null); }}
          testId="group-billing-country"
          hint="The lead contact's billing country. Only an India billing address can hold a group for now."
        />
        {region === 'INTL' && (
          <HoldNotOfferedNotice testId="group-intl-not-offered">
            <HoldAlternatives askHref={retreatHostHref(retreatId, retreatTitle)} testId="group-alternatives" />
          </HoldNotOfferedNotice>
        )}
      </div>

      <div className="mt-5">
        <CancellationPolicy compact startDate={startISO} pricePaidInr={typeof standardInr === 'number' ? standardInr : undefined} />
        <label className="mt-3 flex items-start gap-2.5" htmlFor="group-ack">
          <input id="group-ack" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4 accent-accent" data-testid="group-ack" />
          <span className="text-sm text-ink-soft">I&apos;ve read and accept the cancellation &amp; refund policy on behalf of my group.</span>
        </label>
      </div>

      {/* Next to the button, so a refusal is seen where the buyer tapped (mobile). */}
      {err && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" data-testid="group-error">{err}</p>}

      <button type="submit" disabled={busy || tooFew || tooMany || !ack || region !== 'IN'} className="mt-6 flex min-h-[46px] w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700" data-testid="group-submit">
        {busy ? 'Holding your group…' : holdButtonLabel(region) || (quote ? `Reserve ${size} seats` : 'Reserve group')}
      </button>
      <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900" data-testid="group-final-amount-note">
        The host confirms the final group amount before any payment is requested.
      </p>
      <p className="mt-3 text-xs text-muted">Your group is held for a limited time; the host will share payment details to confirm.</p>
    </form>
  );
}
