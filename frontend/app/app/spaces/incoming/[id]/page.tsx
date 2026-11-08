import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getEnquiryWithViewer } from '@/lib/server/spaces';
import { ENQUIRY_ACTION, ENQUIRY_STATUS, FACILITIES, enquiryParties, historyOldestFirst, FOCUS_AREAS, GROUP_TYPES, PARTICIPANT_PROFILES, WEEK_DAYS, fmtTime } from '@/lib/spaces';
import OwnerEnquiryHeader from '@/components/spaces/OwnerEnquiryHeader';
import OwnerResponsePanel from '@/components/spaces/OwnerResponsePanel';
import EnquiryConversation from '@/components/spaces/EnquiryConversation';
import VenueTermsCard from '@/components/spaces/VenueTermsCard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Venue Owner · Enquiry Details', robots: { index: false, follow: false } };

const fd = (d?: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const ts = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const ACTION = ENQUIRY_ACTION;

// Enquiry Details (owner side). Only the current owner of the approved Space (or an admin) gets here.
export default async function OwnerEnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getSessionUser())) redirect(`/login?next=/app/spaces/incoming/${id}`);
  const r = await getEnquiryWithViewer(id);
  if (!r || (r.viewer !== 'owner' && r.viewer !== 'admin')) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-8 text-center" data-testid="owner-enq-no-access">
        <p className="text-lg font-black text-ink">Enquiry not found</p>
        <p className="mt-1 text-sm text-ink-soft">This enquiry doesn&apos;t exist or you aren&apos;t the owner of the Space it was sent to.</p>
        <Link href="/app/spaces/incoming" className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-brand px-5 text-sm font-black text-white">Enquiries Received</Link>
      </div>
    );
  }
  const e = r.enquiry;
  const st = ENQUIRY_STATUS[e.status] || ENQUIRY_STATUS.sent;
  const closed = e.status === 'declined';
  const days = WEEK_DAYS.filter(([k]) => e.days?.includes(k)).map(([, v]) => v).join(', ');

  return (
    <div className="mx-auto max-w-[1400px]" data-testid="owner-enquiry-page">
      <OwnerEnquiryHeader title="Enquiry Details" subtitle={r.viewer === 'admin' ? 'Administrator view of the request between the teacher and the venue owner.' : 'Review the request and respond to the teacher.'} crumbs={[['Spaces', '/app/spaces'], ['Enquiries', '/app/spaces/incoming'], ['Enquiry Details']]} />
      <div className="grid gap-6 xl:grid-cols-[1fr_440px]">
        <div className="space-y-5">
          <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white p-5" data-testid="owner-enq-head">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-accent text-3xl font-black text-white">{(e.teacher_name || '?').slice(0, 1)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-serif text-3xl font-black text-ink" data-testid="owner-enq-title">{e.programme_title}</h2>
                <span className={`rounded-full px-3 py-1 text-sm font-black ${st.tone}`} data-testid="owner-enq-status">{st.label}</span>
              </div>
              <p className="mt-1 text-lg font-bold text-ink">🧘 {e.teacher_name} · NOSTOPS Yoga Teacher</p>
              <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-ink-soft">
                {e.teacher_email && <a href={`mailto:${e.teacher_email}`} className="font-semibold text-brand-700" data-testid="owner-enq-email">✉️ {e.teacher_email}</a>}
                <span>🏠 {e.space?.name || e.space_name}</span><span>🔖 {e.ref}</span>
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5" data-testid="owner-enq-reqs">
            <h2 className="font-serif text-2xl font-black text-ink">📋 Programme Requirements</h2>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <dl className="space-y-3 text-sm">
                {[
                  ['Participant Profile', PARTICIPANT_PROFILES[e.participant_profile || '']], ['👪 Group Type', GROUP_TYPES[e.group_type || '']],
                  ['👥 No. of Participants', String(e.participants || '')], ['🗓️ Preferred Dates', [fd(e.start_date), fd(e.end_date)].filter(Boolean).join(' – ')],
                  ['⏰ Preferred Time', days ? `${days}: ${fmtTime(e.time_from)} – ${fmtTime(e.time_to)}` : ''], ['⌛ Duration', e.duration],
                ].map(([k, v]) => <div key={k} className="grid grid-cols-[170px_1fr] gap-2"><dt className="font-black text-ink">{k}</dt><dd className="text-ink-soft">{v || '—'}</dd></div>)}
              </dl>
              <div className="space-y-4 text-sm">
                <div data-testid="owner-enq-focus">
                  <p className="font-black text-ink">🎯 Focus Areas</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(e.focus_areas || []).length ? e.focus_areas!.map((f) => (
                      <span key={f} className={`rounded-full px-4 py-1.5 text-sm font-black ${f === 'mind' ? 'bg-teal-100 text-teal-800' : f === 'body' ? 'bg-orange-100 text-orange-800' : 'bg-violet-100 text-violet-800'}`}>{FOCUS_AREAS[f]}</span>
                    )) : <span className="text-ink-soft">Not specified</span>}
                  </div>
                </div>
                <div data-testid="owner-enq-facilities">
                  <p className="font-black text-ink">📝 Facility Requirements</p>
                  <ul className="mt-1 list-disc pl-5 text-ink-soft">{(e.facilities || []).length ? e.facilities!.map((f) => <li key={f}>{FACILITIES[f] || f}</li>) : <li>None specified</li>}</ul>
                </div>
                <div data-testid="owner-enq-access"><p className="font-black text-ink">💛 Special Needs &amp; Access</p><p className="mt-1 whitespace-pre-line text-ink-soft">{e.access_needs || 'None specified'}</p></div>
              </div>
            </div>
            {e.additional_info && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4" data-testid="owner-enq-message">
                <p className="font-serif text-lg font-black text-ink">💬 Message from Teacher</p>
                <p className="mt-1 whitespace-pre-line italic text-ink">“{e.additional_info}”</p>
              </div>
            )}
          </section>

          <VenueTermsCard e={e} editable={!closed} viewer={r.viewer} title={r.viewer === 'admin' ? 'Venue Terms' : undefined} />

          <section className="grid gap-5 rounded-2xl border border-line bg-white p-5 md:grid-cols-2">
            <div data-testid="owner-enq-docs">
              <h3 className="font-black text-ink">📄 Supporting Documents ({e.documents?.length || 0})</h3>
              <div className="mt-2 flex flex-col gap-2">
                {(e.documents || []).map((d) => <a key={d.id} href={`/bff/spaces/enquiries/doc/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center rounded-xl border border-line px-3 text-sm font-bold text-ink hover:border-brand">📕 {d.name}</a>)}
                {!e.documents?.length && <p className="text-sm text-ink-soft">No documents attached</p>}
              </div>
            </div>
            <div data-testid="owner-enq-history">
              <h3 className="font-black text-ink">🕑 Enquiry History</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {historyOldestFirst(e.history).map((h, i) => (
                  <li key={i} className="text-ink-soft"><span className="font-bold text-ink">{ACTION[h.action] || h.action}</span> · {ts(h.at)}{h.note ? ` · “${h.note}”` : ''}</li>
                ))}
              </ul>
            </div>
          </section>
          <Link href="/app/spaces/incoming" className="inline-flex min-h-[48px] items-center rounded-xl border-2 border-brand bg-white px-5 text-sm font-black text-brand-700" data-testid="owner-enq-back">← Back to Enquiries</Link>
        </div>

        <div className="space-y-5">
          <OwnerResponsePanel id={e.id} closed={closed} admin={r.viewer === 'admin'} />
          <EnquiryConversation id={e.id} me="owner" messages={e.messages || []} closed={closed} />
          <p className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-ink" data-testid="owner-enq-rules">
            <strong>Not a booking.</strong> Accepting in principle does not confirm a booking. A programme proceeds only after the teacher and the venue owner mutually agree. Any financial arrangement is private {enquiryParties(r.viewer)}, outside NOSTOPS.
          </p>
        </div>
      </div>
    </div>
  );
}
