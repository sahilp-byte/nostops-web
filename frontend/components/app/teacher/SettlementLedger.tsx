import { inr } from '@/lib/format';
import { ledgerLine, ledgerTotals, type SettlementReservation } from '@/lib/economics';

// PROMPT 23 — auditable settlement ledger. One row per booking transaction,
// splitting each participant payment into NOSTOPS platform fee, venue settlement
// and teacher net. Reuses the existing payment/reservation data — no parallel
// payment system. Refunds are shown so the ledger reconciles against money moved.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmt(d?: string): string {
  if (!d) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || ''}` : '—';
}

export default function SettlementLedger({
  reservations,
  platformFeePct,
}: {
  reservations: SettlementReservation[];
  platformFeePct: number;
}) {
  const lines = reservations.map((r) => ledgerLine(r, platformFeePct));
  const totals = ledgerTotals(lines);

  return (
    <section data-testid="settlement-ledger">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Booking ledger</h2>
        <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-muted">🔒 Private · auditable</span>
      </div>
      <p className="mb-3 text-[11px] text-muted">Every booking transaction, split into participant payment, NOSTOPS platform fee, venue share and your net. Only rows recorded as paid count toward totals; refunds are listed separately.</p>

      {lines.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-ink-soft">No transactions yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-black uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Booking</th>
                <th className="px-3 py-2 text-right">Participant</th>
                <th className="px-3 py-2 text-right">Platform</th>
                <th className="px-3 py-2 text-right">Venue</th>
                <th className="px-3 py-2 text-right">Your net</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-line/70 last:border-0" data-testid="ledger-row">
                  <td className="px-3 py-2.5">
                    <p className="font-bold text-ink">{l.name}{l.seats > 1 ? ` · ${l.seats} seats` : ''}</p>
                    <p className="text-[11px] text-muted">{l.cohort ? `${l.cohort}` : 'Direct'} · reserved {fmt(l.reservedAt)}{l.paidAt ? ` · paid ${fmt(l.paidAt)}` : ''}{l.cancelledAt ? ` · cancelled ${fmt(l.cancelledAt)}` : ''}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-ink">₹{inr(l.participantInr)}</td>
                  <td className="px-3 py-2.5 text-right text-muted">−₹{inr(l.platformFeeInr)}</td>
                  <td className="px-3 py-2.5 text-right text-muted">−₹{inr(l.venueInr)}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-brand-700">₹{inr(l.teacherNetInr)}</td>
                  <td className="px-3 py-2.5">
                    {l.refunded ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">Refunded</span>
                    ) : l.settled ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Recorded paid</span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-cream/40 text-sm font-black text-ink">
                <td className="px-3 py-2.5">Totals (recorded paid)</td>
                <td className="px-3 py-2.5 text-right" data-testid="ledger-total-participant">₹{inr(totals.participantInr)}</td>
                <td className="px-3 py-2.5 text-right text-muted">−₹{inr(totals.platformFeeInr)}</td>
                <td className="px-3 py-2.5 text-right text-muted">−₹{inr(totals.venueInr)}</td>
                <td className="px-3 py-2.5 text-right text-brand-700">₹{inr(totals.teacherNetInr)}</td>
                <td className="px-3 py-2.5" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {totals.refundedInr > 0 && (
        <p className="mt-2 text-xs text-muted" data-testid="ledger-refunded">Refunds recorded: <span className="font-bold text-red-600">₹{inr(totals.refundedInr)}</span> — reversed, not counted in totals.</p>
      )}
    </section>
  );
}
