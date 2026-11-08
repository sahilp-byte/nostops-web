'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import HeaderOrgMenu from '@/components/HeaderOrgMenu';
import { SPACES_HEADER_NAV } from '@/lib/site-nav';

// `match` lets a link point somewhere specific (href) while the active-highlight
// still covers a broader URL family, e.g. Retreats links to /retreats/host but
// highlights across the whole /retreats/* section.
export type NavLink = { href: string; label: string; desc?: string; match?: string };
export type NavGroup = { label: string; href?: string; children: NavLink[] };
export type NavEntry = NavLink | NavGroup;

// Signed-in NOSTOPS Spaces screens (owner/teacher/participant/partner and the admin Spaces tools).
export const SPACES_APP_ROUTE = /^\/app\/(spaces|admin\/(spaces|spaces-localities|community-partners|space-registrations))(\/|$)/;

// A top-level item is active for its own page and any sub-path beneath it,
// so e.g. /retreats also highlights on /retreats/host and /retreats/in/...
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isOrgActive(pathname: string, children: NavLink[]): boolean {
  return children.some((c) => isActivePath(pathname, c.href)) || pathname.startsWith('/for-organisations');
}

// Desktop primary navigation — renders the approved top-level items in order.
// "For Organisations" renders as an accessible hover/click/keyboard dropdown
// (HeaderOrgMenu) listing its cohorts with a one-line description each.
export default function HeaderNav({ items: baseItems }: { items: NavEntry[] }) {
  const pathname = usePathname() || '/';
  // Inside NOSTOPS Spaces the header also shows (and highlights) "Spaces"; elsewhere it is unchanged.
  const items = isActivePath(pathname, '/spaces') || SPACES_APP_ROUTE.test(pathname) ? SPACES_HEADER_NAV : baseItems;
  const base =
    'whitespace-nowrap rounded-lg px-1.5 py-2 text-[13px] font-semibold xl:px-2 xl:text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1';
  return (
    <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
      {items.map((entry) => {
        if ('children' in entry) {
          return (
            <HeaderOrgMenu
              key={entry.label}
              label={entry.label}
              href={entry.href}
              links={entry.children}
              active={isOrgActive(pathname, entry.children)}
            />
          );
        }
        const active = isActivePath(pathname, entry.match ?? entry.href) || (entry.href === '/spaces' && SPACES_APP_ROUTE.test(pathname));
        return (
          <Link
            key={entry.href}
            href={entry.href}
            aria-current={active ? 'page' : undefined}
            className={`${base} ${active ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-brand-50 hover:text-brand-700'}`}
          >
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}
