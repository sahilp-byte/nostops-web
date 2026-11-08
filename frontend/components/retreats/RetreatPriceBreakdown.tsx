import { inr } from '@/lib/format';
import GroupTiersReference from '@/components/retreats/GroupTiersReference';

// PROMPT 11 — participant-facing price breakdown. Shows the listed price, taxes
// note, inclusions and exclusions. NEVER shows platform fee, venue cost or any
// host/venue economics.
// Prompt 3C (founder option B): only the authoritative listed price is shown. Early-bird,
// limited-time and teacher-cohort offers written in the description are not shown, and no
// saving is worked out from them. The group tiers appear only as UNAPPROVED reference tiers,
// so nothing here is labelled "You pay".
export default function RetreatPriceBreakdown({
  priceInr,
  taxNote,
  inclusions,
  notIncluded,
}: {
  priceInr?: number;
  taxNote?: string;
  inclusions: string[];
  notIncluded: string[];
}) {
  if (typeof priceInr !== 'number') return null;

  return (
    <div className="rounded-2xl border border-line bg-white p-5" data-testid="price-breakdown">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-muted" data-testid="listed-price-label">Listed price</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-black text-ink" data-testid="final-price">₹{inr(priceInr)}</span>
            <span className="text-sm font-medium text-muted">/ seat</span>
          </div>
        </div>
      </div>

      <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-ink-soft">Taxes</dt>
          <dd className="font-semibold text-ink">{taxNote || 'As applicable'}</dd>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-2">
          <dt className="font-black text-ink">Listed price / seat</dt>
          <dd className="text-lg font-black text-ink">₹{inr(priceInr)}</dd>
        </div>
      </dl>

      {/* Groups */}
      <div className="mt-4 rounded-xl bg-brand-50/50 p-3.5">
        <p className="text-xs font-black uppercase tracking-wide text-brand-700">Booking as a group</p>
        <p className="mt-2 text-sm text-ink-soft"><span aria-hidden>👥</span> Each seat in a group is at the listed price.</p>
        <GroupTiersReference />
      </div>

      {(inclusions.length > 0 || notIncluded.length > 0) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {inclusions.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-muted">Included</p>
              <ul className="mt-2 space-y-1 p-0 text-sm">
                {inclusions.map((x) => <li key={x} className="flex items-start gap-2 text-ink-soft"><span aria-hidden className="text-brand">✓</span><span className="capitalize">{x}</span></li>)}
              </ul>
            </div>
          )}
          {notIncluded.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-muted">Not included</p>
              <ul className="mt-2 space-y-1 p-0 text-sm">
                {notIncluded.map((x) => <li key={x} className="flex items-start gap-2 text-muted"><span aria-hidden className="text-red-500">✕</span><span className="capitalize">{x}</span></li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted" data-testid="price-unverified-note">
        The listed price is the only price shown here. The group discount tiers are not confirmed and cannot be booked. The amount payable is the one confirmed when a booking is made. NOSTOPS never adds hidden charges, and the teacher’s venue arrangements are their own — never billed to you.
      </p>
    </div>
  );
}
