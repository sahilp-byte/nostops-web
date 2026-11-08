import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import TrustReviewScreen from '@/components/app/trust/TrustReviewScreen';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Trust Review', robots: { index: false, follow: false } };

export default async function AdminTrustReviewPage() {
  const user = await requireAdminUser();
  return <TrustReviewScreen user={user} eyebrow="Admin · Operations" />;
}
