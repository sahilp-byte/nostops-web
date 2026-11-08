'use client';

import { useState } from 'react';
import CashfreePayButton from '@/components/payments/CashfreePayButton';

const CHIPS = [500, 1000, 2000, 5000];
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

// Teacher wallet top-up via Cashfree hosted checkout. The BFF derives the
// customer from the session; we pass the teacher's own id as the order
// reference and the registered phone for the checkout contact.
export default function WalletTopUp() {
  const [amount, setAmount] = useState('');
  const amt = parseInt(amount, 10) || 0;
  const valid = amt >= 100 && amt <= 100000;

  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="wallet-topup">
      <h2 className="text-sm font-extrabold text-ink">Top up your wallet</h2>
      <p className="mt-1 text-sm text-ink-soft">Add funds to your NOSTOPS wallet to cover platform fees and programme dues.</p>

      <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-muted">Amount (₹)</label>
      <input
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="0"
        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-lg font-bold text-ink"
        data-testid="topup-amount"
      />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {CHIPS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAmount(String(v))}
            className="rounded-full border border-line px-2.5 py-1 text-xs font-bold text-ink-soft hover:bg-brand-50"
          >
            {inr(v)}
          </button>
        ))}
      </div>
      {amt > 0 && !valid && <p className="mt-2 text-xs font-semibold text-red-600">Enter an amount between ₹100 and ₹1,00,000.</p>}

      <div className="mt-4">
        {valid ? (
          <CashfreePayButton
            amount={amt}
            orderType="wallet_topup"
            note="NOSTOPS wallet top-up"
            label={`Add ${inr(amt)} with Cashfree →`}
          />
        ) : (
          <button
            type="button"
            disabled
            className="w-full rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white opacity-50"
          >
            Add money with Cashfree →
          </button>
        )}
      </div>
    </section>
  );
}
