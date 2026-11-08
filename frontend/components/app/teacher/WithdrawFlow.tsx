'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

const OTP_THRESHOLD = 5000;
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

type Props = {
  withdrawable: number;
  hasPin: boolean;
  hasBank: boolean;
  hasUpi: boolean;
  platformFeePct: number;
  bankMasked: string | null;
  upiId: string | null;
};

function PinSetup({ onDone }: { onDone: (msg: string, ok: boolean) => void }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!/^\d{4}$/.test(pin)) { setErr('PIN must be exactly 4 digits.'); return; }
    if (pin !== confirm) { setErr('PINs don’t match.'); return; }
    setBusy(true);
    const r = await postBff('/bff/teacher/wallet/setup-pin', { pin });
    setBusy(false);
    if (r.ok) onDone('Wallet PIN set ✓', true);
    else setErr(r.data?.error || 'Could not set PIN.');
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-sm font-extrabold text-ink">🔐 Set up your wallet PIN</h2>
      <p className="mt-1 text-sm text-ink-soft">You’ll enter this 4-digit PIN to request a withdrawal from this wallet.</p>
      <input inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="Enter 4-digit PIN" className="mt-3 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-center text-lg tracking-[0.5em] text-ink" type="password" data-testid="pin-setup-1" />
      <input inputMode="numeric" maxLength={4} value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))} placeholder="Confirm PIN" className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-center text-lg tracking-[0.5em] text-ink" type="password" data-testid="pin-setup-2" />
      {err && <p className="mt-2 text-xs font-semibold text-red-600">{err}</p>}
      <button type="button" onClick={submit} disabled={busy} className="mt-3 w-full rounded-lg bg-brand px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Set PIN'}</button>
    </div>
  );
}

export default function WithdrawFlow(props: Props) {
  const router = useRouter();
  const { withdrawable, hasPin, hasBank, hasUpi, platformFeePct, bankMasked, upiId } = props;

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'bank' | 'upi' | ''>(hasBank ? 'bank' : hasUpi ? 'upi' : '');
  const [pin, setPin] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [busy, setBusy] = useState<null | 'otp-start' | 'otp-verify' | 'withdraw'>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const amt = parseInt(amount, 10) || 0;
  const otpRequired = amt >= OTP_THRESHOLD;
  const fee = amt > 0 ? Math.round(amt * (platformFeePct / 100)) : 0;
  const net = amt > 0 ? amt - fee : 0;

  // Reset OTP when the amount drops below the threshold.
  useEffect(() => {
    if (!otpRequired) { setOtpSent(false); setOtpVerified(false); setOtpCode(''); }
  }, [otpRequired]);

  function done(msg: string, ok: boolean) {
    setToast({ msg, ok });
    if (ok) { setAmount(''); setPin(''); setOtpCode(''); setOtpSent(false); setOtpVerified(false); router.refresh(); }
    setTimeout(() => setToast(null), 4500);
  }

  if (!hasPin) return <PinSetup onDone={done} />;

  if (!hasBank && !hasUpi) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-cream/50 p-5">
        <h2 className="text-sm font-extrabold text-ink">Withdraw funds</h2>
        <p className="mt-1 text-sm text-ink-soft">Add a bank account or UPI ID in the “Payout details” section above to start withdrawing. Your balance keeps accruing meanwhile.</p>
      </div>
    );
  }

  const amountValid = amt >= 1 && amt <= withdrawable;
  const canWithdraw = amountValid && !!method && /^\d{4}$/.test(pin) && (!otpRequired || otpVerified);

  async function sendOtp() {
    setErr(null);
    setBusy('otp-start');
    const r = await postBff('/bff/teacher/wallet/otp-start');
    setBusy(null);
    if (r.ok) { setOtpSent(true); setToast({ msg: 'OTP sent to your registered phone.', ok: true }); setTimeout(() => setToast(null), 4000); }
    else setErr(r.data?.error || 'Could not send OTP.');
  }

  async function verifyOtp() {
    setErr(null);
    setBusy('otp-verify');
    const r = await postBff('/bff/teacher/wallet/otp-verify', { code: otpCode.trim() });
    setBusy(null);
    if (r.ok) setOtpVerified(true);
    else setErr(r.data?.error || 'Invalid OTP. Please retry.');
  }

  async function withdraw() {
    setErr(null);
    if (!amountValid) { setErr(`Enter an amount between ₹1 and ${inr(withdrawable)}.`); return; }
    setBusy('withdraw');
    const r = await postBff('/bff/teacher/wallet/withdraw', { amount_inr: amt, pin, payout_method: method });
    setBusy(null);
    if (r.ok) done('Your withdrawal request has been recorded. Withdrawals are currently paused.', true);
    else setErr(r.data?.error || 'Could not process the withdrawal.');
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="withdraw-flow">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-ink">Withdraw funds</h2>
        <span className="text-xs font-semibold text-muted">Available · <span className="font-black text-brand-700">{inr(withdrawable)}</span></span>
      </div>

      {toast && <p className="mt-3 rounded-lg px-3 py-2 text-xs font-bold" style={{ backgroundColor: toast.ok ? '#0D948812' : '#EF444412', color: toast.ok ? '#0F766E' : '#B91C1C' }}>{toast.msg}</p>}

      {/* Amount */}
      <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-muted">Amount (₹)</label>
      <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="0" className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-lg font-bold text-ink" data-testid="withdraw-amount" />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {[1000, 5000, withdrawable].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => (
          <button key={v} type="button" onClick={() => setAmount(String(v))} className="rounded-full border border-line px-2.5 py-1 text-xs font-bold text-ink-soft hover:bg-brand-50">{v === withdrawable ? 'Max' : inr(v)}</button>
        ))}
      </div>
      {amt > withdrawable && <p className="mt-1 text-xs font-semibold text-red-600">Amount exceeds your available balance.</p>}

      {/* Method */}
      <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-muted">Payout to</label>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {hasBank && (
          <button type="button" onClick={() => setMethod('bank')} className="rounded-xl border p-3 text-left" style={{ borderColor: method === 'bank' ? '#0D9488' : '#E5E7EB', backgroundColor: method === 'bank' ? '#0D948810' : '#fff' }} data-testid="method-bank">
            <p className="text-xs font-extrabold text-ink">🏦 Bank</p>
            <p className="mt-0.5 truncate text-[11px] text-muted">{bankMasked || 'Bank account'}</p>
          </button>
        )}
        {hasUpi && (
          <button type="button" onClick={() => setMethod('upi')} className="rounded-xl border p-3 text-left" style={{ borderColor: method === 'upi' ? '#0D9488' : '#E5E7EB', backgroundColor: method === 'upi' ? '#0D948810' : '#fff' }} data-testid="method-upi">
            <p className="text-xs font-extrabold text-ink">📲 UPI</p>
            <p className="mt-0.5 truncate text-[11px] text-muted">{upiId || 'UPI ID'}</p>
          </button>
        )}
      </div>

      {/* Fee preview */}
      {amt > 0 && (
        <div className="mt-4 rounded-xl bg-cream/70 px-3 py-2.5 text-sm">
          <div className="flex justify-between"><span className="text-ink-soft">Withdrawal</span><span className="font-semibold text-ink">{inr(amt)}</span></div>
          <div className="flex justify-between"><span className="text-ink-soft">Platform fee ({platformFeePct}%)</span><span className="font-semibold text-red-600">−{inr(fee)}</span></div>
          <div className="mt-1 flex justify-between border-t border-line pt-1.5"><span className="font-bold text-ink">You receive</span><span className="font-black text-brand-700">{inr(net)}</span></div>
        </div>
      )}

      {/* OTP (amounts >= 5000) */}
      {otpRequired && (
        <div className="mt-4 rounded-xl border p-3" style={{ borderColor: otpVerified ? '#0D948840' : '#F59E0B40', backgroundColor: otpVerified ? '#0D948808' : '#F59E0B08' }}>
          <p className="text-xs font-extrabold text-ink">{otpVerified ? '✓ OTP verified' : `Withdrawals of ${inr(OTP_THRESHOLD)}+ need an SMS OTP`}</p>
          {!otpVerified && (
            !otpSent ? (
              <button type="button" onClick={sendOtp} disabled={busy === 'otp-start'} className="mt-2 rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50" style={{ backgroundColor: '#F59E0B' }} data-testid="otp-send">{busy === 'otp-start' ? 'Sending…' : 'Send OTP'}</button>
            ) : (
              <div className="mt-2 flex gap-2">
                <input inputMode="numeric" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} placeholder="Enter OTP" maxLength={8} className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" data-testid="otp-code" />
                <button type="button" onClick={verifyOtp} disabled={busy === 'otp-verify'} className="rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-50" style={{ backgroundColor: '#F59E0B' }} data-testid="otp-verify">{busy === 'otp-verify' ? 'Verifying…' : 'Verify'}</button>
              </div>
            )
          )}
        </div>
      )}

      {/* PIN */}
      <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-muted">Wallet PIN</label>
      <input inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" type="password" className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-center text-lg tracking-[0.5em] text-ink" data-testid="withdraw-pin" />

      {err && <p className="mt-3 text-xs font-semibold text-red-600" data-testid="withdraw-error">{err}</p>}

      <button type="button" onClick={withdraw} disabled={!canWithdraw || busy === 'withdraw'} className="mt-4 w-full rounded-xl bg-brand px-3 py-3 text-sm font-bold text-white disabled:opacity-40" data-testid="withdraw-submit">
        {busy === 'withdraw' ? 'Processing…' : amt > 0 ? `Withdraw ${inr(net)}` : 'Withdraw'}
      </button>
      <p className="mt-2 text-center text-[11px] text-muted">Withdrawal requests are currently paused.</p>
    </section>
  );
}
