'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActivePath, isOrgActive, SPACES_APP_ROUTE, type NavEntry } from '@/components/HeaderNav';
import { SPACES_HEADER_NAV } from '@/lib/site-nav';
import { MOBILE_NAV_EVENT, emitUiEvent } from '@/lib/ui-events';

// Tap-open drawer for the public site header on phones. Renders the SAME approved
// six top-level items (in order) as desktop, with the "For Organisations" group
// as a tap-to-expand sub-list of the three cohorts. The panel also surfaces the
// primary auth actions (account controls, kept separate from nav). Closes on
// select, outside tap, Escape, or route change. While open, the page behind is
// scroll-locked and floating widgets (Ask AI Guru, sticky CTA) step aside.
export default function MobileNav({ items: baseItems }: { items: NavEntry[] }) {
  const [open, setOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const pathname = usePathname() || '/';
  // Same rule as the desktop HeaderNav: Spaces pages show the Spaces item.
  const items = isActivePath(pathname, '/spaces') || SPACES_APP_ROUTE.test(pathname) ? SPACES_HEADER_NAV : baseItems;
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch('/bff/auth/whoami', { signal: ac.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAuthed(!!d?.authenticated))
      .catch(() => setAuthed(false));
    return () => ac.abort();
  }, []);

  // Close the drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Broadcast open state + lock page scroll while the drawer is open.
  useEffect(() => {
    emitUiEvent(MOBILE_NAV_EVENT, open);
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Escape closes the drawer and returns focus to the menu button.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-10 w-10 place-items-center rounded-lg text-ink-soft transition hover:bg-brand-50"
        data-testid="mobile-menu-button"
      >
        <span className="relative block h-4 w-5" aria-hidden="true">
          <span className={`absolute left-0 block h-0.5 w-5 rounded bg-current transition-all ${open ? 'top-1.5 rotate-45' : 'top-0'}`} />
          <span className={`absolute left-0 top-1.5 block h-0.5 w-5 rounded bg-current transition-all ${open ? 'opacity-0' : 'opacity-100'}`} />
          <span className={`absolute left-0 block h-0.5 w-5 rounded bg-current transition-all ${open ? 'top-1.5 -rotate-45' : 'top-3'}`} />
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 top-16 z-40 bg-ink/20"
            onClick={close}
          />
          <nav className="fixed inset-x-0 top-16 z-50 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-line bg-white shadow-lg" data-testid="mobile-menu-panel" aria-label="Primary">
            <div className="container-x flex flex-col py-2">
              {items.map((entry) => {
                if ('children' in entry) {
                  const orgActive = isOrgActive(pathname, entry.children);
                  return (
                    <div key={entry.label}>
                      <div className="flex items-center justify-between">
                        <Link
                          href={entry.href ?? '/for-organisations'}
                          onClick={close}
                          aria-current={orgActive ? 'page' : undefined}
                          className={`flex-1 rounded-lg px-3 py-3 text-base font-semibold transition-colors hover:bg-brand-50 ${orgActive ? 'text-brand-700' : 'text-ink-soft'}`}
                        >
                          {entry.label}
                        </Link>
                        <button
                          type="button"
                          aria-expanded={orgOpen}
                          aria-controls="mobile-org-group"
                          aria-label={orgOpen ? 'Collapse organisation cohorts' : 'Expand organisation cohorts'}
                          onClick={() => setOrgOpen((v) => !v)}
                          data-testid="mobile-org-toggle"
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg transition-colors hover:bg-brand-50 ${orgActive ? 'text-brand-700' : 'text-ink-soft'}`}
                        >
                          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden className={`transition-transform ${orgOpen ? 'rotate-180' : ''}`}>
                            <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                      {orgOpen && (
                        <div id="mobile-org-group" className="mb-1 ml-3 border-l border-line pl-2" data-testid="mobile-org-group">
                          {entry.children.map((c) => {
                            const active = isActivePath(pathname, c.href);
                            return (
                              <Link
                                key={c.href}
                                href={c.href}
                                onClick={close}
                                aria-current={active ? 'page' : undefined}
                                className={`block rounded-lg px-3 py-2.5 transition-colors ${active ? 'bg-brand-50' : 'hover:bg-brand-50'}`}
                              >
                                <span className={`block text-base font-semibold ${active ? 'text-brand-700' : 'text-ink-soft'}`}>{c.label}</span>
                                {c.desc ? <span className="mt-0.5 block text-xs text-muted">{c.desc}</span> : null}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                const active = isActivePath(pathname, entry.match ?? entry.href);
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    onClick={close}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-lg px-3 py-3 text-base font-semibold transition-colors ${active ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-brand-50 hover:text-brand-700'}`}
                  >
                    {entry.label}
                  </Link>
                );
              })}

              <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
                {/* The header heart is hidden below 640px; keep Saved venues one tap away here. */}
                <Link
                  href="/venues/saved"
                  onClick={close}
                  data-testid="mobile-saved-link"
                  className="rounded-lg px-3 py-3 text-base font-semibold text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700 sm:hidden"
                >
                  ♡ Saved venues
                </Link>
                {authed ? (
                  <Link
                    href="/app"
                    onClick={close}
                    data-testid="mobile-dashboard"
                    className="rounded-lg bg-brand px-3 py-3 text-center text-base font-bold text-white transition hover:bg-brand-600"
                  >
                    Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={close}
                      data-testid="mobile-login"
                      className="rounded-lg border border-brand/40 px-3 py-3 text-center text-base font-bold text-brand-700 transition hover:bg-brand-50"
                    >
                      Log in
                    </Link>
                    <Link
                      href="/signup"
                      onClick={close}
                      data-testid="mobile-signup"
                      className="rounded-lg bg-brand px-3 py-3 text-center text-base font-bold text-white transition hover:bg-brand-600"
                    >
                      Sign up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
