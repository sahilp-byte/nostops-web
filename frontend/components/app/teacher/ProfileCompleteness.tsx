import Link from 'next/link';
import type { ProfileCompleteness as PC } from '@/lib/server/teacher';

// Onboarding nudge: "Your profile is X% complete" with a progress bar and quick
// links to each remaining section. Renders nothing once the profile is complete.
export default function ProfileCompleteness({ data }: { data: PC }) {
  if (data.complete) return null;
  const missing = data.items.filter((i) => !i.done);
  return (
    <section className="rounded-2xl border border-brand/20 bg-brand-50/40 p-5 sm:p-6" data-testid="profile-completeness">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Complete your profile</p>
          <h2 className="mt-0.5 text-lg font-black tracking-tight text-ink">Your profile is {data.percent}% complete</h2>
          <p className="text-sm text-muted">Finish every section so seekers and organisations can find and trust you.</p>
        </div>
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-base font-black text-brand-700 shadow-sm">
          {data.percent}%
        </span>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${data.percent}%` }} />
      </div>
      <ul className="mt-4 flex flex-wrap gap-2 p-0">
        {missing.map((i) => (
          <li key={i.key}>
            <Link
              href={i.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-white px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:border-brand hover:text-brand-700"
            >
              <span aria-hidden className="text-brand">+</span> {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
