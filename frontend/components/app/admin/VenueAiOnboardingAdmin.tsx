'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

type Order = { orderId: string; status?: string; paid: boolean; amount?: number; currency?: string; createdAt?: number; duplicatePayment: boolean };

/** Admin view of a venue's paid AI-onboarding upgrade + its admin-confirmed Google place. */
export default function VenueAiOnboardingAdmin({
  id,
  active,
  placeId,
  placeConfirmedBy,
  purchasedAt,
  orders,
  grandfathered,
}: {
  id: string;
  active: boolean;
  placeId: string | null;
  placeConfirmedBy?: string;
  purchasedAt?: number;
  orders: Order[];
  grandfathered: boolean;
}) {
  const router = useRouter();
  const [pid, setPid] = useState(placeId || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await postBff(`/bff/admin/venue-submissions/${encodeURIComponent(id)}/google-place`, { place_id: pid.trim() });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: (r.data as { error?: string })?.error || 'Could not save.' }); return; }
    setMsg({ ok: true, text: pid.trim() ? 'Google place confirmed — photos & reviews will show on the listing.' : 'Google place cleared.' });
    router.refresh();
  }

  const status = grandfathered
    ? { label: 'Included (admin-confirmed, before per-venue payments)', cls: 'bg-emerald-100 text-emerald-800' }
    : active
      ? { label: `Paid${purchasedAt ? ` · ${new Date(purchasedAt).toLocaleDateString('en-IN')}` : ''}`, cls: 'bg-emerald-100 text-emerald-800' }
      : { label: 'Not purchased — free listing', cls: 'bg-cream text-ink-soft' };
  const dupes = orders.filter((o) => o.duplicatePayment);

  return (
    <div className="mt-4 rounded-2xl border border-indigo-200 bg-white p-4" data-testid="ai-onboarding-admin">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black text-ink">✨ AI-assisted onboarding &amp; Google content</p>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.cls}`} data-testid="ai-onboarding-status">{status.label}</span>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        Google photos and reviews appear only on paid (or admin-confirmed) listings. Free listings show the owner&apos;s own photos.
      </p>
      {dupes.length > 0 && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700" data-testid="ai-onboarding-duplicate">
          ⚠ {dupes.length} extra payment{dupes.length > 1 ? 's' : ''} received for this venue ({dupes.map((o) => o.orderId).join(', ')}) — please refund.
        </p>
      )}
      {active && !grandfathered && (
        <div className="mt-3">
          <label className="text-xs font-bold text-muted" htmlFor="ai-place-id">Confirmed Google Place ID</label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input id="ai-place-id" value={pid} onChange={(e) => setPid(e.target.value)} placeholder="ChIJ…" className="min-w-0 flex-1 rounded-xl border border-line bg-white p-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" data-testid="ai-place-input" />
            <button type="button" onClick={save} disabled={busy} className="min-h-[44px] rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50" data-testid="ai-place-save">
              {busy ? 'Saving…' : 'Save place'}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Check the exact business on Google Maps first — the wrong place would show another venue&apos;s photos.
            {placeConfirmedBy ? ` Last confirmed by ${placeConfirmedBy}.` : ''}
          </p>
          {msg && <p className={`mt-2 text-xs font-semibold ${msg.ok ? 'text-brand-700' : 'text-red-700'}`} role="status">{msg.text}</p>}
        </div>
      )}
      {orders.length > 0 && (
        <ul className="mt-3 list-none space-y-1 p-0 text-xs text-ink-soft">
          {orders.map((o) => (
            <li key={o.orderId}>
              {o.orderId} · {o.paid ? 'Paid' : o.status || 'Started'}{o.amount ? ` · ${o.currency === 'USD' ? 'US$' : '₹'}${o.amount}` : ''}
              {o.createdAt ? ` · ${new Date(o.createdAt).toLocaleString('en-IN')}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
