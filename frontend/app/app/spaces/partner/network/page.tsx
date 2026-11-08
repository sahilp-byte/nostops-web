import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getCPDashboard, getCPSpaces, getCPTeachers } from '@/lib/server/community-partners';
import { SPACE_MODELS, SPACE_TYPES } from '@/lib/spaces';
import CPReferralForm from '@/components/spaces/CPReferralForm';
import { SpacesPageHeader, SpIcon, SpStat } from '@/components/spaces/ui';

export const metadata: Metadata = { title: 'Community Partner · Local Network', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Phase 7 — discovery of PUBLIC Spaces and verified teachers in the partner's localities + referral form.
export default async function CPNetworkPage() {
  if (!(await getSessionUser())) redirect('/login?next=/app/spaces/partner/network');
  const dash = await getCPDashboard();
  if (!dash) redirect('/app/spaces/partner');
  const [spaces, teachers] = await Promise.all([getCPSpaces(), getCPTeachers()]);
  return (
    <div className="mx-auto max-w-7xl" data-testid="cp-network">
      <SpacesPageHeader crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: 'Community Partner Dashboard', href: '/app/spaces/partner' }, { label: 'Venues Network' }]}
        title="Venues & Teachers Network" image="/brand/spaces/network-hero.jpg"
        subtitle={`Public NOSTOPS Spaces and verified teachers in ${dash.localities.map((l) => l.locality).join(' & ')}. You can refer, not edit or approve.`} />
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SpStat icon="building" value={spaces?.length || 0} label="Public Spaces" />
        <SpStat icon="calendar" tone="green" value={(spaces || []).reduce((n, s) => n + (s.live_programmes || 0), 0)} label="Live Programmes" />
        <SpStat icon="users" tone="lavender" value={teachers?.length || 0} label="Verified Teachers" />
        <SpStat icon="pin" value={dash.localities.length} label="My Localities" />
      </div>
      <section className="sp-card mt-5 p-5" data-testid="cp-spaces">
        <h2 className="text-[24px]">Spaces ({spaces?.length || 0})</h2>
        <div className="mt-3 divide-y divide-[#EEDFC8]">
        {!spaces?.length ? <p className="py-3 text-sm text-ink-soft">No approved Spaces in your localities yet — refer potential Spaces and owners below.</p> : spaces.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-[#FDE7CC] text-[#E8690C]"><SpIcon name="building" className="h-7 w-7" /></span><div><p className="text-[17px] font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>{s.name} <span className="ml-1 rounded-full bg-[#FDE7CC] px-2 py-0.5 text-xs font-semibold text-[#9A3B0B]" style={{ fontFamily: 'var(--sp-sans)' }}>{s.location?.locality}</span></p>
              <p className="text-sm text-ink-soft">{SPACE_TYPES[s.space_type] || s.space_type} · Up to {s.capacity} participants</p></div></div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${SPACE_MODELS[s.model]?.tone || ''}`}>{SPACE_MODELS[s.model]?.label}</span>
            <span className="text-sm text-ink-soft">{s.live_programmes} live programme{s.live_programmes === 1 ? '' : 's'}</span>
            <Link href={`/spaces/${s.id}`} className="sp-btn-secondary !min-h-[44px] !px-4 !text-[15px]">View public page</Link>
          </div>))}
        </div>
      </section>
      <section id="teachers" className="mt-6" data-testid="cp-teachers">
        <h2 className="text-[24px]">Verified teachers nearby ({teachers?.length || 0})</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">{(teachers || []).map((t, i) => (
          <div key={i} className="sp-card flex items-center gap-3 p-4 text-sm"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#E6F5DC] font-bold text-[#1E6B2F]">{t.name?.slice(0, 1)}</span><div><p className="font-bold text-ink">{t.name}</p><p className="text-ink-soft">{t.city}{t.experience_years ? ` · ${t.experience_years} yrs` : ''}</p>
            {t.specializations?.length ? <p className="mt-1 text-xs text-muted">{t.specializations.slice(0, 3).join(', ')}</p> : null}</div></div>))}</div>
      </section>
      <div className="mt-6"><CPReferralForm localities={dash.localities} /></div>
    </div>
  );
}
