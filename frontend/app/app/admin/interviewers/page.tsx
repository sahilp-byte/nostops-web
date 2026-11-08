import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getInterviewers } from '@/lib/server/admin-interviewers';
import Interviewers from '@/components/app/admin/Interviewers';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Interviewers', robots: { index: false, follow: false } };

export default async function AdminInterviewersPage() {
  await requireAdminUser();
  const data = await getInterviewers();

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Platform</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Empanelment Interviewers</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Assign senior council gurus to conduct paid empanelment interviews, or revoke that duty. Each interviewer earns
        a fixed fee per completed interview.
      </p>
      <div className="mt-6">
        <Interviewers interviewers={data.interviewers} candidates={data.candidates} />
      </div>
    </div>
  );
}
