import type { Metadata } from 'next';
import Link from 'next/link';
import { getStopInfo } from '@/lib/server/claim-reminders';
import StopClaimReminders from '@/components/discovery/StopClaimReminders';

// From the "Stop them" link in a finish-your-profile reminder. A button (not the link itself) stops them,
// so email link scanners can never turn reminders off by accident.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Profile reminders', robots: { index: false, follow: false } };

export default async function ClaimRemindersPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = '' } = await searchParams;
  const info = await getStopInfo(t);
  return (
    <main className="container-x mx-auto max-w-xl py-16 text-center" data-testid="claim-reminders-page">
      {info ? (
        <StopClaimReminders token={t} name={info.name} initiallyStopped={info.stopped} />
      ) : (
        <>
          <h1 className="text-2xl font-black tracking-tight text-ink">This link has expired</h1>
          <p className="mt-2 text-ink-soft">We couldn&apos;t find the reminders for this link.</p>
        </>
      )}
      <Link href="/app" className="mt-8 inline-block text-sm font-bold text-brand-700 hover:underline">Go to my dashboard →</Link>
    </main>
  );
}
