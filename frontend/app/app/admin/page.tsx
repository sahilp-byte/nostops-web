import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getAdminDashboard } from '@/lib/server/admin-dashboard';
import { displayName } from '@/lib/roles';
import AdminDashboard from '@/components/app/admin/AdminDashboard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Operations Console', robots: { index: false, follow: false } };

export default async function AdminHomePage() {
  const user = await requireAdminUser();
  const data = await getAdminDashboard();
  return <AdminDashboard data={data} adminName={displayName(user)} />;
}
