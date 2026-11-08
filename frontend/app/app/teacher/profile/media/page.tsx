import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getTeacherSelfProfile, getTeacherVideoIntro, requireOnboardedTeacher } from '@/lib/server/teacher';
import ProfileMediaManager from '@/components/app/teacher/ProfileMediaManager';
import ProfileStrength, { type StrengthItem } from '@/components/app/teacher/ProfileStrength';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Photo & Video', robots: { index: false, follow: false } };

export default async function TeacherProfileMediaPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'teacher') redirect('/app');
  await requireOnboardedTeacher();

  const [{ onboarded, self }, video] = await Promise.all([getTeacherSelfProfile(), getTeacherVideoIntro()]);
  if (!onboarded || !self) redirect('/app/teacher/onboarding');

  const videoDone = ['approved', 'pending', 'processing'].includes(video.status);
  const strength: StrengthItem[] = [
    { label: 'Add a profile photo', done: !!self.avatarUrl },
    { label: 'Add an intro video', done: videoDone },
    { label: 'Write your bio', done: !!self.bio && self.bio.trim().length >= 40, href: '/app/teacher/profile/edit', hint: 'Write' },
    { label: 'Pick your styles & specialities', done: self.styles.length > 0 || self.specializations.length > 0, href: '/app/teacher/profile/edit', hint: 'Choose' },
    { label: 'List the languages you teach in', done: self.languages.length > 0, href: '/app/teacher/profile/edit', hint: 'Add' },
    { label: 'Verify your identity (KYC)', done: self.kycVerified, href: '/app/teacher/kyc', hint: 'Verify' },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/app/teacher/profile" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to my profile</Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">Photo &amp; video</h1>
        <p className="mt-1 text-ink-soft">Your photo and intro video are the first things learners and organisations see.</p>
      </div>
      <div className="space-y-6">
        <ProfileStrength items={strength} />
        <ProfileMediaManager name={self.name} avatarUrl={self.avatarUrl ?? null} video={video} />
      </div>
    </div>
  );
}
