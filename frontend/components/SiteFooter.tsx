'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ORG_COHORTS } from '@/lib/site-nav';

// Simplified site footer: four short groups + a compact legal bar. Footer-only
// change — every page, URL and specialised CTA (Claim, City Coordinator, Host a
// Retreat, List your Venue, …) stays reachable from its own section and the sitemap.
type FooterLink = { href: string; label: string };
type FooterGroup = { heading: string; testId: string; links: FooterLink[] };

const GROUPS: FooterGroup[] = [
  {
    heading: 'Explore NOSTOPS',
    testId: 'footer-explore',
    links: [
      { href: '/', label: 'Home' },
      { href: '/how-it-works', label: 'How It Works' },
      { href: '/teachers', label: 'Find Yoga Teachers' },
      { href: '/programmes', label: 'Explore Programmes' },
      { href: '/retreats', label: 'Retreats' },
      { href: '/yoga-teachers', label: 'Explore Cities' },
    ],
  },
  {
    heading: 'For Organisations',
    testId: 'footer-organisations',
    links: [
      ...ORG_COHORTS.map(({ href, label }) => ({ href, label })),
      { href: '/venues', label: 'Venues & Retreat Hosts' },
    ],
  },
  {
    heading: 'For Yoga Teachers',
    testId: 'footer-teachers',
    links: [
      { href: '/signup?role=teacher', label: 'Join NOSTOPS' },
      { href: '/become-a-teacher', label: 'Teacher Benefits' },
      { href: '/teachers', label: 'Empanelled Teachers Network' },
      { href: '/council', label: 'Council of Yoga Gurus' },
      { href: '/trust', label: 'Teacher Verification' },
    ],
  },
  {
    heading: 'About & Support',
    testId: 'footer-about-support',
    links: [
      { href: '/about', label: 'About NOSTOPS' },
      { href: '/contact', label: 'Contact Us' },
      { href: '/faq', label: 'FAQs' },
      { href: '/support', label: 'Help & Support' },
    ],
  },
];

const LEGAL: FooterLink[] = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms & Conditions' },
  { href: '/refunds', label: 'Refund & Cancellation Policy' },
];

// ≥44px tap height on phones/tablets, compact rows on desktop; visible keyboard focus.
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-cream';
const LINK = `inline-flex min-h-11 items-center rounded text-sm text-ink-soft transition-colors hover:text-accent-600 lg:min-h-0 lg:py-1 ${FOCUS}`;

function LinkColumn({ group }: { group: FooterGroup }) {
  const id = `${group.testId}-heading`;
  return (
    <section aria-labelledby={id} data-testid={group.testId}>
      <h2 id={id} className="text-xs font-black uppercase tracking-[0.14em] text-brand-700">{group.heading}</h2>
      <span aria-hidden className="mt-2 block h-0.5 w-6 rounded-full bg-accent" />
      <ul className="mt-3 lg:space-y-1.5">
        {group.links.map((l) => (
          <li key={l.label}>
            <Link className={LINK} href={l.href}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SiteFooter() {
  const year = new Date().getFullYear();
  // Homepage (owner choice): one compact horizontal row — logo + tagline, About & Support links.
  const isHome = usePathname() === '/';
  const about = GROUPS.find((g) => g.testId === 'footer-about-support')!;
  return (
    <footer className="mt-24 border-t border-line bg-cream" data-testid="site-footer">
      {isHome ? (
        <div className="container-x flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-6 sm:py-8">
          <div className="flex items-center gap-x-3">
            <Link href="/" aria-label="NOSTOPS home" className={`inline-block shrink-0 rounded ${FOCUS}`}>
              <Image src="/brand/nostops-logo.png" alt="NOSTOPS" width={139} height={40} className="h-7 w-auto sm:h-8" />
            </Link>
            <p className="text-xs font-semibold text-brand-700 sm:text-sm" data-testid="footer-tagline">A Teacher&apos;s First Yoga Cooperative</p>
          </div>
          <nav aria-label="Footer" data-testid="footer-nav">
            <ul className="flex flex-wrap gap-x-4 sm:gap-x-6" data-testid="footer-about-support">
              {about.links.map((l) => (
                <li key={l.label}>
                  <Link className={`${LINK} text-xs sm:text-sm`} href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : (
      <div className="container-x py-12 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <Link href="/" aria-label="NOSTOPS home" className={`inline-block rounded ${FOCUS}`}>
              <Image src="/brand/nostops-logo.png" alt="NOSTOPS" width={139} height={40} className="h-9 w-auto" />
            </Link>
            <p className="mt-3 text-sm font-semibold text-brand-700" data-testid="footer-tagline">
              A Teacher&apos;s First Yoga Cooperative
            </p>
          </div>

          <nav aria-label="Footer" className="lg:col-span-9" data-testid="footer-nav">
            <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4 lg:gap-x-8">
              {GROUPS.map((g) => <LinkColumn key={g.testId} group={g} />)}
            </div>
          </nav>
        </div>
      </div>
      )}

      <div className="border-t border-line/70">
        {/* Extra bottom room so the floating Ask AI Guru launcher never sits on the last line (all widths). */}
        <div className={`container-x flex pb-24 pt-5 text-xs text-muted sm:pb-20 ${isHome ? 'flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] sm:text-xs' : 'flex-col gap-2 md:flex-row md:items-center md:justify-between'}`} data-testid="footer-legal">
          <ul className={`flex flex-wrap ${isHome ? 'gap-x-4' : 'gap-x-5'}`}>
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link className={`inline-flex min-h-11 items-center rounded hover:text-accent-600 md:min-h-0 ${FOCUS}`} href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
          <p>Copyright © {year} NOSTOPS. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}
