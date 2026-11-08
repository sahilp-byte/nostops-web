import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { getOnboardingState, getTeacherSelfProfile, hasCoreProfile, getCodex, getFoundingIntake } from '@/lib/server/teacher';
import { getMyPendingClaim } from '@/lib/server/discovery';
import { displayName } from '@/lib/roles';
import OnboardingWizard from '@/components/app/teacher/OnboardingWizard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Become a Teacher', robots: { index: false, follow: false } };

export default async function TeacherOnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  // Profile ALREADY complete? Send them to their profile (avoids a redirect loop
  // with the profile-first guard). Uses the authoritative `profile_complete`
  // signal — NOT the legacy native-profile `onboarded` flag, which flips true as
  // soon as the account role becomes "teacher", before the five fields are filled.
  const [ob, { self }] = await Promise.all([getOnboardingState(), getTeacherSelfProfile()]);
  if (ob?.profileComplete || hasCoreProfile(self)) redirect('/app/teacher/profile');

  const [codex, founding] = await Promise.all([getCodex(), getFoundingIntake()]);

  // Pre-fill the wizard from any existing (e.g. claimed-from-a-public-listing)
  // record so a teacher who claimed their profile only fills what's missing.
  // When there's no teacher self-record yet (the account hasn't been granted the
  // teacher persona — i.e. they just claimed a public listing), pre-fill the
  // Basics from that claimed listing instead of the bare account name.
  const prefill = self
    ? {
        name: self.name || undefined,
        city: self.city || undefined,
        country: self.country || undefined,
        phone: self.phone || undefined,
        experience: self.experienceYears != null ? String(self.experienceYears) : undefined,
        languages: self.languages?.length ? self.languages : undefined,
        styles: self.styles?.length ? self.styles : undefined,
        paramparas: self.parampara ? [self.parampara] : undefined,
        specializations: self.specializations?.length ? self.specializations : undefined,
        yogaDims: self.yogaDimensions?.length ? self.yogaDimensions : undefined,
        bio: self.bio || undefined,
        handle: self.handle || undefined,
      }
    : await (async () => {
        const claim = await getMyPendingClaim();
        return claim ? { name: claim.name || undefined, city: claim.city || undefined } : undefined;
      })();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back</Link>

      <div className="mt-4 rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-50 to-cream p-6 sm:p-7">
        <span className="text-2xl">🌿</span>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">Join NOSTOPS as a teacher</h1>
        <p className="mt-2 leading-relaxed text-ink-soft">
          A teachers-first cooperative built <em>with</em> yoga teachers, not on top of them. Set up your lineage,
          specialisations and public profile — then complete InstaKYC to start earning.
        </p>
        {founding && founding.remaining > 0 && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-brand-700">
            🏅 {founding.claimed} of {founding.cap} founding seats claimed · you’d be #{founding.nextSeat}
          </p>
        )}
      </div>

      <div className="mt-5">
        <OnboardingWizard codex={codex} founding={founding} defaultName={displayName(user)} prefill={prefill} accountId={String(user.user_id || user.email || '')} />
      </div>
    </div>
  );
}
