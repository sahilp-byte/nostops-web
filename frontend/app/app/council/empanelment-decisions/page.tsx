import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import EmpanelmentDecisionScreen from '@/components/app/empanelment/EmpanelmentDecisionScreen';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Empanelment Decisions', robots: { index: false, follow: false } };

export default async function CouncilEmpanelmentDecisionsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'council') redirect('/app');
  return (
    <div>
      <div className="mx-auto mb-4 max-w-4xl">
        <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to Council home</Link>
      </div>
      <EmpanelmentDecisionScreen user={user} eyebrow="Council of Yoga Gurus" />
    </div>
  );
}
