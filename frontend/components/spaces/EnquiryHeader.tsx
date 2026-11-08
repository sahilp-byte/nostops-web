import { SpacesPageHeader } from '@/components/spaces/ui';

// Breadcrumb + title shared by the Phase 4 enquiry screens.
export default function EnquiryHeader({ spaceId, spaceName, title, subtitle }: { spaceId: string; spaceName: string; title: string; subtitle: string }) {
  return (
    <div className="mb-6" data-testid="enq-header">
      <SpacesPageHeader crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: spaceName, href: `/spaces/${spaceId}` }, { label: 'Send an Enquiry' }]} title={title} subtitle={subtitle} />
    </div>
  );
}
