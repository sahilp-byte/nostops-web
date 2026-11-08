'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { inr } from '@/lib/format';
import { getBff, postBff } from '@/lib/auth-client';
import { loadReservations, removeReservation, type LocalReservation } from '@/lib/reservations';
import BillingCountryField, { DomesticOnlyNotice, routingButtonLabel } from '@/components/payments/BillingCountryField';
import { billingRegion, ROUTING_MESSAGES } from '@/lib/payment-routing';

type StatusMap = Record<string, string | null>;

const PAID = new Set(['paid', 'confirmed', 'completed', 'succeeded']);
const DEAD = new Set(['cancelled', 'canceled', 'expired', 'refunded']);

function statusChip(s: string | null): { label: string; cls: string } {
  const v = (s || '').toLowerCase();
  if (PAID.has(v)) return { label: 'Confirmed', cls: 'bg-emerald-50 text-emerald-700' };
  if (DEAD.has(v)) return { label: v.charAt(0).toUpperCase() + v.slice(1), cls: 'bg-red-50 text-red-600' };
  if (!s) return { label: 'Checking…', cls: 'bg-cream text-muted' };
  return { label: 'Held · payment pending', cls: 'bg-amber-50 text-amber-700' };
}

function fmtExpiry(iso?: string | null): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export default function ReservationsPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<LocalReservation[]>([]);
  const [status, setStatus] = useState<StatusMap>({});
  const [payBusy, setPayBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [country, setCountry] = useState('');
  const region = billingRegion(country);

  useEffect(() => {
    setMounted(true);
    const list = loadReservations();
    setItems(list);
    list.forEach(async (r) => {
      const res = await getBff<{ status: string | null }>(`/bff/reservations/${r.reservationId}/status`);
      setStatus((m) => ({ ...m, [r.reservationId]: res.ok ? (res.data as any)?.status ?? null : null }));
    });
  }, []);

  const remove = useCallback((id: string) => {
    removeReservation(id);
    setItems((list) => list.filter((x) => x.reservationId !== id));
  }, []);

  async function pay(r: LocalReservation) {
    setErr(null);
    if (region !== 'IN') {
      setErr(region ? ROUTING_MESSAGES.international_not_offered : ROUTING_MESSAGES.billing_country_required);
      return;
    }
    setPayBusy(r.reservationId);
    const res = await postBff(`/bff/retreats/${r.retreatId}/reservations/${r.reservationId}/pay`, { billing_country: country });
    if (!res.ok || !(res.data as any)?.short_url) {
      setPayBusy(null);
      setErr((res.data as any)?.error || 'Could not start the payment. Please try again.');
      return;
    }
    window.location.href = (res.data as any).short_url;
  }

  if (!mounted) {
    return <div className="mx-auto max-w-3xl"><p className="text-ink-soft">Loading your reservations…</p></div>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-black tracking-tight text-ink">My reservations</h1>
      <p className="mt-2 text-ink-soft">Retreat seats you&apos;ve held. Come back any time to complete payment.</p>

      {err && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{err}</p>}

      {items.length === 0 ? (
        <div className="mt-6 card p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-2xl">🧘</div>
          <p className="mt-4 font-semibold text-ink">No reservations yet</p>
          <p className="mt-1 text-sm text-muted">Reserve a seat on a retreat and it&apos;ll appear here so you can finish paying.</p>
          <Link href="/retreats" className="mt-4 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
            Explore retreats
          </Link>
        </div>
      ) : (
        <>
        {items.some((r) => r.kind === 'individual' && !PAID.has((status[r.reservationId] || '').toLowerCase())) && (
          <div className="mt-6 card p-4" data-testid="reservations-billing">
            <BillingCountryField value={country} onChange={(v) => { setCountry(v); setErr(null); }} testId="reservations-billing-country" hint="Used for the seats you pay for below." />
            {region === 'INTL' && <DomesticOnlyNotice testId="reservations-intl-not-offered" />}
          </div>
        )}
        <ul className="mt-6 list-none space-y-3 p-0">
          {items.map((r) => {
            const st = statusChip(status[r.reservationId]);
            const paid = PAID.has((status[r.reservationId] || '').toLowerCase());
            const dead = DEAD.has((status[r.reservationId] || '').toLowerCase());
            const expiry = fmtExpiry(r.expiresAt);
            return (
              <li key={r.reservationId} className="card p-5" data-testid="reservation-item">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-extrabold tracking-tight text-ink">{r.title}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {r.kind === 'group' ? `Group of ${r.groupSize ?? '—'}` : 'Individual seat'}
                      {typeof r.amountInr === 'number' ? ` · ₹${inr(r.amountInr)}` : ''}
                      {expiry && !paid && !dead ? ` · held until ${expiry}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {r.kind === 'individual' && !paid && !dead && (
                      <button
                        type="button"
                        onClick={() => pay(r)}
                        disabled={payBusy === r.reservationId || region !== 'IN'}
                        data-testid="reservation-pay"
                        className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700"
                      >
                        {payBusy === r.reservationId ? 'Starting…' : routingButtonLabel(region) || 'Pay now'}
                      </button>
                    )}
                    {r.kind === 'group' && !paid && !dead && (
                      <span className="text-xs text-muted">Host will share payment details</span>
                    )}
                    {paid && (
                      <Link href={`/app/reservations/${r.retreatId}/complete`} className="rounded-xl border border-brand bg-white px-3 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-50" data-testid="reservation-review">
                        Reflect &amp; review
                      </Link>
                    )}
                    <Link href={`/retreats/${r.retreatId}`} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream">
                      View
                    </Link>
                    <button type="button" onClick={() => remove(r.reservationId)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-muted transition hover:bg-cream" data-testid="reservation-remove">
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        </>
      )}

      <p className="mt-6 rounded-xl border border-line bg-cream/60 p-4 text-center text-xs text-muted">
        This list is kept on this device. Payments are completed on a secure hosted checkout.
      </p>
    </div>
  );
}
