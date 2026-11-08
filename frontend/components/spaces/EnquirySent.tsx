import Link from 'next/link';
import { ENQUIRY_ACTION, ENQUIRY_STATUS, GROUP_TYPES, WEEK_DAYS, enquiryParties, fmtTime, historyOldestFirst } from '@/lib/spaces';
import type { SpaceEnquiry } from '@/lib/server/spaces';
import { EnquirySpaceCard } from '@/components/spaces/EnquiryReview';
import EnquiryConversation from '@/components/spaces/EnquiryConversation';
import VenueTermsCard from '@/components/spaces/VenueTermsCard';

// Phase 4 · Screen 2 — Enquiry Successfully Sent (teacher side).
const fmtDate = (d?: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const NEXT: Record<string, string[]> = {
  sent: ['The venue owner will review your enquiry.', 'They may contact you to discuss availability or terms.', "You'll hear about next steps by email and in My Enquiries."],
  in_discussion: ['Read the owner’s message and reply in the conversation below.', 'Agree availability and venue terms together.', "You'll hear about next steps by email and in My Enquiries."],
  accepted_in_principle: ['The owner has agreed in principle. This is not a confirmed booking.', 'Finalise the remaining details with the owner in the conversation below.', 'The programme proceeds only after you both mutually agree.'],
  declined: ['This enquiry is closed. The owner can’t respond to it and no new messages can be added.', 'You can send a new enquiry to another Space, or to this Space for different dates.', 'This record and its history stay in My Enquiries.'],
};
// Administrator view of a teacher's enquiry: neutral wording, no teacher instructions.
const NEXT_ADMIN: Record<string, string[]> = {
  sent: ['The venue owner reviews the teacher’s enquiry.', 'The owner may reply to discuss availability or venue terms.', 'Both parties are notified by email and see updates in NOSTOPS.'],
  in_discussion: ['The teacher and the venue owner are discussing this enquiry.', 'They agree availability and venue terms in the conversation below.', 'Both parties are notified by email of new messages.'],
  accepted_in_principle: ['The venue owner has agreed in principle. This is not a confirmed booking.', 'The teacher and the owner finalise the remaining details.', 'The programme proceeds only after both parties mutually agree.'],
  declined: ['This enquiry is closed. No further responses or messages can be added.', 'The teacher may send a new enquiry to another Space or for different dates.', 'This record and its history are retained.'],
};
const BANNER: Record<string, { icon: string; title: string; text: string; tone: string }> = {
  sent: { icon: '✅', title: 'Enquiry Successfully Sent', text: 'Your enquiry has been sent to the owner of', tone: 'border-emerald-200 bg-emerald-50' },
  in_discussion: { icon: '💬', title: 'In Discussion with the Venue Owner', text: 'The owner is discussing your enquiry for', tone: 'border-sky-200 bg-sky-50' },
  accepted_in_principle: { icon: '🤝', title: 'Accepted in Principle', text: 'The owner has accepted your enquiry in principle (not a confirmed booking) for', tone: 'border-emerald-200 bg-emerald-50' },
  declined: { icon: '✖', title: 'Enquiry Declined', text: 'The owner is not able to host this programme at', tone: 'border-red-200 bg-red-50' },
};
const BANNER_ADMIN: Record<string, { title: string; text: string }> = {
  sent: { title: 'Enquiry Sent', text: 'The teacher’s enquiry has been sent to the owner of' },
  in_discussion: { title: 'In Discussion', text: 'The teacher and the venue owner are discussing this enquiry for' },
  accepted_in_principle: { title: 'Accepted in Principle', text: 'The venue owner has accepted this enquiry in principle (not a confirmed booking) for' },
  declined: { title: 'Enquiry Declined', text: 'The venue owner is not able to host this programme at' },
};

export default function EnquirySent({ e, viewer }: { e: SpaceEnquiry; viewer: string }) {
  const admin = viewer === 'admin';
  const days = WEEK_DAYS.filter(([k]) => e.days?.includes(k)).map(([, v]) => v).join(', ');
  const rows: [string, string][] = [
    ['Reference', e.ref || ''], ['Programme', e.programme_title || ''], ['Duration', e.duration || ''],
    ['Expected participants', String(e.participants || '')], ['Group type', GROUP_TYPES[e.group_type || ''] || ''],
    ['Preferred dates', [fmtDate(e.start_date), fmtDate(e.end_date)].filter(Boolean).join(' – ')],
    ['Preferred timings', days ? `${days}: ${fmtTime(e.time_from)} – ${fmtTime(e.time_to)}` : ''],
    ['Sent on', e.sent_at ? new Date(e.sent_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''],
  ];
  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]" data-testid="enquiry-sent">
      <EnquirySpaceCard e={e} />
      <div className="space-y-4">
        {(() => {
          const base = BANNER[e.status] || BANNER.sent;
          const b = admin ? { ...base, ...(BANNER_ADMIN[e.status] || BANNER_ADMIN.sent) } : base;
          return (
            <section className={`rounded-3xl border p-6 text-center ${b.tone}`} data-testid="enq-status-banner">
              <p className="text-5xl" aria-hidden>{b.icon}</p>
              <h2 className="mt-2 text-3xl font-black text-ink" data-testid="enq-banner-title">{b.title}</h2>
              <p className="mt-2 text-ink-soft">{b.text} <strong className="text-ink">{e.space?.name || e.space_name}</strong>.</p>
              {e.decline_reason && <p className="mt-2 text-sm font-semibold text-red-700" data-testid="enq-decline-reason">Reason: {e.decline_reason}</p>}
              {e.status === 'declined' && (
                <p className="mx-auto mt-3 max-w-xl rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-ink" data-testid="enq-closed-note">
                  🔒 Declined · Closed. This enquiry is closed and can&apos;t receive any further responses or messages. Its details and history are kept below{admin ? '' : ' for your records'}.
                </p>
              )}
              <p className="mt-4 inline-block rounded-2xl border-2 border-dashed border-emerald-400 bg-white px-6 py-3">
                <span className="block text-xs font-bold uppercase tracking-wider text-muted">Enquiry reference</span>
                <span className="text-2xl font-black tracking-wider text-ink" data-testid="enq-ref">{e.ref}</span>
              </p>
              {e.status === 'sent' && (
                <p className="mt-4 text-sm font-semibold text-emerald-800" data-testid="enq-owner-notified">
                  {admin ? (e.owner_notified ? '🔔 The venue owner was notified by email.' : '🔔 The venue owner can see this enquiry in their NOSTOPS account.')
                    : e.owner_notified ? '🔔 The venue owner has been notified by email.' : '🔔 The venue owner will see your enquiry in their NOSTOPS account.'}
                </p>
              )}
            </section>
          );
        })()}

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-line bg-white p-5" data-testid="enq-summary">
            <h3 className="text-lg font-black text-ink">Enquiry Summary</h3>
            <dl className="mt-3 space-y-2 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex gap-3"><dt className="w-40 shrink-0 font-semibold text-muted">{k}</dt><dd className="font-bold text-ink">{v || '—'}</dd></div>
              ))}
            </dl>
          </section>
          <section className="space-y-4">
            <div className="rounded-2xl border border-line bg-white p-5" data-testid="enq-next">
              <h3 className="text-lg font-black text-ink">ⓘ What happens next?</h3>
              <ol className="mt-3 space-y-2 text-sm text-ink">
                {((admin ? NEXT_ADMIN : NEXT)[e.status] || (admin ? NEXT_ADMIN : NEXT).sent).map((t, i) => <li key={i}>{'①②③'[i]} {t}</li>)}
              </ol>
            </div>
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5" data-testid="enq-not-booking">
              <p className="font-black text-ink">⚠️ An enquiry is not a confirmed booking.</p>
              <p className="mt-1 text-sm text-ink-soft">The programme proceeds only after the teacher and the venue owner mutually agree on all details. Any financial arrangement is private {enquiryParties(viewer)}, outside NOSTOPS.</p>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap gap-3">
          {admin
            ? <Link href="/app/spaces/incoming" className="inline-flex min-h-[52px] items-center rounded-xl bg-accent px-6 text-base font-black text-white" data-testid="enq-view-all">All Space Enquiries</Link>
            : <Link href="/app/spaces/enquiries" className="inline-flex min-h-[52px] items-center rounded-xl bg-accent px-6 text-base font-black text-white" data-testid="enq-view-mine">View My Enquiries</Link>}
          <Link href="/spaces" className="inline-flex min-h-[52px] items-center rounded-xl border-2 border-brand bg-white px-6 text-base font-black text-brand-700" data-testid="enq-go-spaces">Go to Spaces</Link>
        </div>
        <p className="text-sm font-bold text-ink" data-testid="enq-teacher-status">Current status: {(ENQUIRY_STATUS[e.status] || ENQUIRY_STATUS.sent).label}{e.decline_reason ? ` · Reason: ${e.decline_reason}` : ''}</p>
        {(e.venue_terms || e.status !== 'sent') && <VenueTermsCard e={e} editable={false} viewer={viewer} title="Venue Terms from the Owner" />}
        <EnquiryConversation id={e.id} me={admin ? 'admin' : 'teacher'} readOnly={admin} messages={e.messages || []} closed={e.status === 'declined'} />
        {!!e.history?.length && (
          <section className="rounded-2xl border border-line bg-white p-5" data-testid="enq-history">
            <h3 className="text-lg font-black text-ink">Enquiry History</h3>
            <ol className="mt-3 space-y-1 text-sm">
              {historyOldestFirst(e.history).map((h, i) => (
                <li key={i} className="text-ink-soft"><span className="font-bold text-ink">{ENQUIRY_ACTION[h.action] || h.action}</span> · {new Date(h.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}{h.note ? ` · “${h.note}”` : ''}</li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
