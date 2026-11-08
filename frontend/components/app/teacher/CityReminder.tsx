import Link from 'next/link';

// Dashboard nudge shown ONLY when a teacher's city is missing or just the
// country ("India") — such profiles never appear in city search. Links straight
// to the City field on the profile editor. Purely presentational.
export default function CityReminder() {
  return (
    <section
      className="flex flex-col items-start gap-4 rounded-2xl border border-brand/25 bg-brand-50/50 p-5 sm:flex-row sm:items-center sm:p-6"
      data-testid="city-reminder"
    >
      <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-2xl shadow-sm">
        📍
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-extrabold tracking-tight text-ink">Add your city so learners nearby can find you</p>
        <p className="mt-0.5 text-sm text-ink-soft">
          Your profile only says “India”, so you don’t show up when someone searches for teachers in their city. It takes a few seconds.
        </p>
      </div>
      <Link
        href="/app/teacher/profile/edit#city"
        className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600"
        data-testid="city-reminder-cta"
      >
        Add my city →
      </Link>
    </section>
  );
}
