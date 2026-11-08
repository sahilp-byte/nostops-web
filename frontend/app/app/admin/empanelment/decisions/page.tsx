import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import EmpanelmentDecisionScreen from '@/components/app/empanelment/EmpanelmentDecisionScreen';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Empanelment Decisions', robots: { index: false, follow: false } };

export default async function AdminEmpanelmentDecisionsPage() {
  const user = await requireAdminUser();
  return <EmpanelmentDecisionScreen user={user} eyebrow="Admin · Operations" />;
}
