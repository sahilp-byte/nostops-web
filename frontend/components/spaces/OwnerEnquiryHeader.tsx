import { SpacesPageHeader } from '@/components/spaces/ui';

// Banner header for the Venue Owner enquiry screens (Phase 4 · screen 2).
export default function OwnerEnquiryHeader({ title, subtitle, crumbs }: { title: string; subtitle: string; crumbs?: [string, string?][] }) {
  return (
    <div className="mb-6" data-testid="owner-enq-header">
      <SpacesPageHeader crumbs={(crumbs || [['Spaces', '/spaces'], [title]]).map(([label, href]) => ({ label, href }))} title={title}
        subtitle={<span className="text-[22px] font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>{subtitle}</span>} />
    </div>
  );
}
