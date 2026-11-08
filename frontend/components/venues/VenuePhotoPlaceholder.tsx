// Branded stand-in for a venue listing that has no photo yet (fills its
// positioned parent). Used on directory cards and the compare view.
export default function VenuePhotoPlaceholder({ name }: { name: string }) {
  const initial = (name.trim()[0] || 'N').toUpperCase();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-brand-700 via-brand to-accent-600 text-white" data-testid="venue-photo-placeholder">
      <svg aria-hidden viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full opacity-20">
        <path d="M0 230 L90 150 L150 200 L230 120 L320 190 L400 140 L400 300 L0 300 Z" fill="currentColor" />
        <circle cx="300" cy="80" r="26" fill="currentColor" />
      </svg>
      <span aria-hidden className="relative grid h-14 w-14 place-items-center rounded-full border-2 border-white/60 bg-white/15 text-2xl font-black backdrop-blur-sm">{initial}</span>
      <span className="relative rounded-full bg-black/20 px-2.5 py-0.5 text-[11px] font-bold tracking-wide">Photos coming soon</span>
    </div>
  );
}
