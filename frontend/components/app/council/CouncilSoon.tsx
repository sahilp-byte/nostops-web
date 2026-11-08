import Link from 'next/link';

// Honest placeholder for Council sub-workspaces that ship in the next phase.
// Renders context so the nav link is never a dead end.
export default function CouncilSoon({ icon, title, blurb, points }: { icon: string; title: string; blurb: string; points: string[] }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to Council home</Link>
      <div className="mt-4 rounded-2xl border border-line bg-white p-6 sm:p-8">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-2xl">{icon}</span>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-ink">{title}</h1>
        <p className="mt-2 leading-relaxed text-ink-soft">{blurb}</p>
        <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">🛠️ Rolling out shortly</p>
        <ul className="mt-5 space-y-2.5 p-0">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm text-ink-soft">
              <span aria-hidden="true" className="mt-0.5 text-brand">✓</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
