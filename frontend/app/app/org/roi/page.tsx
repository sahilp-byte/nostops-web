import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import RoiCalculator from '@/components/app/org/RoiCalculator';
import { ROI_CALCULATOR_ENABLED } from '@/lib/org/roi';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'ROI Calculator', robots: { index: false, follow: false } };

export default async function OrgRoiPage() {
  // Hidden until the ROI figures are agreed (lib/org/roi).
  if (!ROI_CALCULATOR_ENABLED) redirect('/app');
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'corporate') redirect('/app');

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to overview</Link>
      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Corporate wellness ROI</h1>
        <p className="mt-1 text-ink-soft">Estimate the investment and program structure for a yoga pilot at your organisation.</p>
      </div>
      <RoiCalculator />
    </div>
  );
}
