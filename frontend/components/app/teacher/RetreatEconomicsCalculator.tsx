'use client';

import { useMemo, useState } from 'react';

// PROMPT 5 — Private Retreat Economics Calculator.
// Entirely client-side and private to the teacher: none of these inputs are ever
// sent to the backend or shown to seekers. It projects revenue, costs, the NOSTOPS
// platform fee, your take-home earnings and the break-even headcount for the retreat.

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

type Line = { key: string; label: string; hint?: string };

const FIXED_LINES: Line[] = [
  { key: 'venueBooking', label: 'Venue booking / rental', hint: 'One-time hall, grounds or property fee.' },
  { key: 'teacherTravel', label: 'Your travel & logistics', hint: 'Your own travel, stay before/after.' },
  { key: 'marketing', label: 'Marketing & materials', hint: 'Promotion, printing, welcome kits.' },
  { key: 'otherFixed', label: 'Other fixed costs' },
];
const PER_SEAT_LINES: Line[] = [
  { key: 'accommodation', label: 'Accommodation', hint: 'Room / seat, per participant.' },
  { key: 'meals', label: 'Meals', hint: 'Sattvic meals per participant.' },
  { key: 'localTransport', label: 'Local transport', hint: 'Pickups, excursions per participant.' },
  { key: 'materials', label: 'Materials / props', hint: 'Mats, kits, per participant.' },
];

const num = (v: string) => {
  const n = parseInt(v.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

function CostInput({
  label,
  hint,
  value,
  onChange,
  prefixTotal,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  prefixTotal?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-muted">{label}</label>
      <div className="mt-1 flex items-center rounded-lg border border-line bg-white px-2.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        <span className="text-sm font-black text-ink">₹</span>
        <input
          inputMode="numeric"
          className="w-full bg-transparent px-1.5 py-2 text-sm font-bold text-ink outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 7))}
          placeholder="0"
        />
        {prefixTotal && <span className="shrink-0 pl-1 text-[10px] font-semibold text-muted">total</span>}
        {!prefixTotal && <span className="shrink-0 pl-1 text-[10px] font-semibold text-muted">/seat</span>}
      </div>
      {hint && <p className="mt-0.5 text-[10px] leading-tight text-muted">{hint}</p>}
    </div>
  );
}

export default function RetreatEconomicsCalculator({
  pricePerSeat,
  seatsTotal,
  platformFeePct,
  minCohort,
  venueCostPerSeat,
}: {
  pricePerSeat: number;
  seatsTotal: number;
  platformFeePct: number;
  minCohort: number;
  venueCostPerSeat: number;
}) {
  const [open, setOpen] = useState(false);
  const [fixed, setFixed] = useState<Record<string, string>>({});
  const [perSeat, setPerSeat] = useState<Record<string, string>>({});
  const [scenario, setScenario] = useState<number>(0); // 0 => derive from seatsTotal

  const fixedTotal = FIXED_LINES.reduce((sum, l) => sum + num(fixed[l.key] || ''), 0);
  // The wizard's disclosed "venue cost per seat" is a real per-participant cost, so
  // fold it into the per-seat cost base (teachers can still add more lines below).
  const perSeatCosts = PER_SEAT_LINES.reduce((sum, l) => sum + num(perSeat[l.key] || ''), 0) + Math.max(0, venueCostPerSeat);

  const feeRate = (platformFeePct || 0) / 100;
  const platformFeePerSeat = Math.round(pricePerSeat * feeRate);
  const contributionPerSeat = pricePerSeat - platformFeePerSeat - perSeatCosts; // margin each seat adds after fee + variable cost

  const breakEven = useMemo(() => {
    if (contributionPerSeat <= 0) return null;
    if (fixedTotal <= 0) return 0;
    return Math.ceil(fixedTotal / contributionPerSeat);
  }, [contributionPerSeat, fixedTotal]);

  const project = (n: number) => {
    const participants = Math.max(0, n);
    const revenue = participants * pricePerSeat;
    const platformFee = participants * platformFeePerSeat;
    const variable = participants * perSeatCosts;
    const totalCost = fixedTotal + variable;
    const earnings = revenue - platformFee - totalCost;
    return { participants, revenue, platformFee, totalCost, earnings };
  };

  const cap = Math.max(1, seatsTotal || 0);
  const activeCount = scenario > 0 ? Math.min(scenario, cap) : cap;
  const live = project(activeCount);

  // Key scenarios: minimum cohort (if set), break-even (if reachable) and a full house.
  const milestones: { label: string; n: number }[] = [];
  if (minCohort > 0) milestones.push({ label: `Min cohort · ${minCohort}`, n: minCohort });
  if (breakEven != null && breakEven > 0 && breakEven <= cap) milestones.push({ label: `Break-even · ${breakEven}`, n: breakEven });
  milestones.push({ label: `Full house · ${cap}`, n: cap });
  // De-dupe by n, keep order.
  const seen = new Set<number>();
  const rows = milestones.filter((m) => (seen.has(m.n) ? false : (seen.add(m.n), true)));

  const priceReady = pricePerSeat >= 500;

  return (
    <div className="rounded-xl border border-royal/25 bg-royal-50/40" data-testid="economics-calculator">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        data-testid="economics-toggle"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-royal/15 text-sm">🔒</span>
          <span>
            <span className="block text-sm font-black text-ink">Your private economics calculator</span>
            <span className="block text-[11px] text-muted">Plan real profit & break-even — only you ever see this.</span>
          </span>
        </span>
        <span className="shrink-0 text-lg text-royal">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-royal/20 px-4 py-4">
          {!priceReady && (
            <p className="rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-muted">
              Set your seat price above to see live projections.
            </p>
          )}

          <div>
            <p className="text-xs font-black uppercase tracking-wide text-royal">Fixed costs · once for the whole retreat</p>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {FIXED_LINES.map((l) => (
                <CostInput key={l.key} label={l.label} hint={l.hint} prefixTotal value={fixed[l.key] || ''} onChange={(v) => setFixed((s) => ({ ...s, [l.key]: v }))} />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-wide text-royal">Per-participant costs · scale with headcount</p>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {PER_SEAT_LINES.map((l) => (
                <CostInput key={l.key} label={l.label} hint={l.hint} value={perSeat[l.key] || ''} onChange={(v) => setPerSeat((s) => ({ ...s, [l.key]: v }))} />
              ))}
            </div>
            {venueCostPerSeat > 0 && (
              <p className="mt-1.5 text-[11px] text-muted">
                + {inr(venueCostPerSeat)}/seat venue cost from your pricing step is already included.
              </p>
            )}
          </div>

          {/* Per-seat contribution & break-even */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-white p-3.5">
              <p className="text-[11px] font-bold text-muted">Each seat adds (after fee + variable cost)</p>
              <p className={`mt-0.5 text-lg font-black ${contributionPerSeat >= 0 ? 'text-brand-700' : 'text-red-600'}`}>
                {inr(contributionPerSeat)}
              </p>
              {contributionPerSeat <= 0 && priceReady && (
                <p className="mt-0.5 text-[11px] font-semibold text-red-600">Your per-seat costs meet or exceed what you keep — raise the price or trim costs.</p>
              )}
            </div>
            <div className="rounded-xl border border-line bg-white p-3.5">
              <p className="text-[11px] font-bold text-muted">Break-even</p>
              {breakEven == null ? (
                <p className="mt-0.5 text-sm font-bold text-ink-soft">Not reachable at this price</p>
              ) : breakEven === 0 ? (
                <p className="mt-0.5 text-lg font-black text-brand-700">Profitable from seat 1</p>
              ) : (
                <p className="mt-0.5 text-lg font-black text-ink">
                  {breakEven} <span className="text-sm font-bold text-muted">{breakEven === 1 ? 'participant' : 'participants'}</span>
                </p>
              )}
              {breakEven != null && breakEven > cap && (
                <p className="mt-0.5 text-[11px] font-semibold text-amber-600">Above your {cap}-seat capacity — this retreat can’t break even as priced.</p>
              )}
            </div>
          </div>

          {/* Live scenario scrubber */}
          <div className="rounded-xl border border-line bg-white p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-extrabold text-ink">If <span className="text-royal">{activeCount}</span> {activeCount === 1 ? 'seat' : 'seats'} fill</p>
              <p className={`text-lg font-black ${live.earnings >= 0 ? 'text-brand-700' : 'text-red-600'}`}>{inr(live.earnings)}</p>
            </div>
            <input
              type="range"
              min={1}
              max={cap}
              value={activeCount}
              onChange={(e) => setScenario(parseInt(e.target.value, 10))}
              className="mt-2 w-full accent-royal"
              data-testid="economics-scrubber"
              aria-label="Participants filled"
            />
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted">Revenue</span><span className="font-bold text-ink">{inr(live.revenue)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Platform fee ({platformFeePct}%)</span><span className="font-semibold text-muted">− {inr(live.platformFee)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Total costs</span><span className="font-semibold text-muted">− {inr(live.totalCost)}</span></div>
              <div className="flex justify-between"><span className="font-bold text-ink">Your earnings</span><span className={`font-black ${live.earnings >= 0 ? 'text-brand-700' : 'text-red-600'}`}>{inr(live.earnings)}</span></div>
            </div>
          </div>

          {/* Milestone table */}
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-cream/70 text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-black">Scenario</th>
                  <th className="px-3 py-2 text-right font-black">Revenue</th>
                  <th className="px-3 py-2 text-right font-black">Costs</th>
                  <th className="px-3 py-2 text-right font-black">You earn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((m) => {
                  const p = project(Math.min(m.n, cap));
                  return (
                    <tr key={m.label}>
                      <td className="px-3 py-2 font-bold text-ink">{m.label}</td>
                      <td className="px-3 py-2 text-right text-ink-soft">{inr(p.revenue)}</td>
                      <td className="px-3 py-2 text-right text-muted">{inr(p.platformFee + p.totalCost)}</td>
                      <td className={`px-3 py-2 text-right font-black ${p.earnings >= 0 ? 'text-brand-700' : 'text-red-600'}`}>{inr(p.earnings)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] leading-relaxed text-muted">
            🔒 Private planning tool. These cost inputs stay on your device — they are never sent to NOSTOPS,
            never shown to seekers, and don’t change your published price.
          </p>
        </div>
      )}
    </div>
  );
}
