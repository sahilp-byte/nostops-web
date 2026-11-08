'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { inr } from '@/lib/format';
import { postBff } from '@/lib/auth-client';
import CashfreePayButton from '@/components/payments/CashfreePayButton';
import BillingCountryField, { HoldNotOfferedNotice, holdButtonLabel } from '@/components/payments/BillingCountryField';
import HoldAlternatives, { teacherHostHref } from '@/components/payments/HoldAlternatives';
import { billingRegion, ROUTING_MESSAGES } from '@/lib/payment-routing';

type Props = {
  teacherHandle: string;
  teacherName: string;
  rateInr?: number;
  durationMin?: number;
  timeZone?: string;
  defaultName: string;
  offers?: { online?: boolean; privateSession?: boolean; group?: boolean; corporate?: boolean };
};

type Reserved = { bookingId: string; amount: number; phone: string };

function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export default function BookingForm({
  teacherHandle,
  teacherName,
  rateInr,
  durationMin,
  timeZone,
  defaultName,
  offers,
}: Props) {
  // Session type — Online / In-person — from the teacher's offer flags. Defaults
  // to Online when a teacher hasn't marked in-person 1:1 availability.
  const modeList = (() => {
    const m = [
      offers?.online ? { id: 'online', label: 'Online' } : null,
      offers?.privateSession ? { id: 'inperson', label: 'In person' } : null,
    ].filter(Boolean) as Array<{ id: string; label: string }>;
    return m.length ? m : [{ id: 'online', label: 'Online' }];
  })();
  const [mode, setMode] = useState<string>(modeList[0].id);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState(defaultName || '');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reserved, setReserved] = useState<Reserved | null>(null);
  // Prompt 2C — billing country BEFORE the slot is held (India only for now; re-checked server-side).
  const [country, setCountry] = useState('');
  const region = billingRegion(country);

  const slotLabel = useMemo(() => {
    if (!date || !time) return '';
    const dt = new Date(`${date}T${time}`);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [date, time]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Please enter your name.');
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    if (cleanPhone.length < 5) return setError('Please enter a valid phone number for your booking.');
    if (!date || !time) return setError('Please choose a preferred date and time.');
    const dt = new Date(`${date}T${time}`);
    if (Number.isNaN(dt.getTime())) return setError('That date/time is invalid.');
    if (dt.getTime() < Date.now()) return setError('Please pick a time in the future.');
    if (region !== 'IN') return setError(region ? ROUTING_MESSAGES.hold_not_offered : ROUTING_MESSAGES.billing_country_required);

    setBusy(true);
    const modeLabel = modeList.find((m) => m.id === mode)?.label || 'Online';
    // Carry the seeker's chosen matrices/requirements onto the booking so the
    // teacher (and admins) can see the reason for the session.
    let focus = '';
    try {
      const raw = localStorage.getItem('nostops.focus.v1');
      if (raw) {
        const f = JSON.parse(raw);
        const labels: string[] = Array.isArray(f?.labels) ? f.labels : [];
        const reqs: string[] = Array.isArray(f?.reqs) ? f.reqs : [];
        const parts: string[] = [];
        if (labels.length) parts.push(labels.join(', '));
        if (reqs.length) parts.push(reqs.map((r: string) => r.replace(/_/g, ' ')).join(', '));
        if (parts.length) focus = `Focus: ${parts.join(' · ')}`;
      }
    } catch {
      /* ignore */
    }
    const composedNote = `${modeLabel} session${focus ? ` · ${focus}` : ''}${notes.trim() ? ` · ${notes.trim()}` : ''}`;
    const r = await postBff('/bff/one-on-one/bookings', {
      teacher_handle: teacherHandle,
      slot_iso: dt.toISOString(),
      learner_name: name.trim(),
      learner_phone: cleanPhone,
      note: composedNote,
      session_mode: mode,
      billing_country: country,
    });
    setBusy(false);
    if (!r.ok || !r.data?.booking_id) {
      setError(r.data?.error || 'Could not reserve your session. Please try again.');
      return;
    }
    setReserved({
      bookingId: String(r.data.booking_id),
      amount: Number(r.data.amount) || rateInr || 0,
      phone: cleanPhone,
    });
  }

  if (reserved) {
    return (
      <div className="card p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-2xl">🧘</div>
        <h2 className="mt-4 text-xl font-black tracking-tight text-ink">Your session is reserved</h2>
        <p className="mt-2 text-ink-soft">
          {teacherName} · <span className="font-semibold">{slotLabel}</span>
        </p>
        <div className="mx-auto mt-5 max-w-sm rounded-xl border border-brand/20 bg-brand-50/50 p-4 text-left">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-bold text-brand-700">Complete payment to confirm</p>
            {reserved.amount > 0 && <span className="text-lg font-black text-ink">₹{inr(reserved.amount)}</span>}
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Pay securely with Cashfree to lock in your 1:1 session with {teacherName}.
          </p>
          <div className="mt-4">
            <CashfreePayButton
              amount={reserved.amount}
              orderType="one_on_one"
              referenceId={reserved.bookingId}
              customerPhone={reserved.phone}
              defaultCountry={country}
              note={`1:1 session with ${teacherName}`}
              label={reserved.amount > 0 ? `Pay ₹${inr(reserved.amount)} with Cashfree →` : 'Pay with Cashfree →'}
            />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={`/app/teachers/${teacherHandle}`}
            className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream"
          >
            Back to {teacherName.split(' ')[0]}
          </Link>
          <Link
            href="/app/discover"
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600"
          >
            Explore more teachers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <form onSubmit={onSubmit} noValidate className="card p-6">
        <h2 className="text-lg font-extrabold tracking-tight text-ink">Choose your slot</h2>

        <div className="mt-4">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Session type</span>
          {modeList.length > 1 ? (
            <div className="inline-flex rounded-xl border border-line bg-white p-1" role="group" aria-label="Session type">
              {modeList.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  aria-pressed={mode === m.id}
                  data-testid={`mode-${m.id}`}
                  className={`min-h-[40px] rounded-lg px-4 text-sm font-bold transition ${mode === m.id ? 'bg-brand text-white' : 'text-ink-soft hover:text-brand-700'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="font-semibold text-ink" data-testid={`mode-${modeList[0].id}`}>{modeList[0].label}</p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Date</span>
            <input
              type="date"
              value={date}
              min={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50"
            />
          </label>
        </div>
        {timeZone && <p className="mt-1.5 text-xs text-muted">Times are in {timeZone}.</p>}

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Phone</span>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="For booking confirmation & reminders"
            className="min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Notes for your teacher (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What would you like to focus on?"
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50"
          />
        </label>

        <div className="mt-4">
          <BillingCountryField
            value={country}
            onChange={(v) => { setCountry(v); setError(null); }}
            testId="booking-billing-country"
            hint="Needed before we hold your slot. Only an India billing address can book for now."
          />
          {region === 'INTL' && (
            <HoldNotOfferedNotice testId="booking-intl-not-offered">
              <HoldAlternatives askHref={teacherHostHref(teacherHandle, teacherName)} askLabel="Message the teacher" testId="booking-alternatives" />
            </HoldNotOfferedNotice>
          )}
        </div>

        {/* Next to the button, so a refusal is seen where the buyer tapped (mobile). */}
        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" data-testid="booking-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || region !== 'IN'}
          data-testid="booking-submit"
          className="mt-6 flex min-h-[46px] w-full items-center justify-center rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700"
        >
          {busy ? 'Reserving your session…' : holdButtonLabel(region) || 'Reserve & continue to payment'}
        </button>
      </form>

      {/* Summary */}
      <aside className="md:sticky md:top-20 md:self-start">
        <div className="card p-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Booking summary</h2>
          <p className="mt-3 font-extrabold text-ink">{teacherName}</p>
          <p className="text-sm text-muted">1:1 personalised session</p>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Type</dt>
              <dd className="font-semibold text-ink">{modeList.find((m) => m.id === mode)?.label || 'Online'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">When</dt>
              <dd className="font-semibold text-ink">{slotLabel || '—'}</dd>
            </div>
            {durationMin ? (
              <div className="flex justify-between">
                <dt className="text-muted">Duration</dt>
                <dd className="font-semibold text-ink">{durationMin} min</dd>
              </div>
            ) : null}
          </dl>

          {rateInr ? (
            <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
              <span className="text-sm font-semibold text-muted">Total</span>
              <span className="text-2xl font-black text-ink">₹{inr(rateInr)}</span>
            </div>
          ) : null}

          <p className="mt-3 text-xs text-muted">
            You&apos;ll only be charged after confirming payment on the next step.
          </p>
        </div>
      </aside>
    </div>
  );
}
