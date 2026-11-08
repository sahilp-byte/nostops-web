import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getSessionUser } from '@/lib/server/session';
import { getAdminMembers, actorFrom } from '@/lib/server/pulse';
import MembersTable from '@/components/app/admin/pulse/MembersTable';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Pulse Members', robots: { index: false, follow: false } };

export default async function AdminPulseMembersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireAdminUser();
  const user = await getSessionUser();
  const { status = 'ALL', q = '' } = await searchParams;
  const qs = [status && status !== 'ALL' && `status=${encodeURIComponent(status)}`, q && `q=${encodeURIComponent(q)}`].filter(Boolean).join('&');
  const { members } = await getAdminMembers(actorFrom(user!), qs ? `?${qs}` : '');

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/app/admin/pulse" className="text-xs font-bold uppercase tracking-wider text-brand-700">← Teacher Pulse</Link>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Participants</h1>
      </div>
      <MembersTable members={members} status={status} q={q} />
    </div>
  );
}
