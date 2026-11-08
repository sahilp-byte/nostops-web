import Link from 'next/link';

export type StrengthItem = { label: string; done: boolean; href?: string; hint?: string };

// A simple, encouraging profile-completeness meter. Purely presentational —
// the page computes the checklist from the teacher's real profile + video.
export default function ProfileStrength({ items }: { items: StrengthItem[] }) {
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = done === total;
  const tone = pct >= 100 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444';

  // Celebratory moment the instant a teacher reaches 100% — a warm, shining
  // banner that acknowledges the effort (replaces the plain meter at full).
  if (complete) {
    return (
      <section
        className="relative overflow-hidden rounded-2xl border border-[#10B981]/30 bg-gradient-to-br from-[#10B981]/10 via-white to-brand-50/60 p-5 text-center sm:p-6"
        data-testid="profile-strength"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[#10B981]/10 blur-2xl"
        />
        <div className="relative">
          <span aria-hidden className="text-4xl">🎉</span>
          <h2 className="mt-2 text-lg font-black tracking-tight text-ink">Your profile is 100% complete!</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
            Beautifully done. 🙏 A complete profile earns the most learner trust — seekers and organisations can now see the full picture of your practice.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#10B981] px-4 py-1.5 text-sm font-black text-white">
            <span aria-hidden>✓</span>
            <span data-testid="strength-pct">{pct}% · All done</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6" data-testid="profile-strength">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-ink">Profile strength</h2>
          <p className="mt-0.5 text-sm text-muted">
            {`${done} of ${total} done · a complete profile earns more learner trust.`}
          </p>
        </div>
        <span className="text-2xl font-black tabular-nums" style={{ color: tone }} data-testid="strength-pct">{pct}%</span>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-cream">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: tone }} />
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-3">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black ${it.done ? 'bg-brand-50 text-brand-700' : 'bg-cream text-muted'}`}
            >
              {it.done ? '✓' : '○'}
            </span>
            <span className={`flex-1 text-sm font-semibold ${it.done ? 'text-ink-soft line-through decoration-line' : 'text-ink'}`}>{it.label}</span>
            {!it.done && it.href && (
              <Link href={it.href} className="shrink-0 text-sm font-bold text-brand-700 hover:underline">{it.hint || 'Add'} →</Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
