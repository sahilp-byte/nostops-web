// FINANCIAL SAFETY AUDIT (2026-06) — the main-backend calls the website must not make.
// Pure (no server-only import) so a plain Node test can check it against the Python
// copy in backend/financial_lock.py: both must give the same answer for every case.
//
//  * ALWAYS rules: mock-payment and policy-bypass routes. Never sent, lock or no lock.
//  * LOCK rules: money actions and reads that change payout state. Sent only after the
//    founder approves and FINANCIAL_ACTIONS_UNLOCKED=true is set on the server.
export const FINANCIAL_LOCK_MESSAGE =
  'Money actions are paused while NOSTOPS completes a financial safety audit. Nothing was sent and nothing changed. Balances and history stay visible.';
export const BLOCKED_ROUTE_MESSAGE = 'This action is not available. Nothing was sent and nothing changed.';

export type LockRule = { id: string; kind: 'ALWAYS' | 'LOCK'; methods: 'ANY' | 'WRITE'; pattern: RegExp; why: string };

export const FINANCIAL_LOCK_RULES: LockRule[] = [
  // ── Never: mock payments and empanelment bypasses ─────────────────────────
  { id: 'mock-checkout', kind: 'ALWAYS', methods: 'ANY', pattern: /^payments\/cashfree\/mock-checkout(\/|$)/, why: 'A GET here fires the payment webhook itself (mock mode)' },
  { id: 'mock-card', kind: 'ALWAYS', methods: 'WRITE', pattern: /^(empanelment\/fast-track\/[^/]+\/pay|premium-sessions\/book|bookings\/[^/]+\/pay)$/, why: 'Marks something paid from a card number alone' },
  { id: 'self-empanel', kind: 'ALWAYS', methods: 'WRITE', pattern: /^teachers\/me\/apply-free-empanelment$/, why: 'Flips is_empanelled without Policy V2' },
  { id: 'razorpay', kind: 'ALWAYS', methods: 'WRITE', pattern: /^(payments\/razorpay(\/|$)|empanelment\/fast-track\/[^/]+\/razorpay-(create|verify)$)/, why: 'Decommissioned payment rail' },
  { id: 'razorpay-callback', kind: 'ALWAYS', methods: 'ANY', pattern: /^payments\/razorpay\/callback(\/|$)/, why: 'Retired Razorpay return callback: a GET can mark a booking paid (founder decision 4)' },
  // ── Never (Prompt 4B): payout / settlement initiation; read-only history stays open ─
  { id: 'payout-initiation', kind: 'ALWAYS', methods: 'WRITE', pattern: /^(v1\/payouts\/withdraw|teacher-wallet\/withdraw|teachers\/me\/payout-request|teacher-referrals\/withdraw|admin\/payouts\/approve)(\/|$)/, why: 'Starts a payout: no payout capability is approved' },
  { id: 'payout-sweep', kind: 'ALWAYS', methods: 'ANY', pattern: /^admin\/payouts\/sweep(\/|$)/, why: 'Triggers the cooling→eligible payout sweep' },
  // ── Locked: reads that change payout state ───────────────────────────────
  { id: 'payout-sweep-read', kind: 'LOCK', methods: 'ANY', pattern: /^admin\/payouts\/list(\/|$)/, why: 'Runs the cooling→eligible payout sweep on a GET' },
  { id: 'wallet-heal', kind: 'LOCK', methods: 'ANY', pattern: /^admin\/wallet\/reconcile(\/|$)/, why: 'Can write balances unless heal_direction=report_only' },
  // ── Locked: money out, payout destination, refunds ──────────────────────
  { id: 'withdraw', kind: 'LOCK', methods: 'WRITE', pattern: /^(teacher-wallet\/(withdraw|setup-pin|change-pin|payout-details)(\/|$)|teachers\/me\/payout-request$|teacher-referrals\/withdraw$)/, why: 'Withdrawal, PIN or payout destination' },
  { id: 'v1-money', kind: 'LOCK', methods: 'WRITE', pattern: /^v1\/(payouts(\/|$)|payments\/admin(\/|$)|referrals\/(credit|trigger)$|kyc\/bank-verify$|teachers\/[^/]+\/wallet(\/|$)|bookings\/[^/]+\/(complete|cancel|self-cancel)$)/, why: 'Second (v1) wallet: credit, withdraw, refund' },
  { id: 'payout-decision', kind: 'LOCK', methods: 'WRITE', pattern: /^admin\/payouts(\/|$)/, why: 'Approves or rejects a payout' },
  { id: 'refund', kind: 'LOCK', methods: 'WRITE', pattern: /^(payments\/cashfree\/orders\/[^/]+\/refunds$|retreats\/[^/]+\/reservations\/[^/]+\/cancel-with-refund$|one-on-one\/booking\/[^/]+\/student-cancel$|one-on-one\/auto-expire-unresponsive$|bookings\/[^/]+\/cancel$)/, why: 'Issues a refund' },
  { id: 'mark-paid', kind: 'LOCK', methods: 'WRITE', pattern: /^(retreats\/[^/]+\/reservations\/[^/]+\/mark-paid|bookings\/[^/]+\/employees\/[^/]+\/mark-paid)$/, why: 'Records a payment without the gateway, crediting a wallet' },
  { id: 'release', kind: 'LOCK', methods: 'WRITE', pattern: /^(one-on-one\/booking\/[^/]+\/(complete|reassign)$|bookings\/[^/]+\/complete-pilot$|bookings\/check-expired-pilots$|bookings\/[^/]+\/split-agreement(\/|$)|empanelment\/claims\/sweep-fallback$)/, why: 'Releases escrow, realises commission or changes a split' },
  { id: 'fast-track-split', kind: 'LOCK', methods: 'WRITE', pattern: /^empanelment\/fast-track\/[^/]+\/decide$/, why: 'Realises the non-refundable reviewer revenue split' },
  // ── P0 (2026-10): found unprotected in the deployed route list ───────────
  { id: 'paid-state-change', kind: 'LOCK', methods: 'WRITE', pattern: /^(retreats\/[^/]+\/reservations\/[^/]+\/cancel|empanelment\/fast-track\/[^/]+\/cancel)$/, why: 'Changes a paid (or payable) record without the money rules' },
  { id: 'split-reassign', kind: 'LOCK', methods: 'WRITE', pattern: /^group-booking-agreements\/[^/]+\/decline$/, why: 'Re-assigns a revenue split' },
  { id: 'credit-issue', kind: 'LOCK', methods: 'WRITE', pattern: /^(gurukul\/issue-credit|referrals\/[^/]+\/status)$/, why: 'Issues a credit or records referral commission' },
  // ── Locked (Prompt 4B): payment actions with no billing-country check; legacy Razorpay confirm ─
  { id: 'payment-request', kind: 'LOCK', methods: 'WRITE', pattern: /^(v1\/payments\/orders|bookings\/[^/]+\/(close-and-request-payment|send-payment-requests)|bookings\/hr\/send-all-payment-requests|international\/paypal\/capture\/[^/]+)(\/|$)/, why: 'Creates or captures a payment with no approved route' },
  { id: 'legacy-kyc-confirm', kind: 'LOCK', methods: 'WRITE', pattern: /^kyc\/sandbox\/verify-payment(\/|$)/, why: 'Confirms a legacy Razorpay InstaKYC payment' },
  // ── Fail-closed catch-all: any other write whose path names a money action ─
  { id: 'money-keyword', kind: 'LOCK', methods: 'WRITE', pattern: /(^|[/_-])(withdraw[a-z0-9_]*|payouts?|refunds?|wallets?|escrow|ledgers?|settle[a-z0-9_]*|commissions?|earnings?|bonus(es)?|cashback|chargebacks?|reversals?|disburse[a-z0-9_]*|beneficiar[a-z0-9_]*|bank-account|bank-verify|mark-paid|credits?|release[a-z0-9_]*|reconcile[a-z0-9_]*)([/_-]|$)/, why: 'Unreviewed money route' },
];

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Path after /api/, decoded, dot-segments resolved, lower case (same as admin_gate._canonical). */
export function canonicalPath(raw: string): { path: string; query: URLSearchParams } {
  const [pathPart, queryPart = ''] = String(raw || '').split('?');
  let p = pathPart;
  for (let i = 0; i < 3; i += 1) {
    let q = p;
    try { q = decodeURIComponent(p); } catch { /* keep */ }
    if (q === p) break;
    p = q;
  }
  const out: string[] = [];
  for (const seg of p.replace(/\\/g, '/').split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop(); else out.push(seg);
  }
  if (out[0]?.toLowerCase() === 'api') out.shift();
  return { path: out.join('/').toLowerCase(), query: new URLSearchParams(queryPart) };
}

/** The body as a JSON object, or null when it can't be read as one (→ refused). */
function jsonObject(body: string | undefined): Record<string, unknown> | null {
  try {
    const v = JSON.parse(body ?? '');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function isWalletTopup(obj: Record<string, unknown> | null): boolean {
  if (!obj) return true;
  return ['order_type', 'orderType'].some((k) => obj[k] != null && JSON.stringify(obj[k]).toLowerCase().includes('wallet'));
}

/** The rule a call breaks, or null. `locked` = the money lock is on (default). */
export function financialLockRule(method: string, rawPath: string, body: string | undefined, locked: boolean): LockRule | null {
  const m = String(method || 'GET').toUpperCase();
  const { path, query } = canonicalPath(rawPath);
  // A "#", a decoded "?" / "#" or a control character would be re-read as a delimiter by the
  // HTTP client, so the route checked here would not be the route reached. Always refused.
  if (/[?#\u0000-\u001f]/.test(path) || String(rawPath || '').split('?')[0].includes('#')) {
    return { id: 'bad-path', kind: 'ALWAYS', methods: 'ANY', pattern: /[?#]/, why: 'Path would not reach the route that was checked' };
  }
  const isWrite = WRITE.has(m);
  for (const r of FINANCIAL_LOCK_RULES) {
    if (r.kind === 'LOCK' && !locked) continue;
    if (r.methods === 'WRITE' && !isWrite) continue;
    if (!r.pattern.test(path)) continue;
    if (r.id === 'wallet-heal' && query.get('heal_direction') === 'report_only' && query.getAll('heal_direction').length === 1) continue;
    return r;
  }
  if (locked && isWrite) {
    // Wallet top-up credits a wallet (refused unless the body is readable and names no wallet
    // order); anything but an exact 1:1 "accept" may decline and refund the learner.
    if (/^payments\/cashfree\/orders$/.test(path) && isWalletTopup(jsonObject(body))) {
      return { id: 'wallet-topup', kind: 'LOCK', methods: 'WRITE', pattern: /^payments\/cashfree\/orders$/, why: 'Credits a wallet' };
    }
    if (/^one-on-one\/booking\/[^/]+\/teacher-action$/.test(path) && jsonObject(body)?.action !== 'accept') {
      return { id: 'decline-refund', kind: 'LOCK', methods: 'WRITE', pattern: /teacher-action$/, why: 'Declining refunds the learner' };
    }
  }
  return null;
}
