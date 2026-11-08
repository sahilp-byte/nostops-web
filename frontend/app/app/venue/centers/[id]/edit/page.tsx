import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getMyCenter } from '@/lib/server/venue-owner';
import CenterForm from '@/components/app/venue/CenterForm';
import VenuePhotosSection from '@/components/app/venue/VenuePhotosSection';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit Venue', robots: { index: false, follow: false } };

export default async function EditCenterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const { created } = await searchParams;
  const center = await getMyCenter(id);
  if (!center) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/app/venue" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to Venue Studio</Link>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Edit venue</h1>
        <p className="mt-1.5 text-ink-soft">Update your venue’s details, amenities and partnership settings.</p>
      </div>
      <VenuePhotosSection centerId={center.id} connected={(center.photos?.length ?? 0) > 0} photos={center.photos ?? []} justCreated={created === '1'} />
      <CenterForm mode="edit" centerId={center.id} initial={center} />
    </div>
  );
}
