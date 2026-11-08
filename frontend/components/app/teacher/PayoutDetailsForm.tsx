'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

type Props = {
  hasPin: boolean;
  ifsc: string | null;
  accountHolder: string | null;
  upiId: string | null;
  bankMasked: string | null;
};

// Add / update the teacher's payout destination (bank account and/or UPI),
// protected by the wallet PIN. Saving a valid destination unlocks the Withdraw
// box below. Backend enforces the teacher verification gate — if the teacher
// isn't verified/empanelled yet, it returns a clear message which we surface.
export default function PayoutDetailsForm(props: Props) {
  const router = useRouter();
  const { hasPin } = props;

  const [open, setOpen] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [ifsc, setIfsc] = useState(props.ifsc || '');
  const [holder, setHolder] = useState(props.accountHolder || '');
  const [upi, setUpi] = useState(props.upiId || '');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const field = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand';

  if (!hasPin) {
    return (
      <p className="mt-3 rounded-xl bg-cream/70 px-3 py-2.5 text-xs text-ink-soft">
        Set your 4-digit wallet PIN in the <span className="font-bold">Withdraw</span> section below first — it protects your payout details.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setOk(null); }}
        className="mt-3 inline-flex rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
        data-testid="payout-edit"
      >
        {props.bankMasked || props.upiId ? 'Update bank / UPI →' : 'Add bank account or UPI →'}
      </button>
    );
  }

  async function save() {
    setErr(null); setOk(null);
    const bankFilled = !!(accountNumber || ifsc.trim() || holder.trim());
    if (bankFilled) {
      if (!accountNumber || !ifsc.trim() || !holder.trim()) { setErr('For a bank account, fill the account number, IFSC and holder name.'); return; }
      if (accountNumber !== confirmAccount) { setErr('Account numbers don’t match.'); return; }
    }
    if (!bankFilled && !upi.trim()) { setErr('Add a bank account or a UPI ID.'); return; }
    if (!/^\d{4}$/.test(pin)) { setErr('Enter your 4-digit wallet PIN.'); return; }

    setBusy(true);
    const r = await postBff('/bff/teacher/wallet/payout-details', {
      pin,
      bank_account_number: bankFilled ? accountNumber : '',
      bank_ifsc: bankFilled ? ifsc.trim() : '',
      bank_account_holder: bankFilled ? holder.trim() : '',
      upi_id: upi.trim(),
    });
    setBusy(false);
    if (r.ok) {
      setOk('Bank details saved ✓');
      setAccountNumber(''); setConfirmAccount(''); setPin('');
      setOpen(false);
      router.refresh();
    } else {
      setErr((r.data as any)?.error || 'Could not save your payout details.');
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-cream/40 p-4" data-testid="payout-form">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">Bank account</p>
      <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Account number" data-testid="payout-acct" className={field} />
      <input value={confirmAccount} onChange={(e) => setConfirmAccount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Re-enter account number" data-testid="payout-acct2" className={field} />
      <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="IFSC (e.g. HDFC0000258)" data-testid="payout-ifsc" className={field} />
        <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Account holder name" data-testid="payout-holder" className={field} />
      </div>
      {props.bankMasked && <p className="mt-1 text-[11px] text-muted">Current: {props.bankMasked}</p>}

      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">or UPI ID</p>
      <input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" data-testid="payout-upi" className={field} />

      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">Wallet PIN</p>
      <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} maxLength={4} type="password" inputMode="numeric" placeholder="••••" data-testid="payout-pin" className={`${field} text-center tracking-[0.5em]`} />

      {err && <p className="mt-2 text-xs font-semibold text-red-600" data-testid="payout-error">{err}</p>}

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={save} disabled={busy} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="payout-save">
          {busy ? 'Saving…' : 'Save payout details'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setErr(null); }} className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">Cancel</button>
      </div>
      {ok && <p className="mt-2 text-xs font-semibold text-brand-700">{ok}</p>}
    </div>
  );
}
