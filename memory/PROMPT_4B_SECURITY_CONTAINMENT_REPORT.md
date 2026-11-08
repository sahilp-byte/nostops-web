# Prompt 4B: payment gateway security containment (report)

**Status:** done in the preview workspace. **Stopped for your review.** Prompt 4C and Prompt 5 have not started.
- **Money lock:** ON. `FINANCIAL_ACTIONS_UNLOCKED` is absent, and `financial_lock.locked()` is `True`.
- **Checkout:** off.
- **Deployment:** nothing was deployed, published or merged.
- **Provider and main-backend calls:** none (§6).

**What success means here:** the website's preview gateway, and the website server's copy of the same rules, now refuse the specified unsafe actions without moving money. **This does not secure production, and it does not secure the main backend, which can be called directly** (§8).

---

## 1. Files changed

| File | Change |
|---|---|
| `backend/financial_lock.py` (gateway lock rules) | **+4 rules**: `payout-initiation` (ALWAYS), `payout-sweep` (ALWAYS), `payment-request` (LOCK) and `legacy-kyc-confirm` (LOCK). `payout-sweep-read` is narrowed to `admin/payouts/list`, because the sweep is now ALWAYS |
| `frontend/lib/financial-lock-rules.ts` (the website server's copy, applied in `backendFetch` to every main-backend call) | The same 4 rules and the same narrowing, in the same order. A parity test proves both copies give identical answers |
| `backend/payment_routing.py` (gateway routing, independent of the lock) | The 3 corporate payment-request actions → **403** `unroutable-payment-request`. `v1/payments/orders` → treated as an order of unknown kind → **400** (`billing-country` / `unknown_flow`). PayPal capture → **503** `paypal-checkout-not-enabled`, the same as create-order |
| `frontend/app/bff/teacher/kyc/[...action]/route.ts` | Comment only. The route still maps `verify-payment`, for traceability; the website lock now refuses it while locked |
| `backend/tests/test_p4b_containment.py` | **New**, 289 offline tests |
| `backend/tests/test_p0_freeze_gateway.py` | `v1/payments/orders` and `kyc/sandbox/verify-payment` are no longer listed as "money coming in, never refused" |
| `backend/tests/test_p2a_payment_routing.py`, `test_p2b_checkout_routing.py` | 4 tests that pinned the **old** behaviour (PayPal capture forwarded in production; Razorpay confirm forwarded) now pin the new behaviour. The rollback path is kept and tested |
| `backend/tests/test_p2g_isolation.py` | The reviewed read-only list gained 1 entry: `test_reports/p4a/gateway_matrix.py`. That script makes **no network request** (0 request calls in its source); the preview hostname appears only as a header value fed to pure functions. Stated openly: this is an addition to the guard's reviewed list, not a change to how the guard works |
| `backend/tests/workflow/test_wf_financial_safety.py` | Expected rule IDs updated for the payout rules. **Not run** (see §5) |

No other file changed. Nothing in the main backend, production configuration, provider settings, `.env` files or data was touched.

---

## 2. The five payment actions: before and after

All five are `POST`. No website page or website server code calls any of them; they could only be reached directly through the public `/api` gateway.

| Route | What it does (from the main backend's saved API docs) | Before (production code path) | After: locked | After: unlocked |
|---|---|---|---|---|
| `/api/v1/payments/orders` | Creates a Cashfree order for a pending v1 booking | **Forwarded**, with no country check | **423** `payment-request` | **400**: an order of unknown kind (only a booking is named, so no route or currency can be established) |
| `/api/bookings/{id}/close-and-request-payment` | Closes a corporate batch and sends payment requests | **Forwarded** | **423** `payment-request` | **403** `unroutable-payment-request` |
| `/api/bookings/{id}/send-payment-requests` | Bulk payment request to a batch's participants | **Forwarded** | **423** `payment-request` | **403** `unroutable-payment-request` |
| `/api/bookings/hr/send-all-payment-requests` | The same, across every batch an HR user owns | **Forwarded** | **423** `payment-request` | **403** `unroutable-payment-request` |
| `/api/international/paypal/capture/{id}` | Captures a PayPal order | **Forwarded** | **423** `payment-request` | **503** `paypal-checkout-not-enabled` (the same as create-order) |

**Order of checks.** The lock check runs **first**, before the admin role check or any other upstream call, followed by the routing check. There is no fallback to another provider, and every refusal says "nothing was sent and nothing changed". No secret is returned: tests assert that no `secret` or `client_id` text appears in the response.

**Preview** already refused all five before this change (preview payment guard 503). They now get 423 there too, because the lock answers first.

**Offline gateway matrix, re-run** (`test_reports/p4a/gateway_matrix_after_p4b.*`):
- Production writes forwarded with an India billing country went from **21 to 15**.
- The 15 still forwarded are:
  - **7 routing-checked** order or hold routes. Each is refused with no country (400) and with US (422).
  - **8 non-payment** routes: identity checks, Fast-Track claim and schedule, group-agreement generate and accept, and a media webhook.
- From preview: still **0**.

---

## 3. Payouts and settlements

**Refused permanently (ALWAYS: 423 "This action is not available", lock or no lock):**

| Route | Rule |
|---|---|
| `POST /api/v1/payouts/withdraw` ("Initiate Payout") | `payout-initiation` |
| `POST /api/teacher-wallet/withdraw`, plus `/withdraw/otp/start` and `/withdraw/otp/verify` | `payout-initiation` |
| `POST /api/teachers/me/payout-request` | `payout-initiation` |
| `POST /api/teacher-referrals/withdraw` | `payout-initiation` |
| `POST /api/admin/payouts/approve` | `payout-initiation` |
| `GET` / `POST /api/admin/payouts/sweep` ("Trigger Sweep") | `payout-sweep` |

These are also refused under path variants: trailing slash, double slash, upper case and an encoded slash.

**Read-only history stays open** (tested, locked and unlocked; forwarded to the fake main backend):
- `GET v1/payouts/{transfer_id}`
- `teachers/me/payouts` and `payouts/report`
- `retreats/payouts/mine` and `admin/retreats/payouts`
- `teacher-wallet/balance`, `transactions`, `unified-summary`, `pin-status` and `payout-details`
- `v1/teachers/me/wallet` and `v1/teachers/{id}/wallet`, both with `/transactions`
- `mentor/me/wallet`
- `teachers/me/commission-tier`
- `admin/wallet/anomalies`

**Left under the existing temporary lock, unchanged,** because it isn't clear whether they start something or only read (your decision). Each is pinned by a test: refused while locked, and **not** made permanent.
- `GET admin/payouts/list`: a read that also runs the sweep.
- `POST admin/payouts/reject`.
- `admin/wallet/reconcile`.
- Payout destination setup: `teacher-wallet/payout-details` (POST), `setup-pin`, `change-pin` and `v1/teachers/me/wallet/bank-account`.
- `v1/payouts/webhook`: an incoming status update.
- Session completion and split actions: `one-on-one/booking/{id}/complete`, `bookings/{id}/split-agreement/*`, `empanelment/claims/sweep-fallback` and `empanelment/fast-track/{id}/decide`.

No payout feature was built, no alternative payout provider was added, and no historical payout or settlement record was touched.

**Visible effect on the website:** the teacher withdrawal and payout-request actions, and the admin payout approval, now show "This action is not available. Nothing was sent and nothing changed." This replaces the temporary "money actions are paused" text. History pages are unchanged.

---

## 4. Legacy Razorpay InstaKYC confirmation (`POST /api/kyc/sandbox/verify-payment`)

- **Now:** refused **while the lock is on**, on every host (**423** `legacy-kyc-confirm`), whatever the request body claims. The same applies in the website server (`/bff/teacher/kyc/verify-payment`). Nothing is forwarded, so no confirmation or ledger record can be created through this website.
- **Kept:** the Razorpay code, credentials, the route mapping and every historical record and audit log. No call was made to Razorpay.
- **Current verification mechanism** (from the main backend's own API docs, not checked live): the main backend asks Razorpay for the teacher's most recent InstaKYC payment link, and sets `kyc_paid = true` when Razorpay reports it paid. The browser's word is not used.
- **Consequence (as you accepted):**
  - Teachers who paid a Razorpay link before 27 Oct and haven't confirmed **will not be confirmed until the lock is lifted**.
  - Any manual reconciliation needs a **separate, authorised process** using authoritative records, from the Razorpay dashboard and the main backend.
  - How many are waiting is unknown, because that data is in the main backend.
- **Before any future reactivation**, check:
  1. the number of unconfirmed paid links, from Razorpay and the main backend
  2. that the main backend matches the link to the right teacher, amount and currency
  3. that the main backend's confirmation is idempotent
  4. that no new link can be created (`kyc/sandbox/create-payment` is still 410)
  5. a written rollback

  Rollback is simply the approved unlock: the route is forwarded again in production only, and this is tested.
- **A redirect is not proof.** The Razorpay return callback (`payments/razorpay/callback`) stays refused permanently, so a GET carrying `status=paid` gets 423 and nothing is forwarded. The website's return pages confirm only through a server-side re-read of the order; this is tested from source.

---

## 5. Tests

| Run | Result |
|---|---|
| `tests/test_p4b_containment.py` (new) | **289 passed** |
| Full offline regression (P0, P2A–P2G, P3, P3C, P4B) | **2,139 passed, 0 failed, 12 skipped.** The 12 are skipped by design: 8 run only against a Cashfree sandbox and 4 are inventory rows reviewed as "records no money" |
| Website/gateway rule parity (inside pytest, via `node tests/verify_financial_lock.ts`) | Identical answers in every case |
| Frontend checks (checkout routing, booking holds, preview isolation, phase A, InstaKYC pricing) | All passed |
| `tsc --noEmit` / `eslint` (changed frontend files) | exit 0 / 0 problems |
| Offline gateway matrix, re-run | 15 production writes forwarded (was 21); 0 from preview |

**Tamper coverage** (all refused, with zero calls to the fake main backend):
- Each of the five routes was tried on a production host and a preview host, locked and unlocked.
- Each run combined:
  - 5 path variants (plain, trailing slash, double slash, upper case, encoded slash)
  - 5 billing-country headers (none, IN, US, `zz`, `IN, US`)
  - 5 bodies (empty, INR and Cashfree, USD and PayPal, a fake "PAID" status with price, not-JSON)
  - 2 query strings
- That makes 2,500 requests per route.
- A grid of 15 countries × 10 currencies × 5 providers × every flow only ever allows **India + Cashfree + INR**.

**Deliberately not run**, because they sign in to or call the main backend, or target the live preview:
- `tests/workflow/*`, including `test_wf_financial_safety.py`, whose expected IDs were updated
- `test_iter9_features.py`
- `scripts/fin_verify_fixes.py`, `scripts/prod_postdeploy_audit.py` and `scripts/fin_audit_probe.py`

---

## 6. Side effects

- **Persistent data:** none changed. The demo-data snapshot was **identical** across the backend reloads caused by the edits (`s20` → `s21`) and across the final regression run (`s22` → `s23`). It covers the demo scope, the audit log, counters and every collection count.
- **Timestamps and counters:** unchanged (inside the snapshot).
- **Logs:** only the normal backend reload lines in the supervisor log. The test error monitor kept 0 events and blocked 0 alerts; monitoring writes were disabled in the new tests.
- **Emails and alerts:** none.
- **External calls:** **no call to Cashfree, PayPal, Razorpay or the main backend.**
  - The new tests use a fake main backend (MockTransport) and record zero upstream calls on every refusal.
  - The network log for the whole run shows exactly 1 outside connection: the existing check that the preview URL refuses an unsigned call (`test_p3_pricing_live`, the preview's own 401). It reaches no provider or main backend.

---

## 7. Out of scope (follow-ups, not done)

- PayPal Checkout integration.
- Cashfree sandbox configuration or API calls (C6, TVR-24).
- Production security fixes; production was not checked.
- Hardening direct calls to the main backend `pro-learn-connect-1`.
- Automatic payment confirmation for paid events (R7).
- Refund processing.
- Teacher payouts or settlements, including reviewing the ambiguous routes in §3.
- A trusted billing-country source: the dropdown is still only the customer's statement. Nothing here treats it as proof, and anything that can't be validated fails closed.
- Tax and commercial pricing decisions.
- Removing Razorpay.
- Deployment or publishing.

---

## 8. Remaining production and main-backend exposure

1. **The main backend is a separate public service** (**I**). Anyone who calls it directly bypasses every rule here: the five actions, payouts and the Razorpay confirmation. These changes protect only traffic through this website's gateway and website server.
2. **Production runs whatever was last deployed.** These rules take effect there only after a separately approved deployment.
3. In production, **India order and hold routes are still forwarded** (7 routes, all routing-checked), following the earlier founder decision that incoming payments pass the lock.
4. **The ambiguous payout and settlement routes** in §3 are refused only while the lock is on.
5. **Unsigned or forged Cashfree notifications to the main backend:** the gateway checks only that signature headers are present; the HMAC check happens upstream (**I**).
6. **The main backend's PayPal notification route** may accept unsigned events when its webhook ID is unset (**I**, from its saved docs).
7. **The preview `.env` holds production-mode Cashfree credentials** (C6).
8. **Legacy InstaKYC confirmations** are now delayed (§4).

---

## 9. Evidence needed before each future stage

| Stage | Evidence needed first |
|---|---|
| 4C, billing-country source | Which authoritative country each journey has (account profile, KYC, invoice address); how the customer confirms it; where it is recorded on the order |
| Order and state-machine records | A written state model approved; a throwaway database for tests; price-version and routing-decision fields agreed |
| Cashfree sandbox | Sandbox keys stored as secrets; `WEB_APP_BASE_URL` and `CASHFREE_CHECKOUT_ORIGIN` set for preview only; a written rollback |
| PayPal sandbox | Account details confirmed (REST app, Orders v2, webhook ID, receiving currency, purpose code / FIRC); US$30 price and tax approved |
| Payout and settlement review | The main-backend owner explains read versus write for each §3 route; payout capability decision (none today) |
| Lifting the lock, for any flow | Explicit founder approval per flow; the matrix re-run; the residual-risk list accepted |
| Main-backend hardening | The main-backend owner's change plan; it can't be done from this workspace |
| Production | A separate deployment approval, after the items above |

**Evidence files** (in `/app/test_reports/p4a/`):
- `p4b_regression.log` and `p4b_net_external.jsonl`
- `gateway_matrix_after_p4b.{log,json}` (the Stage A run's summary is in `gateway_matrix.log`)
- `p4b_tsc.log`, `p4b_eslint.log` and `p4b_fe_*.log`
- snapshots `s20`–`s23`
