# Main-backend team — P0 remediation fix pack (MB-1 … MB-8)

> **HANDOFF STATUS: NOT SENT.** It is prepared for review only. It will be sent only after the founder verifies the
> recipient addresses and these contents.
> - **Proposed recipients (to be confirmed by the founder):** the main-backend contact used for the 25 Oct hand-off,
>   with a copy to the NOSTOPS team inbox. The exact addresses are confirmed at the time of sending.
> - **Proposed attachment:** this file only. Evidence files and the founder reports are internal and available on
>   request; they are not attached by default.
> - **Pre-send checklist:**
>   1. recipients confirmed;
>   2. MB-1 … MB-8 each still labelled "Recommendation — not implemented";
>   3. no secret, key value, personal data or account id in the text (checked 26 Oct: none found);
>   4. the website references below are described as preview-only until publication is authorized.

**From:** NOSTOPS web team, 26 Oct 2026. **Status of every item in this file: RECOMMENDATION — NOT IMPLEMENTED in the
main backend.** The main backend is a separate codebase. We changed nothing in it, sent no money action to it and ran no
real transaction. **Priority: MB-1 → MB-4 first (P0), then MB-5 (P1), MB-6/MB-7 (P2), MB-8 (carried over).**

- Founder reports (internal, available on request): `P0_REMEDIATION_PREVIEW_REPORT.md`, `P0_RELEASE_REVIEW_REPORT.md`
  and `P0_FINAL_GATE_REPORT.md`.
- Earlier spec (still open, referenced by MB-8): the financial safety fix spec sent on 25 Oct
  (`NOSTOPS_financial_safety_fix_spec.md`: FS-00, FIN-01 … FIN-10).
- Evidence (read-only; website repository paths; available on request):
  - `test_reports/p0/money_inventory.json`: 96 money routes classified from your **deployed** route list (648 paths, 26 Oct).
  - `test_reports/prod_audit/`: the post-deployment audit.
  - `test_reports/p0/cashfree_env_diagnosis.json`, `segments_investigation.json`.

**Founder decisions that bind this pack (26 Oct 2026):**
- `MONEY_OPS_FROZEN` stays **ON** and unchanged. Unfreezing needs a **separate, explicit** founder authorization.
- **Option B:** record only verified, correctly associated inbound payments, idempotently. While frozen, create **no**
  wallet credit, earning, commission, referral credit, escrow release, payout or refund. Queue the downstream accounting
  for **controlled review** after a separately authorized unfreeze. **No automatic release.**
- Paid checkout on the main backend is **unavailable** until an authorized administrator fixes the Cashfree production
  authentication failure (MB-5).
- No production writes, repairs, migrations or balance changes as part of this pack. Do not apply the ₹1,062 correction,
  and do not delete the two synthetic ledger rows. Do not change teacher verification or empanelment status.

## Ground rules
1. **Staging first.** Build and test every item on staging. Run nothing that moves money on production.
2. **No heals, deletions or migrations** of wallet, ledger, payout, order or refund rows without the founder's written
   sign-off. A repair is a new, reversible row with a reason code.
3. **Acceptance tests in this file are safe by design:**
   - use made-up ids, an amount below the minimum and sandbox orders only;
   - compare row counts in wallet, ledger, payout, order and refund records before and after.
4. **What the website does** (implemented in the website **preview only — not yet published**). Once publication is
   authorized, it covers `www.nostops.org` and its `/api` gateway, **not** the mobile app, direct calls to
   `pro-learn-connect-1.emergent.host`, or your jobs:
   - refuses every route below with 423 while its lock is on (`backend/financial_lock.py`,
     `frontend/lib/financial-lock-rules.ts`);
   - refuses the retired fake-payment routes always;
   - forwards signed payment notifications unchanged and refuses unsigned ones;
   - serves a minimal admin-only Cashfree diag.

   These protect only the website path. They are **references, not a substitute** for MB-1 … MB-4.

---

## MB-1 (P0) — FS-00 freeze: checked FIRST on every money route, ON by default
**Recommendation — not implemented.**

- **Change:**
  1. One guard (dependency or middleware) runs **before** id lookup, auth-dependent branching and body validation on
     every route in Appendix A. It answers `423 {"code":"FS00_MONEY_FROZEN"}`.
  2. **Fail closed.** If `MONEY_OPS_FROZEN` is missing, empty or unreadable, the service treats money as frozen.
     Only an explicit value set by an authorized operator unfreezes it. Log the effective value at startup.
  3. **Second check at the point of write.** Check the freeze inside the shared write helpers (wallet movement, ledger
     insert, payout create, refund create, escrow release, commission realise), so no new route can skip it.
- **Why (evidence):**
  - Production answers **404, not 423**, for made-up ids on 1:1 complete, 1:1 reassign, 1:1 student-cancel,
    complete-pilot and v1 booking complete (audit F6). So the freeze is not checked first, and whether it stops the
    final write is unknown.
  - These further routes have no confirmed freeze:
    - `retreats/{id}/reservations/{id}/cancel`
    - `empanelment/fast-track/{id}/cancel`
    - `group-booking-agreements/{id}/decline`
    - `gurukul/issue-credit`
    - `referrals/{id}/status`
- **Acceptance tests:**
  - **T1-1:** every Appendix A route, called directly (no website) with a made-up id, signed out / as teacher / as
    admin → 423 `FS00_MONEY_FROZEN`, never 404 or 422.
  - **T1-2:** start staging with `MONEY_OPS_FROZEN` removed → T1-1 still 423.
  - **T1-3:** a unit test calls each shared write helper directly while frozen → it raises, and the row counts don't
    change.
  - **T1-4:** an encoded path (`%2F`, `%3F`, upper case, trailing `/`) reaches the same guard.
- **Done when:** T1-1 … T1-4 pass on staging, and the effective value appears in the startup log.

## MB-2 (P0) — retire every fake-payment route
**Recommendation — not implemented.**

- **Change:** answer **410 Gone** with no body processing and no database read for all of these:
  - `POST bookings/{id}/pay`
  - `POST empanelment/fast-track/{id}/pay`
  - `POST empanelment/fast-track/{id}/razorpay-create` and `…/razorpay-verify`
  - `POST premium-sessions/book`
  - `GET payments/cashfree/mock-checkout/{id}` and `…/complete`
  - **`GET payments/razorpay/callback`**
  - `POST payments/razorpay/create-order`, `…/recover/{id}`, `…/verify`, `…/verify-payment-link`, `…/webhook`

  Remove the Luhn "mock card" code paths.
- **Why:**
  - They mark things paid from a card number alone, or through a retired provider (audit D-2 / FIN-03).
  - The website refuses all of them, and since 26 Oct (preview) also the Razorpay GET callback. The mobile app and
    direct callers still reach them.
- **Acceptance tests:**
  - **T2-1:** each route → 410 for every caller.
  - **T2-2:** no booking, Fast-Track, empanelment, order or ledger record changes (counts before and after).
- **Done when:** the routes are gone from `/openapi.json`, or every one answers 410.

## MB-3 (P0) — inbound payments under Option B (record, verify, release nothing)
**Recommendation — not implemented.** Applies to `POST payments/cashfree/webhook`, `POST v1/payments/webhook` and the
return-URL status checks that confirm a payment.

1. **Authenticity:**
   - Verify the Cashfree HMAC over the **raw bytes** (`timestamp + raw body`) and compare in constant time.
   - Body not valid UTF-8 → 400. Bad or missing signature → 401. Timestamp outside ±5 minutes → 400.
2. **Idempotency:**
   - Store one event record per provider event id (or `x-idempotency-key`) with a state: `processing` → `processed` /
     `failed` / `ignored`.
   - A duplicate of a processed or ignored event → 200, no effect.
   - An event in `processing` for less than 60 s → 503, retry later.
   - A failed event is retried on the next delivery and is **never** acknowledged as done.
3. **Correct association (verification):**
   - Never trust the payload: re-read the order from Cashfree.
   - Count the payment only if **all** of these hold:
     - the order exists locally and was created by this backend;
     - order id, amount and currency equal the local order;
     - the order's reference (booking or registration id) is the record being paid.
   - Anything else → **record as an unmatched inbound payment** for review (not lost), with no effect.
4. **What is recorded while frozen:**
   - the payment record itself (provider ids, amount, currency, verified_at);
   - the paid state of the booking or seat, so the customer gets what they paid for.

   Nothing else.
5. **What is NOT created while frozen:** no wallet credit (available or held), earning, commission, referral credit,
   escrow hold or release, payout or refund. Not even for a duplicate or unmatched payment.
6. **Deferred-accounting queue** (new collection, e.g. `frozen_accounting_queue`):
   - **One row per intended downstream effect**, with:
     - `source_event_id`, `order_id`, `reference_id`;
     - `effect_type` (`wallet_credit`, `earning`, `commission`, `referral_credit`, `escrow_hold`, `escrow_release`,
       `refund_review`);
     - `beneficiary_id`, `amount_inr` as computed by the current rules (**for review only**), `currency`, `rule_version`;
     - `status: PENDING_REVIEW`, `created_at`.
   - A unique index on (`source_event_id`, `effect_type`, `beneficiary_id`), so retries never duplicate a row.
   - **No job, cron, startup hook or unfreeze hook may process it.** It is drained only by an explicit admin action,
     **after** a separately authorized unfreeze, one item at a time:
     - re-validate the item;
     - write it through the normal (freeze-checked) helpers;
     - add an audit row with actor and reason.
   - Unfreezing does **not** release anything automatically.
7. **Order of events:** a late "failed" or "dropped" notice never undoes a PAID order. A second payment for an already
   paid item is recorded as `refund_review` in the queue, never auto-refunded.

- **Reference implementation (website, implemented, preview only):**
  - `backend/ai_onboarding.py` `webhook()` / `_refresh_status()`: states, re-read, amount/currency/id match, unknown
    order ignored, failure → 503.
  - `backend/institutional.py` `participant_payment_confirm()`: exact amount, currency and reference match; mismatch
    audited; earlier checkout orders kept; duplicate and not-pending payments recorded once.
  - Tests: `backend/tests/test_p0_inbound_payments.py`.
- **Acceptance tests (staging, sandbox order only):**
  - **T3-1:** the same signed notice ×3 → 1 payment record, 1 event `processed`, 0 wallet, ledger, payout or commission
    rows, and the expected queue rows exactly once.
  - **T3-2:** Cashfree says the amount is ₹1 more, or another currency → not paid, flagged, 0 queue rows.
  - **T3-3:** bad signature → 401. Missing headers → 400. Stale timestamp → 400. Non-UTF-8 → 400. No writes.
  - **T3-4:** Cashfree unreachable during processing → 503 and event `failed`. The redelivery succeeds once.
  - **T3-5:** unknown order id → 200 `ignored`, no Cashfree call, no writes.
  - **T3-6:** a late FAILED after a PAID → still PAID.
  - **T3-7:** freeze on for 24 h of staging traffic → 0 new wallet, ledger, payout, refund or commission rows.
    Queue rows equal the expected effects.

## MB-4 (P0) — jobs, sweeps and retries obey the freeze
**Recommendation — not implemented.**

- **Change:** each scheduled, retried or startup job checks the freeze (MB-1 helper) **inside** the job, before
  reading candidates. Covered:
  - payout sweep cooling → eligible;
  - `bookings/check-expired-pilots`;
  - `one-on-one/auto-expire-unresponsive` (refunds);
  - `empanelment/claims/sweep-fallback`;
  - pilot and commission completion;
  - referral digest and credit jobs;
  - Cashfree refund or payout status pollers;
  - any retry queue that re-runs a money helper.

  If frozen, log `skipped: frozen` with a count, and change nothing.
- **Why:** jobs don't pass through any route, so neither our gateway nor a route-level guard stops them. The audit
  (F8) could not check them from outside.
- **Acceptance tests:**
  - **T4-1:** freeze on, trigger each job once (and let one scheduled run happen) → 0 changes and a skip log line.
  - **T4-2:** freeze on, a queued retry of a payout or refund → not executed and still queued.
- **Done when:** T4-1 and T4-2 pass, and the list of jobs is attached to the reply.

## MB-5 (P1) — Cashfree production authentication (authorized administrator only)
**Recommendation — not implemented. Paid checkout on the main backend is treated as UNAVAILABLE until this is done.**

- **Finding:** the diag says the environment is production, the credentials are configured and the key type matches
  production, but **Cashfree rejects them (401 "authentication Failed")**. This is not a sandbox-versus-live mix-up.
- **Steps (an authorized administrator, on the Cashfree production dashboard and the main-backend secret store; nobody
  else handles the values):**
  1. Take the App ID and Secret from the **same** production app. Regenerate the secret if unsure.
  2. Confirm Payment Gateway production access is active (KYC and activation).
  3. Turn IP allow-listing off, or add the backend's outgoing IP.
  4. Store the values again (no spaces or new lines) and restart.
  5. **Create no order.** Only the auth check runs.
- **Acceptance:** the admin diag through the website shows `credentials_accepted_by_cashfree: true`. Paid checkout is
  re-enabled only after a separate founder go-ahead.

## MB-6 (P2) — Cashfree diag admin-only on the main-backend host
**Recommendation — not implemented** (a website-gateway version is implemented in preview, not yet published:
`backend/cashfree_diag.py`).

- **Change:** `GET payments/cashfree/diag` requires an admin, checked on every call. It returns only `environment`,
  `credentials_configured`, `credential_type_matches_environment` and `credentials_accepted_by_cashfree`, with no ids,
  prefixes or URLs. The Cashfree check is cached for at least 60 s, with one call at a time.
- **Why:** the main host still shows the environment, the last 4 of the client id, the key prefix and the URLs to
  anyone, and pings Cashfree on every request (audit D-4).
- **Tests:**
  - **T6-1:** signed out → 401, teacher → 403, admin → the 4 fields only.
  - **T6-2:** two admin calls within 60 s → one Cashfree call.

## MB-7 (P2) — Cohort Segments counts
**Recommendation — not implemented.** The website dashboard is **deferred** until this is fixed and reconciled.

- **Finding:**
  - `/v1/stats/segments` returns 0 for every period and every bucket, "unknown" included.
  - The same backend reports 15 organisations (`/platform-stats`) and 63 bookings (`/dashboards/admin-stats`).
  - So no record is matched at all. It's a source or filter fault, not a cohort-mapping fault.
- **Likely causes:**
  1. `created_at` stored as text but compared with a date (or the other way round). "All time" still applies
     `until = now`.
  2. The wrong source collections for organisations and group bookings.
  3. A filter that no stored record passes.
- **Change:** confirm the collections and the `created_at` type, apply no date filter for "All time", and compare
  dates as the same type.
- **Tests:**
  - **T7-1:** for "all", organisations equal the authoritative organisation count, and group bookings equal the
    authoritative group-booking count.
  - **T7-2:** the buckets (including "unknown") add up to the totals.
  - **T7-3:** 30d ≤ 90d ≤ 12m ≤ all.

## MB-8 (P1, carried over from the earlier spec, not re-verified)
**Recommendation — not implemented.** Specs and tests are in the financial safety fix spec sent on 25 Oct
(`NOSTOPS_financial_safety_fix_spec.md`):
- **FIN-02:** withdrawal OTP not enforced.
- **FIN-04:** ₹1,062 owed, the wrong-sign row and the 2 synthetic rows. **Do not repair** without founder sign-off.
- **FIN-05:** the 15% fee taken twice, and the 85% "withdrawable" display.
- **FIN-10:** withdrawals never paid out.

---

## What we need back
- For each MB item: the commit or PR, the staging test output for its tests, and confirmation that nothing ran on production.
- The effective `MONEY_OPS_FROZEN` value and the default when it is missing (MB-1).
- The list of jobs covered (MB-4), and the schema plus index of the deferred-accounting queue (MB-3).

## Appendix A — money routes for MB-1 (from the deployed route list, 26 Oct 2026)
**Outbound (money out, payout destination, refund, release, credit, mark-paid):**
- `admin/payouts/approve`, `admin/payouts/reject`, `admin/payouts/list` (GET), `admin/payouts/sweep` (GET)
- `admin/wallet/reconcile` (GET and POST)
- `bookings/check-expired-pilots`, `bookings/{id}/cancel`, `bookings/{id}/complete-pilot`,
  `bookings/{id}/employees/{id}/mark-paid`
- `bookings/{id}/split-agreement/confirm|propose|reject|reset`
- `empanelment/fast-track/{id}/cancel`, `empanelment/fast-track/{id}/decide`, `empanelment/claims/sweep-fallback`
- `group-booking-agreements/{id}/decline`, `gurukul/issue-credit`, `referrals/{id}/status` (PUT)
- `one-on-one/auto-expire-unresponsive`
- `one-on-one/booking/{id}/complete|reassign|student-cancel|teacher-action` (a decline refunds)
- `payments/cashfree/orders/{id}/refunds`
- `retreats/{id}/reservations/{id}/cancel|cancel-with-refund|mark-paid`
- `teacher-referrals/withdraw`
- `teacher-wallet/withdraw`, `withdraw/otp/start`, `withdraw/otp/verify`, `setup-pin`, `change-pin`, `payout-details`
- `teachers/me/payout-request`
- `v1/bookings/{id}/cancel|complete|self-cancel`
- `v1/kyc/bank-verify`, `v1/payments/admin/refund`
- `v1/payouts/withdraw`, `v1/payouts/webhook`
- `v1/referrals/credit|trigger`
- `v1/teachers/me/wallet/bank-account`
- wallet top-up orders on `payments/cashfree/orders`

**Fake payment (MB-2, always 410):** `bookings/{id}/pay`, `empanelment/fast-track/{id}/pay|razorpay-create|razorpay-verify`,
`premium-sessions/book`, `payments/cashfree/mock-checkout/{id}` (+ `/complete`), `payments/razorpay/callback` (GET),
`payments/razorpay/create-order|recover/{id}|verify|verify-payment-link|webhook`.

**Inbound (MB-3 — never frozen, Option B applies):** `payments/cashfree/webhook`, `v1/payments/webhook`,
`payments/cashfree/orders` (not a wallet top-up), `v1/payments/orders`, `retreats/{id}/reserve`, `retreats/{id}/group-book`,
`one-on-one/bookings`, `kyc/sandbox/create-payment|verify-payment`, `empanelment/fast-track/{id}/cashfree-order`,
`international/paypal/webhook`.
