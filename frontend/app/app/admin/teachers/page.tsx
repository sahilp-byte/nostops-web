import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getAdminTeacherDirectory } from '@/lib/server/admin-teachers';
import TeacherDirectoryTable from '@/components/app/admin/TeacherDirectoryTable';
import PhotoReminderPanel from '@/components/admin/PhotoReminderPanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Teachers · Verification & Empanelment', robots: { index: false, follow: false } };

export default async function AdminTeachersPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'admin') redirect('/app');

  const { rows, counts } = await getAdminTeacherDirectory();

  const kpis = [
    { label: 'Total teachers', value: counts.total, tone: 'text-ink' },
    { label: 'Verified', value: counts.verified, tone: 'text-brand-700' },
    { label: 'Awaiting verification', value: counts.awaitingVerification, tone: 'text-accent-600' },
    { label: 'Empanelled', value: counts.empanelled, tone: 'text-brand-700' },
    { label: 'Awaiting empanelment', value: counts.awaitingEmpanelment, tone: 'text-accent-600' },
    { label: 'Profile incomplete', value: counts.incomplete, tone: 'text-red-700' },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Teachers</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Verification &amp; Empanelment</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Every registered NOSTOPS teacher. Search and filter, then open a teacher to review their submitted onboarding
        information alongside their administrative status before making verification or empanelment decisions.
      </p>
      <p className="mt-2 text-sm">
        <a href="/app/admin/listings" className="font-bold text-brand-700 hover:underline" data-testid="teachers-listings-link">
          Feature teachers on the homepage or delete a teacher from the website →
        </a>
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">{k.label}</p>
            <p className={`mt-1 text-2xl font-black tabular-nums ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <PhotoReminderPanel />

      <div className="mt-6">
        <TeacherDirectoryTable rows={rows} />
      </div>
    </div>
  );
}
