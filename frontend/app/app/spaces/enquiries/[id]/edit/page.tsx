import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getEnquiry } from '@/lib/server/spaces';
import EnquiryForm from '@/components/spaces/EnquiryForm';
import EnquiryHeader from '@/components/spaces/EnquiryHeader';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit Space enquiry', robots: { index: false, follow: false } };

export default async function EditEnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getSessionUser())) redirect(`/login?next=/app/spaces/enquiries/${id}/edit`);
  const e = await getEnquiry(id);
  if (!e) notFound();
  if (e.status !== 'draft') redirect(`/app/spaces/enquiries/${id}`);
  const name = e.space?.name || e.space_name || 'Space';
  return (
    <div className="mx-auto max-w-4xl" data-testid="edit-enquiry-page">
      <EnquiryHeader spaceId={e.space_id} spaceName={name} title="Edit Enquiry" subtitle="Update the details, then review and send." />
      <EnquiryForm spaceId={e.space_id} spaceName={name} initial={e} />
    </div>
  );
}
