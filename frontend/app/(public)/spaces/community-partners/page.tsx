import type { Metadata } from 'next';
import Link from 'next/link';
import { SpBreadcrumbs, SpIcon, SpSection, SpSwash, type SpIconName } from '@/components/spaces/ui';
import { canonical } from '@/lib/site';

export const metadata: Metadata = {
  title: 'NOSTOPS Community Partners — bring NOSTOPS to your community',
  description: 'Help build a local yoga ecosystem in your neighbourhood by connecting Spaces, teachers and people through NOSTOPS.',
  alternates: { canonical: canonical('/spaces/community-partners') },
  openGraph: { title: 'NOSTOPS Community Partners — bring NOSTOPS to your community', description: 'Help build a local yoga ecosystem in your neighbourhood by connecting Spaces, teachers and people through NOSTOPS.', url: canonical('/spaces/community-partners'), type: 'website' },
  robots: { index: true, follow: true },
};

const HOW: [SpIconName, string][] = [['search', 'Find Your Locality'], ['users', 'Apply as a Community Partner'], ['shield', 'Get Verified & Onboarded'], ['calendar', 'Activate Local Yoga Programmes'], ['chart', 'Grow Your Community']];

// Phase 7 — public Community Partner landing (non-financial: no earnings, fees or revenue share).
export default function CommunityPartnersLanding() {
  return (
    <div data-testid="cp-landing">
      <section className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/spaces/cp-hero.jpg" alt="" aria-hidden className="sp-fade-left pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[50%] object-cover object-left lg:block" />
        <div className="container-x relative py-8 lg:py-12">
          <SpBreadcrumbs items={[{ label: 'NOSTOPS Spaces', href: '/spaces' }, { label: 'Community Partners' }]} />
          <div className="mt-5 max-w-[560px]">
            <h1 className="text-[42px] leading-[1.1] lg:text-[52px]">Bring NOSTOPS to <span className="text-[#E8690C]">Your Community</span></h1>
            <SpSwash className="mt-1 h-3 w-72" />
            <p className="mt-2 text-[28px] font-bold italic text-[#E8690C] lg:hidden" style={{ fontFamily: 'var(--sp-serif)' }}>Yoga se kya hoga?</p>
            <p className="mt-4 text-[19px] font-medium text-[#1C2A47]">Help create a local yoga ecosystem in your neighbourhood by connecting spaces, teachers and people through NOSTOPS.</p>
            <ul className="mt-5 space-y-3">
              {([['users', 'Build a local yoga community'], ['pin', 'Activate accessible neighbourhood spaces'], ['handshake', 'Connect teachers, Space owners and local organisations']] as [SpIconName, string][]).map(([i, t]) => (
                <li key={t} className="flex items-center gap-3 text-[17px] text-[#1C2A47]"><span className="text-[#F28A1E]"><SpIcon name={i} className="h-7 w-7" /></span>{t}</li>))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/app/spaces/partner/apply" className="sp-btn-primary bg-accent" data-testid="cp-become">Become a Community Partner<SpIcon name="arrowRight" className="h-5 w-5" strokeWidth={2.2} /></Link>
              <a href="#role" className="sp-btn-secondary">Know the Role</a>
            </div>
          </div>
          <p className="pointer-events-none absolute right-[30%] top-10 hidden -rotate-6 text-[40px] font-bold italic leading-tight text-[#E8690C] drop-shadow-[0_2px_0_#fff] lg:block" style={{ fontFamily: 'var(--sp-serif)' }} aria-hidden>Yoga se<br />kya hoga?</p>
        </div>
      </section>
      <div className="container-x pb-10">
        <section className="sp-card p-6 lg:p-8" aria-labelledby="how">
          <h2 id="how" className="text-[28px]">How It Works</h2>
          <ol className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-5">{HOW.map(([i, t], n) => (
            <li key={t} className="relative text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#FDE7CC] text-[#E8690C]" aria-hidden><SpIcon name={i} className="h-8 w-8" /></span>
              {n < HOW.length - 1 && <span aria-hidden className="absolute left-[calc(50%+44px)] right-[calc(-50%+44px)] top-8 hidden border-t-2 border-dashed border-[#F2B574] sm:block" />}
              <p className="mt-3 text-[16px] font-semibold text-[#1C2A47]">{n + 1}. {t}</p>
            </li>))}</ol>
        </section>
        <section className="mt-6 grid gap-4 rounded-[20px] bg-[#0F4C4A] p-5 text-white sm:grid-cols-4" aria-label="Highlights">
          {([['pin', 'Local Discovery', 'Find verified Spaces near you'], ['users', 'Local Teachers', 'Bring more yoga teachers onto the platform'], ['handshake', 'Stronger Community', 'Enable regular, accessible yoga'], ['chart', 'Visible Impact', 'More people practising yoga']] as [SpIconName, string, string][]).map(([i, t, d]) => (
            <div key={t} className="flex items-start gap-3"><span className="text-[#FFB25E]"><SpIcon name={i} className="h-8 w-8" /></span><span><b className="block text-[16px]">{t}</b><span className="text-[14px] text-white/80">{d}</span></span></div>))}
        </section>
        <section id="role" className="mt-6 grid gap-5 md:grid-cols-2">
          <SpSection icon="star" title="What Community Partners do">
            <ul className="space-y-2 text-[15px] text-[#1C2A47]">{['Discover and refer yoga teachers, potential Spaces and Space owners in up to two localities.', 'Promote public NOSTOPS programmes in their neighbourhood.', 'Track the referrals they make and see verified local activity.'].map((t) => <li key={t} className="flex gap-2"><span className="mt-0.5 text-[#22A447]"><SpIcon name="check" className="h-5 w-5" strokeWidth={2.4} /></span>{t}</li>)}</ul>
          </SpSection>
          <SpSection icon="shield" title="A voluntary, non-financial role">
            <p className="text-[15px] text-[#1C2A47]">Community Partners are not paid through NOSTOPS and pay nothing to NOSTOPS: there is no revenue share, fee or reward of any kind. Spaces use only the three official participation models: Commercial, Subsidised and Community.</p>
          </SpSection>
        </section>
      </div>
    </div>
  );
}
