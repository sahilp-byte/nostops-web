import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getOrgEnquiry } from '@/lib/server/org-enquiries';
import { DURATIONS, ENQ_COHORTS, INTERESTS, PARTICIPANT_LABELS, START_PERIODS, labelOf } from '@/lib/org/enquiry';
import OrgEnquiryEditor from '@/components/app/admin/OrgEnquiryEditor';
import ProposalComposer from '@/components/app/admin/ProposalComposer';
import DeleteEnquiry from '@/components/app/admin/DeleteEnquiry';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Org Enquiry', robots: { index: false, follow: false } };

export default async function AdminOrgEnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser();
  const { id } = await params;
  const e = await getOrgEnquiry(id);
  if (!e) notFound();

  const rows: [string, string][] = [
    ['Organisation type', labelOf(ENQ_COHORTS, e.cohort)],
    ['City', e.city],
    ['Approx. participants', labelOf(PARTICIPANT_LABELS, e.participants)],
    ['Programme interests', e.interests.map((i) => labelOf(INTERESTS, i)).join(', ')],
    ['Customised programme', e.customisation_requested ? 'Requested (via the programme wizard)' : 'Not requested'],
    ['Preferred duration', labelOf(DURATIONS, e.duration)],
    ['Preferred start', labelOf(START_PERIODS, e.start_period)],
    ['Contact', [e.contact_name, e.designation].filter(Boolean).join(' · ')],
    ['Email', e.email || '—'],
    ['Phone', e.phone || '—'],
    ['Source page', e.source_page || '—'],
    ['Landing page', e.landing_page || '—'],
    ['Referrer', e.referrer || '—'],
    ['Campaign (UTM)', Object.entries(e.utm || {}).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'],
    ['Received', e.created_at.replace('T', ' ').replace(/\+.*/, '')],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/admin/org-enquiries" className="text-sm font-bold text-brand-700 hover:underline">‹ All enquiries</Link>
      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <h1 className="text-3xl font-black tracking-tight text-ink" data-testid="enq-detail-org">{e.organisation_name}</h1>
        <span className="text-sm font-bold text-muted" data-testid="enq-detail-ref">{e.ref}</span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-white p-5">
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              {rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-semibold text-muted">{k}</dt>
                  <dd className="break-words text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          {e.message && (
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="text-xs font-black uppercase tracking-wide text-muted">Message</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft" data-testid="enq-detail-message">{e.message}</p>
            </div>
          )}
          <ProposalComposer enquiry={e} />
          <DeleteEnquiry id={e.id} enquiryRef={e.ref} />
        </div>
        {/* Keyed on updated_at so a sent proposal (router.refresh) remounts it with fresh data. */}
        <OrgEnquiryEditor key={e.updated_at} initial={e} />
      </div>
    </div>
  );
}
