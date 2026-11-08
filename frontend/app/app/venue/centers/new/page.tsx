import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getVenueOwnerState } from '@/lib/server/venue-owner';
import CenterForm from '@/components/app/venue/CenterForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Add a Venue', robots: { index: false, follow: false } };

export default async function NewCenterPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const state = await getVenueOwnerState();
  if (!state.canOwnVenues) redirect('/app/venue');

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/app/venue" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to Venue Studio</Link>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Add a venue</h1>
        <p className="mt-1.5 text-ink-soft">Describe your space so teachers and seekers know exactly what to expect. Add your Google listing and a few photos too — you can edit anything later.</p>
        <p className="mt-2 text-sm text-ink-soft">
          Suggesting a venue you don&apos;t own or manage?{' '}
          <Link href="/venues/submit" className="font-bold text-brand-700 hover:underline" data-testid="public-submit-link">Use the public &lsquo;Suggest a venue&rsquo; form →</Link>
        </p>
      </div>
      <CenterForm mode="create" />
    </div>
  );
}
