import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { requireOnboardedTeacher } from '@/lib/server/teacher';
import { getUnifiedJourney } from '@/lib/server/verification';
import UnifiedVerification from '@/components/app/teacher/UnifiedVerification';
import DiditStart from '@/components/app/teacher/DiditStart';
import InternationalVerificationNotice from '@/components/app/teacher/InternationalVerificationNotice';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Get Verified + Empanelled',
  robots: { index: false, follow: false },
};

export default async function GetVerifiedPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'teacher') redirect('/app');
  await requireOnboardedTeacher();

  const journey = await getUnifiedJourney(user);
  const isIndia = journey.route === 'INDIA';
  const paymentDone = journey.steps.find((s) => s.key === 'payment')?.status === 'DONE';
  const identityDone = journey.steps.find((s) => s.key === 'identity')?.status === 'DONE';

  // B4.8 — outside India identity verification is not yet available: show only
  // that message (no steps, no payment wording, no price, no provider button).
  if (!isIndia && !journey.international_available && !journey.complete) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to dashboard</Link>
        <h1 className="text-2xl font-black tracking-tight text-ink">Get verified</h1>
        <InternationalVerificationNotice />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to dashboard</Link>

      <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-6">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-xl text-white">🛡️</span>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-ink">GET VERIFIED + EMPANELLED</h1>
        <p className="mt-2 leading-relaxed text-ink-soft">
          One application, one payment, one verification journey — ending in NOSTOPS Verified + Empanelled.
          You don’t need to understand the provider details; we route you automatically.
        </p>
      </div>

      {/* 6-step progress (or the completed badges) */}
      <UnifiedVerification journey={journey} />

      {/* Contextual next action (hidden once complete) */}
      {!journey.complete && (
        <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-base font-black tracking-tight text-ink">Your next step</h2>

          {isIndia ? (
            <div className="mt-2">
              <p className="text-sm text-ink-soft">
                As an India-based teacher, your identity is verified through NOSTOPS InstaKYC. After that we
                automatically run Credential Verification, Professional Evidence and the Empanelment Assessment.
              </p>
              <Link
                href="/app/teacher/kyc"
                className="mt-3 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600"
              >
                {identityDone ? 'Continue verification' : 'Continue with InstaKYC'}
              </Link>
            </div>
          ) : (
            <div className="mt-2">
              <p className="text-sm text-ink-soft">
                As an international teacher, your identity is verified securely through Didit (ID check, passive
                liveness, face match and a short questionnaire). After that we automatically run Credential
                Verification, Professional Evidence and the Empanelment Assessment.
              </p>
              <div className="mt-3">
                {paymentDone ? (
                  <DiditStart />
                ) : (
                  <p className="rounded-xl bg-cream px-4 py-3 text-sm text-ink-soft">
                    Identity verification begins once your one-time payment is confirmed.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <p className="text-center text-xs text-muted">
        Your existing InstaKYC and Empanelment options remain available from your dashboard.
      </p>
    </div>
  );
}
