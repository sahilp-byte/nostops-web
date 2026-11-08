import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { getHostEligibility, getHostBaseLocation, getHostRateContext, getTeacherIdentity } from '@/lib/server/retreat-host';
import { getBindableVenues } from '@/lib/server/venues';
import HostRetreatWizard from '@/components/app/teacher/HostRetreatWizard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Host a Retreat', robots: { index: false, follow: false } };

export default async function NewRetreatPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const [elig, base, rate, identity, venues] = await Promise.all([
    getHostEligibility(),
    getHostBaseLocation(),
    getHostRateContext(),
    getTeacherIdentity(),
    getBindableVenues({ limit: 100 }).catch(() => []),
  ]);
  if (!elig.eligible) redirect('/app/teacher/retreats');

  // Eligible listed venues for the binding picker — only the public fields the
  // wizard needs. Reuses the existing directory (no parallel venue API).
  const eligibleVenues = venues.map((v) => ({
    id: v.id,
    name: v.name,
    city: v.city ?? '',
    state: v.state ?? '',
    lat: v.lat ?? null,
    lng: v.lng ?? null,
    capacity: typeof v.capacity === 'number' && v.capacity > 0 ? v.capacity : null,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/app/teacher/retreats" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to retreats</Link>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Create your retreat</h1>
        <p className="mt-1.5 text-ink-soft">
          Create and host a retreat around your teaching, your students and an experience you believe in. We&apos;ll guide
          you step by step — NOSTOPS keeps {elig.platformFeePct}% to run payments and secure seats.
        </p>
      </div>
      <HostRetreatWizard
        platformFeePct={elig.platformFeePct}
        baseLat={base?.lat ?? null}
        baseLng={base?.lng ?? null}
        baseLabel={base?.label ?? null}
        hostName={elig.hostName}
        rate={rate}
        identity={identity}
        eligibleVenues={eligibleVenues}
      />
    </div>
  );
}
