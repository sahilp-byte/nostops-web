'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type OrgLink = { href: string; label: string; desc?: string };

// Desktop-only "For Organisations" dropdown for the public site header.
// Opens on hover (desktop) and on click/keyboard (accessible); closes on
// outside click, Escape, link tap, or route change.
export default function HeaderOrgMenu({ label = 'For Organisations', href = '/for-organisations', links, active = false }: { label?: string; href?: string; links: OrgLink[]; active?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      data-testid="org-menu"
    >
      <Link
        href={href}
        aria-haspopup="true"
        aria-expanded={open}
        aria-current={active ? 'page' : undefined}
        onFocus={() => setOpen(true)}
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-2 text-[13px] font-semibold xl:px-2 xl:text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 ${
          active ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-brand-50 hover:text-brand-700'
        }`}
      >
        {label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      {open && (
        <div
          role="menu"
          data-testid="org-menu-panel"
          className="absolute right-0 top-full z-50 mt-1 w-80 rounded-2xl border border-line bg-white p-2 shadow-xl"
        >
          {links.map((l) => {
            const here = pathname === l.href || (pathname?.startsWith(`${l.href}/`) ?? false);
            return (
              <Link
                key={l.href}
                href={l.href}
                role="menuitem"
                aria-current={here ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={`block rounded-xl px-3 py-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${here ? 'bg-brand-50' : 'hover:bg-brand-50'}`}
              >
                <span className={`block text-sm font-bold ${here ? 'text-brand-700' : 'text-ink'}`}>{l.label}</span>
                {l.desc ? <span className="mt-0.5 block text-xs text-muted">{l.desc}</span> : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
