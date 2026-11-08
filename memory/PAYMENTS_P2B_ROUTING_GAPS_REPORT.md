# NOSTOPS Payments — Prompt 2B: Close Remaining Payment Routing Gaps (deliverable report)

**Status:** done in **preview only**. Nothing was deployed or published, and no production setting was changed.
**Money lock:** ON (`FINANCIAL_ACTIONS_UNLOCKED` is absent, so `financial_lock.locked() = True`).
**Checkout:** still off in preview. Every India checkout stops at the preview test-mode guard (503).
**Prompt 3:** not started. It waits for your review and explicit approval.
**External main backend (`pro-learn-connect-1`):** not modified. Its PayPal webhook security stays **BLOCKED**.
**Policy:** one server-side rule, `backend/payment_routing.py`, version `2026-10-27.1`.
**Dates:** times are from the container clock (28 Oct 2026).

---

## 0. The iteration-187 Fast-Track finding: fixed and verified

**What was wrong:**
- The Fast-Track BFF checked the billing country only on the *payment* step (`/{id}/cashfree-order`).
- The *application* step (`/initiate`) skipped the country check and the preview guard, and went straight to the main backend.
- That step creates the paid Fast-Track request (`pending_payment`) upstream.
- A request with a missing or bad country, or from outside India, was therefore forwarded upstream, and in production it could create a request record.
- The first reproduction this session confirmed it: unauthenticated `POST /bff/teacher/empanelment/fast-track/initiate` reached the main backend, which answered `401 Not authenticated`.
- Signed in, the same request could create the record or fail upstream (the reported 500).

**What changed:**
- **BFF route** (`frontend/app/bff/teacher/empanelment/fast-track/[...action]/route.ts`): `initiate` now runs the same two server-side checks as `cashfree-order`, before anything is sent upstream:
  1. The billing-country routing check.
  2. The preview payment guard.
- If both pass (India only, not preview), the application is forwarded with `X-Billing-Country: IN`. The `billing_country`, `currency` and `provider` fields are taken out of the body first.
- **Form** (`FastTrackApply.tsx`): the application submit now sends the chosen billing country.

**Documented error responses (all journeys, Fast-Track included):**
- Every refusal has the body `{"error": "<message>", "routing_refused": true, "reason": "<code>"}`.
- Every message ends with "No payment has been taken."
- With any of these, no request is created, no order is created, and no provider is called.

| HTTP | `reason` | When |
|---|---|---|
| 400 | `billing_country_required` | Country missing or empty, or the body is not JSON, `null`, a list or a bare string |
| 400 | `billing_country_invalid` | Not an ISO country code: `"India"`, `"XX"`, `91`, `["IN"]`, `{"code":"IN"}` |
| 400 | `currency_invalid` | A malformed or non-text currency: `"RUPEE"`, `840`, `["INR"]` |
| 400 | `provider_invalid` | An unknown or non-text provider: `"stripe"`, `["cashfree"]` |
| 422 | `currency_not_supported` | India with any currency except INR |
| 422 | `provider_conflict` | India with PayPal, or outside India with Cashfree |
| 422 | `international_not_offered` | Any country outside India (these six products have no approved international price) |
| 422 | `provider_not_supported_in_country` | A country PayPal doesn't serve (CU, IR, KP, SY, RU) |
| 503 | *(routing unavailable)* | The routing policy can't be reached, or it answered anything except "India → Cashfree, INR" (fail closed) |
| 503 | `payments_disabled: true` | India passed routing, and the preview test-mode guard stopped it |
| 403 | — | No CSRF token (nothing runs) |
| 423 | — | Wallet top-up (money lock) |

**Verified live**, signed in as `qa.organic.teacher` and calling the endpoint directly (no form):

| Body sent | Result |
|---|---|
| `{}` | 400 `billing_country_required` |
| `XX` | 400 `billing_country_invalid` |
| `US` | 422 `international_not_offered` |
| `IN` + `USD` | 422 `currency_not_supported` |
| `IN` + `paypal` | 422 `provider_conflict` |
| `["IN"]` | 400 `billing_country_invalid` |
| `IN` | 503 `payments_disabled` |

After these calls the teacher still had **no** Fast-Track request: the form was still offered and no status card was shown.

## 1. Files changed (all of Prompt 2B, preview only)

**New:**
- `frontend/lib/server/payment-routing.ts`: `routeCashfreeCheckout()`. It asks `/api/payment-routing/decide` (shared secret) and refuses unless the answer is exactly IN → Cashfree, INR. If the policy can't be reached, it refuses (fail closed).
  - *This session:* the hard-coded default URL is removed (missing config means refused).
  - *This session:* non-text values are sent in their JSON form, so they are always refused as invalid.
- `frontend/components/payments/BillingCountryField.tsx`: the billing-country select. It has no default and is never guessed from IP, phone or language. It also holds `DomesticOnlyNotice` and `routingButtonLabel()`.
- Tests:
  - `backend/tests/test_p2b_checkout_routing.py` (offline)
  - `backend/tests/test_p2b_bff_live.py` (live, refusal-only)
  - `backend/tests/test_p2b_gap_checks.py` (live, added by the testing agent)
  - `frontend/tests/verify_checkout_routing.ts` and `frontend/tests/server-only-hook.mjs` (real BFF handlers, network intercepted)

**Website BFF (server-side enforcement):**
- `frontend/app/bff/payments/cashfree/orders/route.ts`: 1:1 session and InstaKYC (and wallet, which stays locked with 423).
- `frontend/app/bff/institutional/participant/payment/order/route.ts`: event fee. It accepts INR intents only and records the billing country on attach.
- `frontend/app/bff/retreats/[id]/reservations/[rid]/pay/route.ts`: retreat seat.
- `frontend/app/bff/teacher/empanelment/fast-track/[...action]/route.ts`: Fast-Track. *This session:* `initiate` is now routed and guarded too.
- `frontend/app/bff/booking-invite/[token]/[action]/route.ts`: group invitation. It forwards the email only.

**Backend (website gateway and engine, not the main backend):**
- `backend/payment_routing.py`:
  - Gateway rule: an order-creation route needs `X-Billing-Country: IN` (INR, Cashfree).
  - Gateway rule: creating a payment link → 410.
  - Gateway rule: `international/paypal/create-order` → 503.
  - *This session:* any other Cashfree "order" write path fails closed (`v1/…`, `…;x`, `…/create-order`, `…/cashfree-order/retry`).
  - *This session:* a non-text currency is refused (400).
  - *This session:* a claimed currency is now checked on every order route, not only `payments/cashfree/orders`.
  - *This session:* the `currency_invalid` message now ends with "No payment has been taken".
  - *This session:* the docstring is corrected. Recording a decision is available but not called yet.
- `backend/server.py`: the gateway calls `gateway_checkout_refusal()` after the money lock and the 2A routing refusals.
- `backend/institutional.py`: the event-fee attach stores the billing country (`payment_routing.billing_country`).

**UI and disclosures:**
- `CashfreePayButton.tsx`, `ParticipantPayStep.tsx`, `RetreatReserve.tsx`, `PayNow.tsx`, `FastTrackApply.tsx`, `app/app/reservations/page.tsx`, `AiOnboardingPurchase.tsx` (billing-country step)
- `TeacherCard.tsx`, `BookJourney.tsx`, `app/app/discover/page.tsx`, `UnifiedVerification.tsx`
- `app/(public)/venues/page.tsx`, `app/(public)/venues/ai-onboarding/page.tsx`, `app/(public)/list-your-venue/page.tsx`
- `frontend/lib/payment-routing.ts` (message copy)
- **Deleted:** `frontend/lib/currency.ts`. It held the indicative 83.5 INR→USD conversion.
- *This session:*
  - `/app/reservations` now uses `routingButtonLabel()` like the other checkouts.
  - Disabled pay buttons are readable: slate-700 on slate-200 (about 8:1) instead of white text at 60% opacity (about 2:1).
  - `UnifiedVerification` no longer has a code path that could print a `US$` price.

**Tests and config touched:**
- `backend/tests/test_p2a_payment_routing.py`: the PayPal create-order expectation now includes the new 503 rule.
- `backend/tests/test_participant_paid_payment_chain.py`: *this session.* The anti-poaching test sends `billing_country: IN`, because routing now runs first.
- `frontend/package.json`: adds the `test:checkout-routing` script only. No dependency was added.

*`frontend/yarn.lock` was already modified before Prompt 2A and was left as found. It adds lock entries for the devDependencies already declared (`eslint`, `eslint-config-next`). No new package.*

## 2. Six-journey routing matrix (enforced server-side; the browser can't change it)

| # | Journey | Website page / component | BFF route (checked first) | Policy flow | Main-backend call made only if allowed |
|---|---|---|---|---|---|
| 1 | 1:1 session | Teacher booking → `CashfreePayButton` | `POST /bff/payments/cashfree/orders` (`orderType=one_on_one`) | `one_on_one` | `POST /payments/cashfree/orders` (`order_type=one_on_one`) + `X-Billing-Country: IN` |
| 2 | Event fee | `/events/…/register` → `ParticipantPayStep` | `POST /bff/institutional/participant/payment/order` | `event_fee` | Engine intent (INR only) → `POST /payments/cashfree/orders` (`institutional_event`) + header; the attach records `billing_country=IN` |
| 3 | Retreat seat | `RetreatReserve` pay step, `/app/reservations` | `POST /bff/retreats/[id]/reservations/[rid]/pay` | `retreat_seat` | `POST /retreats/{id}/reservations/{rid}/cashfree-order` + header |
| 4 | Empanelment Fast-Track | `/app/teacher/empanelment/fast-track` → `FastTrackApply` | `POST /bff/teacher/empanelment/fast-track/initiate` **(new this session)** and `/{id}/cashfree-order` | `fast_track` | `POST /empanelment/fast-track/initiate`, then `/empanelment/fast-track/{id}/cashfree-order`, both + header |
| 5 | InstaKYC | InstaKYC page → `CashfreePayButton` (₹279, server-side price) | `POST /bff/payments/cashfree/orders` (`orderType=instakyc`) | `instakyc` | `POST /payments/cashfree/orders` (`order_type=instakyc`) + header |
| 6 | Group booking invitation | `/booking-invite/[token]` → `PayNow` | `POST /bff/booking-invite/[token]/cashfree-order` | `group_invite` | `POST /bookings/invite/{token}/cashfree-order` + header (email only) |

**Result for every journey:**

| Billing country | Result |
|---|---|
| India, INR, Cashfree | **Allowed.** Preview: stopped at the 503 test-mode guard. Production (only after an approved publish): Cashfree order in INR, sent with `X-Billing-Country: IN`. |
| Any other valid country | **422 `international_not_offered`** (or `provider_not_supported_in_country`). There is no PayPal option for these six, and no converted price. |
| Missing or invalid | **400**, as in the table in section 0. |
| PayPal (any host) | Not available. `international/paypal/create-order` → 503 at the gateway, and `PAYPAL_CHECKOUT_FLOWS` is empty. |

**Razorpay InstaKYC continuity (unchanged from 2A):**
- `kyc/sandbox/create-payment` → 410 at the gateway; the BFF route returns 404.
- `kyc/sandbox/verify-payment` is **kept**, so a link paid earlier can still be confirmed.
- The `LEGACY_RAZORPAY_KYC_CHECKOUT=allow` switch still works.

**Gateway coverage (any caller using `www.nostops.org/api/*`):**
- The same six order routes need `X-Billing-Country: IN`.
- A path variant (case, `//`, encoded, `v1/` prefix, `;x` suffix, another "order" name) is checked the same way or refused.

## 3. Public pricing disclosures corrected

| Where | Before | Now |
|---|---|---|
| `/app/discover` teacher cards (`TeacherCard`) | Showed an indicative `$` price (₹ ÷ 83.5) to visitors outside India | No `$` figure. They see "Paid in ₹ · India billing address only for now". The conversion file is deleted. |
| `BookJourney` (1:1) and the discover hero | No international note | "International payment isn't available yet: sessions are paid in ₹ with an India billing address for now." |
| `/venues` FAQ and Tier 2 price note | "US$30 internationally", "International: US$30 one-time" | "The international price is US$30, but international checkout is temporarily unavailable while PayPal checkout is being prepared." / "International: US$30 (checkout temporarily unavailable)" |
| `/venues/ai-onboarding` description and meta | "…or US$30 internationally." | "International price US$30 — international checkout is temporarily unavailable while PayPal checkout is being prepared." The button reads "International checkout unavailable". |
| `/list-your-venue` | "International US$30 one-time." | "International US$30 — international checkout is temporarily unavailable while PayPal checkout is being prepared." |
| All six checkouts (pay step) | No country step | A billing-country select with no default. Outside India: amber notice "International payment isn't available for this yet … No payment has been taken." The button reads "International payment not available". |
| Get Verified + Empanelled card (`UnifiedVerification`) | Could print `US$…` if the main backend ever sent a USD price | Shows a ₹ price only. |

The US$30 venue AI-onboarding price is still *named* (it is an approved price), but it is no longer claimed to be available to buy. The exact wording is your decision before PayPal goes live.

## 4. Test results (separated by what was actually run)

### 4a. Verified: run this session, after the fix, all passing

| Suite | Result |
|---|---|
| Offline backend payment suites (8 files: `test_p2b_checkout_routing`, `test_p2a_payment_routing`, `test_p0_freeze_gateway`, `test_p0_inbound_payments`, `test_p0_razorpay_callback`, `test_p0_cashfree_diag`, `test_cashfree_sandbox_guard`, `test_participant_paid_payment_chain`) | **931 passed, 13 skipped, 0 failed** |
| · `test_p2b_checkout_routing.py` (mock upstream, throwaway DB) | **277 passed** (was 230; +47 new: other order paths fail closed, webhook not treated as an order, non-text currency ×36, claimed currency on every order route) |
| · `test_p2a_payment_routing.py` | **197 passed** |
| Live preview BFF and gateway, refusal-only (`test_p2b_bff_live`, `test_p2b_gap_checks`, `test_p2a_http_live`) | **196 passed, 0 failed** |
| · `test_p2b_bff_live.py` | **88 passed** (was 54; adds the Fast-Track application journey, list or numeric country/currency, unreadable bodies) |
| `frontend/tests/verify_checkout_routing.ts` (real BFF handlers + the real local policy; every other network call intercepted and counted) | **291 checks passed** (was 185). Each refusal makes exactly 1 policy call and 0 other calls. |
| `test:pricing` (InstaKYC ₹279) | passed |
| `test:lyv` | 22/22 |
| TypeScript `tsc --noEmit` | 0 errors |
| ESLint on the changed files | 0 issues |
| Live browser, 390×844, signed in as `qa.organic.teacher`: Fast-Track | No country → "Select your billing country to continue". US → disabled "International payment not available" plus the notice (readable grey style). IN → "Submit & pay ₹4,999 →". Not submitted. |
| Live browser: `/app/reservations` (temporary localStorage-only reservation, removed afterwards) | No country / GB / IN → correct labels |
| Live browser: Fast-Track application bypass | As listed in section 0 |
| testing_agent iteration 187 (before this session's fix) | UI for the other journeys, disclosures, gateway refusals and Razorpay continuity all passed. Its 3 backend items, 1 UI item, 1 design item and 4 code-review notes are all fixed (sections 0–1). |

### 4b. Skipped (with reason)
- **12**, `test_p0_freeze_gateway`: the reviewed `LEFT_OPEN` routes, which record no money. Unchanged since P0.
- **1**, the anti-poaching ownership check (`test_participant_paid_payment_chain`): the preview guard (503) stops the request before the ownership check runs. That check runs only on production or sandbox. The routing step before it was verified.

### 4c. Failing, pre-existing, not caused by Prompt 2B
- `test:tier2`, 2 stale source checks. They expect `/venues/ai-onboarding` to say "free / no checkout", but that page has sold a paid ₹2,359 product since before Prompt 2A. Both fail the same way on the Prompt 2A commit.

### 4d. Blocked or untested (not claimed as working)
- **A real Cashfree order (sandbox or live) for any of the six journeys:** not run. The preview guard, the money lock and the missing sandbox keys all prevent it. The "India allowed" path is verified only up to the preview guard, plus the gateway forwarding test against a *mock* upstream.
- **The Fast-Track forwarded body on a production host** (routing fields removed, `X-Billing-Country: IN` added): checked by **code review only**. Running it would create a real upstream request.
- **The main backend honouring `X-Billing-Country`:** external, so it can't be tested here.
- **Direct callers of the main backend** (mobile app, scripts): they bypass the website and its gateway. Not covered.
- **PayPal checkout, capture and webhooks:** blocked (not built or approved).
- **`tests/workflow/test_wf_ai_onboarding.py`:** not re-run this session. It needs Cashfree sandbox keys, and this change doesn't touch it.

## 5. Financial lock and "nothing real happened": evidence

**Lock and settings:**
- `FINANCIAL_ACTIONS_UNLOCKED` is absent from `backend/.env` and `frontend/.env`, so `financial_lock.locked()` prints `True`.
- The wallet top-up is refused with 423 (tested both offline and through the BFF).
- No `.env` value, production setting, deployment or publish was changed this session.

**No provider calls and no transactions:**
- The offline suites use a mock upstream or an intercepted `fetch`.
- Every live check was refused before the main backend (400/422/503/403).
- The only main-backend calls made in live checks were sign-in and page reads.
- One disclosure: before the fix, 4 unauthenticated reproduction requests to `/initiate` reached the main backend and were rejected `401 Not authenticated`. No record was created.

**Database (website, local):**

| Collection or check | State |
|---|---|
| `payment_routing_decisions` | 0 |
| `ai_onboarding_orders` | 0 |
| `inst_settlements` | 0 |
| `audit_ledger` | 0 |
| Registrations with a payment order | 0 |
| `verification_payments` | 6 rows, none touched in the last 6 h |

- `ai_onboarding_webhook_events` gained 4 rows at 04:53–04:54 UTC. They were written by the existing `test_p0_inbound_payments.py` fixtures, which send unsigned or unknown-order webhooks. All 4 are status `ignored`, note `unknown_order`, and are tied to no order and no money. I left them in place rather than delete records.
- The temporary QA event, org and participants created by `test_participant_paid_payment_chain` this session were removed by its cleanup.
- 8 older "QA Poach A" participant rows from earlier sessions (7–23 Oct) remain, untouched.

**Upstream:** no historical financial record was changed, and no Fast-Track request was created for the QA teacher.

## 6. Remaining blockers and external main-backend dependencies

**External main backend (`pro-learn-connect-1`): BLOCKED. This workspace can't change it, and I did not.**
1. **The main backend must enforce the routing rule itself.**
   - The website BFF calls the main backend *directly* (`BACKEND_URL`), so the BFF check is the website's enforcement.
   - The `/api` gateway check covers only callers that use `www.nostops.org/api`.
   - Upstream must refuse unless the billing country is IN and the currency INR on: `POST /payments/cashfree/orders` (one_on_one, instakyc, institutional_event), `/retreats/{id}/reservations/{rid}/cashfree-order`, `/empanelment/fast-track/initiate`, `/empanelment/fast-track/{id}/cashfree-order` and `/bookings/invite/{token}/cashfree-order`.
   - It should also refuse any order for these products in another currency.
2. **PayPal webhook security: BLOCKED until the owner implements and verifies it.** The 2A specification stands:
   - Refuse when `PAYPAL_WEBHOOK_ID` is unset.
   - Verify every event with `verify-webhook-signature` on the raw body, and check `payee.merchant_id`.
   - De-duplicate by event id, and ignore out-of-order events.
   - Never apply REFUNDED or REVERSED while the lock is on.
   - Route PayPal through the website gateway, or apply the same checks upstream.
3. **PayPal capture:** require the booking owner's session, and check amount, currency and booking against the server price.
4. **Refuse `POST /payments/cashfree/international/create-order` upstream** (the gateway already refuses it).
5. **Razorpay InstaKYC retirement:** list and expire the open links, then retire `verify-payment`. Keep `razorpay_*` history read-only.
6. **Confirm production config:** `PAYPAL_WEBHOOK_ID`, the registered webhook URL, and the Cashfree account in use.

**Website, open (need your decision; not changed in 2B):**
- **1:1 booking and retreat seat hold come before the country question.**
  - Both are created *before* the pay step asks for the billing country. This creates no order and no money.
  - After a publish, though, a buyer outside India could create a pending booking or seat hold and only then be refused at payment.
  - Options: ask the country at booking or hold time (as Fast-Track now does), or keep it as it is. A seat hold can also be paid off-platform through the host, which is why it was not changed.
- **Routing decisions are not stored per order yet.** The `record` / `attach` API exists, but no checkout calls it.
- **From the audit, still open:**
  - No webhook or reconciler for event-fee payments (R7).
  - Two simultaneous venue checkouts can create two orders (TVR-24).
  - The InstaKYC price is set in two places (R6).
- **Final wording for the named US$30 venue AI-onboarding price,** before PayPal goes live.

**Still blocked (unchanged):** PayPal integration (Prompt 3, awaiting approval), B4.9 Payouts and Billing, B5.2 Tax/Legal wording.
