import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';
import { financialLockedJson } from '@/lib/server/financial-lock';
import { projectPayout, type PayoutRow } from '@/lib/server/admin-payouts';

// Payout actions (PHASE 5, FINANCIAL SAFETY AUDIT 2026-06). CSRF-guarded + admin-only.
//   queue   → GET  /api/admin/payouts/list            (explicit action: it runs the sweep)
//   approve → POST /api/admin/payouts/approve  { ledger_id, note? }
//   reject  → POST /api/admin/payouts/reject   { ledger_id, reason }
// While the financial lock is on, every action answers 423 before anything else.
const ACTIONS = new Set(['queue', 'approve', 'reject']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const locked = financialLockedJson();
  if (locked) return locked;
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { action } = await params;
  if (!ACTIONS.has(action)) return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  const raw = await req.json().catch(() => ({}));

  if (action === 'queue') {
    if (raw?.confirm_sweep !== true) return NextResponse.json({ ok: false, error: 'Please confirm before loading the queue.' }, { status: 400 });
    console.info(`[payouts] queue loaded (runs the main-backend sweep) by admin ${String(guard.user.user_id || '')}`);
    const up = await backendFetch('/admin/payouts/list').catch(() => null);
    if (!up || !up.ok) return NextResponse.json({ ok: false, error: 'Payout service is unavailable right now.' }, { status: up?.status || 502 });
    const list = await up.json().catch(() => ({}));
    const rows: PayoutRow[] = (Array.isArray(list.payouts) ? list.payouts : []).map(projectPayout).filter((r: PayoutRow) => r.ledgerId);
    return NextResponse.json({ ok: true, rows });
  }

  const ledgerId = typeof raw?.ledger_id === 'string' ? raw.ledger_id.trim() : '';
  if (!ledgerId) return NextResponse.json({ ok: false, error: 'A payout reference is required.' }, { status: 400 });

  let body: Record<string, unknown>;
  if (action === 'reject') {
    const reason = typeof raw?.reason === 'string' ? raw.reason.trim() : '';
    if (reason.length < 3) return NextResponse.json({ ok: false, error: 'A rejection reason is required.' }, { status: 400 });
    body = { ledger_id: ledgerId, reason: reason.slice(0, 400) };
  } else {
    body = { ledger_id: ledgerId, note: typeof raw?.note === 'string' ? raw.note.slice(0, 400) : '' };
  }

  let up: Response;
  try {
    up = await backendFetch(`/admin/payouts/${action}`, { method: 'POST', body: JSON.stringify(body) });
  } catch {
    return NextResponse.json({ ok: false, error: 'Payout service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok || data?.success === false) {
    return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'Could not complete the action.') }, { status: up.status || 502 });
  }

  revalidatePath('/app/admin/payouts');
  return NextResponse.json({ ok: true });
}
