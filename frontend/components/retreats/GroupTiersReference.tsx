// Prompt 3C (founder decision): the retreat group tiers are UNAPPROVED reference tiers. They are
// shown only with the exact label: never as a discounted price, a saving or a payable total.
import { DEFAULT_GROUP_TIERS, type GroupTier } from '@/lib/pricing';
import { UNAPPROVED_LABEL } from '@/lib/org/pricing';

export default function GroupTiersReference({ tiers = DEFAULT_GROUP_TIERS }: { tiers?: GroupTier[] }) {
  return (
    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900" data-testid="group-tiers-reference">
      <p className="font-bold">Group discount tiers (reference only)</p>
      <ul className="mt-1 space-y-1 p-0">
        {tiers.map((t) => (
          <li key={t.min_seats} className="list-none" data-testid={`group-tier-${t.min_seats}`}>
            {t.min_seats}+ seats, {t.discount_pct}%: <span className="font-black">{UNAPPROVED_LABEL}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
