import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { canSendEnquiry, getPublicSpace } from '@/lib/server/spaces';
import EnquiryForm from '@/components/spaces/EnquiryForm';
import EnquiryHeader from '@/components/spaces/EnquiryHeader';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Send a Space enquiry', robots: { index: false, follow: false } };

export default async function NewEnquiryPage({ searchParams }: { searchParams: Promise<{ space?: string }> }) {
  const { space: sid = '' } = await searchParams;
  const access = await canSendEnquiry();
  if (!access.signedIn) redirect(`/login?next=${encodeURIComponent(`/app/spaces/enquiries/new?space=${sid}`)}`);
  const space = await getPublicSpace(sid);
  if (!space) notFound();
  return (
    <div className="mx-auto max-w-4xl" data-testid="new-enquiry-page">
      <EnquiryHeader spaceId={space.id} spaceName={space.name || 'Space'} title="Send an Enquiry" subtitle={`Tell the owner of ${space.name} about the programme you'd like to run.`} />
      {access.allowed ? (
        <EnquiryForm spaceId={space.id} spaceName={space.name || 'Space'} initial={null} />
      ) : (
        <div className="rounded-2xl border border-line bg-white p-6" data-testid="enq-not-teacher">
          <p className="font-black text-ink">Only NOSTOPS teachers and Council Gurus can send a Space enquiry.</p>
          <p className="mt-1 text-sm text-ink-soft">If you teach yoga, create your teacher profile first.</p>
          <Link href="/become-a-teacher" className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-brand px-4 text-sm font-black text-white">Become a NOSTOPS teacher</Link>
        </div>
      )}
    </div>
  );
}
