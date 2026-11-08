import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getSessionUser } from '@/lib/server/session';
import { getAdminConfig, actorFrom } from '@/lib/server/pulse';
import LifecycleForm from '@/components/app/admin/pulse/LifecycleForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Pulse Settings', robots: { index: false, follow: false } };

export default async function AdminPulseSettingsPage() {
  await requireAdminUser();
  const user = await getSessionUser();
  const config = await getAdminConfig(actorFrom(user!));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href="/app/admin/pulse" className="text-xs font-bold uppercase tracking-wider text-brand-700">← Teacher Pulse</Link>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Settings &amp; export</h1>
      </div>
      <LifecycleForm config={config} />
    </div>
  );
}
