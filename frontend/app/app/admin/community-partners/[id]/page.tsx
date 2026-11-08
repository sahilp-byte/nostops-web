import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { CP_STATUS, FOCUS_LABEL, getAdminCP, REF_KIND, TIMELINE_LABEL } from '@/lib/server/community-partners';
import { fmtDateTime } from '@/lib/format';
import { CPAdminActions, CPDocButton, CPRefStatus } from '@/components/spaces/CPAdmin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Community Partner', robots: { index: false, follow: false } };

export default async function AdminCPDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser();
  const { id } = await params;
  const d = await getAdminCP(id);
  if (!d) notFound();
  const a = d.application;
  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-4 py-2"><dt className="text-ink-soft">{k}</dt><dd className="text-right font-bold text-ink">{v || '—'}</dd></div>;
  return (
    <div className="mx-auto max-w-6xl space-y-5" data-testid="admin-cp-detail">
      <Link href="/app/admin/community-partners" className="text-sm font-bold text-brand-700">← Applications</Link>
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-[36px] leading-tight">{a.applicant.full_name || a.account_name}</h1>
        <span className="font-mono text-sm">{a.ref}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${CP_STATUS[a.status]?.tone}`} data-testid="admin-cp-status">{CP_STATUS[a.status]?.label}</span>
        {a.partner_status && <span className={`rounded-full px-3 py-1 text-xs font-bold ${CP_STATUS[a.partner_status].tone}`} data-testid="admin-cp-partner">{CP_STATUS[a.partner_status].label}</span>}</div>
      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-line bg-white p-5"><h2 className="font-serif text-xl font-semibold text-brand-700">Applicant</h2><dl className="mt-2 divide-y divide-line text-sm">
            {row('Account', `${a.account_name} · ${a.account_email}`)}{row('Phone', a.applicant.phone)}{row('City', a.applicant.city)}{row('Occupation', a.applicant.occupation)}{row('Languages', a.applicant.languages)}
            {row('Applied localities', a.localities.map((l) => `${l.locality}, ${l.district} (${l.pin})`).join(' · '))}{row('Assigned localities', a.assigned_localities.map((l) => `${l.locality} (${l.pin})`).join(' · '))}
            {row('Focus', a.focus_areas.map((f) => FOCUS_LABEL[f]).join(', '))}{row('Timeline', TIMELINE_LABEL[a.plan.timeline || ''])}{row('Hours / week', a.plan.weekly_hours)}
            {row('Team', a.team.map((m) => `${m.name}${m.role ? ` (${m.role})` : ''}`).join(', '))}{row('Declarations', a.declarations.truthful && a.declarations.guidelines ? 'Both accepted' : 'Incomplete')}</dl>
            <p className="mt-3 text-sm"><b>Background:</b> {a.applicant.background}</p><p className="mt-2 text-sm"><b>Community work:</b> {a.applicant.community_experience || '—'}</p>
            <p className="mt-2 text-sm"><b>Activation plan:</b> {a.plan.activation_plan}</p></section>
          <section className="rounded-3xl border border-line bg-white p-5"><h2 className="font-serif text-xl font-semibold text-brand-700">Documents (private)</h2>
            <div className="mt-3 flex flex-wrap gap-2">{a.documents.map((doc) => <CPDocButton key={doc.id} id={doc.id} label={d.doc_kinds[doc.kind] || doc.kind} />)}</div></section>
          <section className="rounded-3xl border border-line bg-white p-5"><h2 className="font-serif text-xl font-semibold text-brand-700">Referrals & activity ({d.referrals.length})</h2>
            <ul className="mt-2 divide-y divide-line text-sm">{d.referrals.map((r) => <li key={r.id} className="flex items-center justify-between gap-3 py-2"><span><b>{r.name}</b> · {REF_KIND[r.kind]} · {r.locality} · {r.contact}</span><CPRefStatus id={r.id} status={r.status} /></li>)}</ul></section>
        </div>
        <div className="space-y-5">
          <CPAdminActions key={`${a.status}-${a.partner_status}-${a.updated_at}`} id={a.id} status={a.status} partner={a.partner_status} assigned={a.assigned_localities.map((l) => ({ ...l, country: 'IN' as const }))} />
          <section className="rounded-3xl border border-line bg-white p-5"><h2 className="font-serif text-xl font-semibold text-brand-700">Audit history</h2>
            <ul className="mt-2 space-y-2 text-xs" data-testid="admin-cp-audit">{d.audit.map((h, i) => <li key={i}><b>{h.action.replace(/_/g, ' ')}</b> · {h.actor} · {fmtDateTime(h.at)}{h.reason ? <><br /><span className="text-ink-soft">{h.reason}</span></> : null}</li>)}</ul></section>
        </div>
      </div>
    </div>
  );
}
