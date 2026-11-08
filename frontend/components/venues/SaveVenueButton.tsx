'use client';

import { useSavedVenues } from '@/lib/saved-venues';

// Heart toggle overlaid on a venue card / profile. Lives as a sibling of the
// card's Link (not inside it) and still guards against navigation when tapped.
// `pill` = labelled button for the dark venue-detail hero (next to Share).
export default function SaveVenueButton({
  id,
  name,
  className = '',
  variant = 'icon',
}: {
  id: string;
  name?: string;
  className?: string;
  variant?: 'icon' | 'pill';
}) {
  const { isSaved, toggle } = useSavedVenues();
  const saved = isSaved(id);
  const pill = variant === 'pill';
  const look = pill
    ? `inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${saved ? 'border-brand bg-brand text-white' : 'border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20'}`
    : `grid h-9 w-9 place-items-center rounded-full border backdrop-blur transition ${saved ? 'border-brand bg-brand text-white' : 'border-white/70 bg-white/85 text-ink-soft hover:text-brand-700'}`;
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name ?? 'venue'} from saved` : `Save ${name ?? 'venue'}`}
      title={saved ? 'Saved — tap to remove' : 'Save venue'}
      data-testid={pill ? 'venue-detail-save' : 'save-venue-btn'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
      className={`${look} ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      {pill && <span>{saved ? 'Saved' : 'Save venue'}</span>}
    </button>
  );
}
