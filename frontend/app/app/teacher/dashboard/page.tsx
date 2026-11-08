import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { isHostUser } from '@/lib/server/retreat-host';
import { getTeacherGroupDashboard } from '@/lib/server/teacher-dashboard';
import TeacherGroupDashboard from '@/components/app/teacher/TeacherGroupDashboard';
import GroupBookingFlywheel from '@/components/marketing/GroupBookingFlywheel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Group Dashboard', robots: { index: false, follow: false } };

export default async function TeacherDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const host = await isHostUser(user);
  if (!host) redirect('/app/teacher/retreats');

  const data = await getTeacherGroupDashboard();
  const hostName = (user as any)?.name || 'Teacher';

  return (
    <div className="space-y-10">
      <TeacherGroupDashboard data={data} hostName={hostName} />
      <div className="mx-auto max-w-5xl">
        <GroupBookingFlywheel variant="compact" heading="The flywheel you're part of" />
      </div>
    </div>
  );
}
