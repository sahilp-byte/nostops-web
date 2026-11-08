// Prompt 3C — the suspended 15–28 / 29–40 participant discounts. Shown only with the exact
// UNAPPROVED label: never a percentage, a discounted price or a saving.
import { UNAPPROVED_BANDS, UNAPPROVED_LABEL } from '@/lib/org/pricing';

export default function UnapprovedBands({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const box = tone === 'dark' ? 'border-white/40 bg-white/10 text-white' : 'border-amber-300 bg-amber-50 text-amber-900';
  return (
    <div className={`mt-3 rounded-xl border p-3 text-xs ${box}`} data-testid="unapproved-bands">
      <p className="font-bold">Group-size discounts</p>
      <ul className="mt-1 space-y-1 p-0">
        {UNAPPROVED_BANDS.map((b) => (
          <li key={b.tier} className="list-none" data-testid={`unapproved-band-${b.min}-${b.max}`}>
            {b.min}–{b.max} participants: <span className="font-black">{UNAPPROVED_LABEL}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
