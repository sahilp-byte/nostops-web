'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import CashfreePayButton from '@/components/payments/CashfreePayButton';
import { INSTAKYC_PRICE_INR, INSTAKYC_BASE_INR, INSTAKYC_GST_INR, INSTAKYC_GST_PCT, instaKycPriceLabel } from '@/lib/pricing';
import type { KycStatus } from '@/lib/server/teacher';
import FestiveClaimButton from '@/components/app/teacher/festive/FestiveClaimButton';

const inputCls =
  'mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-cream disabled:text-muted';

function Badge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">Verified ✓</span>
  ) : (
    <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-bold text-muted">Pending</span>
  );
}

function Card({ title, badge, children }: { title: string; badge: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-ink">{title}</h3>
        {badge}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function InstaKycFlow({ initial, festive = null }: { initial: KycStatus; festive?: 'claim' | 'upcoming' | 'waived' | null }) {
  const router = useRouter();
  const st = initial || { kycPaid: false, kycVerified: false, aadhaarVerified: false, panVerified: false, bankVerified: false, maskedAadhaar: null };

  // Festive waiver applied (backend claim) counts as "fee settled" on the website. The main app
  // may still refuse a step until it records the ₹0 waiver — its message is shown as-is.
  const paid = st.kycPaid || festive === 'waived';
  const locked = !paid;

  // Aadhaar OKYC
  const [aadhaar, setAadhaar] = useState('');
  const [otp, setOtp] = useState('');
  const [refId, setRefId] = useState<string | null>(null);
  const [aadhaarOk, setAadhaarOk] = useState(st.aadhaarVerified);
  const [aBusy, setABusy] = useState(false);
  const [aMsg, setAMsg] = useState<string | null>(null);

  // PAN
  const [pan, setPan] = useState('');
  const [panName, setPanName] = useState('');
  const [panOk, setPanOk] = useState(st.panVerified);
  const [pBusy, setPBusy] = useState(false);
  const [pMsg, setPMsg] = useState<string | null>(null);

  // Bank
  const [acct, setAcct] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankOk, setBankOk] = useState(st.bankVerified);
  const [bBusy, setBBusy] = useState(false);
  const [bMsg, setBMsg] = useState<string | null>(null);

  async function sendAadhaarOtp() {
    setAMsg(null);
    const clean = aadhaar.replace(/\D/g, '');
    if (clean.length !== 12) return setAMsg('Enter a valid 12-digit Aadhaar number.');
    setABusy(true);
    const r = await postBff('/bff/teacher/kyc/aadhaar/otp', { aadhaar_number: clean });
    setABusy(false);
    if (r.ok) {
      setRefId(r.data?.reference_id || null);
      setAMsg('OTP sent to your Aadhaar-linked mobile.');
    } else setAMsg(r.data?.error || 'Could not send OTP.');
  }

  async function verifyAadhaar() {
    setAMsg(null);
    if (otp.length !== 6) return setAMsg('Enter the 6-digit OTP.');
    if (!refId) return setAMsg('Please request an OTP first.');
    setABusy(true);
    const r = await postBff('/bff/teacher/kyc/aadhaar/verify', { reference_id: refId, otp });
    setABusy(false);
    if (r.ok) {
      setAadhaarOk(true);
      setAMsg('Aadhaar verified.');
      router.refresh();
    } else setAMsg(r.data?.error || 'OTP verification failed.');
  }

  async function verifyPan() {
    setPMsg(null);
    const v = pan.toUpperCase().trim();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v)) return setPMsg('PAN must look like ABCDE1234F.');
    if (panName.trim().length < 2) return setPMsg('Enter your name as printed on the PAN card.');
    setPBusy(true);
    const r = await postBff('/bff/teacher/kyc/pan/verify', { pan: v, name_as_per_pan: panName.trim() });
    setPBusy(false);
    if (r.ok && r.data?.verified) {
      setPanOk(true);
      setPMsg('PAN verified.');
      router.refresh();
    } else setPMsg(r.data?.message || r.data?.error || 'PAN could not be verified.');
  }

  async function verifyBank() {
    setBMsg(null);
    const a = acct.replace(/\s+/g, '');
    const i = ifsc.toUpperCase().trim();
    if (!/^[0-9]{6,20}$/.test(a)) return setBMsg('Enter a valid account number (6–20 digits).');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(i)) return setBMsg('IFSC must be 11 chars, e.g. HDFC0001234.');
    setBBusy(true);
    const r = await postBff('/bff/teacher/kyc/bank/verify', { account_number: a, ifsc: i, ...(bankName.trim() ? { name: bankName.trim() } : {}) });
    setBBusy(false);
    if (r.ok && r.data?.verified) {
      setBankOk(true);
      setBMsg(`Bank account verified${r.data?.name_at_bank ? ` · ${r.data.name_at_bank}` : ''}.`);
      router.refresh();
    } else setBMsg(r.data?.message || r.data?.error || 'Bank account could not be verified.');
  }

  return (
    <div className="space-y-4">
      {/* Paywall (or the festive ₹0 claim — never a payment order for an eligible teacher) */}
      {festive === 'claim' || festive === 'upcoming' ? (
        <section className="rounded-2xl border border-[#F3D9C4] bg-[#FFF6EC] p-5" data-testid="kyc-festive-claim">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-extrabold text-ink">Festive offer: your InstaKYC is free</h3>
            <span className="text-2xl font-black text-ink">₹0</span>
          </div>
          <p className="mt-2 text-sm text-ink-soft">No payment is needed. Claim the complimentary InstaKYC, then complete the normal verification below.</p>
          <div className="mt-4">
            {festive === 'claim' ? (
              <FestiveClaimButton testid="kyc-festive-claim-btn" />
            ) : (
              <p className="text-sm font-semibold text-brand-700" role="status">Claiming opens on 1 November 2026.</p>
            )}
          </div>
        </section>
      ) : festive === 'waived' && !st.kycPaid ? (
        <div className="rounded-xl border border-brand/25 bg-brand-50/50 px-4 py-3 text-sm font-semibold text-brand-700" data-testid="kyc-festive-waived">
          ✓ Complimentary festive InstaKYC applied — ₹0. Complete the verifications below.
        </div>
      ) : !paid ? (
        <section className="rounded-2xl border border-accent/40 bg-accent/5 p-5" data-testid="kyc-paywall">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-extrabold text-ink">Pay the one-time fee to begin</h3>
            <span className="text-2xl font-black text-ink">{instaKycPriceLabel()}</span>
          </div>
          <dl className="mt-3 space-y-1.5 text-sm text-ink-soft">
            <div className="flex justify-between"><dt>InstaKYC verification</dt><dd>{instaKycPriceLabel(INSTAKYC_BASE_INR)}</dd></div>
            <div className="flex justify-between"><dt>GST ({INSTAKYC_GST_PCT}%)</dt><dd>{instaKycPriceLabel(INSTAKYC_GST_INR)}</dd></div>
            <div className="flex justify-between border-t border-accent/30 pt-1.5 font-extrabold text-ink"><dt>Total</dt><dd>{instaKycPriceLabel()}</dd></div>
          </dl>
          <div className="mt-4">
            <CashfreePayButton
              amount={INSTAKYC_PRICE_INR}
              orderType="instakyc"
              note="NOSTOPS InstaKYC verification fee"
              label={`Pay ${instaKycPriceLabel()} with Cashfree →`}
              className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-60"
            />
          </div>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-2 w-full rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream"
          >
            I’ve completed payment — refresh status
          </button>
        </section>
      ) : (
        <div className="rounded-xl border border-brand/25 bg-brand-50/50 px-4 py-3 text-sm font-semibold text-brand-700">
          ✓ InstaKYC fee paid. Complete the verifications below.
        </div>
      )}

      {locked && (
        <p className="rounded-xl border border-dashed border-line bg-cream/60 px-4 py-3 text-sm text-muted" data-testid="kyc-locked-note">
          🔒 {festive === 'claim' || festive === 'upcoming' ? 'The verification steps below unlock once you claim the festive offer.' : 'The verification steps below unlock after payment.'}
        </p>
      )}

      {/* Aadhaar OKYC */}
      <Card title="Aadhaar (OKYC)" badge={<Badge ok={aadhaarOk} />}>
        {aadhaarOk ? (
          <p className="text-sm text-ink-soft">Your Aadhaar is verified{st.maskedAadhaar ? ` (${st.maskedAadhaar})` : ''}.</p>
        ) : (
          <>
            <label className="block text-sm font-bold text-ink">Aadhaar number</label>
            <input className={inputCls} value={aadhaar} onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="12-digit Aadhaar" inputMode="numeric" disabled={locked || !!refId} />
            {!refId ? (
              <button type="button" onClick={sendAadhaarOtp} disabled={locked || aBusy} className="mt-3 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">Send OTP</button>
            ) : (
              <>
                <label className="mt-3 block text-sm font-bold text-ink">Enter OTP</label>
                <input className={inputCls} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" inputMode="numeric" disabled={locked} />
                <button type="button" onClick={verifyAadhaar} disabled={locked || aBusy} className="mt-3 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">Verify Aadhaar</button>
              </>
            )}
            {aMsg && <p className="mt-2 text-sm font-semibold text-ink-soft">{aMsg}</p>}
          </>
        )}
      </Card>

      {/* PAN */}
      <Card title="PAN" badge={<Badge ok={panOk} />}>
        {panOk ? (
          <p className="text-sm text-ink-soft">Your PAN is verified.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-bold text-ink">PAN</label>
                <input className={inputCls} value={pan} onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} placeholder="ABCDE1234F" disabled={locked} />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink">Name as per PAN</label>
                <input className={inputCls} value={panName} onChange={(e) => setPanName(e.target.value)} disabled={locked} />
              </div>
            </div>
            <button type="button" onClick={verifyPan} disabled={locked || pBusy} className="mt-3 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">Verify PAN</button>
            {pMsg && <p className="mt-2 text-sm font-semibold text-ink-soft">{pMsg}</p>}
          </>
        )}
      </Card>

      {/* Bank */}
      <Card title="Bank account (penny-drop)" badge={<Badge ok={bankOk} />}>
        {bankOk ? (
          <p className="text-sm text-ink-soft">Your payout bank account is verified.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-bold text-ink">Account number</label>
                <input className={inputCls} value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, '').slice(0, 20))} inputMode="numeric" disabled={locked} />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink">IFSC</label>
                <input className={inputCls} value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))} placeholder="HDFC0001234" disabled={locked} />
              </div>
            </div>
            <label className="mt-3 block text-sm font-bold text-ink">Account holder name (optional)</label>
            <input className={inputCls} value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={locked} />
            <button type="button" onClick={verifyBank} disabled={locked || bBusy} className="mt-3 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">Verify bank account</button>
            {bMsg && <p className="mt-2 text-sm font-semibold text-ink-soft">{bMsg}</p>}
          </>
        )}
      </Card>
    </div>
  );
}
