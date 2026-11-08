import Link from 'next/link';

// Shared secondary navigation for the "For Organisations" gateway and its
// child pages (Impact, Resources). Server component — just links. The `active`
// path highlights the current page.
type Item = { href: string; label: string };

const ITEMS: Item[] = [
  { href: '/for-organisations', label: 'Overview' },
  { href: '/for-organisations#how-it-works', label: 'How it works' },
  { href: '/for-organisations/impact', label: 'Impact' },
  { href: '/for-organisations/resources', label: 'Resources' },
];

export default function OrgSubNav({ active }: { active?: string }) {
  return (
    <nav className="sticky top-16 z-30 border-b border-line bg-white/90 backdrop-blur" aria-label="For Organisations">
      <div className="container-x flex items-center gap-1 overflow-x-auto py-2">
        {ITEMS.map((it) => {
          const isActive = active === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={isActive ? 'page' : undefined}
              className={
                isActive
                  ? 'whitespace-nowrap rounded-lg bg-brand-50 px-3 py-2 text-sm font-bold text-brand-700'
                  : 'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700'
              }
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
