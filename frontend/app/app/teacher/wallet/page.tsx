import Link from 'next/link';
import type { Metadata } from 'next';
import { getTeacherWallet } from '@/lib/server/teacher';
import { enforceTeacherFeature } from '@/lib/server/teacher-access';
import WithdrawFlow from '@/components/app/teacher/WithdrawFlow';
import WalletTopUp from '@/components/app/teacher/WalletTopUp';
import PayoutDetailsForm from '@/components/app/teacher/PayoutDetailsForm';
import PayoutStatus from '@/components/app/teacher/PayoutStatus';
import FinancialLockNotice from '@/components/app/FinancialLockNotice';
import { financialActionsLocked } from '@/lib/server/financial-lock';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Wallet', robots: { index: false, follow: false } };

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function fmt(ts: number | null): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 text-lg font-black ${accent ? 'text-brand-700' : 'text-ink'}`}>{value}</p>
    </div>
  );
}

export default async function TeacherWalletPage() {
  await enforceTeacherFeature('wallet');

  const w = await getTeacherWallet();
  const locked = financialActionsLocked();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to dashboard</Link>
      </div>
      <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Your wallet</h1>

      {!w ? (
        <div className="rounded-2xl border border-line bg-white p-6 text-center text-ink-soft">
          Your wallet isn’t available yet. Complete InstaKYC and your first session to start earning.
        </div>
      ) : (
        <>
          {/* Combined hero */}
          <section className="rounded-2xl bg-brand p-6 text-white">
            <p className="text-sm font-semibold text-white/80">Wallet balance</p>
            <p className="mt-1 text-4xl font-black tracking-tight">{inr(w.withdrawable)}</p>
            <p className="mt-0.5 text-xs text-white/80">Recorded earnings — not a bank transfer.</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/90">
              <span>Reserved earnings · {inr(w.combined.held)}</span>
              <span>Lifetime earned · {inr(w.combined.lifetimeEarned)}</span>
              <span>Withdrawn · {inr(w.combined.lifetimeWithdrawn)}</span>
            </div>
          </section>

          {/* Two wallets */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="text-sm font-extrabold text-ink">💼 Session wallet</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Stat label="Available" value={inr(w.session.available)} accent />
                <Stat label="Reserved earnings" value={inr(w.session.held)} />
                <Stat label="Lifetime earned" value={inr(w.session.lifetimeEarned)} />
                <Stat label="Withdrawn" value={inr(w.session.lifetimeWithdrawn)} />
              </div>
            </section>
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="text-sm font-extrabold text-ink">🎁 Referral wallet</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Stat label="Available" value={inr(w.referral.available)} accent />
                <Stat label="Total earned" value={inr(w.referral.totalEarned)} />
                <Stat label="Referrals" value={String(w.referral.referralsTotal)} />
                <Stat label="Empanelled" value={String(w.referral.referralsEmpanelled)} />
              </div>
            </section>
          </div>

          {/* Payout details */}
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-sm font-extrabold text-ink">Payout details</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Bank account</p>
                <p className="mt-1 font-semibold text-ink">{w.payout.bankMasked || 'Not added'}</p>
                {w.payout.ifsc && <p className="text-xs text-muted">{w.payout.ifsc}{w.payout.accountHolder ? ` · ${w.payout.accountHolder}` : ''}</p>}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">UPI</p>
                <p className="mt-1 font-semibold text-ink">{w.payout.upiId || 'Not added'}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${w.payout.kycVerified ? 'bg-brand-50 text-brand-700' : 'bg-cream text-muted'}`}>KYC {w.payout.kycVerified ? '✓' : 'pending'}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${w.payout.panVerified ? 'bg-brand-50 text-brand-700' : 'bg-cream text-muted'}`}>PAN {w.payout.panVerified ? '✓' : 'pending'}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${w.payout.bankVerified ? 'bg-brand-50 text-brand-700' : 'bg-cream text-muted'}`}>Bank {w.payout.bankVerified ? '✓' : 'pending'}</span>
            </div>
            {!w.payout.kycVerified && (
              <Link href="/app/teacher/kyc" className="mt-3 inline-block text-sm font-bold text-brand-700 hover:underline">Complete InstaKYC to verify your identity and bank details →</Link>
            )}
            {!locked && (
              <PayoutDetailsForm
                hasPin={w.hasPin}
                ifsc={w.payout.ifsc}
                accountHolder={w.payout.accountHolder}
                upiId={w.payout.upiId}
                bankMasked={w.payout.bankMasked}
              />
            )}
          </section>

          {locked ? (
            <FinancialLockNotice title="Withdrawals, top-ups and payout changes are paused" />
          ) : (
            <>
              <WalletTopUp />
              <WithdrawFlow
                withdrawable={w.withdrawable}
                hasPin={w.hasPin}
                hasBank={w.hasBank}
                hasUpi={w.hasUpi}
                platformFeePct={w.platformFeePct}
                bankMasked={w.payout.bankMasked}
                upiId={w.payout.upiId}
              />
            </>
          )}

          {/* Payout / settlement status */}
          <PayoutStatus payouts={w.payouts} />

          {/* Activity */}
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-sm font-extrabold text-ink">Recent activity</h2>
            {w.activity.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No transactions yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line p-0">
                {w.activity.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm" style={{ backgroundColor: a.direction === 'credit' ? '#0D948815' : '#EF444415' }}>
                      {a.direction === 'credit' ? '↓' : '↑'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{a.note || (a.source === 'referral' ? 'Referral reward' : 'Session earning')}</p>
                      <p className="text-xs text-muted">{[a.source, fmt(a.ts)].filter(Boolean).join(' · ')}</p>
                    </div>
                    <span className={`shrink-0 text-sm font-bold ${a.direction === 'credit' ? 'text-brand-700' : 'text-red-600'}`}>
                      {a.direction === 'credit' ? '+' : '−'}{inr(a.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
