import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getPayoutsOverview } from '@/lib/server/admin-payouts';
import { financialActionsLocked } from '@/lib/server/financial-lock';
import { inr } from '@/lib/format';
import PayoutsQueue from '@/components/app/admin/PayoutsQueue';
import FinancialLockNotice from '@/components/app/FinancialLockNotice';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Payouts', robots: { index: false, follow: false } };

// FINANCIAL SAFETY AUDIT: viewing this page never changes a payout. It reads only
// side-effect-free totals; the queue loads on an explicit admin action, and not at
// all while the financial lock is on.
export default async function AdminPayoutsPage() {
  await requireAdminUser();
  const data = await getPayoutsOverview();
  const locked = financialActionsLocked();

  return (
    <div className="mx-auto max-w-4xl" data-testid="admin-payouts">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Money &amp; Growth</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Payouts</h1>

      <div className="mt-6">
        {locked ? (
          <FinancialLockNotice title="Payouts are paused for the financial safety audit">
            <p className="mt-2 text-xs text-amber-900/80">
              The payout queue is not loaded, because loading it on the main backend moves payouts from cooling to eligible.
              Approve, reject and withdrawals stay off until the founder approves the next stage.
            </p>
          </FinancialLockNotice>
        ) : (
          <PayoutsQueue />
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className={`text-2xl font-black tabular-nums ${data.refundsPending > 0 ? 'text-red-700' : 'text-ink'}`}>{data.refundsPending}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">Refunds pending</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-2xl font-black tabular-nums text-ink">{data.retreat.count}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">Retreat payouts processed</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-2xl font-black tabular-nums text-brand-700">₹{inr(data.retreat.platformFeeEarned)}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">Retreat platform fee</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-2xl font-black tabular-nums text-ink">₹{inr(data.retreat.grossProcessed)}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">Retreat gross processed</p>
        </div>
      </div>
    </div>
  );
}
