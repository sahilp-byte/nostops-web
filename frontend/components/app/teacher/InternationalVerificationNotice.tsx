import Link from 'next/link';

// B4.8 — identity verification for teachers outside India is not yet available.
// One plain message, no price, no payment, no provider button.
export default function InternationalVerificationNotice({ country }: { country?: string | null }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6" data-testid="intl-verification-unavailable">
      <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-xl bg-cream text-xl">🌍</span>
      <h2 className="mt-3 text-base font-black tracking-tight text-ink">Not yet available in your country</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Identity verification for teachers outside India{country ? ` (you are in ${country})` : ''} is not yet available on
        NOSTOPS. We will open it as soon as it is ready. There is nothing to pay and nothing you need to do right now.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/support"
          className="inline-flex min-h-[44px] items-center rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600"
          data-testid="intl-verification-support"
        >
          Ask a question
        </Link>
        <Link
          href="/app"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-line bg-white px-5 text-sm font-bold text-ink-soft transition hover:bg-cream"
        >
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
