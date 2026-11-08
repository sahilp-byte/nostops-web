// B4.8 — teacher verification OFFERS: one provisional configuration + the server-side
// checkout amount rule. PURE (no I/O) so the BFF and tests share exactly one rule.
//
// Owner decision (B4.8), provisional:
//   • InstaKYC  — ₹279 incl. GST, India only (subject to final provider-cost/tax validation)
//   • Fast-Track — ₹4,999, an expedited ASSESSMENT only; approval is never guaranteed.
//     Its order amount is set by the main backend from its own offer, never by the browser.
//   • Combined ₹2,499 + tax / US$99 offer — PAUSED (no new purchases) until approved.
//   • Membership — not active; never charged.
// No international prices exist; none are invented here.
import { INSTAKYC_PRICE_INR } from '@/lib/pricing';

export const FAST_TRACK_PRICE_INR = 4999;
export const WALLET_TOPUP_MIN_INR = 100;
export const WALLET_TOPUP_MAX_INR = 100000;

export const OFFERS = {
  instakyc: {
    label: 'InstaKYC identity verification',
    amountInr: INSTAKYC_PRICE_INR,
    region: 'India',
    purchasable: true,
    note: 'Provisional price, incl. GST — subject to final provider-cost and tax validation.',
  },
  fast_track: {
    label: 'Fast-Track empanelment assessment',
    amountInr: FAST_TRACK_PRICE_INR,
    region: 'India',
    purchasable: true,
    note: 'Provisional price. An expedited assessment only — approval is not guaranteed.',
  },
  unified: {
    label: 'Combined verification + empanelment',
    purchasable: false,
    note: 'Paused until its scope and pricing are formally approved. No new purchases.',
  },
  membership: { label: 'Membership', purchasable: false, note: 'Not active. Nothing is charged.' },
} as const;

// One flat shape (the project compiles with strictNullChecks off, so a discriminated
// union does not narrow on `if (!check.ok)`).
export type AmountCheck = { ok: boolean; amount?: number | null; fromBooking?: boolean; status?: number; error?: string };

const TAMPERED = 'The amount does not match the current price. Please reload the page and try again.';

/** Server-side checkout amount. A browser-sent amount is only ever COMPARED with the
 *  authoritative price, never used as it is. `one_on_one` is re-derived from the
 *  reserved booking by the caller (`fromBooking`). Anything else is refused. */
export function resolveCheckoutAmount(orderType: string, clientAmount: unknown, referenceId?: string | null): AmountCheck {
  const sent = clientAmount === undefined || clientAmount === null || clientAmount === '' ? null : Number(clientAmount);
  if (sent !== null && !Number.isFinite(sent)) return { ok: false, status: 400, error: 'Invalid amount.' };
  switch (orderType) {
    case 'instakyc':
      if (sent !== null && sent !== OFFERS.instakyc.amountInr) return { ok: false, status: 400, error: TAMPERED };
      return { ok: true, amount: OFFERS.instakyc.amountInr, fromBooking: false };
    case 'wallet_topup':
      // A top-up is the teacher's own chosen amount — bounded, whole rupees only.
      if (sent === null || !Number.isInteger(sent) || sent < WALLET_TOPUP_MIN_INR || sent > WALLET_TOPUP_MAX_INR) {
        return { ok: false, status: 400, error: 'Enter an amount between ₹100 and ₹1,00,000.' };
      }
      return { ok: true, amount: sent, fromBooking: false };
    case 'one_on_one':
      if (!referenceId) return { ok: false, status: 400, error: 'Missing booking reference.' };
      return { ok: true, amount: null, fromBooking: true };
    default:
      return { ok: false, status: 400, error: 'This offer is not available.' };
  }
}

/** For a 1:1 booking: the reserved booking's amount is authoritative; a different
 *  browser amount is treated as tampering. */
export function checkBookingAmount(authoritative: unknown, clientAmount: unknown): AmountCheck {
  const a = Number(authoritative);
  if (!Number.isFinite(a) || a <= 0) return { ok: false, status: 409, error: 'This booking has no payable amount yet.' };
  const sent = clientAmount === undefined || clientAmount === null || clientAmount === '' ? null : Number(clientAmount);
  if (sent !== null && sent !== a) return { ok: false, status: 400, error: TAMPERED };
  return { ok: true, amount: a, fromBooking: true };
}
