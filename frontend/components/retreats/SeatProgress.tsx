// Live "X of Y seats reserved" momentum tracker. Pure/presentational — reads the
// retreat's real public seat counts (seats_total / seats_remaining) so it never
// invents numbers. Used on the public retreat page and the group landing so
// organisers and their invitees feel the momentum to fill the retreat.
export default function SeatProgress({
  seatsTotal,
  seatsRemaining,
  className = '',
  tone = 'light',
}: {
  seatsTotal?: number;
  seatsRemaining?: number;
  className?: string;
  tone?: 'light' | 'dark';
}) {
  if (typeof seatsTotal !== 'number' || seatsTotal <= 0) return null;
  if (typeof seatsRemaining !== 'number') return null;
  const remaining = Math.max(0, Math.min(seatsTotal, seatsRemaining));
  const reserved = seatsTotal - remaining;
  const pct = Math.max(0, Math.min(100, Math.round((reserved / seatsTotal) * 100)));
  const full = remaining <= 0;

  const msg = full
    ? 'Fully booked'
    : remaining <= 3
      ? `Only ${remaining} seat${remaining === 1 ? '' : 's'} left — filling fast`
      : pct >= 60
        ? 'Filling fast — reserve your group soon'
        : reserved > 0
          ? 'Momentum is building — bring your group'
          : 'Be the first to reserve';

  const dark = tone === 'dark';
  return (
    <div className={className} data-testid="seat-progress">
      <div className={`flex items-baseline justify-between gap-3 text-sm ${dark ? 'text-white/90' : 'text-ink'}`}>
        <span className="font-black">
          {reserved} <span className={dark ? 'font-semibold text-white/70' : 'font-semibold text-muted'}>of {seatsTotal} seats reserved</span>
        </span>
        <span className={`shrink-0 text-xs font-bold ${full ? (dark ? 'text-white/70' : 'text-ink-soft') : dark ? 'text-accent' : 'text-accent-600'}`}>{pct}%</span>
      </div>
      <div className={`mt-1.5 h-2.5 w-full overflow-hidden rounded-full ${dark ? 'bg-white/20' : 'bg-cream'}`} role="progressbar" aria-valuenow={reserved} aria-valuemin={0} aria-valuemax={seatsTotal} aria-label={`${reserved} of ${seatsTotal} seats reserved`}>
        <div className={`h-full rounded-full transition-all ${full ? 'bg-ink/40' : remaining <= 3 ? 'bg-accent' : 'bg-brand'}`} style={{ width: `${Math.max(pct, reserved > 0 ? 6 : 0)}%` }} />
      </div>
      <p className={`mt-1.5 text-xs font-semibold ${dark ? 'text-white/70' : full ? 'text-ink-soft' : remaining <= 3 ? 'text-accent-600' : 'text-brand-700'}`} data-testid="seat-progress-msg">{msg}</p>
    </div>
  );
}
