'use client';

import { useEffect, useState } from 'react';

// Live countdown to the campaign's last claim moment (31 Dec 2026, 23:59:59 IST, from the backend
// `endsAt`). Display only — the backend enforces expiry. Renders a neutral placeholder until mounted
// so server and browser HTML match.
const UNITS = [
  { key: 'd', label: 'Days', ms: 86400000 },
  { key: 'h', label: 'Hours', ms: 3600000 },
  { key: 'm', label: 'Minutes', ms: 60000 },
  { key: 's', label: 'Seconds', ms: 1000 },
];

export default function FestiveCountdown({ endsAt }: { endsAt: string }) {
  const end = Date.parse(endsAt) + 999;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = now == null ? null : Math.max(0, end - now);
  if (left === 0) return null;
  let rest = left ?? 0;
  const parts = UNITS.map((u) => {
    const v = Math.floor(rest / u.ms);
    rest -= v * u.ms;
    return { ...u, v };
  });

  return (
    <div className="mt-7 w-fit rounded-2xl border border-[#F3D9C4] bg-white/90 px-4 py-3 shadow-[0_12px_28px_-22px_rgba(240,122,26,0.9)]" data-testid="festive-countdown" role="timer" aria-live="off">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#C7365A]">Offer ends 31 December 2026, 11:59:59 PM IST</p>
      <ol className="mt-2 flex gap-2 sm:gap-3">
        {parts.map((p) => (
          <li key={p.key} className="flex min-w-[64px] flex-col items-center rounded-xl bg-[#0E3D3B] px-2 py-2 text-white sm:min-w-[72px]">
            <span className="font-mono text-2xl font-black tabular-nums sm:text-3xl" data-testid={`festive-countdown-${p.key}`}>
              {left == null ? '--' : String(p.v).padStart(2, '0')}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-white/75">{p.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
