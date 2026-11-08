import Link from 'next/link';
import type { TeacherStatus } from '@/lib/teacher-status';
import { computeNextStep, type NextStepTone } from '@/lib/teacher-next-step';

// "Your Next Step" (Prompt 12) — ONE dynamic, entitlement-driven directive derived
// from the teacher's authoritative status. The decision logic lives in the pure
// lib/teacher-next-step engine (shared with the test matrix); this component only
// renders it. Accessible: labelled region, decorative icon hidden from AT, a
// screen-reader status word so state is never conveyed by colour alone.
const TONE: Record<NextStepTone, { ring: string; icon: string; title: string; sr: string }> = {
  action: { ring: 'border-brand/40 bg-brand-50/50', icon: '🎯', title: 'text-brand-700', sr: 'Action needed' },
  info: { ring: 'border-amber-300 bg-amber-50/60', icon: '⏳', title: 'text-amber-800', sr: 'In progress' },
  done: { ring: 'border-emerald-300 bg-emerald-50/60', icon: '✓', title: 'text-emerald-800', sr: 'Complete' },
};

export default function TeacherNextStep({ status, kycComplete }: { status: TeacherStatus; kycComplete: boolean }) {
  const step = computeNextStep(status, kycComplete);
  const tone = TONE[step.tone];
  return (
    <section
      className={`rounded-2xl border p-5 ${tone.ring}`}
      data-testid="teacher-next-step"
      role="region"
      aria-label={`Your next step: ${step.title}`}
    >
      <p className="text-[11px] font-black uppercase tracking-wider text-muted">Your next step</p>
      <div className="mt-2 flex flex-wrap items-start gap-3">
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-lg shadow-sm">{tone.icon}</span>
        <div className="min-w-0 flex-1">
          <p className={`text-base font-extrabold tracking-tight ${tone.title}`}>
            <span className="sr-only">{tone.sr}: </span>{step.title}
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">{step.message}</p>
        </div>
        {step.cta && (
          <Link
            href={step.cta.href}
            className="w-full shrink-0 rounded-xl bg-brand px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 sm:w-auto sm:self-center"
            aria-label={`${step.title}: ${step.cta.label}`}
          >
            {step.cta.label} →
          </Link>
        )}
      </div>
    </section>
  );
}
