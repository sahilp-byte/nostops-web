'use client';

import { useState } from 'react';
import { postBff } from '@/lib/auth-client';

// Embedded NOSTOPS City Coordinator application (the production Jotform,
// 262701751986061). Eligibility (empanelled Yoga Level 2 / Level 3) is enforced
// SERVER-SIDE by the parent page before this ever renders. A prominent
// open-in-new-tab action is always offered as a fallback in case the embed is
// blocked, so an eligible teacher can always reach the form.
//
// Because the Jotform is external, we can't observe the submission event. So
// once the teacher finishes the form they tap "I've submitted my application",
// which records a warm on-platform confirmation (persisted per teacher).
const JOTFORM_URL = 'https://form.jotform.com/262701751986061';

function fmtDate(ms?: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export default function CoordinatorApplyForm({ initialApplied = false, appliedAt }: { initialApplied?: boolean; appliedAt?: number }) {
  const [applied, setApplied] = useState(initialApplied);
  const [when, setWhen] = useState<number | undefined>(appliedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmApplied() {
    setBusy(true);
    setError(null);
    const res = await postBff<{ ok?: boolean; applied_at?: number; error?: string }>('/bff/coordinator/applied', {});
    setBusy(false);
    if (!res.ok || !res.data?.ok) { setError(res.data?.error || 'Could not save right now. Please try again.'); return; }
    setWhen(res.data.applied_at);
    setApplied(true);
  }

  return (
    <div data-testid="coordinator-apply-form">
      {applied && (
        <div className="mb-5 rounded-2xl border border-brand/25 bg-brand-50/70 p-5 sm:p-6" data-testid="cc-applied-note" role="status">
          <div className="flex items-start gap-3">
            <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-lg text-white">🙏</span>
            <div>
              <p className="text-base font-black tracking-tight text-ink">Thank you — your application is with us</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                We&apos;ve noted your City Coordinator application{when ? <> on <span className="font-bold text-ink">{fmtDate(when)}</span></> : ''}.
                Our team will review it with care and reach out to you. In the meantime, keep serving your students — that&apos;s the heart of this role.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft">
          Complete the short application below. If the form does not load, open it in a new tab.
        </p>
        <a
          href={JOTFORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600"
          data-testid="coordinator-apply-open"
        >
          Open the application <span aria-hidden>↗</span>
        </a>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
        <iframe
          title="NOSTOPS City Coordinator Application"
          src={JOTFORM_URL}
          className="h-[1200px] w-full"
          loading="lazy"
          allow="geolocation; microphone; camera; fullscreen; payment"
          referrerPolicy="strict-origin-when-cross-origin"
          data-testid="coordinator-apply-iframe"
        />
      </div>

      {!applied && (
        <div className="mt-5 rounded-2xl border border-line bg-cream/60 p-5 sm:flex sm:items-center sm:justify-between sm:gap-4" data-testid="cc-applied-prompt">
          <p className="text-sm text-ink-soft">
            Finished the form above? Let us know so we can confirm we&apos;ve received your application.
          </p>
          <button
            type="button"
            onClick={confirmApplied}
            disabled={busy}
            data-testid="coordinator-applied-confirm"
            className="mt-3 inline-flex shrink-0 items-center gap-2 rounded-xl border border-brand/30 bg-white px-5 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50 sm:mt-0"
          >
            {busy ? 'Saving…' : "I've submitted my application ✓"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-red-600" data-testid="cc-applied-error">{error}</p>}
    </div>
  );
}
