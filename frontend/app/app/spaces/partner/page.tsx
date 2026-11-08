import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { CP_STATUS, FOCUS_LABEL, getCPDashboard, getMyCPApplication, REF_KIND } from '@/lib/server/community-partners';
import { SPACE_MODELS } from '@/lib/spaces';
import { fmtDate, fmtDateLong } from '@/lib/format';
import { SpacesPageHeader, SpBreadcrumbs, SpEmpty, SpIcon, SpSection, SpStat, type SpIconName } from '@/components/spaces/ui';

export const metadata: Metadata = { title: 'Community Partner', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const PROCESS: [SpIconName, string][] = [['doc', 'Application Received'], ['search', 'Review (1–3 working days)'], ['users', 'Conversation (if needed)'], ['shield', 'Approval & Activation']];

// Phase 7 — application status tracking, confirmation and (once active) the Community Partner dashboard.
export default async function CPHome({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  if (!(await getSessionUser())) redirect('/login?next=/app/spaces/partner');
  const { submitted } = await searchParams;
  const a = await getMyCPApplication();
  if (!a) return (
    <div className="mx-auto max-w-2xl py-6"><SpEmpty title="Become a Community Partner" testId="cp-none" action={<Link href="/app/spaces/partner/apply" className="sp-btn-primary bg-accent">Start application →</Link>}>Help your neighbourhood connect with NOSTOPS Spaces, teachers and programmes.</SpEmpty></div>);
  const active = a.status === 'approved' && a.partner_status === 'active';
  const dash = active ? await getCPDashboard() : null;
  if (dash) {
    const s = dash.stats;
    const tiles: [SpIconName, string, number, string][] = [['pin', 'My Localities', dash.localities.length, '/app/spaces/partner'], ['building', 'Active Spaces', s.active_spaces, '/app/spaces/partner/network'],
      ['users', 'Verified Teachers', s.verified_teachers, '/app/spaces/partner/network#teachers'], ['calendar', 'Public Programmes', s.programmes, '/app/spaces/partner/network'],
      ['check', 'Confirmed Participants', s.confirmed_participants, '/app/spaces/partner'], ['handshake', 'My Referrals', s.referrals, '/app/spaces/partner/referrals']];
    return (
      <div className="mx-auto max-w-7xl" data-testid="cp-dashboard">
        <SpacesPageHeader crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: 'Community Partner Dashboard' }]}
          title={`Welcome back, ${a.applicant.full_name?.split(' ')[0] || 'Partner'}!`}
          subtitle={`Your local yoga ecosystem in ${dash.localities.map((l) => l.locality).join(' & ')}.`}
          eyebrow={<p className="inline-flex items-center gap-2 rounded-full bg-[#E6F5DC] px-3 py-1 text-[14px] font-semibold text-[#1E6B2F]"><SpIcon name="shield" className="h-4 w-4" />Approved Community Partner{a.activated_at ? ` · Active since ${fmtDate(a.activated_at)}` : ''}</p>}
          image="/brand/spaces/network-hero.jpg" />
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{tiles.map(([i, l, n, h], k) => (
          <SpStat key={l} icon={i} value={n} label={l} href={h} tone={k % 3 === 1 ? 'green' : k % 3 === 2 ? 'lavender' : 'peach'} testId={`cp-tile-${l.replace(/\s/g, '-').toLowerCase()}`} />))}</div>
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <SpSection icon="pin" title="My Localities">
            <ul className="space-y-2 text-sm">{dash.localities.map((l) => <li key={l.locality_id} className="rounded-xl bg-[#FCF4E6] p-3"><b className="text-ink">{l.locality}</b><br /><span className="text-ink-soft">{l.district}, {l.state} · PIN {l.pin}</span></li>)}</ul>
            <p className="mt-3 text-xs text-muted">Spaces by model: {(['commercial', 'subsidised', 'community'] as const).map((m) => `${SPACE_MODELS[m]?.label} ${s.spaces_by_model[m] || 0}`).join(' · ')}</p></SpSection>
          <SpSection icon="calendar" title="Local Programme Activity">
            {dash.programmes.length === 0 ? <p className="text-sm text-ink-soft">No public programmes in your localities yet.</p> : <ul className="space-y-2 text-sm">{dash.programmes.map((p) => (
              <li key={p.slug}><Link href={`/events/${p.slug}`} className="font-bold text-brand-700">{p.title}</Link><br /><span className="text-ink-soft">{p.event_date ? fmtDateLong(p.event_date) : ''} · {p.lifecycle.toLowerCase()}</span></li>))}</ul>}</SpSection>
          <SpSection icon="star" title="Quick Actions">
            <div className="grid gap-2">{[['Explore local Spaces & teachers', '/app/spaces/partner/network'], ['Refer a teacher, Space or owner', '/app/spaces/partner/network#refer'], ['Track my referrals', '/app/spaces/partner/referrals'], ['Support & resources', '/spaces/community-partners#role']].map(([l, h]) => (
              <Link key={l} href={h} className="flex min-h-[48px] items-center justify-between rounded-xl border border-line bg-white px-4 text-[15px] font-medium text-ink hover:border-[#F2B574]">{l}<span aria-hidden className="text-[#F28A1E]">›</span></Link>))}</div></SpSection>
        </div>
        <SpSection icon="handshake" title="Recent Referrals" className="mt-5">
          {dash.recent_referrals.length === 0 ? <p className="text-sm text-ink-soft">No referrals yet.</p> : <ul className="divide-y divide-line text-sm">{dash.recent_referrals.map((r) => (
            <li key={r.id} className="flex justify-between py-2"><span><b className="text-ink">{r.name}</b> · {REF_KIND[r.kind]} · {r.locality}</span><span className="text-ink-soft">{r.status}</span></li>))}</ul>}
          <p className="mt-3 text-xs text-muted">Community Partners are a voluntary, non-financial role: there is no revenue share, fee or reward through NOSTOPS.</p></SpSection>
      </div>
    );
  }
  const st = a.partner_status && a.status === 'approved' ? CP_STATUS[a.partner_status] : CP_STATUS[a.status];
  const reached = { draft: 0, submitted: 1, info_requested: 2, approved: 3, rejected: 1 }[a.status] ?? 0;
  return (
    <div className="mx-auto max-w-6xl" data-testid="cp-status">
      <div className="space-y-5">
        <section className="relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/spaces/submitted-hero.jpg" alt="" aria-hidden className="sp-fade-left pointer-events-none absolute right-0 top-0 hidden h-full w-[42%] object-cover lg:block" />
          <SpBreadcrumbs items={[{ label: 'Spaces', href: '/spaces' }, { label: 'Community Partner Network', href: '/spaces/community-partners' }, { label: 'Application Status' }]} />
          <div className="relative mt-4 flex items-center gap-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#22A447] text-white ring-8 ring-[#DFF1D3]" aria-hidden>{a.status === 'draft' ? '…' : <SpIcon name="check" className="h-9 w-9" strokeWidth={3} />}</span>
          <div className="lg:max-w-[calc(58%-8rem)]"><h1 className="text-[34px] leading-tight">NOSTOPS Community Partner Network</h1>
            <p className="text-[24px] font-bold text-[#E8690C]" style={{ fontFamily: 'var(--sp-serif)' }} data-testid="cp-status-title">{submitted && a.status === 'submitted' ? 'Application Submitted!' : st?.label}</p>
            {a.status === 'submitted' && <p className="text-[16px] text-ink-soft">Thank you for applying. Your application is now under review.</p>}</div>
          </div>
        </section>
        <section className="sp-card flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3"><span className="text-[#F28A1E]"><SpIcon name="doc" className="h-9 w-9" /></span><div><p className="text-[18px] font-bold text-ink">Your Application Reference</p><p className="text-sm text-ink-soft">Please quote this reference in any communication with us.</p></div></div>
          <span className="rounded-full bg-[#0F4C4A] px-5 py-2 font-mono text-lg font-bold text-white" data-testid="cp-ref">{a.ref}</span>
        </section>
        <SpSection icon="search" title="Review & Approval Process">
          <ol className="mt-2 grid list-none grid-cols-4 gap-2 p-0">{PROCESS.map(([i, l], n) => (
            <li key={l} className="text-center"><span className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${n < reached || (n === 3 && a.status === 'approved') ? 'bg-[#22A447] text-white ring-8 ring-[#DFF1D3]' : 'border-2 border-[#C9C2B6] bg-white text-[#5B5B5B]'}`} aria-hidden><SpIcon name={i} className="h-8 w-8" /></span><p className="mt-3 text-[14px] font-semibold text-ink">{l}</p></li>))}</ol>
          {a.status === 'rejected' && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">Not approved: {a.decision_note}</p>}
          {a.status === 'info_requested' && <p className="mt-4 rounded-xl bg-orange-50 p-3 text-sm text-ink">NOSTOPS asked for more information: {a.info_request?.message}</p>}
          {a.status === 'approved' && a.partner_status !== 'active' && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-ink" data-testid="cp-not-active">{a.partner_status === 'suspended' ? 'Your partner access is suspended. Please contact spaces@nostops.org.' : a.partner_status === 'deactivated' ? 'Your partner access has been deactivated.' : 'Approved — NOSTOPS will activate your partner access shortly.'}</p>}
        </SpSection>
        <div className="grid gap-5 md:grid-cols-2">
          <SpSection icon="doc" title="Your application" className="text-sm">
            <p className="text-ink-soft">Localities: {a.localities.map((l) => `${l.locality} (${l.pin})`).join(', ') || '—'}</p>
            <p className="text-ink-soft">Focus: {a.focus_areas.map((f) => FOCUS_LABEL[f]).join(', ') || '—'}</p>
            {a.submitted_at && <p className="text-ink-soft">Submitted: {fmtDateLong(a.submitted_at)}</p>}</SpSection>
          <SpSection icon="mail" title="Need Help?" className="text-sm">
            <p className="text-ink-soft">For any questions, write to <a href="mailto:spaces@nostops.org" className="font-bold text-brand-700 underline">spaces@nostops.org</a>.</p></SpSection>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="sp-btn-secondary"><SpIcon name="home" className="h-5 w-5" />Back to Home</Link>
          {(a.status === 'draft' || a.status === 'info_requested') && <Link href="/app/spaces/partner/apply" className="sp-btn-primary bg-accent" data-testid="cp-continue">{a.status === 'draft' ? 'Continue application →' : 'Update & resubmit →'}</Link>}
        </div>
      </div>
    </div>
  );
}
