import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getOneOnOneDetail, type LedgerEvent } from '@/lib/server/audit';
import { inr, titleCase, fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · 1:1 Session', robots: { index: false, follow: false } };

const STATUS_CLS: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-50 text-amber-700',
  PAYMENT_INITIATED: 'bg-blue-50 text-blue-700',
  PAID: 'bg-emerald-50 text-emerald-700',
};
const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Pending payment',
  PAYMENT_INITIATED: 'Payment initiated',
  PAID: 'Paid',
};

const EVENT_META: Record<string, { label: string; note: string; dot: string }> = {
  reserve: { label: 'Session reserved', note: 'Seeker reserved the slot — awaiting payment', dot: 'bg-amber-500' },
  order_created: { label: 'Checkout started', note: 'Payment order created at the gateway', dot: 'bg-blue-500' },
  payment_confirmed: { label: 'Payment confirmed', note: 'Gateway confirmed the payment', dot: 'bg-emerald-500' },
};

function iso(ms?: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink">{value || '—'}</dd>
    </div>
  );
}

export default async function AdminOneOnOneDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  await requireAdminUser();
  const { bookingId } = await params;
  const s = await getOneOnOneDetail(bookingId);
  if (!s) notFound();

  const status = s.status || 'PENDING_PAYMENT';
  const events: LedgerEvent[] = Array.isArray(s.events) ? s.events : [];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/admin/one-on-one" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to 1:1 Sessions</Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · 1:1 Session</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
            {s.teacher_name || s.teacher_handle || 'Teacher'} <span className="text-muted">←</span> {s.seeker_name || s.seeker_email || 'Seeker'}
          </h1>
          <p className="mt-1 break-all text-xs text-muted">{s.booking_id}</p>
        </div>
        <div className="text-right">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_CLS[status] || 'bg-slate-100 text-slate-600'}`}>
            {STATUS_LABEL[status] || titleCase(status)}
          </span>
          {s.amount_inr ? <p className="mt-2 text-2xl font-black tabular-nums text-ink">₹{inr(s.amount_inr)}</p> : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Booking</h2>
          <dl className="mt-2">
            <Field label="Teacher" value={s.teacher_name} />
            <Field label="Teacher handle" value={s.teacher_handle} />
            <Field label="Seeker" value={s.seeker_name} />
            <Field label="Seeker email" value={s.seeker_email} />
            <Field label="Session type" value={s.session_mode ? titleCase(s.session_mode) : null} />
            <Field label="Preferred slot" value={s.slot_iso ? fmtDateTime(s.slot_iso) : null} />
            <Field label="Focus / reason" value={s.matrix_reason} />
          </dl>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Payment</h2>
          <dl className="mt-2">
            <Field label="Amount" value={s.amount_inr ? `₹${inr(s.amount_inr)} ${s.currency || 'INR'}` : null} />
            <Field label="Gateway" value={s.gateway ? titleCase(s.gateway) : null} />
            <Field label="Order id" value={s.order_id} />
            <Field label="Status" value={STATUS_LABEL[status] || titleCase(status)} />
            <Field label="Booked" value={s.created_at ? fmtDateTime(iso(s.created_at)) : null} />
            <Field label="Last update" value={s.updated_at ? fmtDateTime(iso(s.updated_at)) : null} />
          </dl>
          {s.note && (
            <div className="mt-3 rounded-xl border border-line bg-cream/40 p-3">
              <p className="text-xs font-semibold text-muted">Booking note</p>
              <p className="mt-1 text-sm text-ink-soft">{s.note}</p>
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Timeline</h2>
        <ol className="mt-4 space-y-4">
          {events.length === 0 ? (
            <li className="text-sm text-muted">No events recorded.</li>
          ) : (
            events.map((e, i) => {
              const meta = EVENT_META[e.event] || { label: titleCase(e.event), note: '', dot: 'bg-slate-400' };
              return (
                <li key={i} className="flex gap-3" data-testid={`event-${e.event}`}>
                  <div className="flex flex-col items-center">
                    <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${meta.dot}`} />
                    {i < events.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
                  </div>
                  <div className="min-w-0 pb-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="text-sm font-bold text-ink">{meta.label}</p>
                      <span className="text-xs text-muted">{fmtDateTime(iso(e.at))}</span>
                    </div>
                    {meta.note && <p className="text-xs text-ink-soft">{meta.note}</p>}
                    <p className="mt-0.5 text-[11px] text-muted">
                      {[
                        e.gateway ? titleCase(e.gateway) : null,
                        e.order_id ? `order ${e.order_id}` : null,
                        e.amount_inr ? `₹${inr(e.amount_inr)}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </li>
              );
            })
          )}
        </ol>
      </section>
    </div>
  );
}
