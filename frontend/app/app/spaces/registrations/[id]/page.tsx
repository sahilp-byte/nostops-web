import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getSpaceRegistration, inr, REG_STATUS, verifySpaceRegistration } from '@/lib/server/space-registrations';
import { fmtDateLong, fmtDateTime } from '@/lib/format';
import RegSteps from '@/components/spaces/RegSteps';
import SpaceRegistrationActions from '@/components/spaces/SpaceRegistrationActions';
import { SpacesPageHeader } from '@/components/spaces/ui';

export const metadata: Metadata = { title: 'Registration', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const HEAD: Record<string, { title: string; sub: string; icon: string; tone: string }> = {
  CONFIRMED: { title: 'Your Registration is Confirmed!', sub: 'Your place is confirmed.', icon: '✓', tone: 'bg-emerald-500' },
  PENDING_PAYMENT: { title: 'Payment not yet confirmed', sub: 'Your place is held for a short time. It is confirmed only after NOSTOPS verifies your payment with the gateway.', icon: '…', tone: 'bg-amber-500' },
  PAYMENT_FAILED: { title: 'Payment was not completed', sub: 'No place was confirmed and the reserved place has been released.', icon: '!', tone: 'bg-red-500' },
  EXPIRED: { title: 'Reservation expired', sub: 'Payment was not completed in time, so the reserved place was released.', icon: '!', tone: 'bg-stone-400' },
  CANCELLED: { title: 'Registration cancelled', sub: 'This registration has been cancelled.', icon: '×', tone: 'bg-stone-400' },
};
const REFUND: Record<string, string> = { REQUESTING: 'Refund being requested', PENDING: 'Refund in progress', SUCCESS: 'Refunded', ONHOLD: 'Refund on hold', CANCELLED: 'Refund cancelled', MANUAL_REVIEW: 'Refund under review by NOSTOPS' };

export default async function SpaceRegistrationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ order_id?: string }> }) {
  const { id } = await params;
  const { order_id } = await searchParams;
  if (!(await getSessionUser())) redirect(`/login?next=/app/spaces/registrations/${id}`);
  // Returning from checkout: the server re-reads the gateway's record before anything is shown.
  const r = order_id ? (await verifySpaceRegistration(id)) || (await getSpaceRegistration(id)) : await getSpaceRegistration(id);
  if (!r) notFound();
  const h = HEAD[r.status] || HEAD.CANCELLED;
  const paid = r.pricing_mode === 'PAID';
  const ev = r.event;
  const rows: [string, string][] = [
    ['Registration ID', r.registration_id], ['Programme', ev?.title || '—'], ['Participant', r.participant_name || '—'],
    ['Status', REG_STATUS[r.status]?.label || r.status],
    [paid ? 'Amount' : 'Fee', paid ? `${inr(r.amount)} (${r.status === 'CONFIRMED' ? 'paid' : 'not confirmed'})` : 'Free'],
    ...(paid ? [['Payment reference', r.payment_reference || '—'] as [string, string], ['Payment status', (r.payment_status || '—').replace(/_/g, ' ').toLowerCase()] as [string, string]] : []),
    ...(r.refund_status ? [['Refund', REFUND[r.refund_status] || r.refund_status] as [string, string]] : []),
    ['Registered on', fmtDateTime(r.created_at)],
  ];
  return (
    <div className="mx-auto max-w-6xl" data-testid="space-reg-page">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SpacesPageHeader crumbs={[{ label: 'My Registrations', href: '/app/spaces/registrations' }, { label: r.registration_id }]} image={null}
            title={r.status === 'CONFIRMED' ? 'Registration Confirmed!' : 'Registration status'} subtitle="Thank you! Your registration details are below." />
          <div className="w-full max-w-md"><RegSteps current={r.status === 'CONFIRMED' ? 3 : r.status === 'PENDING_PAYMENT' ? 2 : 1} paid={paid} /></div>
        </div>
        <section className="sp-panel-peach relative flex items-center gap-5 overflow-hidden p-6" data-testid="space-reg-banner" data-status={r.status}>
          <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-full text-3xl font-black text-white ring-8 ring-white/70 ${h.tone}`} aria-hidden>{h.icon}</span>
          <div className="relative z-10">
            <h2 className="text-[30px]" data-testid="space-reg-title">{h.title}</h2>
            <p className="mt-1 text-[16px] text-ink-soft">{r.status === 'CONFIRMED' && ev?.title ? `You are now enrolled in ${ev.title}.` : h.sub}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/spaces/note-figure.png" alt="" aria-hidden className="sp-blend pointer-events-none absolute bottom-0 right-4 hidden h-28 w-auto lg:block" />
        </section>
        <div className="grid gap-5 md:grid-cols-2">
          <section className="sp-card p-5" data-testid="space-reg-details">
            <h3 className="text-[22px]">Registration Details</h3>
            <dl className="mt-3 divide-y divide-line text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2"><dt className="text-ink-soft">{k}</dt><dd className="text-right font-bold text-ink">{v}</dd></div>)}</dl>
          </section>
          <section className="sp-card p-5">
            <h3 className="text-[22px]">Programme Schedule</h3>
            <dl className="mt-3 divide-y divide-line text-sm">
              <div className="flex justify-between py-2"><dt className="text-ink-soft">Start date</dt><dd className="font-bold text-ink">{ev?.event_date ? fmtDateLong(ev.event_date) : '—'}</dd></div>
              {ev?.last_session_date && <div className="flex justify-between py-2"><dt className="text-ink-soft">End date</dt><dd className="font-bold text-ink">{fmtDateLong(ev.last_session_date)}</dd></div>}
              <div className="flex justify-between py-2"><dt className="text-ink-soft">Session time</dt><dd className="font-bold text-ink">{[ev?.start_time, ev?.end_time].filter(Boolean).join(' – ') || '—'}</dd></div>
              <div className="flex justify-between gap-3 py-2"><dt className="text-ink-soft">Venue</dt><dd className="text-right font-bold text-ink">{ev?.space?.name}<br /><span className="font-normal text-ink-soft">{[ev?.space?.locality, ev?.space?.district].filter(Boolean).join(', ')}</span></dd></div>
              <div className="flex justify-between py-2"><dt className="text-ink-soft">Teacher</dt><dd className="font-bold text-ink">{ev?.teacher_name || '—'}</dd></div>
            </dl>
          </section>
        </div>
        <section className="sp-card p-5">
          <SpaceRegistrationActions id={r.registration_id} pending={r.status === 'PENDING_PAYMENT'} canCancel={!!r.can_cancel} rule={r.cancel_rule} paid={paid} />
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/app/spaces/registrations" className="sp-btn-primary bg-accent" data-testid="space-reg-mine">Go to My Registrations →</Link>
            {ev?.slug && <Link href={`/events/${ev.slug}`} className="sp-btn-secondary">View programme</Link>}
          </div>
        </section>
      </div>
    </div>
  );
}
