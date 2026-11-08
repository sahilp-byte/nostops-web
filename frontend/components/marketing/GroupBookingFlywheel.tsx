// PROMPT 38 — the NOSTOPS Group Booking Flywheel, as a reusable visual.
// Presentational only; rendered on the public /how-it-works page and inside the
// teacher Group Dashboard. Each stage is tagged by the actor it benefits, so the
// self-reinforcing loop (Teacher ⇄ Venue ⇄ NOSTOPS ⇄ Participant) reads at a glance.
type Actor = 'teacher' | 'venue' | 'nostops' | 'participant' | 'reputation';

const ACTOR: Record<Actor, { label: string; dot: string; chip: string }> = {
  teacher: { label: 'Teacher', dot: 'bg-brand', chip: 'bg-brand-50 text-brand-700' },
  venue: { label: 'Venue', dot: 'bg-royal', chip: 'bg-royal-50 text-royal' },
  nostops: { label: 'NOSTOPS', dot: 'bg-accent', chip: 'bg-accent/10 text-accent-600' },
  participant: { label: 'Participant', dot: 'bg-ink', chip: 'bg-cream text-ink-soft' },
  reputation: { label: 'Reputation', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
};

const STAGES: { text: string; actor: Actor; icon: string }[] = [
  { text: 'Teacher selects a venue', actor: 'teacher', icon: '📍' },
  { text: 'Teacher negotiates venue economics', actor: 'teacher', icon: '🤝' },
  { text: 'Teacher creates a retreat', actor: 'teacher', icon: '🏔️' },
  { text: 'Teacher sets the participant price', actor: 'teacher', icon: '🎟️' },
  { text: 'Teacher creates a cohort', actor: 'teacher', icon: '🧘' },
  { text: 'Teacher invites students / their group', actor: 'teacher', icon: '📨' },
  { text: 'Participants book', actor: 'participant', icon: '✅' },
  { text: 'Venue receives occupancy + service revenue', actor: 'venue', icon: '🏡' },
  { text: 'Teacher earns teaching + retreat income', actor: 'teacher', icon: '💰' },
  { text: 'NOSTOPS earns its platform fee', actor: 'nostops', icon: '⚙️' },
  { text: 'Participants experience the retreat', actor: 'participant', icon: '🧘' },
  { text: 'Reviews are generated', actor: 'reputation', icon: '⭐' },
  { text: 'Teacher reputation increases', actor: 'reputation', icon: '📈' },
  { text: 'Venue reputation increases', actor: 'reputation', icon: '📈' },
  { text: 'Teacher returns', actor: 'teacher', icon: '↩️' },
  { text: 'Venue hosts more retreats', actor: 'venue', icon: '🔁' },
  { text: 'More teachers discover the venue · more participants discover NOSTOPS', actor: 'nostops', icon: '🌱' },
];

export default function GroupBookingFlywheel({
  variant = 'full',
  heading = 'The NOSTOPS group booking flywheel',
}: {
  variant?: 'full' | 'compact';
  heading?: string;
}) {
  const compact = variant === 'compact';
  return (
    <section className="rounded-3xl border border-line bg-white p-6 sm:p-8" data-testid="group-flywheel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={`font-black tracking-tight text-ink ${compact ? 'text-lg' : 'text-2xl'}`}>{heading}</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ACTOR) as Actor[]).map((a) => (
            <span key={a} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ACTOR[a].chip}`}>
              <span className={`h-2 w-2 rounded-full ${ACTOR[a].dot}`} aria-hidden /> {ACTOR[a].label}
            </span>
          ))}
        </div>
      </div>
      {!compact && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Every retreat feeds the next. Teachers bring their own students, venues fill rooms, everyone builds reputation —
          and the whole loop spins faster with each retreat.
        </p>
      )}

      <ol className="relative mt-6 list-none space-y-0 p-0">
        {/* vertical connector */}
        <span className="absolute left-[15px] top-2 bottom-8 w-0.5 bg-gradient-to-b from-brand/40 via-royal/30 to-emerald-400/40" aria-hidden />
        {STAGES.map((s, i) => (
          <li key={i} className="relative flex items-start gap-4 pb-4" data-testid="flywheel-stage">
            <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ${ACTOR[s.actor].dot} text-xs font-black text-white`}>{i + 1}</span>
            <div className="min-w-0 flex-1 rounded-xl border border-line bg-cream/40 px-4 py-2.5">
              <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <span aria-hidden>{s.icon}</span>
                <span>{s.text}</span>
              </p>
            </div>
          </li>
        ))}
        {/* loop back */}
        <li className="relative flex items-center gap-4">
          <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-royal text-white" aria-hidden>↻</span>
          <div className="rounded-xl bg-gradient-to-r from-brand-50 to-royal-50 px-4 py-2.5">
            <p className="text-sm font-black text-ink">…and the flywheel repeats — stronger each turn.</p>
          </div>
        </li>
      </ol>
    </section>
  );
}
