import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { guardTeacherFeature } from '@/lib/server/teacher-access';
import CoordinatorHome from '@/components/app/coordinator/CoordinatorHome';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Coordinator Hub', robots: { index: false, follow: false } };

export default async function CoordinatorPage() {
  const denied = await guardTeacherFeature('coordinator');
  if (denied) redirect(denied);
  return (
    <div>
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to overview</Link>
      <div className="mt-4">
        <CoordinatorHome />
      </div>
    </div>
  );
}
