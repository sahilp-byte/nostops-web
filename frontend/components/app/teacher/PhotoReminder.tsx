import Link from 'next/link';

// Gentle, warm dashboard nudge shown ONLY when a teacher has not yet added a
// profile photo. A profile photo is the single biggest trust signal for seekers
// and organisations, so we surface a focused, friendly reminder (separate from
// the fuller completeness checklist). Purely presentational.
export default function PhotoReminder({ name }: { name?: string }) {
  return (
    <section
      className="flex flex-col items-start gap-4 rounded-2xl border border-accent/30 bg-accent/5 p-5 sm:flex-row sm:items-center sm:p-6"
      data-testid="photo-reminder"
    >
      <span
        aria-hidden
        className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-dashed border-accent/40 bg-white text-2xl"
      >
        📷
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-extrabold tracking-tight text-ink">
          Add a profile photo{name ? `, ${name}` : ''}
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">
          Profiles with a warm, friendly photo earn far more trust — and more bookings — from seekers and organisations. Listed teachers with a photo are shown first on the NOSTOPS homepage. It only takes a minute.
        </p>
      </div>
      <Link
        href="/app/teacher/profile/media"
        className="shrink-0 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
        data-testid="photo-reminder-cta"
      >
        Add your photo →
      </Link>
    </section>
  );
}
