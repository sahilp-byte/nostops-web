import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getVouchInbox } from '@/lib/server/guru';
import VouchInbox from '@/components/app/council/VouchInbox';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Vouch Lineage', robots: { index: false, follow: false } };

export default async function CouncilVouchPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'council') redirect('/app');

  const items = await getVouchInbox();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to Council home</Link>
      <div className="mt-4">
        <h1 className="text-2xl font-black tracking-tight text-ink">Vouch Lineage</h1>
        <p className="mt-1 text-sm text-ink-soft">Attest or decline teachers who claim your parampara.</p>
      </div>
      <div className="mt-5">
        <VouchInbox items={items} />
      </div>
    </div>
  );
}
