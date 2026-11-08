'use client';

import { operationalCapacity, bindingConstraint, hasAnyCapacity, type VenueCapacityBreakdown } from '@/lib/venue-capacity';

// PROMPT 21 — reusable capacity planner. The owner/host enters each operational
// dimension; we compute the venue's operational capacity as the tightest hard
// constraint. Used by the venue CenterForm (persists the computed total) and by
// the teacher retreat wizard (setup-time guardrail).

const FIELDS: { key: keyof VenueCapacityBreakdown; label: string; hint: string; hard: boolean }[] = [
  { key: 'accommodation', label: 'Total accommodation', hint: 'People who can stay overnight', hard: true },
  { key: 'rooms', label: 'Room inventory', hint: 'Number of rooms (informational)', hard: false },
  { key: 'practiceHall', label: 'Practice hall', hint: 'People the yoga hall holds', hard: true },
  { key: 'meals', label: 'Meal / dining', hint: 'People served per sitting', hard: true },
  { key: 'services', label: 'Other services', hint: 'e.g. spa / therapy slots (informational)', hard: false },
];

const input =
  'mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

export default function VenueCapacityPlanner({
  value,
  onChange,
  compact,
}: {
  value: VenueCapacityBreakdown;
  onChange: (next: VenueCapacityBreakdown) => void;
  compact?: boolean;
}) {
  const op = operationalCapacity(value);
  const binder = bindingConstraint(value);
  const any = hasAnyCapacity(value);

  function set(key: keyof VenueCapacityBreakdown, raw: string) {
    const n = parseInt(raw.replace(/\D/g, '').slice(0, 4), 10);
    onChange({ ...value, [key]: Number.isFinite(n) ? n : 0 });
  }

  return (
    <div data-testid="venue-capacity-planner">
      <div className={`grid gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-bold text-muted" htmlFor={`cap-${f.key}`}>
              {f.label}
              {f.hard && <span className="ml-1 text-brand-700">•</span>}
            </label>
            <input
              id={`cap-${f.key}`}
              inputMode="numeric"
              className={input}
              value={value[f.key] ? String(value[f.key]) : ''}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder="—"
              data-testid={`cap-${f.key}`}
            />
            <p className="mt-0.5 text-[10px] leading-tight text-muted">{f.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-brand-50/60 px-3.5 py-2.5" data-testid="venue-operational-capacity">
        {any && op > 0 ? (
          <>
            <span className="text-sm font-extrabold text-brand-700">Operational capacity: {op} {op === 1 ? 'guest' : 'guests'}</span>
            {binder && <span className="text-xs font-semibold text-muted">· limited by {binder}</span>}
          </>
        ) : (
          <span className="text-sm font-semibold text-muted">Enter at least one of accommodation, practice hall or dining (•) to set the venue&apos;s operational capacity.</span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted">
        • dimensions gate the total the venue can host at once. Room inventory &amp; other services are recorded as guidance.
      </p>
    </div>
  );
}
