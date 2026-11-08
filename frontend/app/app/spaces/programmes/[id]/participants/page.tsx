import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getProgrammeParticipants, inr, REG_STATUS } from '@/lib/server/space-registrations';
import { fmtDateTime } from '@/lib/format';
import AdminRegCancel from '@/components/spaces/AdminRegCancel';
import { SpacesPageHeader } from '@/components/spaces/ui';

export const metadata: Metadata = { title: 'Programme Participants', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Phase 6 — teacher (names + status only) and admin (+ email and payment) participant list. Space owners have no access.
export default async function ProgrammeParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getSessionUser())) redirect(`/login?next=/app/spaces/programmes/${id}/participants`);
  const d = await getProgrammeParticipants(id);
  if (!d) notFound();
  const admin = d.viewer === 'admin';
  const stat = (n: number | string, label: string) => (
    <div className="sp-card p-4"><p className="text-[28px] font-bold text-[#1C2A47]">{n}</p><p className="text-[14px] font-medium text-ink-soft">{label}</p></div>
  );
  return (
    <div className="mx-auto max-w-6xl" data-testid="sp-participants">
      <div className="space-y-5">
        <SpacesPageHeader crumbs={[{ label: 'My Programmes', href: '/app/spaces/programmes' }, { label: 'Programme', href: `/app/spaces/programmes/${id}` }, { label: 'Participants' }]} title="Registered Participants" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stat(d.confirmed, 'Confirmed')}{stat(d.pending, 'Awaiting payment')}{stat(d.seats_remaining, 'Places left')}{stat(d.capacity, 'Capacity')}
        </div>
        <p className="text-sm text-ink-soft" data-testid="sp-participants-state">{d.state.registration_status}{d.state.pricing.mode === 'PAID' ? ` · Fee ${inr(d.state.pricing.fee_minor / 100)} per participant` : ' · Free'}</p>
        {!admin && <p className="text-xs text-muted">Participant contact details are not shown. NOSTOPS shares programme updates with participants.</p>}
        {d.items.length === 0 ? <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-ink-soft">No registrations yet.</p> : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-left text-sm" data-testid="sp-participants-table">
              <thead className="bg-cream text-xs uppercase text-muted"><tr>{admin && <th className="p-3">Registration ID</th>}<th className="p-3">Participant</th>{admin && <th className="p-3">Email</th>}<th className="p-3">Status</th><th className="p-3">Payment</th><th className="p-3">Registered</th>{admin && <th className="p-3" />}</tr></thead>
              <tbody>{d.items.map((r, i) => (
                <tr key={admin ? r.registration_id : `row-${i}`} className="border-t border-line">
                  {admin && <td className="p-3 font-mono text-xs" data-testid={`sp-participant-rid-${r.registration_id}`}>{r.registration_id}</td>}
                  <td className="p-3 font-bold text-ink">{r.participant_name}</td>
                  {admin && <td className="p-3 text-ink-soft">{r.participant_email || '—'}</td>}
                  <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${REG_STATUS[r.status]?.tone || ''}`}>{REG_STATUS[r.status]?.label || r.status}</span></td>
                  <td className="p-3 text-ink-soft">{r.pricing_mode === 'PAID' ? `${inr(r.amount)} · ${(r.payment_status || '').toLowerCase()}${r.refund_status ? ` · refund ${r.refund_status.toLowerCase()}` : ''}` : 'Free'}</td>
                  <td className="p-3 text-ink-soft">{fmtDateTime(r.created_at)}</td>
                  {admin && <td className="p-3">{(r.status === 'CONFIRMED' || r.status === 'PENDING_PAYMENT') && <AdminRegCancel id={r.registration_id} />}</td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
