// "Request a proposal" section (anchor #enquire) placed on every organisation
// page. Server component wrapper around the client form; the cohort is
// pre-selected on cohort pages and the source page is recorded with the lead.
import type { CohortKey } from '@/lib/org/cohort-copy';
import { ENQUIRY_REPLY_SLA } from '@/lib/org/enquiry';
import OrgEnquiryForm from '@/components/org/OrgEnquiryForm';

export default function OrgEnquirySection({
  sourcePage,
  cohort,
  title = 'Request a proposal',
  subtitle,
}: {
  sourcePage: string;
  cohort?: CohortKey;
  title?: string;
  subtitle?: string;
}) {
  return (
    <section id="enquire" className="scroll-mt-24 border-t border-line bg-cream" data-testid="org-enquiry-section">
      <div className="container-x grid gap-8 py-12 sm:py-16 lg:grid-cols-[1fr_1.4fr] lg:gap-12">
        <div>
          <span className="text-xs font-black uppercase tracking-[0.18em] text-accent-600">For Organisations</span>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">{title}</h2>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            {subtitle ||
              'Tell us about your organisation and what you are looking for. The NOSTOPS team will come back with a tailored programme proposal: the right Council-curated programme, duration, batch plan and pricing.'}
          </p>
          <ul className="mt-6 space-y-3 text-sm text-ink-soft">
            <li className="flex gap-2"><span aria-hidden className="text-brand">✓</span>A reply {ENQUIRY_REPLY_SLA}, with a reference number for your enquiry</li>
            <li className="flex gap-2"><span aria-hidden className="text-brand">✓</span>Delivered on-site by NOSTOPS-provided, Council-vetted teachers</li>
            <li className="flex gap-2"><span aria-hidden className="text-brand">✓</span>Mind, Body and Special Needs programmes curated by the Council of Gurus</li>
            <li className="flex gap-2"><span aria-hidden className="text-brand">✓</span>No payment and no obligation to enquire</li>
          </ul>
        </div>
        <OrgEnquiryForm defaultCohort={cohort} sourcePage={sourcePage} />
      </div>
    </section>
  );
}
