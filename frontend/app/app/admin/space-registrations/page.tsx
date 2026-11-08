import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getAdminSpaceRegistrations, inr, REG_STATUS } from '@/lib/server/space-registrations';
import { fmtDateTime } from '@/lib/format';
import AdminRegCancel from '@/components/spaces/AdminRegCancel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Space Programme Registrations', robots: { index: false, follow: false } };

const TABS = ['', 'CONFIRMED', 'PENDING_PAYMENT', 'CANCELLED', 'EXPIRED', 'PAYMENT_FAILED'];

// Phase 6 — admin registration and payment overview for NOSTOPS Spaces programmes (participant fees only).
export default async function AdminSpaceRegistrationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminUser();
  const { status: raw } = await searchParams;
  const status = TABS.includes(raw || '') ? raw || '' : '';
  const d = await getAdminSpaceRegistrations(status || undefined);
  return (
    <div className="mx-auto max-w-6xl" data-testid="admin-space-regs">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · NOSTOPS Spaces</p>
      <h1 className="mt-1 text-[36px] leading-tight">Programme registrations & payments</h1>
      <p className="mt-2 text-sm text-ink-soft">Participant fees only. There is no venue rent, revenue share, commission or payout for Space programmes.</p>
      {!d ? <p className="mt-6 rounded-2xl border border-line bg-white p-6 text-sm">The overview couldn&apos;t be loaded.</p> : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black text-brand-700">{d.totals.CONFIRMED || 0}</p><p className="text-xs font-bold text-ink-soft">Confirmed</p></div>
            <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black text-brand-700">{d.totals.PENDING_PAYMENT || 0}</p><p className="text-xs font-bold text-ink-soft">Awaiting payment</p></div>
            <div className="rounded-2xl border border-line bg-white p-4"><p className="text-2xl font-black text-brand-700">{inr(d.collected_minor / 100)}</p><p className="text-xs font-bold text-ink-soft">Fees collected (not refunded)</p></div>
            <div className="rounded-2xl border border-line bg-white p-4" data-testid="admin-space-regs-checkout"><p className="text-lg font-black text-brand-700">{d.checkout.enabled ? `On · ${d.checkout.gateway_mode}` : 'Off'}</p><p className="text-xs font-bold text-ink-soft">Online checkout (sandbox only)</p></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {TABS.map((t) => <Link key={t || 'all'} href={`/app/admin/space-registrations${t ? `?status=${t}` : ''}`} className={`inline-flex min-h-[40px] items-center rounded-full px-4 py-2 text-xs font-bold leading-none ${t === status ? 'bg-brand text-white' : 'border border-line bg-white text-ink'}`}>{t ? REG_STATUS[t].label : 'All'}</Link>)}
          </div>
          {d.items.length === 0 ? <p className="mt-6 rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-ink-soft" data-testid="admin-space-regs-empty">Nothing here.</p> : (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full text-left text-sm" data-testid="admin-space-regs-table">
                <thead className="bg-cream text-xs uppercase text-muted"><tr><th className="p-3">Registration</th><th className="p-3">Programme</th><th className="p-3">Participant</th><th className="p-3">Status</th><th className="p-3">Payment</th><th className="p-3">Created</th><th className="p-3" /></tr></thead>
                <tbody>{d.items.map((r) => (
                  <tr key={r.registration_id} className="border-t border-line align-top">
                    <td className="p-3 font-mono text-xs">{r.registration_id}</td>
                    <td className="p-3"><Link href={`/app/spaces/programmes/${r.event_id}/participants`} className="font-bold text-brand-700">{r.event?.title || r.event_id}</Link><br /><span className="text-xs text-muted">{r.event?.space?.name}</span></td>
                    <td className="p-3">{r.participant_name}<br /><span className="text-xs text-muted">{r.participant_email}</span></td>
                    <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${REG_STATUS[r.status]?.tone || ''}`}>{REG_STATUS[r.status]?.label || r.status}</span></td>
                    <td className="p-3 text-xs text-ink-soft">{r.pricing_mode === 'PAID' ? <>{inr(r.amount)} {r.currency} · {r.payment_status}<br />{r.payment_reference}{r.refund_status ? <><br />Refund: {r.refund_status}</> : null}</> : 'Free'}</td>
                    <td className="p-3 text-xs text-ink-soft">{fmtDateTime(r.created_at)}</td>
                    <td className="p-3">{(r.status === 'CONFIRMED' || r.status === 'PENDING_PAYMENT') && <AdminRegCancel id={r.registration_id} />}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
