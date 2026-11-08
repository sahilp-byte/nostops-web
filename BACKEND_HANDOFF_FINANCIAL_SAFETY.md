# Main-backend team — Financial Safety fix spec (FIN-01 … FIN-10)

From: NOSTOPS web team. Founder report: `/app/memory/FINANCIAL_SAFETY_AUDIT.md`.
Evidence: `/app/test_reports/fin_audit/evidence.json` (read-only GETs, PII masked) and `reconciliation.json`.
Companion spec (empanelment / policy): `/app/BACKEND_HANDOFF_B48_policy_v2.md` (MB-01…MB-10, TVR-01).

**Code references** are to the last main-backend copy kept in the web project's git history (`4089ab92^`, 28 Aug
2026). Please check them against the current live code.

| Area | File / function | Collection |
|---|---|---|
| Payout sweep on GET | `routes/payout_escrow.py` `list_payouts` L455–462, `trigger_sweep` L555, `sweep_cooling_to_eligible` L284 | `payout_escrow` |
| Heal on GET | `routes/wallet_helpers.py` `reconcile_wallets` L182+ | `teacher_wallet`, `teacher_wallet_ledger`, `wallet_reconciliations` |
| Wallet movements | `routes/wallet_helpers.py` `apply_wallet_movement` | `teacher_wallet`, `teacher_wallet_ledger` |
| Withdraw (current wallet) | `routes/teacher_wallet.py` `withdraw` L458–503, `balance` L168–186 (`withdrawable_inr` ×0.85 at L180) | `teacher_wallet_ledger` |
| Withdrawal OTP | `routes/twilio_verify.py` L470–510 (`WITHDRAWAL_OTP_THRESHOLD_INR`, token issue) | `withdrawal_auth_tokens` (issued, never read) |
| v1 withdraw | `routes/payouts_v1.py` `initiate_payout` L235+ | v1 transactions, `payout_beneficiaries_v1` |
| Referral withdraw (mock) | `routes/teacher_referrals.py` `request_withdrawal` L454 | `teacher_referral_ledger` |
| Payout request | `routes/teachers.py` `request_payout` L728 | `teacher_payouts` |
| Fast-Track mock card | `routes/empanelment.py` `_luhn_ok` L73, `/fast-track/{id}/pay` L234 | Fast-Track requests |
| History | Commit `16b74714` (25 Jul 16:41 UTC): holds made escrow-only, plus the drift test. Commit `a6d07e1c` (26 Jul 02:31 UTC): withdrawal fee removed. | |

## Ground rules
1. **Staging first.** Reproduce every item on a staging copy. Do not run tests that move money on production.
2. **No heals or deletions** of wallet, ledger, payout or order rows without the founder's written sign-off. Repairs
   are new, reversible ledger rows with a reason code. Never edit or delete existing rows.
3. **Keep evidence:** export the affected rows and the request logs (16 Jul 2026 → today) before changing anything.
4. Our website and `/api` gateway refuse every route below with **HTTP 423** while the founder's lock is on. The rule
   list is in `backend/financial_lock.py` (mirrored in `frontend/lib/financial-lock-rules.ts`). That covers the web
   only, **not** the mobile app or direct calls.

---

## FS-00 — Server-side money switch (do first)
- One setting (e.g. `MONEY_ACTIONS_ENABLED=false`) that makes the main backend refuse, with 423, every write in this
  list:
  - all withdrawals: `teacher-wallet/withdraw`, `v1/payouts/withdraw`, `teacher-referrals/withdraw`,
    `teachers/me/payout-request`;
  - payout-destination changes: `teacher-wallet/payout-details` POST, `v1/teachers/me/wallet/bank-account`,
    `v1/kyc/bank-verify`, plus `setup-pin` and `change-pin`;
  - `admin/payouts/approve` and `reject`;
  - all refund routes;
  - `mark-paid`;
  - escrow release / complete;
  - `v1/referrals/credit` and `trigger`;
  - wallet top-up orders;
  - Fast-Track `decide`.
- The same setting also stops `GET admin/payouts/list` and `/sweep` from sweeping.
- Mock-card routes and mock checkout are refused **always** outside tests.
- **Acceptance:** with the setting off, each route returns 423 and writes nothing. Compare the row counts in the wallet,
  ledger, payout, order and refund records before and after.

## FIN-01 — GET routes that write
| Route | Change |
|---|---|
| `GET /admin/payouts/list` | Read only. Remove the embedded cooling→eligible sweep. |
| `GET /admin/payouts/sweep` | Replace with `POST /admin/payouts/sweep` (admin, confirm flag, audit row with actor + count). Plus a scheduled job if wanted. |
| `GET /admin/wallet/reconcile` | Read only (report). Move `ledger_to_wallet` / `wallet_to_ledger` to an admin `POST` that needs a second admin approval, a reason, per-teacher scope and an audit row. |
| `GET /payments/cashfree/mock-checkout/*` | Remove outside tests. Never reachable when the order or gateway mode is production. |

- **Scope query:** list every payout or ledger row whose state changed cooling→eligible through `/list` or `/sweep`
  since 16 Jul 2026, with time, actor token and user agent. Our admin sidebar badge called `/list` on every admin page
  view from 11 Sep 2026, and the Payouts page called it from 16 Jul 2026.
- **Scope query:** confirm the heal on 25 Jul 2026 around 16:38 UTC
  (`GET /admin/wallet/reconcile?heal_direction=wallet_to_ledger`, which wrote `wl_recon_877e6523f3fa`).
  - Our project history places it in the main-backend "Iter69 — P0 Wallet Ledger Drift Fix" session (commit
    `16b74714`, 16:41 UTC). That session recorded "zero drift" afterwards.
  - No website code ever sent `heal_direction`.
  - Check whether any other wallet got a "Reconcile wallet→ledger" adjustment.
- **Tests:**
  - FT-01: 10× `GET /admin/payouts/list` → no row's status or `updated_at` changes.
  - FT-02: `GET reconcile` with any `heal_direction` → no writes.
  - FT-03: in production mode, `GET mock-checkout/{id}/complete` → 404/410, and the order is unchanged.

## FIN-02 — Withdrawal authorisation
**Current contract** (from your API list, then checked in code):
- `teacher-wallet/withdraw {amount_inr, pin, payout_method}` checks the PIN, a ₹500 minimum, that a method is on file
  and the balance. **It never checks an OTP token.** `WITHDRAWAL_OTP_THRESHOLD_INR = 5000` is defined but unused, and
  the tokens `otp/verify` puts in `withdrawal_auth_tokens` are never read.
- `withdraw/otp/start {phone, purpose='login', channel}` uses the phone on the user record. It falls back to the phone
  in the request **only if none is on file**.
- `v1/payouts/withdraw {amount_inr}` has no PIN and no OTP. It does need `verified_bank_account.verified` and
  `kyc_bank_status.verified` (Cashfree BAV), with a 60-minute cool-off.
- `teacher-referrals/withdraw {amount}` has no PIN and no OTP, and it is a **mock**: it writes a "processing" row and
  sends nothing.
- `teachers/me/payout-request` has no PIN, no OTP and **no balance check**: any `amount` from ₹1,000 and any
  `account_detail` text become a pending row in `teacher_payouts`.
- `v1/teachers/me/wallet/bank-account` sets `verified=True` without a check.

**Required:**
1. **One** withdrawal route. Retire the v1, referral and payout-request routes, or route them through the same checks.
2. PIN required: 5-attempt lockout, which already exists.
3. **OTP:**
   - sent only to the teacher's **registered** phone (ignore any phone in the request);
   - `purpose=withdrawal`, bound to the teacher id, the amount and a single use, valid for 5 minutes or less;
   - required at or above the threshold (the founder confirms the amount, today understood as ₹5,000);
   - the verify step returns a token that the withdraw route **requires** and consumes.
4. Payout destination change (bank or UPI): PIN + OTP, then a 72-hour hold before the next payout. Notify the teacher
   by email and SMS. Never mark a bank "verified" without a penny-drop.
5. Server-side limits per withdrawal and per day.

**Tests:**
- FT-10: withdraw without a PIN → 4xx.
- FT-11: at or above the threshold without an OTP token → 4xx.
- FT-12: an OTP issued for login, another teacher or another amount → rejected.
- FT-13: `otp/start` with a different phone → the code goes only to the registered phone.
- FT-14: v1, referral and payout-request withdraw → refused, or the same checks apply.
- FT-15: a bank change → `verified=false` until the penny-drop, and payouts are blocked for 72 hours.

**Website follow-up (ours, after approval):** pass the OTP token on withdraw. Today the website's OTP step is not bound
to the withdrawal.

## FIN-03 — Mock / fake-card payments
| Route | Required |
|---|---|
| `POST /empanelment/fast-track/{id}/pay` (Luhn + expiry only) | 410. Cashfree order + webhook only. |
| `POST /premium-sessions/book` (mock CC, anonymous) | 410, or a Cashfree order with webhook-confirmed payment |
| `POST /bookings/{id}/pay` (mock batch) | Set `DISABLE_MOCK_BATCH_PAY=true` in every environment, then remove the route |
| Cashfree mock mode | Off outside tests. Per-order `mode=mock` must never settle anything that feeds earnings. |

**Data:** flag (do not delete) every record whose payment is `card_mock`, `credit_card_mock`, `mock_txn_*` or a
`mode=mock` order. Exclude these from:
- teacher earnings and holds;
- empanelment evidence (Policy V2 already excludes them on our side);
- referral bonuses (`empanelment_fast` credits);
- reviewer earnings and revenue summaries.

**Known rows:**
- Fast-Track `ef_aad45e0ad440` (non-seed, approved) plus 17 `ft_demo_*` / `ft_qseed_*`;
- teacher.demo's 3 premium sessions;
- the mock orders `order_0b1e7946337e439d` (wallet top-up ₹500), `order_57925c41bd31497e`, `order_49057ee66e0e42c1`,
  `order_89e85e93bf004c50`, `order_be8c64e5854a4a17` and `order_33572aa0888244b9`.

**Tests:**
- FT-20: a test card `4111…1111` on each mock route → 410, nothing marked paid.
- FT-21: a mock-mode order does not change a wallet, booking, KYC or empanelment status in production.

## FIN-04 — Wallet ≠ ledger, ₹96,909 not backed by earnings
**Reconciliation for `tn_9b0aa00b35c5`:**
- Wallet ₹91,743 against ledger ₹93,955: Δ ₹2,212.
- ₹1,150 comes from `wl_7d013798d0564c9a`, a withdrawal stored as +575 (the wallet was debited correctly).
- ₹1,062 comes from `wl_090d507cf3c14a4a`, a release that never credited the wallet.
- Unexplained: ₹0.

**Unbacked money:**
- `wl_recon_877e6523f3fa` (+₹96,909, 2026-07-25T16:38Z): "wallet ₹92318, ledger was ₹-4591".
- Before the heal:
  - Σhold = ₹96,911, of which 4 retreat holds on 24 Jul = ₹96,900;
  - Σhold_reversed = −₹2;
  - Σpayout_release = ₹9;
  - Σwithdrawal = −₹4,600.
- **holds + reversals + releases + withdrawals = ₹92,318 exactly.**
- Cause (confirmed in code): before commit `16b74714`, `apply_wallet_delta` ran `$inc balance_inr` for every type,
  including holds, so holds were spendable. That commit made holds escrow-only. The same session then healed
  `wallet_to_ledger`, which moved the ledger **up** to the inflated wallet.
- **Live bug (confirmed in code):** `teacher_wallet.withdraw` passes `amount_inr` positive. `apply_wallet_movement`
  stores it unchanged in `teacher_wallet_ledger` while running `$inc balance_inr: -abs(amount)`. Every withdrawal since
  25 Jul is therefore stored positive, and the drift grows by 2× each withdrawal.
- `wl_f9f4f0e5d8e54b4b` → `wl_090d507cf3c14a4a` (hold and release 1 second apart, 26 Jul 03:29 UTC) did not credit the
  wallet, although `_wallet_release` normally does. This happened while automated tests with ₹1,250 bookings were
  being run. Check whether these rows were written directly.

**Required:**
1. The available balance is **derived** from the ledger:
   Σrelease + Σadjustment − Σ|withdrawal| − Σwithdrawal_fee (if any).
   `held` = Σhold − Σrelease − Σ|hold_reversed|. A stored balance, if kept, is a cache checked against the ledger on
   every write.
2. Withdrawals are always stored negative (add a DB constraint or validation). A hold never changes the available
   balance. A release credits exactly once, inside the same transaction as the ledger row.
3. Withdrawable ≤ available. Held money is never withdrawable.

**Scope query:** run the report-only reconcile in staging **plus** a ledger-only check for all teachers:
- wrong-sign withdrawals;
- releases without a wallet credit;
- `adjustment` rows with a "Reconcile wallet→ledger" note (they hide earlier drift);
- ledgers that ever went negative.

**Repair (founder sign-off F-4):** for teacher.demo, a correcting row for the wrong sign, a decision on the ₹1,062
owed, and a decision on the ₹96,909 unbacked adjustment. All are new reversible rows with reason codes.

**Tests:**
- FT-30: hold → balance unchanged, held +x.
- FT-31: release → balance +x once, held −x.
- FT-32: a withdrawal row is stored negative and the balance falls by exactly its amount.
- FT-33: our live check `test_live_wallet_reconciles_with_its_ledger` (an expected failure today) passes.

## FIN-05 — Platform fee taken twice
**Evidence:**
- 19 retreat holds have `meta.fee_pct=15`: gross ₹3,31,125 → net ₹2,81,457.
- A 1:1 hold of ₹1,062 equals ₹1,250 × 85%.
- `premium-sessions` show `teacher_share` 85%.
- All 7 withdrawals carry `fee_inr` = 15% of the amount (₹776.25 in total), and `withdrawable_inr` = 85% of the balance.
- Effective fee: 27.75%.
- Code timeline: the withdrawal fee (`fee = amount × 0.15`) was removed in commit `a6d07e1c` (26 Jul 02:31 UTC). All 7
  withdrawals are older than that. `withdrawable_inr = balance × 0.85` ("15% platform fee on payout",
  `teacher_wallet.py` L180) is still live: today's evidence shows 77,981 against 91,743.

**Required (after founder decision B9-2):**
- The fee is applied at exactly one point; we recommend at credit.
- `withdrawable_inr` = available balance, with no second 15%.
- Withdrawal `fee_inr` = 0, or only a disclosed transfer charge.
- Refund the second fee on past withdrawals as new ledger rows.

**Tests:**
- FT-40: a ₹12,000 retreat seat → ₹10,200 credit → withdraw ₹10,200 → ₹10,200 transferred.
- FT-41: our live check `test_live_platform_fee_is_taken_once` (an expected failure today) passes.

## FIN-06 — Two wallets
- The `v1` wallet (`v1/teachers/me/wallet`, `v1/payouts/*`, `v1/teachers/{id}/wallet`) uses its own sign-in and an
  `X-Admin-Key`. The current `teacher-wallet` uses the normal session.
- After founder decision B9-1:
  - reconcile both into the chosen one;
  - make the other read-only, then retire it;
  - send us the v1 balance and payout history for every teacher (in staging) so the founder can see what it holds.
- **Test FT-50:** only one wallet can be debited.

## FIN-07 — Retreat escrow
- The teacher's `held_inr` (₹2,81,457, all retreat) is not reflected in `retreats/payouts/mine` or in
  `admin/retreats/payouts` (₹0, 0 batches).
- **Required:** one escrow record per paid reservation. It is released only after the retreat is delivered, and
  reversed on a refund. It is shown the same way in the wallet, the retreat payouts and the admin ledger.
- **Test FT-60:** a reservation that is paid and then cancelled with a refund → the hold is reversed, nothing is ever
  available.

## FIN-08 — Payout eligibility
- Enforce the founder rule (B9-3; recommended: KYC verified + bank penny-drop verified + empanelled) on **every**
  withdrawal route.
- **Test FT-70:** teacher.demo (KYC, PAN and bank unverified) → withdrawal refused.

## FIN-09 — Fast-Track split
- One split figure everywhere, per founder decisions B9-4 and B9-5: the decide route, the revenue summary and the
  reviewer earnings. Count only gateway-paid fees.
- Decide whether rejections earn a fee.
- **Test FT-80:** the three endpoints agree for the same set of requests.

## FIN-10 — Bookkeeping
- `lifetime_withdrawn_inr` must equal Σ|withdrawal| (today it is ₹4,475 against ₹5,175; `wd_8f4057cf889e` is missing).
- `order_33572aa0888244b9` is PAID while booking `oob_e6bd5a74ee4149` is `pending_payment`. Fulfilment must be atomic,
  and a daily job should list paid orders without a confirmed booking.
- Referral withdrawals `trln_b30d8d6f3b8e` and `trln_a96d4e2659c5` have been "Mock … processing" since May 2026. Close
  them per founder decision B9-8. Confirm whether `trln_6213cb1b5c5d` (₹2,000 "paid", ICICI ending 4521) was a real
  transfer.
- The 7 session-wallet withdrawals (₹5,175) have all been `pending` since Jun–Jul 2026.
  - In the code, `teacher_wallet.withdraw` requests no transfer, and we found no code that processes pending
    withdrawal rows.
  - The money is debited from the teacher and never paid or returned.
  - Required: a withdrawal state machine (pending → processing → paid | failed → reversed), a real transfer, and an
    automatic reversal on failure or timeout.
  - Confirm that none of these was sent to Cashfree Payouts.
- `teacher-referrals/withdraw` is a mock that marks referral money withdrawn. Replace it with the same real withdrawal
  flow, or lock it.
- **Tests:**
  - FT-90: withdraw → a transfer is requested. A failed transfer → the wallet is credited back automatically.
  - FT-91: `teachers/me/payout-request` above the available balance → refused.

## What we need back
1. FS-00 live, with its acceptance results.
2. The scope-query results: FIN-01 sweep history, the FIN-01 heal caller, the FIN-04 all-teacher ledger check and the
   FIN-06 v1 balances and payouts.
3. Staging results for FT-01 … FT-80.
4. A repair proposal for teacher.demo, which the founder signs off before anything is applied.
