import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import TeacherServiceLocalities from '@/components/spaces/TeacherServiceLocalities';
import { SpacesPageHeader, SpEmpty } from '@/components/spaces/ui';

export const metadata = { title: 'My Teaching Localities · NOSTOPS Spaces', robots: { index: false } };

export default async function TeachingLocalitiesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/app/spaces/teaching-localities');
  const teacher = ['teacher', 'guru', 'council', 'council_guru'].includes(String(user.role || ''));
  return (
    <div className="mx-auto max-w-5xl space-y-5" data-testid="tsl-page">
      <SpacesPageHeader crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: 'My Teaching Localities' }]} title="My Teaching Localities"
        subtitle="Tell NOSTOPS which neighbourhoods you teach in, so local Community Partners can connect you with Spaces and learners." />
      {teacher ? <TeacherServiceLocalities /> : <SpEmpty title="For NOSTOPS teachers" testId="tsl-not-teacher">Teaching localities can be set by NOSTOPS teachers only.</SpEmpty>}
    </div>
  );
}
