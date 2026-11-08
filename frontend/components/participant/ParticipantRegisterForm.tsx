'use client';

import { useState } from 'react';
import Link from 'next/link';
import { postBff } from '@/lib/auth-client';
import ParticipantPayStep from '@/components/participant/ParticipantPayStep';
import BillingCountryField, { HoldNotOfferedNotice, holdButtonLabel } from '@/components/payments/BillingCountryField';
import HoldAlternatives, { plainHostHref } from '@/components/payments/HoldAlternatives';
import { billingRegion, ROUTING_MESSAGES } from '@/lib/payment-routing';

const inputCls =
  'w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand';

type EventLite = {
  slug: string;
  title: string;
  is_free?: boolean;
  is_full?: boolean;
  pricing_type?: string;
  participant_fee?: number | null;
  // B2.2 — the one session of a repeating programme being booked.
  session_id?: string | null;
  session_label?: string | null;
};

type Registration = {
  registration_id: string;
  booking_status?: string;
  registration_status?: string;
  payment_status?: string;
  pricing_type?: string;
  amount?: number | null;
  currency?: string | null;
  event_title?: string | null;
};

const PARTICIPANT_TYPES = [
  { key: 'EMPLOYEE', label: 'Employee' },
  { key: 'STUDENT', label: 'Student' },
  { key: 'MEMBER', label: 'Member' },
  { key: 'OTHER', label: 'Other' },
];

export default function ParticipantRegisterForm({
  event,
  participantName = '',
  participantEmail = '',
  defaultType = 'OTHER',
}: {
  event: EventLite;
  participantName?: string | null;
  participantEmail?: string;
  defaultType?: string;
}) {
  const [name, setName] = useState(participantName || '');
  const [type, setType] = useState(defaultType);
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Registration | null>(null);
  const [pay, setPay] = useState<Registration | null>(null);

  const isPaid = event.is_free === false || event.pricing_type === 'PAID';
  // Prompt 2C — a paid registration holds a place, so the billing country comes first (India only
  // for now; the engine re-checks it before writing anything). Free events don't ask.
  const [country, setCountry] = useState('');
  const region = billingRegion(country);
  const blocked = isPaid && region !== 'IN';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (isPaid && !event.is_full && phone.trim().replace(/[^\d]/g, '').length < 7) {
      setError('A valid phone number is required to pay for this programme.');
      return;
    }
    if (blocked) {
      setError(region ? ROUTING_MESSAGES.hold_not_offered : ROUTING_MESSAGES.billing_country_required);
      return;
    }
    setBusy(true);
    const res = await postBff('/bff/institutional/participant/register', {
      event_slug: event.slug,
      session_id: event.session_id || null,
      name: name.trim(),
      participant_type: type,
      department: department.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
      ...(isPaid ? { billing_country: country } : {}),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.data?.error || 'Could not complete your registration. Please try again.');
      return;
    }
    const reg = (res.data?.registration as Registration) || { registration_id: '' };
    if (reg.booking_status === 'PENDING_PAYMENT') {
      setPay(reg);
      return;
    }
    setDone(reg);
  }

  if (pay) {
    return (
      <ParticipantPayStep
        registrationId={pay.registration_id}
        eventTitle={pay.event_title || event.title}
        amount={pay.amount ?? event.participant_fee}
        currency={pay.currency || 'INR'}
        phone={phone.trim() || null}
        defaultCountry={country}
      />
    );
  }

  if (done) {
    const waitlisted = done.booking_status === 'WAITLISTED';
    return (
      <div className="rounded-2xl border border-line bg-white p-6 text-center" data-testid="participant-registered">
        <div className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-3xl ${waitlisted ? 'bg-amber-50' : 'bg-emerald-50'}`}>
          {waitlisted ? '⏳' : '✓'}
        </div>
        <h3 className="mt-3 text-xl font-black text-ink">
          {waitlisted ? "You're on the waitlist" : "You're registered!"}
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          {waitlisted
            ? `This ${event.session_label ? 'session' : 'event'} is full. We'll let you know if a seat opens up for ${event.title}${event.session_label ? ` (${event.session_label})` : ''}.`
            : `Your place for ${event.title}${event.session_label ? ` (${event.session_label})` : ''} is confirmed. We've saved it to your NOSTOPS programmes.`}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/participant" className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-700" data-testid="go-dashboard">
            View my programmes
          </Link>
          <Link href={`/events/${event.slug}${event.session_id ? '#sessions' : ''}`} className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink hover:bg-cream">
            {event.session_id ? 'Book another session' : 'Back to event'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-6" data-testid="participant-register-form">
      <h3 className="text-lg font-black text-ink">Your details</h3>
      {event.session_label && (
        <p className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-bold text-brand-700" data-testid="reg-session-label">📅 {event.session_label}</p>
      )}
      <p className="mt-1 text-sm text-muted">
        Signed in as <span className="font-semibold text-ink">{participantEmail}</span>.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="r-name" className="mb-1 block text-xs font-bold text-ink-soft">Full name</label>
          <input id="r-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required data-testid="reg-name" />
        </div>
        <div>
          <label htmlFor="r-type" className="mb-1 block text-xs font-bold text-ink-soft">I am registering as</label>
          <select id="r-type" value={type} onChange={(e) => setType(e.target.value)} className={inputCls} data-testid="reg-type">
            {PARTICIPANT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="r-dept" className="mb-1 block text-xs font-bold text-ink-soft">Department / Class <span className="font-normal text-muted">(optional)</span></label>
            <input id="r-dept" value={department} onChange={(e) => setDepartment(e.target.value)} className={inputCls} placeholder="e.g. Engineering" />
          </div>
          <div>
            <label htmlFor="r-phone" className="mb-1 block text-xs font-bold text-ink-soft">
              Phone {isPaid && !event.is_full
                ? <span className="font-normal text-red-500">(required for payment)</span>
                : <span className="font-normal text-muted">(optional)</span>}
            </label>
            <input id="r-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+91…" inputMode="tel" data-testid="reg-phone" required={isPaid && !event.is_full} />
          </div>
        </div>
        <div>
          <label htmlFor="r-notes" className="mb-1 block text-xs font-bold text-ink-soft">Anything we should know? <span className="font-normal text-muted">(optional)</span></label>
          <textarea id="r-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className={inputCls} placeholder="Accessibility needs, questions…" />
        </div>
      </div>
      {isPaid && (
        <div className="mt-3">
          <BillingCountryField
            value={country}
            onChange={(v) => { setCountry(v); setError(''); }}
            testId="reg-billing-country"
            hint="Needed before we hold your place. Only an India billing address can pay for this event for now."
          />
          {region === 'INTL' && (
            <HoldNotOfferedNotice testId="reg-intl-not-offered">
              <HoldAlternatives askHref={plainHostHref(`a place at "${event.title}"`)} askLabel="Message the organiser" testId="reg-alternatives" />
            </HoldNotOfferedNotice>
          )}
        </div>
      )}
      {event.is_full && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          This {event.session_label ? 'session' : 'event'} is full — you&apos;ll join the waitlist and we&apos;ll notify you if a seat opens.
        </p>
      )}
      {error && <p className="mt-3 text-sm font-semibold text-red-600" data-testid="reg-error">{error}</p>}
      <button
        type="submit"
        disabled={busy || blocked}
        className="mt-4 w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700"
        data-testid="reg-submit"
      >
        {busy ? 'Confirming…' : (isPaid && holdButtonLabel(region)) || (event.is_full ? 'Join the waitlist' : isPaid ? 'Continue to payment' : 'Confirm my registration')}
      </button>
      {isPaid && !event.is_full && typeof event.participant_fee === 'number' && event.participant_fee > 0 && (
        <p className="mt-2 text-center text-xs font-semibold text-ink-soft">
          Fee: ₹{Math.round(event.participant_fee).toLocaleString('en-IN')} · paid securely via Cashfree after this step.
        </p>
      )}
      {event.is_free && !event.is_full && (
        <p className="mt-2 text-center text-xs font-semibold text-emerald-700">This programme is free to attend.</p>
      )}
    </form>
  );
}
