import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';
import { requireVerifiedTeacher } from '@/lib/server/teacher-guard';
import { financialLockedJson } from '@/lib/server/financial-lock';

// Teacher wallet money-out actions. CSRF-guarded, whitelisted proxy. Every path
// forwards only sanitised fields to the backend, which owns the PIN/OTP/ledger
// logic. Actions: setup-pin | otp-start | otp-verify | withdraw.
type Handler = { path: string; build: (raw: any) => { body: Record<string, unknown> } | { error: string } };

const ACTIONS: Record<string, Handler> = {
  'setup-pin': {
    path: '/teacher-wallet/setup-pin',
    build: (raw) => {
      const pin = String(raw?.pin ?? '');
      if (!/^\d{4}$/.test(pin)) return { error: 'PIN must be exactly 4 digits.' };
      return { body: { pin } };
    },
  },
  'otp-start': {
    path: '/teacher-wallet/withdraw/otp/start',
    build: () => ({ body: { phone: '', purpose: 'withdraw' } }),
  },
  'otp-verify': {
    path: '/teacher-wallet/withdraw/otp/verify',
    build: (raw) => {
      const code = String(raw?.code ?? '').trim();
      if (!/^\d{4,8}$/.test(code)) return { error: 'Enter the OTP code sent to your phone.' };
      return { body: { phone: '', code, purpose: 'withdraw' } };
    },
  },
  'payout-details': {
    path: '/teacher-wallet/payout-details',
    build: (raw) => {
      const pin = String(raw?.pin ?? '');
      if (!/^\d{4}$/.test(pin)) return { error: 'Enter your 4-digit wallet PIN.' };
      const bankNo = String(raw?.bank_account_number ?? '').replace(/\s/g, '');
      const ifsc = String(raw?.bank_ifsc ?? '').trim().toUpperCase();
      const holder = String(raw?.bank_account_holder ?? '').trim();
      const upi = String(raw?.upi_id ?? '').trim();
      const hasBank = !!(bankNo || ifsc || holder);
      if (!hasBank && !upi) return { error: 'Add a bank account or a UPI ID.' };
      if (hasBank && !(bankNo && ifsc && holder)) return { error: 'Bank account needs the account number, IFSC and holder name.' };
      if (bankNo && !/^\d{6,18}$/.test(bankNo)) return { error: 'Enter a valid bank account number.' };
      if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return { error: 'Enter a valid IFSC code (e.g. HDFC0000258).' };
      if (upi && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi)) return { error: 'Enter a valid UPI ID (e.g. name@bank).' };
      const body: Record<string, unknown> = { pin };
      if (hasBank) { body.bank_account_number = bankNo; body.bank_ifsc = ifsc; body.bank_account_holder = holder; }
      if (upi) body.upi_id = upi;
      return { body };
    },
  },
  withdraw: {
    path: '/teacher-wallet/withdraw',
    build: (raw) => {
      const amount = Math.floor(Number(raw?.amount_inr));
      const pin = String(raw?.pin ?? '');
      const method = raw?.payout_method === 'bank' || raw?.payout_method === 'upi' ? raw.payout_method : '';
      if (!Number.isFinite(amount) || amount < 1) return { error: 'Enter a valid amount.' };
      if (!/^\d{4}$/.test(pin)) return { error: 'Enter your 4-digit wallet PIN.' };
      if (!method) return { error: 'Choose a payout method.' };
      return { body: { amount_inr: amount, pin, payout_method: method } };
    },
  },
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  // FINANCIAL SAFETY AUDIT: withdrawals, PIN, OTP and payout destination are paused for everyone.
  const locked = financialLockedJson();
  if (locked) return locked;
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const gate = await requireVerifiedTeacher();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { action } = await params;
  const handler = ACTIONS[action];
  if (!handler) return NextResponse.json({ error: 'unknown action' }, { status: 404 });

  const raw = await req.json().catch(() => ({}));
  const built = handler.build(raw);
  if ('error' in built) return NextResponse.json({ error: built.error }, { status: 400 });

  const up = await backendFetch(handler.path, { method: 'POST', body: JSON.stringify(built.body) });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText(data?.detail, 'Request could not be completed.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, data });
}
