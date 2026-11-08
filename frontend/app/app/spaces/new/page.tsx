import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { displayName } from '@/lib/roles';
import SpaceWizard from '@/components/spaces/SpaceWizard';
import { SPACE_MODELS } from '@/lib/spaces';
import { SpacesPageHeader, SpIcon, type SpIconName } from '@/components/spaces/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'List a Space', robots: { index: false, follow: false } };

export default async function NewSpacePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/app/spaces/new');
  return (
    <div className="mx-auto max-w-7xl" data-testid="new-space-page">
      <SpacesPageHeader crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: 'My Spaces', href: '/app/spaces' }, { label: 'List Your Space' }]}
        title="List Your Space on NOSTOPS" subtitle={<span className="font-serif text-[22px] font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>Venue Owner Onboarding</span>} />
      <p className="mt-1 text-[15px] text-ink-soft">For halls, studios and community spaces in India. Your progress is saved at every step.</p>
      <div className="mt-5">
        <SpaceWizard initial={null} ownerName={displayName(user)} />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="sp-card p-6" data-testid="why-list-space">
          <h2 className="text-[24px]">Why List Your Space on NOSTOPS?</h2>
          <ul className="mt-3 space-y-2.5 text-[16px] text-[#1C2A47]">
            {([['users', 'Connect with verified yoga teachers'], ['calendar', 'Host yoga classes, workshops and retreats'], ['sprout', 'Support community well-being'], ['chart', 'Better utilisation of your space'], ['star', 'Recognition as a NOSTOPS Space Partner']] as [SpIconName, string][]).map(([i, t]) => (
              <li key={t} className="flex items-center gap-4"><span className="text-[#F28A1E]"><SpIcon name={i} className="h-7 w-7" /></span>{t}</li>))}
          </ul>
        </div>
        <div className="sp-card p-6" data-testid="three-models">
          <h2 className="text-[24px]">The Three Participation Models</h2>
          <ul className="mt-2 divide-y divide-[#EEDFC8]">
            {Object.entries(SPACE_MODELS).map(([k, m]) => (
              <li key={k} className="flex items-start gap-4 py-3">
                <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${k === 'community' ? 'bg-[#E6F5DC] text-[#22A447]' : 'bg-[#FDE7CC] text-[#E8690C]'}`}><SpIcon name={k === 'commercial' ? 'building' : k === 'subsidised' ? 'tag' : 'users'} className="h-8 w-8" /></span>
                <span><span className="flex flex-wrap items-center gap-2 text-[18px] font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>{m.label} Space<span className={`rounded-full px-3 py-0.5 text-[13px] font-semibold ${m.tone}`} style={{ fontFamily: 'var(--sp-sans)' }}>{m.badge}</span></span><span className="text-[15px] text-[#1C2A47]">{m.blurb}</span></span>
              </li>))}
          </ul>
        </div>
      </div>
    </div>
  );
}
