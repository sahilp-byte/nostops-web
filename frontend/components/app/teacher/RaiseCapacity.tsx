'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

// Raise Capacity — one-tap seat bump for an authorised host when a retreat is
// full/near-full and the venue can genuinely take more. Reuses the existing
// edit BFF (PATCH seats_total). The backend HARD-LOCKS capacity once any seat is
// paid (to protect confirmed guests), so when locked we explain that instead.
const MAX = 200;

export default function RaiseCapacity({
  retreatId,
  seatsTotal,
  seatsFilled,
  locked,
  paidCount,
}: {
  retreatId: string;
  seatsTotal: number;
  seatsFilled: number;
  locked: boolean;
  paidCount: number;
}) {
  const router = useRouter();
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const atMax = seatsTotal >= MAX;

  async function raise(by: number) {
    if (!ack || busy) return;
    const next = Math.min(MAX, seatsTotal + by);
    if (next <= seatsTotal) return;
    setBusy(true);
    setMsg(null);
    const r = await sendBff(`/bff/teacher/retreats/${retreatId}`, 'PATCH', { seats_total: next });
    setBusy(false);
    if (r.ok) {
      setMsg({ text: `Capacity raised to ${next} seats ✓`, ok: true });
      router.refresh();
      return;
    }
    setMsg({ text: r.data?.error || 'Could not raise capacity.', ok: false });
  }

  if (locked) {
    return (
      <div className="rounded-xl border border-line bg-cream/50 px-3.5 py-2.5" data-testid="raise-capacity-locked">
        <p className="text-xs text-ink-soft">🔒 Capacity is locked — {paidCount} {paidCount === 1 ? 'participant has' : 'participants have'} already paid, so seats can&apos;t be changed. This protects your confirmed guests.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand/25 bg-brand-50/40 p-3.5" data-testid="raise-capacity">
      <p className="text-sm font-extrabold text-ink">Venue has more room?</p>
      <p className="mt-0.5 text-xs text-ink-soft">If the venue can genuinely take more guests, raise this retreat&apos;s capacity in one tap. Currently {seatsTotal} seats · {seatsFilled} filled.</p>
      {atMax ? (
        <p className="mt-2 text-xs font-semibold text-muted">You&apos;re at the {MAX}-seat maximum.</p>
      ) : (
        <>
          <label className="mt-2.5 flex items-start gap-2 text-xs text-ink-soft" htmlFor="raise-ack">
            <input id="raise-ack" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" data-testid="raise-ack" />
            <span>I confirm the venue can accommodate more guests.</span>
          </label>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {[1, 2, 5].map((n) => {
              const next = Math.min(MAX, seatsTotal + n);
              const disabled = busy || !ack || next <= seatsTotal;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => raise(n)}
                  disabled={disabled}
                  className="rounded-lg bg-brand px-3.5 py-2 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-40"
                  data-testid={`raise-plus-${n}`}
                >
                  +{n} seat{n > 1 ? 's' : ''}
                </button>
              );
            })}
          </div>
        </>
      )}
      {msg && <p className={`mt-2 text-xs font-bold ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`} data-testid="raise-msg">{msg.text}</p>}
    </div>
  );
}
