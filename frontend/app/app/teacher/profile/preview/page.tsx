import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getTeacherSelfProfile, getCodex, requireOnboardedTeacher } from '@/lib/server/teacher';
import SeekerPreview from '@/components/app/teacher/SeekerPreview';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Seeker preview', robots: { index: false, follow: false } };

export default async function TeacherProfilePreviewPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'teacher') redirect('/app');
  await requireOnboardedTeacher();

  const [{ onboarded, self, social }, codex] = await Promise.all([getTeacherSelfProfile(), getCodex()]);
  if (!onboarded || !self) redirect('/app/teacher/onboarding');

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/teacher/profile/edit" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to editing</Link>
        <Link href="/app/teacher/profile/edit" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">Edit profile</Link>
      </div>

      <div className="rounded-2xl border border-brand/20 bg-brand-50/50 p-4" data-testid="seeker-preview-banner">
        <p className="text-xs font-black uppercase tracking-wider text-brand-700">👁 Seeker preview</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          This is how seekers see your profile. It reflects your <span className="font-bold text-ink">last saved</span> changes —
          save your edits, then refresh this tab to see them here.{' '}
          {!self.publicVisible && <span className="font-semibold text-ink">Your public page goes live once your profile is published and active.</span>}
        </p>
      </div>

      <SeekerPreview self={self} social={social} codex={codex} />
    </div>
  );
}
