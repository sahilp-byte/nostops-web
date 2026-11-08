'use client';

import Link from 'next/link';
import { useSavedVenues } from '@/lib/saved-venues';

// Header utility icon (sits beside Search) linking to the visitor's saved
// venues, with a live count badge. Not a primary nav item.
export default function HeaderSavedLink() {
  const { count } = useSavedVenues();
  return (
    <Link
      href="/venues/saved"
      aria-label={count > 0 ? `Saved venues (${count})` : 'Saved venues'}
      title="Saved venues"
      data-testid="header-saved-link"
      className="relative grid h-10 w-10 place-items-center rounded-lg text-ink-soft transition hover:bg-brand-50"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {count > 0 && (
        <span
          data-testid="header-saved-count"
          className="absolute right-0.5 top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-brand px-1 text-[10px] font-black leading-none text-white"
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
