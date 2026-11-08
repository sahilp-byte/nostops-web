'use client';

import { useSavedRetreats, type SavedRetreat } from '@/lib/saved-retreats';

// PROMPT 30 — save / remove a retreat to the wishlist. Two shapes: a round icon
// (default, for cards/hero overlays) or a full labelled button (variant="button").
export default function SaveRetreatButton({
  retreat,
  variant = 'icon',
  className = '',
}: {
  retreat: SavedRetreat;
  variant?: 'icon' | 'button';
  className?: string;
}) {
  const { isSaved, toggle } = useSavedRetreats();
  const active = isSaved(retreat.id);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(retreat);
  };

  if (variant === 'button') {
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={active ? 'Remove from saved' : 'Save retreat'}
        onClick={onClick}
        data-testid="save-retreat"
        className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
          active ? 'border-accent bg-accent/10 text-accent-600' : 'border-line bg-white text-ink-soft hover:border-accent hover:text-accent-600'
        } ${className}`}
      >
        <span aria-hidden>{active ? '♥' : '♡'}</span>
        <span>{active ? 'Saved' : 'Save'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? 'Remove from saved' : 'Save retreat'}
      onClick={onClick}
      data-testid="save-retreat"
      className={`grid h-9 w-9 place-items-center rounded-full border text-base shadow-sm transition ${
        active ? 'border-accent bg-accent text-white' : 'border-line bg-white/90 text-ink-soft hover:border-accent hover:text-accent-600'
      } ${className}`}
    >
      <span aria-hidden>{active ? '♥' : '♡'}</span>
    </button>
  );
}
