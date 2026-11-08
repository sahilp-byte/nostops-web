import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getTeacherSelfProfile, getCodex, getOnboardingState, hasCoreProfile } from '@/lib/server/teacher';
import { getMyPendingClaim } from '@/lib/server/discovery';
import { deriveTeacherStatus } from '@/lib/teacher-status';
import { getServerT } from '@/lib/i18n/server';
import TeacherProfileEditForm from '@/components/app/teacher/TeacherProfileEditForm';
import WeeklyAvailability from '@/components/app/teacher/WeeklyAvailability';
import SetLocationButton from '@/components/app/teacher/SetLocationButton';
import OnboardingEmptyState from '@/components/app/teacher/OnboardingEmptyState';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit Profile', robots: { index: false, follow: false } };

export default async function TeacherProfileEditPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'teacher') {
    // A learner who claimed a provisional listing (onboarding in progress) sees
    // the Start-Onboarding empty state here too, rather than a redirect to /app.
    const pending = await getMyPendingClaim();
    if (pending) {
      const t0 = await getServerT();
      return (
        <div className="mx-auto max-w-3xl">
          <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">{t0('‹ Back')}</Link>
          <h1 className="mt-3 text-center text-2xl font-black tracking-tight text-ink">{t0('Edit Profile')}</h1>
          <OnboardingEmptyState claimedName={pending.name} claimedCity={pending.city} />
        </div>
      );
    }
    redirect('/app');
  }

  const [{ self, social }, ob, codex, t, sp] = await Promise.all([
    getTeacherSelfProfile(),
    getOnboardingState(),
    getCodex(),
    getServerT(),
    searchParams,
  ]);

  // Not onboarded yet → show the "You haven't onboarded yet → Start Onboarding"
  // empty state right here instead of silently redirecting into the wizard.
  const onboarded = (ob?.profileComplete ?? false) || hasCoreProfile(self);
  if (!onboarded || !self) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">{t('‹ Back')}</Link>
        <h1 className="mt-3 text-center text-2xl font-black tracking-tight text-ink">{t('Edit Profile')}</h1>
        <OnboardingEmptyState />
      </div>
    );
  }

  const isWelcome = sp?.welcome === '1';
  const canOperate = deriveTeacherStatus(self).canOperate;

  return (
    <div className="mx-auto max-w-3xl">
      {isWelcome && (
        <div className="mb-6 rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-50 to-cream p-5" data-testid="welcome-banner">
          <p className="text-xs font-black uppercase tracking-wider text-brand-700">🙏 Welcome to NOSTOPS</p>
          <h2 className="mt-1.5 text-xl font-black tracking-tight text-ink">Let’s set up your teacher profile</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            A complete profile helps seekers and organisations find and trust you. Add your bio, lineage, styles and a
            photo below — you can always refine it later.
          </p>
        </div>
      )}
      <div className="mb-6">
        <Link href="/app/teacher/profile" className="text-sm font-bold text-brand-700 hover:underline">{t('‹ Back to my profile')}</Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">{t('Edit your profile')}</h1>
        <p className="mt-1 text-ink-soft">{t('Keep your details current — this is what learners and organisations see.')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/app/teacher/profile/media" className="inline-block text-sm font-bold text-brand-700 hover:underline">{t('Manage photo & intro video →')}</Link>
          <a href="/app/teacher/profile/preview" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline" data-testid="seeker-preview-link">👁 See how seekers view my profile ↗</a>
        </div>
      </div>
      <TeacherProfileEditForm self={self} social={social} codex={codex} canOperate={canOperate} />
      <div className="mt-6">
        <WeeklyAvailability />
      </div>
      <div className="mt-6">
        <SetLocationButton initialCity={self.city} />
      </div>
    </div>
  );
}
