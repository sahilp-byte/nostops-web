import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getOrgEnquiries } from '@/lib/server/org-enquiries';
import { ENQUIRY_REPLY_SLA } from '@/lib/org/enquiry';
import OrgEnquiryPipeline from '@/components/app/admin/OrgEnquiryPipeline';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Admin · Org Enquiries',
  robots: { index: false, follow: false },
};

export default async function AdminOrgEnquiriesPage() {
  await requireAdminUser();
  const initial = await getOrgEnquiries('stage=open');
  const s = initial.by_stage || {};
  const open = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION'].reduce((n, k) => n + (s[k] || 0), 0);
  const cards = [
    { label: 'New', value: s.NEW || 0, accent: (s.NEW || 0) > 0 },
    { label: 'Open pipeline', value: open },
    { label: 'Won', value: s.WON || 0 },
    { label: 'Total enquiries', value: initial.total || 0 },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Organisations</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Org Enquiries</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        &ldquo;Request a proposal&rdquo; enquiries from the organisation pages. Visitors are promised a reply {ENQUIRY_REPLY_SLA}. Move each lead
        through the stages, assign an owner and keep notes.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="enq-admin-cards">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-white p-4">
            <p className={`text-2xl font-black tabular-nums ${c.accent ? 'text-accent-600' : 'text-ink'}`}>{c.value}</p>
            <p className="text-xs font-semibold text-muted">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <OrgEnquiryPipeline initial={initial} />
      </div>
    </div>
  );
}
