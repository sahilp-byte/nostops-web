import type { TeacherWallet } from '@/lib/server/teacher';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function fmt(ts: number | null): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

// Status pill colours by settlement state (bank/UPI payouts move async, so a
// withdrawal sits as pending → processing before it's paid).
function pill(status: string): { label: string; cls: string } {
  const s = status.toLowerCase();
  if (['paid', 'success', 'completed', 'settled'].some((x) => s.includes(x))) return { label: 'Marked paid', cls: 'bg-brand-50 text-brand-700' };
  if (['fail', 'reject', 'cancel', 'reverse', 'return'].some((x) => s.includes(x))) return { label: status, cls: 'bg-red-50 text-red-700' };
  return { label: status || 'Pending', cls: 'bg-amber-50 text-amber-700' };
}

type Payouts = NonNullable<TeacherWallet>['payouts'];

export default function PayoutStatus({ payouts }: { payouts: Payouts }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="payout-status">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-ink">Withdrawal requests</h2>
        <div className="flex gap-4 text-xs font-semibold text-muted">
          <span>Pending · <span className="font-black text-amber-600">{inr(payouts.pending)}</span></span>
          <span>Marked paid · <span className="font-black text-brand-700">{inr(payouts.totalPaid)}</span></span>
        </div>
      </div>

      {payouts.items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No withdrawal requests yet. Each request and the status recorded for it appears here.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line p-0">
          {payouts.items.map((it) => {
            const p = pill(it.status);
            return (
              <li key={it.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {inr(it.amount)}{it.method ? ` · ${it.method === 'upi' ? 'UPI' : 'Bank'}` : ''}
                  </p>
                  <p className="text-xs text-muted">{[fmt(it.ts), it.utr ? `UTR ${it.utr}` : ''].filter(Boolean).join(' · ')}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${p.cls}`}>{p.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
