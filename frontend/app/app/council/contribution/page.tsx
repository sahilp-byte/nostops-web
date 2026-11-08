import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import CouncilSoon from '@/components/app/council/CouncilSoon';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Contribution', robots: { index: false, follow: false } };

export default async function CouncilContributionPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'council') redirect('/app');
  return (
    <CouncilSoon
      icon="📊"
      title="My Contribution"
      blurb="Your lifetime impact as a Council Guru — reviews completed, earnings, badges and a six-month trend of your empanelment activity."
      points={[
        'Lifetime reviews, approval rate and earnings at a glance',
        'Six-month trend of interviews conducted and decided',
        'Badges and recognition for consistent contribution',
      ]}
    />
  );
}
