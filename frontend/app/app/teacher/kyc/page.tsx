import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getKycStatus, getTeacherSelfProfile, requireOnboardedTeacher } from '@/lib/server/teacher';
import InternationalVerificationNotice from '@/components/app/teacher/InternationalVerificationNotice';
import { isIndiaCountry } from '@/lib/country';
import InstaKycFlow from '@/components/app/teacher/InstaKycFlow';
import { getFestiveStatus } from '@/lib/server/festive-kyc';
import { festiveView } from '@/lib/festive-view';
import { instaKycPriceLabel } from '@/lib/pricing';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'InstaKYC', robots: { index: false, follow: false } };

const VERIFIES = [
  { icon: '🪪', title: 'Aadhaar OKYC', desc: 'UIDAI-backed identity check' },
  { icon: '🧾', title: 'PAN', desc: 'Income-tax verification' },
  { icon: '🏦', title: 'Bank account', desc: 'Reverse penny-drop to verify your bank account' },
  { icon: '🤳', title: 'Video selfie', desc: 'Liveness match' },
];

export default async function TeacherKycPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'teacher') redirect('/app');
  await requireOnboardedTeacher();

  // InstaKYC (Aadhaar / PAN / Indian bank) is India-only; teachers elsewhere see
  // the B4.8 "not yet available" message instead of an India-only flow.
  const { self } = await getTeacherSelfProfile();
  if (!isIndiaCountry(self?.country)) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to dashboard</Link>
        <div className="mt-4">
          <InternationalVerificationNotice country={self?.country} />
        </div>
      </div>
    );
  }

  const status = await getKycStatus();
  // Festive Complimentary InstaKYC (backend-driven): eligible → claim instead of paying;
  // waiver applied → no payment, verification steps open.
  const festive = await getFestiveStatus(user);
  const fv = festiveView(festive);
  const festiveMode = fv.mode === 'claim' || fv.mode === 'upcoming' ? fv.mode
    : festive?.claim_status === 'claimed' ? 'waived' : null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to dashboard</Link>

      <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-6">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-xl text-white">🛡️</span>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-ink">NOSTOPS InstaKYC</h1>
        <p className="mt-2 leading-relaxed text-ink-soft">
          A one-time {festiveMode ? <><strong>₹0 this festive season</strong> (standard {instaKycPriceLabel()} incl. GST)</> : <>{instaKycPriceLabel()} (incl. GST)</>} verification that unlocks your directory listing, adds verified badges to your
          public profile, and enables payouts. Takes about two minutes.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {VERIFIES.map((v) => (
            <div key={v.title} className="rounded-xl border border-accent/20 bg-white p-3">
              <p className="text-lg">{v.icon}</p>
              <p className="mt-1 text-sm font-extrabold text-ink">{v.title}</p>
              <p className="text-xs text-muted">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <InstaKycFlow initial={status} festive={festiveMode} />
      </div>
    </div>
  );
}
