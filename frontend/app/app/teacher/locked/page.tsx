import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getTeacherGate } from '@/lib/server/teacher';
import VerificationChecklist from '@/components/app/teacher/VerificationChecklist';
import { instaKycPriceLabel } from '@/lib/pricing';
import InternationalVerificationNotice from '@/components/app/teacher/InternationalVerificationNotice';
import { isIndiaCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Get Verified', robots: { index: false, follow: false } };

// Short "what this unlocks" teaser per gated feature — motivates finishing verification.
const TEASERS: Record<string, { icon: string; blurb: string; points: string[] }> = {
  Offerings: { icon: '🧘', blurb: 'Create paid 1:1 & group offerings learners can book.', points: ['Set your price within your tier', 'Publish your session types & availability', 'Appear in learner SmartMatch results'] },
  Bookings: { icon: '📅', blurb: 'Manage every session in one place.', points: ['See upcoming & past bookings', 'Track attendance and earnings per session', 'Confirm or reschedule with a tap'] },
  Wallet: { icon: '👛', blurb: 'Track your recorded earnings.', points: ['Live balance & transaction history', 'Withdrawal requests are currently paused.'] },
  'Refer & Earn': { icon: '🎁', blurb: 'Grow the cooperative and earn rewards.', points: ['Share your personal invite link', 'Earn when teachers you refer get empanelled', 'Track every referral live'] },
  'City Coordinator': { icon: '🧭', blurb: 'Lead and support teachers in your city.', points: ['Searchable roster of your teachers', 'Milestones and revenue share', 'Help new teachers get onboarded'] },
  Sessions: { icon: '🗓️', blurb: 'Your teaching calendar in one place.', points: ['See upcoming & past sessions', 'Track attendance and what you earn', 'Prep for your next class at a glance'] },
  'My Widgets': { icon: '🧩', blurb: 'Your growth system — turn your profile into students.', points: ['Shareable booking & QR widgets', 'Website embeds that auto-sync', 'A real, no-vanity growth funnel'] },
};

export default async function TeacherLockedPage({ searchParams }: { searchParams: Promise<{ feature?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'teacher') redirect('/app');

  const { onboarded, self, verified } = await getTeacherGate();
  if (!onboarded || !self) redirect('/app/teacher/onboarding');
  if (verified) redirect('/app'); // already unlocked — nothing to see here

  const { feature } = await searchParams;
  const teaser = feature ? TEASERS[feature] : undefined;
  const featureName = teaser ? feature! : 'This feature';

  // Requirement-aware, user-facing message (no internal flags/security details):
  // name the ONE thing the teacher needs next to unlock this feature.
  const kycDone = self.kycVerified && self.kycPaid;
  // B4.8 — outside India InstaKYC does not apply; no price, just "not yet available".
  const intlPending = !kycDone && !isIndiaCountry(self.country);
  const requirement = intlPending
    ? { title: 'Verification required', subtitle: 'Identity verification for teachers outside India is not yet available. There is nothing to pay right now.' }
    : !kycDone
    ? { title: 'Verification required', subtitle: `Complete InstaKYC (Aadhaar · PAN · Bank) and the one-time ${instaKycPriceLabel()} verification to unlock your earning tools.` }
    : !self.isEmpanelled
      ? { title: 'Empanelment required', subtitle: 'Get empanelled — via the free merit track or a Council fast-track review — to unlock this feature.' }
      : { title: 'Verification approval pending', subtitle: 'Your InstaKYC and empanelment are complete. A NOSTOPS reviewer will approve your verification shortly.' };

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to dashboard</Link>

      <section className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-6 sm:p-8 text-center" data-testid="locked-hero">
        <span className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-2xl">{teaser?.icon || '🔒'}</span>
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-wider text-accent-600 ring-1 ring-accent/30" data-testid="locked-requirement">
          <span aria-hidden="true">🔒</span> {requirement.title}
        </p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-ink sm:text-3xl">{featureName} is locked</h1>
        <p className="mx-auto mt-2 max-w-lg text-ink-soft">{requirement.subtitle}</p>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          You keep full browse access meanwhile — your profile, the directory and the steps below.
        </p>
      </section>

      {teaser && (
        <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6" data-testid="feature-teaser">
          <h2 className="text-base font-extrabold tracking-tight text-ink">What you&apos;ll unlock</h2>
          <p className="mt-0.5 text-sm text-muted">{teaser.blurb}</p>
          <ul className="mt-3 space-y-2 p-0">
            {teaser.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-ink-soft">
                <span aria-hidden="true" className="mt-0.5 text-brand">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6">
        {intlPending ? (
          <InternationalVerificationNotice country={self.country} />
        ) : (
          <VerificationChecklist flags={{ kycVerified: self.kycVerified, kycPaid: self.kycPaid, isEmpanelled: self.isEmpanelled }} title="Finish verification to unlock" />
        )}
      </div>
    </div>
  );
}
