import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePulseParticipant, getMyInvites } from '@/lib/server/pulse';
import InvitePanel from '@/components/app/pulse/InvitePanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Invite a teacher · Teacher Pulse', robots: { index: false, follow: false } };

export default async function PulseInvitePage() {
  const { actor } = await requirePulseParticipant();
  const { invites } = await getMyInvites(actor);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/app/pulse" className="text-xs font-bold uppercase tracking-wider text-brand-700">← Teacher Pulse</Link>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Invite a fellow teacher</h1>
        </div>
      </div>
      <InvitePanel initialInvites={invites} />
    </div>
  );
}
