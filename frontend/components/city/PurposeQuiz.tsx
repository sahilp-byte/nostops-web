'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DIMENSION_BY_ID, type DimensionId } from '@/lib/yoga-dimensions';

export type QuizPurpose = { id: DimensionId; slug: string; label: string; emoji: string; tagline: string; count: number };

// A short, guided "what are you seeking?" flow. It only ever offers purposes
// that ACTUALLY have teachers in this city, and lands the seeker on the real
// canonical purpose page (/yoga-teachers/{city}/{purpose}) — no dead ends.
export default function PurposeQuiz({ citySlug, cityLabel, purposes }: { citySlug: string; cityLabel: string; purposes: QuizPurpose[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<QuizPurpose | null>(null);

  if (purposes.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-brand-50/60 to-royal/5 p-6 md:p-8" data-testid="purpose-quiz">
      {!picked ? (
        <>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700">Not sure who to choose?</span>
          <h3 className="mt-2 text-xl font-black tracking-tight text-ink md:text-2xl">What are you seeking?</h3>
          <p className="mt-1 text-sm text-ink-soft">Pick what matters most and we&apos;ll match you to the right teachers in {cityLabel}.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {purposes.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPicked(p)}
                className="group rounded-2xl border border-line bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md"
                data-testid={`quiz-purpose-${p.slug}`}
              >
                <span aria-hidden className="text-3xl">{p.emoji}</span>
                <span className="mt-2 block font-black text-ink group-hover:text-brand-700">{p.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{p.tagline}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700">{picked.emoji} {picked.label}</span>
          <h3 className="mt-2 text-xl font-black tracking-tight text-ink md:text-2xl">Here&apos;s what this focuses on</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {DIMENSION_BY_ID[picked.id].examples.map((ex) => (
              <span key={ex} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft">{ex}</span>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/yoga-teachers/${citySlug}/${picked.slug}`)}
              className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600"
              data-testid="quiz-see-teachers"
            >
              See {picked.count} {picked.count === 1 ? 'teacher' : 'teachers'} in {cityLabel} →
            </button>
            <button type="button" onClick={() => setPicked(null)} className="text-sm font-bold text-brand-700 hover:underline" data-testid="quiz-restart">
              Start over
            </button>
          </div>
        </>
      )}
    </div>
  );
}
