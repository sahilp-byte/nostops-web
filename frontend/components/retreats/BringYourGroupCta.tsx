import Link from 'next/link';

// PROMPT 34 — public "Bring Your Group" entry point. Links to the per-retreat
// group landing (/retreats/{id}/group) where organisers create a group and
// invitees join. Pure presentational link (no client JS).
export default function BringYourGroupCta({
  retreatId,
  variant = 'sidebar',
  className = '',
}: {
  retreatId: string;
  variant?: 'hero' | 'sidebar';
  className?: string;
}) {
  const href = `/retreats/${retreatId}/group`;
  if (variant === 'hero') {
    return (
      <Link
        href={href}
        data-testid="bring-your-group-cta"
        className={`inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20 ${className}`}
      >
        <span aria-hidden>👥</span> Bring your group
      </Link>
    );
  }
  return (
    <Link
      href={href}
      data-testid="bring-your-group-cta"
      className={`flex items-center justify-center gap-2 rounded-xl border border-brand/25 bg-brand-50/60 px-4 py-2.5 text-center text-sm font-bold text-brand-700 transition hover:border-brand hover:bg-brand-50 ${className}`}
    >
      <span aria-hidden>👥</span> Bring your group — save together
    </Link>
  );
}
