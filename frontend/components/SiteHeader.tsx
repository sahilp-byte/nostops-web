import Link from 'next/link';
import Image from 'next/image';
import HeaderAuthCta from '@/components/HeaderAuthCta';
import HeaderNav from '@/components/HeaderNav';
import HeaderSavedLink from '@/components/HeaderSavedLink';
import MobileNav from '@/components/MobileNav';
import { HEADER_NAV as NAV } from '@/lib/site-nav';

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-white/85 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-2 sm:gap-3 xl:gap-5">
        <Link href="/" className="flex shrink-0 flex-col justify-center leading-none" aria-label="NOSTOPS home">
          <Image src="/brand/nostops-logo.png" alt="NOSTOPS" width={139} height={40} priority className="h-7 w-auto self-start sm:h-8" />
          <span className="mt-1 whitespace-nowrap text-[9px] font-semibold tracking-tight text-muted sm:text-[10px]">A Teacher&apos;s First Yoga Cooperative</span>
        </Link>

        {/* Primary menu, placed immediately next to the logo on the web layout */}
        <HeaderNav items={NAV} />

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1 xl:gap-2">
          <Link
            href="/search"
            aria-label="Search NOSTOPS"
            className="grid h-10 w-10 place-items-center rounded-lg text-ink-soft transition hover:bg-brand-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </Link>
          {/* On phones (360px) the Saved shortcut moves into the menu drawer so the header never scrolls sideways. */}
          <div className="hidden sm:block"><HeaderSavedLink /></div>
          <HeaderAuthCta />
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}
