import Link from 'next/link';
import { getTeacherOneOnOne } from '@/lib/server/audit';
import { inrExact, titleCase } from '@/lib/format';

// Teacher's own 1:1 bookings + expected earnings, from the local NOSTOPS ledger
// (filtered server-side to THIS teacher — anti-poaching safe). Renders nothing
// when the teacher has no web 1:1 bookings yet, so it never clutters the
// dashboard. `verified` drives the "get verified to receive payouts" nudge.
export default async function TeacherOneOnOneSnapshot({ verified }: { verified: boolean }) {
  const { rows, stats, monthly } = await getTeacherOneOnOne();
  if (stats.count === 0) return null;

  const recent = rows.slice(0, 3);

  return (
    <section className="rounded-2xl border border-brand/25 bg-brand-50/40 p-5 sm:p-6" data-testid="teacher-1on1-snapshot">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Your 1:1 bookings</p>
          <h2 className="mt-0.5 text-lg font-black tracking-tight text-ink">Sessions booked via NOSTOPS</h2>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink-soft">You keep 85%</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-line bg-white p-3">
          <p className="text-xl font-black tabular-nums text-ink">{stats.count}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted">Sessions</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3">
          <p className="text-xl font-black tabular-nums text-emerald-700">₹{inrExact(stats.paid_net_inr)}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted">Confirmed earnings</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-3">
          <p className="text-xl font-black tabular-nums text-amber-700">₹{inrExact(stats.pending_net_inr)}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted">Expected (pending)</p>
        </div>
      </div>

      {monthly.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Monthly earnings (recorded)</p>
          <div className="mt-1.5 divide-y divide-line">
            {monthly.map((m) => (
              <div key={m.month} className="flex items-center justify-between gap-3 py-1.5" data-testid={`payout-${m.month}`}>
                <span className="text-sm font-semibold text-ink">{m.label}</span>
                <span className="text-sm tabular-nums">
                  <span className="font-bold text-emerald-700">₹{inrExact(m.earned_net_inr)}</span>
                  <span className="text-muted"> earned</span>
                  {m.pending_net_inr > 0 && (
                    <span className="text-amber-700"> · ₹{inrExact(m.pending_net_inr)} on the way</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <ul className="mt-4 space-y-2">
          {recent.map((r) => (
            <li key={r.booking_id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{r.seeker_name || 'A seeker'}</p>
                <p className="truncate text-[11px] text-muted">
                  {[r.session_mode ? titleCase(r.session_mode) : null, r.matrix_reason || null].filter(Boolean).join(' · ') || '1:1 session'}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {/* The server's per-booking share (exact to the paisa) — the same figure the totals add up. */}
                {r.amount_inr && typeof r.teacher_net_inr === 'number' ? <p className="text-sm font-black tabular-nums text-ink">₹{inrExact(r.teacher_net_inr)}</p> : null}
                <p className={`text-[10px] font-bold ${r.status === 'PAID' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {r.status === 'PAID' ? 'Paid' : 'Pending'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!verified && (stats.pending_net_inr > 0 || stats.paid_net_inr > 0) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-sm font-semibold text-amber-800">
            Get verified to have eligible earnings recorded in your NOSTOPS wallet.
          </p>
          <Link
            href="/app/teacher/kyc"
            className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600"
          >
            Complete InstaKYC →
          </Link>
        </div>
      )}
    </section>
  );
}
