const STEPS = ['Invitation checked', 'Verify it’s you', 'Open your profile'];

export default function ClaimProgress({ done }: { done: number }) {
  return (
    <ol className="mt-8 grid grid-cols-3 gap-2" aria-label="Claim progress" data-testid="claim-progress">
      {STEPS.map((s, i) => {
        const state = i < done ? 'done' : i === done ? 'current' : 'todo';
        return (
          <li key={s} className="flex flex-col items-center text-center" data-state={state}>
            <span
              className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${
                state === 'done' ? 'bg-brand-700 text-white' : state === 'current' ? 'border-2 border-accent bg-white text-brand-700' : 'border border-line bg-white text-muted'
              }`}
              aria-hidden
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span className={`mt-2 text-xs sm:text-sm ${state === 'todo' ? 'text-muted' : 'font-semibold text-brand-700'}`}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}
