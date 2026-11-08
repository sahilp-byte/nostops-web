import type { CityCoordinator } from '@/lib/server/city-coordinator';

// "City coordinators near you" — shown on the claim hub hero so a hesitant
// teacher always has a human to reach. Renders the coordinator(s) available for
// the chosen city (from existing coordinator data); the contact action ALWAYS
// routes through NOSTOPS (personal phone/email are never exposed). When no
// coordinator is listed for the city yet, it falls back to "Talk to the NOSTOPS
// team".
export default function CoordinatorsNearYou({
  coordinators,
  cityLabel,
  heading = 'City coordinators near you',
}: {
  coordinators: CityCoordinator[];
  cityLabel?: string | null;
  /** Heading shown when a coordinator is listed (defaults to "near you"). */
  heading?: string;
}) {
  const has = coordinators.length > 0;
  return (
    <aside className="rounded-2xl border border-line bg-white p-4 sm:p-5" data-testid="coordinators-near-you">
      <p className="text-[11px] font-black uppercase tracking-wider text-brand-700">
        {has ? heading : 'Need a hand?'}
      </p>
      {has ? (
        <ul className="mt-3 space-y-3">
          {coordinators.map((c) => {
            const src = c.avatarUrl || (c.avatarB64 ? `data:image/jpeg;base64,${c.avatarB64}` : null);
            const intro = introLine(c.story);
            return (
              <li key={c.name} className="flex items-start gap-3">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={c.name} className="h-12 w-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-50 text-base font-black text-brand-700">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-ink">{c.name}</p>
                  <p className="truncate text-[12px] text-muted">
                    {cityLabel ? `${cityLabel} coordinator` : 'City coordinator'}
                  </p>
                  {intro && (
                    <p className="mt-1 line-clamp-2 text-[12px] italic leading-snug text-ink-soft" data-testid="coordinator-intro">
                      “{intro}”
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <p className="mt-1 text-sm font-black text-ink">Can’t find yourself?</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
            {cityLabel ? `No coordinator is listed for ${cityLabel} yet. ` : ''}
            Don’t worry. Our team can help you find your listing or help create your profile.
          </p>
        </>
      )}
      <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
        Tap <span className="font-bold text-brand-700">✨ Ask AI Guru</span> anytime for help finding or claiming your profile — it
        can raise a support request to our team if you need a person.
      </p>
    </aside>
  );
}

// A friendly one-line intro drawn from the coordinator's own story — the first
// sentence, clamped — so a teacher recognises a real local human (not a form).
function introLine(story?: string): string | null {
  const s = (story || '').trim();
  if (!s) return null;
  const first = (s.split(/(?<=[.!?])\s/)[0] || s).trim();
  if (!first) return null;
  return first.length > 140 ? `${first.slice(0, 137).trimEnd()}…` : first;
}
