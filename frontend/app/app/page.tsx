import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getMyPendingClaim } from '@/lib/server/discovery';
import LearnerHome from '@/components/app/learner/LearnerHome';
import TeacherHome from '@/components/app/teacher/TeacherHome';
import OrgHome from '@/components/app/org/OrgHome';
import CouncilHome from '@/components/app/council/CouncilHome';
import OnboardingEmptyState from '@/components/app/teacher/OnboardingEmptyState';

export const dynamic = 'force-dynamic';

export default async function AppHome() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const role = normalizeRole(user.role);

  // Converted personas.
  if (role === 'learner') {
    // A learner who has CLAIMED a provisional teaching profile (but not yet
    // completed onboarding, so the remote backend hasn't granted the teacher
    // persona) is a teacher whose onboarding is in progress — send them to the
    // "Finish setting up your profile" empty state instead of the seeker home.
    const pending = await getMyPendingClaim();
    if (pending) {
      return (
        <div className="mx-auto max-w-3xl">
          <OnboardingEmptyState claimedName={pending.name} claimedCity={pending.city} />
        </div>
      );
    }
    return <LearnerHome user={user} />;
  }
  if (role === 'teacher') return <TeacherHome user={user} />;
  if (role === 'corporate') return <OrgHome user={user} />;
  // City Coordinator temporarily deactivated (Phase 1): coordinators see the teacher home.
  if (role === 'coordinator') return <TeacherHome user={user} />;
  if (role === 'council') return <CouncilHome user={user} />;
  if (role === 'admin') redirect('/app/admin');

  // Every role is handled above; this is unreachable but keeps the type checker happy.
  redirect('/login');
}
