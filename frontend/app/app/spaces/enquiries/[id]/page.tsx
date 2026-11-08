import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getEnquiryWithViewer } from '@/lib/server/spaces';
import EnquiryReview from '@/components/spaces/EnquiryReview';
import EnquirySent from '@/components/spaces/EnquirySent';
import EnquiryHeader from '@/components/spaces/EnquiryHeader';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Space enquiry', robots: { index: false, follow: false } };

// Draft → Space Enquiry: Review & Send. Sent → Enquiry Successfully Sent.
export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getSessionUser())) redirect(`/login?next=/app/spaces/enquiries/${id}`);
  const r = await getEnquiryWithViewer(id);
  if (!r) notFound();
  // The Space owner reviews enquiries on the owner screen.
  if (r.viewer === 'owner') redirect(`/app/spaces/incoming/${id}`);
  const admin = r.viewer === 'admin';
  const e = r.enquiry;
  const name = e.space?.name || e.space_name || 'Space';
  const draft = e.status === 'draft';
  return (
    <div className="mx-auto max-w-[1400px]" data-testid="enquiry-page">
      <EnquiryHeader spaceId={e.space_id} spaceName={name}
        title={draft ? 'Space Enquiry – Review & Send' : 'Space Enquiry – Status'}
        subtitle={draft ? 'Please review your enquiry details before sending it to the venue owner.'
          : e.status === 'declined' ? `This enquiry was declined by the venue owner and is ${admin ? '' : 'now '}closed.`
          : admin ? 'Administrator view of a teacher’s enquiry to this Space.' : 'Your enquiry is with the venue owner.'} />
      {draft ? <EnquiryReview e={e} /> : <EnquirySent e={e} viewer={r.viewer} />}
    </div>
  );
}
