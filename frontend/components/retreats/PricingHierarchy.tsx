import { inr } from '@/lib/format';
import type { ResolvedPricing, BenefitKey } from '@/lib/pricing';

// PROMPT 17 — the PRICING HIERARCHY made visible to the user. Prompt 3C: the listed
// price, plus a group rate only when a verified per-retreat rule supplies one (none
// does today), with the ONE that applies marked. Host-listed offers and the UNAPPROVED
// group tiers are never priced here. Pure display — safe on server or client.

const ICON: Record<BenefitKey, string> = {
  standard: '•',
  group: '👥',
};

export default function PricingHierarchy({ resolved, title = 'How your price is decided' }: { resolved: ResolvedPricing; title?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5" data-testid="pricing-hierarchy">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-wide text-muted">{title}</p>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-black text-brand-700">One price — never stacked</span>
      </div>

      <ul className="mt-3 space-y-1.5 p-0">
        {resolved.candidates.map((c) => {
          const applied = c.key === resolved.applied;
          return (
            <li
              key={c.key}
              data-testid={`hierarchy-${c.key}`}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${
                applied ? 'border-brand bg-brand-50/60' : c.eligible ? 'border-line bg-white' : 'border-line/60 bg-cream/40'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="w-5 text-center">{ICON[c.key]}</span>
                <span className={`truncate font-bold ${applied ? 'text-ink' : c.eligible ? 'text-ink-soft' : 'text-muted'}`}>
                  {c.label}
                  {c.detail ? <span className="ml-1 font-normal text-muted">· {c.detail}</span> : null}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`font-black ${applied ? 'text-brand-700' : c.eligible ? 'text-ink' : 'text-muted line-through'}`}>₹{inr(c.perSeatInr)}</span>
                {applied ? (
                  <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">Applies</span>
                ) : c.eligible ? (
                  <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">Available</span>
                ) : (
                  <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted/70">Not yet</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-muted" data-testid="hierarchy-note">{resolved.note}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted" data-testid="hierarchy-unverified">
        The listed price applies unless a verified group rate exists for this retreat. The group discount tiers are not confirmed and are never applied here. The amount payable is confirmed when a booking is made.
      </p>
    </div>
  );
}
