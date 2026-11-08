import { backendFetch } from '@/lib/server/session';

// Admin Payouts data layer (PHASE 5, FINANCIAL SAFETY AUDIT 2026-06).
// A PAGE VIEW reads only routes with no side effects:
//   • GET /api/admin/refunds/pending   → pending refund count
//   • GET /api/admin/retreats/payouts  → retreat payout totals
// The payout queue (GET /api/admin/payouts/list) is NOT read on a page view: the
// main backend runs its cooling→eligible sweep on every list call. It is loaded
// only by an explicit admin action (POST /bff/admin/payouts/queue), and not at all
// while the financial lock is on. /admin/payouts/sweep is never called.

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

export type PayoutRow = {
  ledgerId: string;
  teacherName: string;
  amount: number;
  status: string | null;
  method: string | null;
  destination: string | null; // upi / masked bank
  createdAt: string | null;
  coolingUntil: string | null;
};

export function projectPayout(p: any): PayoutRow {
  return {
    ledgerId: str(p.ledger_id) || str(p.id) || str(p._id) || '',
    teacherName: str(p.teacher_name) || str(p.name) || 'Teacher',
    amount: num(p.net_amount ?? p.amount ?? p.amount_inr),
    status: str(p.status),
    method: str(p.method) || str(p.payout_method),
    destination: str(p.upi) || str(p.upi_id) || str(p.bank_masked) || str(p.destination),
    createdAt: str(p.created_at) || str(p.requested_at),
    coolingUntil: str(p.cooling_until) || str(p.eligible_at),
  };
}

export type PayoutsOverview = {
  refundsPending: number;
  retreat: { count: number; platformFeeEarned: number; grossProcessed: number };
};

export async function getPayoutsOverview(): Promise<PayoutsOverview> {
  const [refundRes, retreatRes] = await Promise.all([
    backendFetch('/admin/refunds/pending'),
    backendFetch('/admin/retreats/payouts'),
  ]);
  const refunds = refundRes.ok ? await refundRes.json().catch(() => ({})) : {};
  const retreat = retreatRes.ok ? await retreatRes.json().catch(() => ({})) : {};
  return {
    refundsPending: num(refunds.count),
    retreat: {
      count: num(retreat.count),
      platformFeeEarned: num(retreat.total_platform_fee_earned),
      grossProcessed: num(retreat.total_gross_processed),
    },
  };
}
