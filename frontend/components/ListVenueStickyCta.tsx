'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MOBILE_NAV_EVENT, GURU_BUBBLE_EVENT } from '@/lib/ui-events';

// Subtle persistent "List your Venue — Free" shortcut that fades in once the
// visitor has scrolled a little way down a long page. Bottom-LEFT so it never
// collides with the bottom-right "Ask AI Guru" launcher, and hidden while the
// mobile menu, the Ask AI Guru bubble or the site footer is on screen (so they never overlap).
// Hidden on the listing pages themselves (where it would be redundant), on the
// organisation pages (off-audience there, and on phones it covered the FAQ) and
// on the programme and event pages (off-audience; on phones it covered content).
export default function ListVenueStickyCta() {
  const pathname = usePathname() || '/';
  const [show, setShow] = useState(false);
  const [covered, setCovered] = useState({ nav: false, bubble: false, footer: false });

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const onNav = (e: Event) => setCovered((c) => ({ ...c, nav: !!(e as CustomEvent<boolean>).detail }));
    const onBubble = (e: Event) => setCovered((c) => ({ ...c, bubble: !!(e as CustomEvent<boolean>).detail }));
    window.addEventListener(MOBILE_NAV_EVENT, onNav);
    window.addEventListener(GURU_BUBBLE_EVENT, onBubble);
    // Hide while the footer is on screen: it already links List your Venue, and the
    // floating pill would otherwise sit on top of the footer's last lines.
    const footer = document.querySelector('[data-testid="site-footer"]');
    const io = footer
      ? new IntersectionObserver(([e]) => setCovered((c) => ({ ...c, footer: e.isIntersecting })))
      : null;
    if (footer && io) io.observe(footer);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener(MOBILE_NAV_EVENT, onNav);
      window.removeEventListener(GURU_BUBBLE_EVENT, onBubble);
      io?.disconnect();
    };
  }, []);

  const redundant = pathname.startsWith('/list-your-venue') || pathname.startsWith('/venues/submit');
  const orgPage = /^\/(for-organisations|programmes|events)(\/|$)/.test(pathname);
  if (redundant || orgPage || !show || covered.nav || covered.bubble || covered.footer) return null;

  return (
    <Link
      href="/list-your-venue"
      data-analytics="sticky_list_venue"
      data-testid="sticky-list-venue"
      aria-label="List your venue for free"
      className="fixed bottom-24 left-5 z-40 inline-flex items-center gap-2 rounded-full bg-brand/95 px-4 py-2.5 text-sm font-bold text-white shadow-lg ring-1 ring-black/5 backdrop-blur transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      List your Venue — Free
    </Link>
  );
}
