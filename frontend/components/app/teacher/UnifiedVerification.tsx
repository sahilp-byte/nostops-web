import Link from 'next/link';
import type { UnifiedJourney, JourneyStep } from '@/lib/server/verification';

const STEP_STYLES: Record<JourneyStep['status'], { dot: string; label: string; text: string }> = {
  DONE: { dot: 'bg-emerald-500 text-white', label: '✓', text: 'text-ink' },
  IN_PROGRESS: { dot: 'bg-brand text-white', label: '•', text: 'text-ink' },
  ACTION_REQUIRED: { dot: 'bg-amber-500 text-white', label: '!', text: 'text-ink' },
  BLOCKED: { dot: 'bg-rose-500 text-white', label: '×', text: 'text-ink' },
  PENDING: { dot: 'bg-line text-muted', label: '', text: 'text-ink-soft' },
  LOCKED: { dot: 'bg-cream text-muted border border-line', label: '🔒', text: 'text-muted' },
};

const STATUS_LABEL: Record<JourneyStep['status'], string> = {
  DONE: 'Done', IN_PROGRESS: 'In progress', ACTION_REQUIRED: 'Action needed',
  BLOCKED: 'Blocked', PENDING: 'Pending', LOCKED: 'Locked',
};

/** The unified 6-step progress + badges. Presentational — fed by getUnifiedJourney. */
export default function UnifiedVerification({ journey, showHeading = true }: { journey: UnifiedJourney; showHeading?: boolean }) {
  const { steps, badges, complete, price } = journey;

  if (complete) {
    return (
      <section className="rounded-2xl border border-brand-100 bg-brand-50/60 p-5 sm:p-6">
        <h2 className="text-lg font-black tracking-tight text-ink">You’re fully verified 🎉</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {badges.nostops_verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">✓ NOSTOPS VERIFIED</span>
          )}
          {badges.nostops_empanelled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-700 px-3 py-1 text-xs font-bold text-white">✓ NOSTOPS EMPANELLED</span>
          )}
        </div>
        <p className="mt-3 text-sm text-ink-soft">Your empanelled-teacher features are unlocked.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      {showHeading && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black tracking-tight text-ink">GET VERIFIED + EMPANELLED</h2>
          {/* Prompt 2B — only a ₹ price is shown: there is no approved international price yet. */}
          {price?.currency === 'INR' && typeof price.amount === 'number' && (
            <span className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-ink-soft">
              ₹{Math.round(price.amount).toLocaleString('en-IN')}
              {price.tax_note ? ` ${price.tax_note}` : ''}
            </span>
          )}
        </div>
      )}
      <p className="mt-1 text-sm text-ink-soft">One application, one payment, one verification journey.</p>

      <ol className="mt-4 space-y-3">
        {steps.map((s) => {
          const st = STEP_STYLES[s.status];
          return (
            <li key={s.key} className="flex items-start gap-3">
              <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${st.dot}`}>
                {st.label || s.step}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-sm font-bold ${st.text}`}>{s.title}</p>
                  <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-muted">{STATUS_LABEL[s.status]}</span>
                </div>
                {s.detail && <p className="mt-0.5 text-xs text-muted">{s.detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Compact dashboard CTA card — shown only when journey.cta.show is true. */
export function UnifiedCtaCard({ journey }: { journey: UnifiedJourney }) {
  const { cta, steps, price } = journey;
  const done = steps.filter((s) => s.status === 'DONE').length;
  return (
    <section className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black tracking-tight text-ink">GET VERIFIED + EMPANELLED</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            One journey to NOSTOPS Verified + Empanelled
            {typeof price?.amount === 'number' ? ` · ${price.currency === 'INR' ? '₹' : 'US$'}${Math.round(price.amount).toLocaleString('en-IN')}${price.tax_note ? ` ${price.tax_note}` : ''}` : ''}
          </p>
          {steps.length > 0 && (
            <p className="mt-1 text-xs font-semibold text-brand-700">{done} of {steps.length} steps complete</p>
          )}
          {cta.test_only && (
            <p className="mt-1 text-[11px] font-semibold text-amber-700">Preview (TEST_ONLY) — not yet live for teachers</p>
          )}
        </div>
        <Link href={cta.route} className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
          {cta.label}
        </Link>
      </div>
    </section>
  );
}
