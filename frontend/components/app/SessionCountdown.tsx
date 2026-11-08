'use client';

import { useEffect, useState } from 'react';

// Live countdown to a scheduled session + a one-tap "Join" action that opens
// the real connect channel (WhatsApp/call) within a join window around the
// slot. NOSTOPS 1:1 sessions connect over WhatsApp/phone (the backend exposes
// no video-conference link), so "Join" opens that channel. Client-only; renders
// a stable placeholder until mounted to avoid hydration mismatch.
export default function SessionCountdown({
  slotTs,
  joinHref,
  joinLabel = 'Join session →',
  windowBeforeMin = 15,
  windowAfterMin = 90,
}: {
  slotTs: number;
  joinHref?: string | null;
  joinLabel?: string;
  windowBeforeMin?: number;
  windowAfterMin?: number;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  if (now == null) {
    // Pre-hydration placeholder (keeps layout stable).
    return <div className="mt-2 h-6" aria-hidden />;
  }

  const diff = slotTs - now;
  const openFrom = slotTs - windowBeforeMin * 60000;
  const openUntil = slotTs + windowAfterMin * 60000;
  const inWindow = now >= openFrom && now <= openUntil;
  const passed = now > openUntil;

  function label(): string {
    if (inWindow) return diff > 0 ? 'Starting soon' : 'In progress now';
    if (passed) return 'Session time has passed';
    const mins = Math.round(diff / 60000);
    if (mins < 60) return `Starts in ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Starts in ${hours}h ${mins % 60}m`;
    const daysN = Math.floor(hours / 24);
    return `Starts in ${daysN}d ${hours % 24}h`;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="session-countdown">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${inWindow ? 'bg-emerald-50 text-emerald-700' : passed ? 'bg-cream text-muted' : 'bg-brand-50 text-brand-700'}`}>
        {inWindow && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
        <span aria-hidden>⏱</span> {label()}
      </span>
      {inWindow && joinHref && (
        <a
          href={joinHref}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="session-join"
          className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-emerald-700"
        >
          {joinLabel}
        </a>
      )}
    </div>
  );
}
