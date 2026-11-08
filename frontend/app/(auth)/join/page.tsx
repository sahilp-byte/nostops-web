import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { apiGetSafe } from '@/lib/api';
import { getSessionUser } from '@/lib/server/session';
import TeacherJoinForm from '@/components/auth/TeacherJoinForm';

export const metadata: Metadata = { title: 'Join as a Yoga Teacher', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type Track = { valid?: boolean; code?: string; referrer?: { name?: string; avatar_url?: string } };

// Teacher-only onboarding invitation page. Referral-aware (?ref=CODE): validates
// the code server-side via the PUBLIC track endpoint to greet the invitee with
// who invited them. Already-authenticated visitors skip straight to their app.
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const user = await getSessionUser();
  if (user) redirect('/app');

  const ref = ((await searchParams).ref || '').trim();
  const codeOk = /^[A-Za-z0-9_-]{4,20}$/.test(ref);

  let invitedBy: string | null = null;
  let inviterAvatar: string | null = null;
  let refValid = false;
  if (codeOk) {
    const t = await apiGetSafe<Track>(`/teacher-referrals/track/${encodeURIComponent(ref)}`, {}, { noStore: true });
    if (t?.valid && t.referrer?.name) {
      invitedBy = t.referrer.name;
      inviterAvatar = t.referrer.avatar_url || null;
      refValid = true;
    }
  }

  return (
    <TeacherJoinForm
      referralCode={refValid ? ref : ''}
      invitedBy={invitedBy}
      inviterAvatar={inviterAvatar}
      badCode={codeOk && !refValid}
    />
  );
}
