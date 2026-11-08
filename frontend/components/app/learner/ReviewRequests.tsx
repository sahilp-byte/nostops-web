'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ReviewableSession } from '@/lib/server/bookings';

// Auto review-request prompt. After a session is completed, we proactively
// invite the learner to rate the teacher (keeping profiles full of fresh,
// trustworthy reviews). Sessions the learner has already acted on/dismissed
// are remembered client-side so we never nag — the backend exposes no
// per-user "has reviewed" flag, so localStorage is the honest source here.
const KEY = 'nostops.reviewed.v1';

function readDone(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw || '[]') : []);
  } catch {
    return new Set();
  }
}

function writeDone(s: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export default function ReviewRequests({ sessions }: { sessions: ReviewableSession[] }) {
  const [done, setDone] = useState<Set<string> | null>(null);

  useEffect(() => {
    setDone(readDone());
  }, []);

  // Wait for the client read so we never flash a prompt the user already dismissed.
  if (!done) return null;

  const pending = sessions.filter((s) => !done.has(s.id));
  if (pending.length === 0) return null;

  const top = pending[0];
  const first = top.teacherName.split(' ')[0] || top.teacherName;

  function dismiss(id: string) {
    const next = new Set(done);
    next.add(id);
    writeDone(next);
    setDone(next);
  }

  return (
    <div
      data-testid="review-request"
      className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-white p-5"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15 text-xl">⭐</span>
        <div className="min-w-0 flex-1">
          {top.profileHandle ? (
            <>
              <p className="font-extrabold tracking-tight text-ink">How was your session with {top.teacherName}?</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                A quick review helps other seekers find great teachers — it only takes a minute.
                {pending.length > 1 ? ` You have ${pending.length} sessions to rate.` : ''}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href={`/app/teachers/${top.profileHandle}?review=1`}
                  onClick={() => dismiss(top.id)}
                  data-testid="review-request-cta"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-600"
                >
                  Rate {first} ›
                </Link>
                <button
                  type="button"
                  onClick={() => dismiss(top.id)}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:text-ink-soft"
                >
                  Maybe later
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="font-extrabold tracking-tight text-ink">Your session with {top.teacherName}</p>
              <p className="mt-0.5 text-sm text-ink-soft" data-testid="review-request-unavailable">
                Rating isn’t available for this session right now — we can’t find {top.teacherName}’s profile.
                Your booking is still saved in My bookings.
              </p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => dismiss(top.id)}
                  data-testid="review-request-ok"
                  className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream"
                >
                  OK
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
