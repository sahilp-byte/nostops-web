'use client';

import { toggleCompare, useProgrammeCompare } from '@/lib/programme-compare';
import { MAX_COMPARE } from '@/lib/programme-compare-url';

// "Compare" tick for a programme (cards on /programmes, button on the detail page).
export default function CompareToggle({ slug, name, size = 'sm' }: { slug: string; name: string; size?: 'sm' | 'lg' }) {
  const { has, full } = useProgrammeCompare();
  const on = has(slug);
  const disabled = !on && full;
  const box = size === 'lg' ? 'min-h-[52px] px-6 text-base' : 'min-h-[44px] px-4 text-sm';
  return (
    <label
      className={`relative z-10 inline-flex items-center gap-2 rounded-xl border font-bold transition focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 ${box} ${
        on ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-soft hover:border-brand'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      data-testid={`compare-toggle-${slug}`}
    >
      <input
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={() => toggleCompare({ slug, name })}
        className="h-4 w-4 accent-brand"
        aria-label={`Compare ${name}`}
      />
      {on ? 'Added to compare' : disabled ? `Max ${MAX_COMPARE} to compare` : 'Compare'}
    </label>
  );
}
