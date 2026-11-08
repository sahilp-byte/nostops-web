'use client';

import { useFavorites, type FavTeacher } from '@/lib/favorites';

export default function FavoriteButton({
  teacher,
  className = '',
  showLabel = false,
}: {
  teacher: FavTeacher;
  className?: string;
  showLabel?: boolean;
}) {
  const { isFav, toggle } = useFavorites();
  const active = isFav(teacher.handle);

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? 'Remove from saved' : 'Save teacher'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(teacher);
      }}
      className={
        showLabel
          ? `inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
              active
                ? 'border-brand bg-brand-50 text-brand-700'
                : 'border-line bg-white text-ink-soft hover:border-brand hover:text-brand-700'
            } ${className}`
          : `grid h-9 w-9 place-items-center rounded-full border text-base shadow-sm transition ${
              active
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-white/90 text-ink-soft hover:border-brand hover:text-brand-700'
            } ${className}`
      }
    >
      <span aria-hidden="true">{active ? '♥' : '♡'}</span>
      {showLabel && <span>{active ? 'Saved' : 'Save'}</span>}
    </button>
  );
}
