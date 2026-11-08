'use client';
// Participant fee (owner decision: participants pay, not the organisation).
// The organiser sets a fee per participant, per session; the NOSTOPS list rate
// (lib/org/pricing; no discount applies) supplies the suggestion. Each person pays
// online when they register — the existing Cashfree participant checkout.
import { input, label } from './wizard-ui';

export const FEE_MAX = 100000;

/** A whole number of rupees between 1 and FEE_MAX, or null. */
export function parseFee(v: string): number | null {
  const n = Number(v);
  return v.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= FEE_MAX ? n : null;
}

export default function ParticipantFee({ value, suggested, repeat, onChange, onUseSuggested }: {
  value: string; suggested: number; repeat: boolean;
  onChange: (v: string) => void; onUseSuggested: () => void;
}) {
  const fee = parseFee(value);
  return (
    <div className="rounded-2xl border border-line bg-cream p-4" data-testid="fee-block">
      <label className={label} htmlFor="cfg-fee">Participant fee *</label>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-sm font-bold text-ink-soft">₹</span>
        <input id="cfg-fee" type="number" inputMode="numeric" min={1} max={FEE_MAX} step={1} className={`${input} !mt-0 min-h-[44px] pl-7`}
          value={value} onChange={(e) => onChange(e.target.value)} data-testid="cfg-fee" />
      </div>
      <p className="mt-1 text-[11px] text-muted">Per participant{repeat ? ', per session' : ''}.</p>
      {value.trim() !== '' && fee == null && (
        <p className="mt-1 text-[11px] font-semibold text-rose-600" data-testid="fee-invalid">Enter a whole number of rupees, from ₹1 to ₹{FEE_MAX.toLocaleString('en-IN')}.</p>
      )}
      <p className="mt-2 text-[11px] text-ink-soft" data-testid="fee-suggested">
        NOSTOPS list rate: <span className="font-bold text-ink">₹{suggested.toLocaleString('en-IN')}</span>.
        {fee !== suggested && (
          <button type="button" onClick={onUseSuggested} data-testid="fee-use-suggested" className="ml-1 font-bold text-brand-700 hover:underline">
            Use ₹{suggested.toLocaleString('en-IN')}
          </button>
        )}
      </p>
      {fee != null && fee < suggested && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800" data-testid="fee-below-warning" role="status">
          ⚠ This is below the NOSTOPS list rate. Your teacher&rsquo;s share comes from these fees, so please check with NOSTOPS before going lower.
        </p>
      )}
      <p className="mt-2 text-[11px] font-semibold text-emerald-700" data-testid="fee-how-paid">
        Each participant pays online (card or UPI) when they register. Their place is confirmed once the payment goes through.
        {repeat ? ' They pay for each session they register for.' : ''}
      </p>
    </div>
  );
}
