# NOSTOPS Payments — Prompt 2C: Prevent Ineligible Booking Holds and Verify Backend Boundaries (deliverable report)

**Status:** done in **preview only**. Nothing was published or deployed, and no production setting was changed.
**Money lock:** ON. `FINANCIAL_ACTIONS_UNLOCKED` is absent from `backend/.env` and `frontend/.env`, so `financial_lock.locked()` returns `True`.
**Checkout:** still disabled in preview. India requests that pass routing stop at the preview test-mode guard (503); wallet top-up and payouts stay refused (423).
**Prompt 3:** not started. It waits for your review and explicit approval.
**External main backend (`pro-learn-connect-1`):** not modified. Everything that depends on it is marked **UNVERIFIED** or **BLOCKED** in section 6.
**Founder decisions applied:**
- No holds outside India for now.
- Buyers outside India get "Message the host" (WhatsApp link kept as it is).
- "Join the waitlist" only when a retreat is sold out.
- Paid events and group batches get the message option too.

**Dates:** container clock, 28 Oct 2026.

---

## 1. Files and endpoints changed

### 1a. Endpoints (website only)

| Endpoint | Change |
|---|---|
| `POST /bff/one-on-one/bookings` | Billing country checked **first** (`one_on_one`, hold). Then the preview guard runs, then sign-in. Forwards `X-Billing-Country: IN`. |
| `POST /bff/retreats/{id}/reserve` | Same, flow `retreat_seat`. |
| `POST /bff/retreats/{id}/group-book` | Same, flow `retreat_group` (new). *No preview guard; that was already the case, see 6c.* |
| `POST /bff/booking-invite/{token}/register` | Group-batch enrolment checked first (`group_invite`, hold). Forwards only name + email, plus the header. |
| `POST /bff/institutional/participant/register` | A non-text `billing_country` is passed as text (always invalid). The engine's refusal details are passed through. |
| `POST /api/institutional/participant/register` (website engine) | For a **PAID** event, `billing_country` is required and routed (India → Cashfree, INR) **before anything is written**. The country is stored on the registration. FREE events are unchanged. |
| Gateway `POST /api/{one-on-one/bookings, retreats/{id}/reserve, retreats/{id}/group-book, bookings/invite/{token}/register, empanelment/fast-track/initiate}` | Need `X-Billing-Country: IN`. Otherwise 400/422 with `hold_refused: true` and "Nothing has been reserved." |
| `GET /bff/teachers/{handle}/ask-whatsapp` (new) | "Message the teacher": the server looks up the number and redirects to WhatsApp. No number is ever put in the page. |
| `GET /bff/retreats/{id}/ask-whatsapp` | Refactored onto the shared lookup. Behaviour unchanged. |

### 1b. Files

**Backend (website gateway and engine):**
- `backend/payment_routing.py`: new flow `retreat_group` (India only), the `_HOLD_ROUTES` gateway rule and `HOLD_SUFFIX`.
- `backend/institutional.py`: `ParticipantRegisterIn.billing_country`, and the routing check before any write in `participant_register`.

**Website server (BFF):**
- `frontend/app/bff/one-on-one/bookings/route.ts`
- `frontend/app/bff/retreats/[id]/reserve/route.ts`
- `frontend/app/bff/retreats/[id]/group-book/route.ts`
- `frontend/app/bff/booking-invite/[token]/[action]/route.ts`
- `frontend/app/bff/institutional/participant/register/route.ts`
- `frontend/app/bff/retreats/[id]/ask-whatsapp/route.ts`
- New: `frontend/app/bff/teachers/[handle]/ask-whatsapp/route.ts`
- New: `frontend/lib/server/host-whatsapp.ts`
- `frontend/lib/server/payment-routing.ts`: the `hold` option adds `hold_refused` and "Nothing has been reserved."
- `frontend/lib/payment-routing.ts`: the `hold_not_offered` message.

**UI:**
- `components/payments/BillingCountryField.tsx`: `HoldNotOfferedNotice` and `holdButtonLabel()`.
- New: `components/payments/HoldAlternatives.tsx`. After the iteration-188 fix it renders only the "Message …" link, never a form.
- Country asked **before** the hold:
  - `components/app/learner/BookingForm.tsx` (1:1)
  - `components/retreats/RetreatReserve.tsx` (seat)
  - `components/retreats/GroupBook.tsx` (group)
  - `components/participant/ParticipantRegisterForm.tsx` (paid event)
  - `components/booking/BookingRegister.tsx` (group batch)
- In BookingForm, RetreatReserve and GroupBook, the refusal message now sits just above the submit button, so it stays visible on phones.
- `components/payments/CashfreePayButton.tsx` and `components/participant/ParticipantPayStep.tsx`: new `defaultCountry` prop. The pay step is pre-filled with the country chosen at hold time, and it is still re-checked on the server.
- `components/retreats/EnquiryForm.tsx`: **unchanged**. A temporary change was reverted when the waitlist came out of the hold forms.

**Tests:**
- New:
  - `backend/tests/test_p2c_booking_holds.py` (146, offline)
  - `backend/tests/test_p2c_hold_live.py` (59, live, refusal-only)
  - `frontend/tests/verify_booking_holds.ts` (196 checks)
  - `frontend/tests/next-headers-hook.mjs`
- Updated (they now send a billing country, because routing runs first):
  - `test_p0_freeze_gateway.py`
  - `test_participant_paid_payment_chain.py`
  - `test_b23_paid_programmes.py`
  - `workflow/test_wf_b47_privacy_payments.py`, `workflow/test_wf_web_bff.py`, `workflow/test_wf_web_ui.py` (see 4c)

`frontend/yarn.lock` was already modified before Prompt 2A and was left as found. No package was added.

## 2. Buyer-journey table

The server enforces all of this; the browser can't skip it. "Country" means the billing country, chosen explicitly. There is no default, and it is never guessed.

| Journey | Country selection (UI) | Eligibility validation (server, before anything is created) | Booking / seat hold | Order creation | Payment |
|---|---|---|---|---|---|
| **1:1 session** | Before "Reserve & continue to payment" | BFF `routeCashfreeCheckout('one_on_one', hold)`, then the gateway `X-Billing-Country` rule | India: PENDING_PAYMENT booking upstream. Preview: refused 503 first, so no booking. | Later step, `POST /bff/payments/cashfree/orders` (2B routing) | India: Cashfree INR. Preview: 503. |
| **Paid event place** | Before "Continue to payment" (paid events only) | Engine `payment_routing.decide('event_fee')` **before** any profile or registration write | India: PENDING_PAYMENT registration that holds a place, with `billing_country=IN` | Later, `POST /bff/institutional/participant/payment/order` (INR intent, 2B routing) | India: Cashfree INR. Preview: 503. |
| **Retreat seat** | Before "Reserve & continue to payment" | BFF `retreat_seat` (hold), then the gateway rule | India: seat hold upstream. Preview: refused 503 first, so no hold. | Later, `POST /bff/retreats/{id}/reservations/{rid}/pay` | India: Cashfree INR. Preview: 503. |
| **Retreat group** | Before "Reserve N seats" | BFF `retreat_group` (hold), then the gateway rule | India: group hold upstream (~72 h). **Preview: forwarded to the real main backend** (no preview guard; unchanged). | None on NOSTOPS; the host shares payment details | Off-platform via the host. Unchanged. |
| **Group batch (company invite)** | Before "enroll me" | BFF `group_invite` (hold), then the gateway rule | India: enrolment holds a place upstream. **Preview: forwarded to the real main backend** (unchanged). | Later, `POST /bff/booking-invite/{token}/cashfree-order` (2B routing) | India: Cashfree INR. Preview: 503. |
| **Fast-Track application** | Already asked in 2B | 2B BFF check, plus the 2C gateway hold rule on `empanelment/fast-track/initiate` | India: request upstream. Preview: 503. | `/{id}/cashfree-order` (2B) | India: Cashfree INR. Preview: 503. |
| **Free event** | Not asked (unchanged) | No country rule | CONFIRMED, or WAITLISTED when full | None | None |

**Result for each kind of buyer (every hold journey above):**

| Buyer | Result |
|---|---|
| **India** | Allowed: hold, then order, then Cashfree in INR (after an approved publish only). In preview, 1:1, seat, Fast-Track and every pay step stop at the 503 test-mode guard. |
| **Outside India (valid country)** | **422 `international_not_offered`** (or `provider_not_supported_in_country` / `provider_conflict`). **No hold, no booking, no registration, no order.** The UI greys out the button with "Booking from outside India not available yet". It shows the amber notice "…Nothing has been reserved and no payment has been taken." with a message option: |
| | • **1:1:** "Message the teacher" (`/bff/teachers/{handle}/ask-whatsapp`) |
| | • **Retreat seat / group:** "Message the host" (`/bff/retreats/{id}/ask-whatsapp`) |
| | • **Paid event / group batch:** "Message the organiser" (WhatsApp with the message text) |
| | • **Waitlist:** only on a sold-out retreat. The existing sold-out page shows it instead of the reserve form. |
| **Missing / invalid** (`""`, `"India"`, `"XX"`, `91`, `["IN"]`, unreadable body) | **400 `billing_country_required` / `billing_country_invalid`**, and nothing is created. India with another currency → 422 `currency_not_supported`. India + PayPal → 422 `provider_conflict`. |

Every refusal has `routing_refused: true` and `hold_refused: true`, and its message ends "No payment has been taken. Nothing has been reserved."

**Known limitation (founder decision "keep as is"):** the main backend doesn't share hosts' WhatsApp numbers with the website. "Message the host / teacher / organiser" therefore opens WhatsApp with the prepared message but **no recipient**. Fix item R8 (section 5) is for the main-backend owner.

## 3. No hold or capacity is used by rejected or ineligible requests

| Evidence | Result |
|---|---|
| Gateway (offline, mock upstream that records every call): 5 hold routes × 8 bad countries × 2 hosts, plus unreadable bodies and wrong currencies | Every refusal: **0 upstream calls**. India on production: exactly 1 call, with the booking details unchanged. |
| Engine (throwaway DB): paid event registration refused for 9 bad countries | **0 registrations**. The participant profile is not changed either, because the check runs before the profile update. |
| Engine: an existing PENDING registration, then a refused retry from the US | The registration is unchanged (1 row, identical document). |
| Node BFF harness (real route handlers plus the real policy; all other network calls intercepted) | Each refusal makes the policy call only, and **no** call to the main backend or the engine. |
| Live preview (refusal-only suites) | Refused at the BFF before the main backend: 400/422, 403 without CSRF, 503 preview guard for India on 1:1 and seat. |
| UI testing (iterations 188 and 189) | **No bookings, holds or waitlist entries were created.** The only writes were sign-in and the two allowed India submits (1:1 and seat), both refused 503. Group-submit with India was never pressed. |

**Website database after all runs:**

| Check | State |
|---|---|
| `inst_registrations` with PENDING_PAYMENT | **0** |
| `inst_registrations` with a payment order | **0** |
| `payment_routing_decisions` | 0 |
| `ai_onboarding_orders` | 0 |
| `inst_settlements` | 0 |
| `audit_ledger` | 0 |
| `webhook_events` | 0 |
| `verification_payments` | 6 rows, none touched today |
| Throwaway test DBs left behind | none |

- Two registrations were created today: `NOSTOPS-REG-2026-000272` and `-000289`. Both are **FREE** QA-event registrations (CONFIRMED, NOT_REQUIRED, no order), made by the existing `test_regression_iter132.py` on the QA audit event. No place was held for a payment.

**Upstream capacity:** refused requests never reach the main backend, so they can't use its capacity. The main backend's own seat counting is **UNVERIFIED** (see 6).

## 4. Test results (actual counts)

### 4a. Backend (pytest)

| Suite | Passed | Failed | Skipped | xfailed |
|---|---|---|---|---|
| Re-run of the 3 updated legacy tests (`test_p0_freeze_gateway`, `test_participant_paid_payment_chain`) | 237 | 0 | 13 | – |
| Offline payment and hold suites (10 files: `test_p2c_booking_holds`, `test_p2b_checkout_routing`, `test_p2a_payment_routing`, `test_p0_freeze_gateway`, `test_p0_inbound_payments`, `test_p0_razorpay_callback`, `test_p0_cashfree_diag`, `test_cashfree_sandbox_guard`, `test_p0_encoded_delimiter_bypass`, `test_participant_paid_payment_chain`) | **1090** | 0 | 13 | – |
| Live preview refusal-only (`test_p2c_hold_live`, `test_p2b_bff_live`, `test_p2b_gap_checks`, `test_p2a_http_live`) | **255** | 0 | 0 | – |
| Regression suites that call the changed endpoints (11 files: participant, certificate, cohort, B2.2, B2.3, renewals, live gateway, KYC BFF, retreats) — final run | **287** | 0 | 3 | – |
| Full workflow suite (`tests/workflow`, 27 files) — final run | **1186** | **1** | 9 | 94 |
| **Total (final runs)** | **2818** | **1** | **25** | **94** |

**Frontend:**

| Check | Result |
|---|---|
| `verify_booking_holds.ts` (after the UI fix) | **196/196** |
| `verify_checkout_routing.ts` | **291/291** |
| `test:pricing` | pass |
| `test:lyv` | 22/22 |
| `test:tier2` | 16 pass, **2 fail** (stale since 2A, see 4d) |
| `tsc --noEmit` | 0 errors (after the fix) |
| ESLint, all changed files | 0 issues |

**UI testing agent (390×844 and 1280×800):**
- **Iteration 188:** country gating passed on 1:1, seat and group. It found 4 issues, all handled (4b).
- **Iteration 189 retest:** all fixes pass.

### 4b. Failures found and investigated (none dismissed without evidence)

1. **`test_b23_paid_programmes` (2 failed in the first regression run).**
   - **Cause:** Prompt 2C. A paid registration without a country is now refused (400). The second failure was a knock-on (`KeyError reg_id`).
   - **Fix:** the test sends `billing_country: IN`. Result 6/6.
2. **Workflow suite, first run: 25 failed.** Each one was traced:
   - **20 stale expectations.** The tests expected the preview 503 guard. They now hit an earlier, stricter refusal: the billing-country check (400, from 2A/2B) or the P0 money lock (423).
     - **3 of the 20 are caused by 2C:** `/bff/one-on-one/bookings`, `/bff/retreats/{id}/reserve` and `/api/retreats/{id}/reserve` now check the country before the preview guard.
     - **The other 17 come from 2A/2B/P0.** Their routes are not in the 2C diff (`git diff HEAD` has 0 lines for `ai_onboarding.py`, `server.py`, `payments/cashfree/orders`, `reservations/[rid]/pay`, `participant/payment/order` and `venue-onboarding/checkout`). This file was last edited in B4.7/B4.8, before P0 and 2A.
     - **Fix:** the tests now send India (and an order type) so they still prove the preview guard. Money-lock routes expect 423. Every "nothing created" assertion is kept.
   - **2 stale UI/BFF expectations (from 2A/2B):**
     - The venue checkout BFF now needs a country.
     - The AI-onboarding pay button stays disabled until a country is chosen.
     - The tests now choose India.
   - **3 transient:** 502 and "invalid origin" on sign-in, while three suites were loading the preview at once. On re-run, `test_signed_in_pages_still_load` passed **7/7**.
   - After the fixes the affected tests passed (64/64, then 15/15). The full re-run then left 1 failure, below.
3. **Workflow re-run: 1 failed, `test_wf_monitoring::test_identical_errors_group_into_one_row_and_alert_once`. Environmental.**
   - The error monitor's global cap of 20 alerts per hour was reached by today's test traffic: `monitor_alerts` held exactly 20 in the last hour.
   - With the cap lifted in-process (no file changed), `test_wf_monitoring.py` passes **9/9**. Unmodified, it fails 1/9.
   - `monitoring.py` is not changed. It will pass again once the hour clears.
4. **UI testing agent, iteration 188:**
   - (a) **HIGH:** the "Join the waitlist" form was nested inside the reserve and group forms, so the page reloaded. (b) **HIGH:** the main backend accepts waitlist sign-ups only for sold-out retreats.
     - **Fixed** by your decision: the waitlist is removed from the hold forms. It shows only on sold-out retreats (the existing page). `HoldAlternatives` now renders a link only.
   - (c) **MEDIUM:** WhatsApp opens with no recipient. **Kept as is** (your decision) and added as R8.
   - (d) **MEDIUM:** the refusal message was off-screen on phones. **Fixed:** it now sits above the submit button. In iteration 189 it was visible without scrolling on 1:1 and seat.

### 4c. Tests changed this session
- `test_b23_paid_programmes.py`: billing country added.
- `workflow/test_wf_b47_privacy_payments.py`: India sent; money-lock 423 expected for wallet top-up and payout.
- `workflow/test_wf_web_bff.py`: India sent.
- `workflow/test_wf_web_ui.py`: chooses India before expecting an enabled pay button.

No assertion that "nothing was sent or created" was removed.

### 4d. Pre-existing, not caused by 2C (left as found)
- `test:tier2`, 2 stale source checks ("landing says free", "banner gated on flag"). Same failure since the 2A commit.
- **iteration 189:** in group mode at 390 px the page is 8 px wider than the screen (`app/app/retreats/[retreat_id]/page.tsx:50` grid).
- **iteration 188:** `rt_e8715c9ed0` started 13 Sep 2026 but can still be reserved. Its policy reads "−46 days before".
- **iteration 188:** the waitlist BFF has no CSRF origin check.

These need your OK before I change them.

### 4e. Skipped (with reason)
- **13**, offline: 12 reviewed `LEFT_OPEN` routes that record no money, plus 1 ownership check that runs only on production or sandbox (the preview guard stops it first).
- **3**, regression: no teacher assignment yet (×2); the main backend refused a QA retreat create (venue required).
- **9**, workflow: Cashfree **sandbox**-only order tests (no sandbox keys), and a wallet page gated for an unverified demo teacher.
- **94 xfailed**: documented main-backend defects (TVR-01 admin routes, B4.7-C public fields, IDOR). Unchanged.

## 5. Remediation specification for the owner of `pro-learn-connect-1`

The website now refuses ineligible holds and orders at its BFF and `/api` gateway. Direct callers (the mobile app, scripts, anyone calling `pro-learn-connect-1.emergent.host` directly) bypass both, so the main backend must enforce the same rules itself.

| # | Endpoint(s) | Required behaviour | Acceptance test (owner) |
|---|---|---|---|
| **R1** | `POST /one-on-one/bookings`, `POST /retreats/{id}/reserve`, `POST /retreats/{id}/group-book`, `POST /bookings/invite/{token}/register`, `POST /empanelment/fast-track/initiate` | Require billing country = `IN` **before** any write. Missing or not an ISO code → 400 `billing_country_required` / `billing_country_invalid`. Any other country → 422 `international_not_offered`. A refused request creates **no** booking, hold, enrolment or request; decrements **no** seat or slot count; starts **no** expiry timer; sends **no** email or notification. Validate before the capacity transaction (not after it), and store `billing_country` on the hold. | For each route: send no country, `XX`, `US` → 4xx; seats/slots and record counts unchanged; no email sent. `IN` → created exactly as today. |
| **R2** | Trust of `X-Billing-Country` | Trust the header only on server-to-server calls from the website, authenticated with a shared secret (as `/api/payment-routing/decide` does). Otherwise require `billing_country` in the body and validate it. Never infer it from IP, phone or language. | A direct call with a spoofed header and no secret is treated as "country missing" (400). |
| **R3** | `POST /payments/cashfree/orders` (`one_on_one`, `instakyc`, `institutional_event`), `/retreats/{id}/reservations/{rid}/cashfree-order`, `/empanelment/fast-track/{id}/cashfree-order`, `/bookings/invite/{token}/cashfree-order` | **India-only Cashfree order creation:** billing country `IN` **and** currency `INR`, or refuse with no Cashfree API call. Take the amount from the server price only. Re-check the `billing_country` stored on the hold or booking, and refuse if it is missing or not `IN`. `wallet_topup` and payouts stay refused while the money lock is on. | Orders with `US`, `INR+USD`, or a hold without a country → 4xx and no provider call (check provider logs). `IN`/`INR` → one order, with an idempotent retry. |
| **R4** | `POST /payments/cashfree/international/create-order` (and any `international/*` Cashfree route) | **Reject every international Cashfree order** (403/410) until an international product is approved. Never fall back from PayPal to Cashfree. | Any call → 403/410, with no Cashfree API call. |
| **R5** | PayPal webhook | Refuse every event when `PAYPAL_WEBHOOK_ID` is unset. Verify each event with `verify-webhook-signature` on the **raw body** and the transmission headers. Check `payee.merchant_id` and the environment (sandbox vs live). De-duplicate by event id and ignore out-of-order events. **Never** apply REFUNDED or REVERSED automatically while the lock is on. Route PayPal through the website gateway, or apply the same checks. | Unsigned, forged, replayed or wrong-merchant events → refused and nothing changed. A valid event is processed once. |
| **R6** | PayPal capture | Require the booking owner's session. Check amount, currency and booking against the server price. Make it idempotent. | Another user's booking → 403. A tampered amount → refused. |
| **R7** | Existing holds | List the PENDING holds and bookings created before R1 that have no stored billing country. Let them expire by the normal rule. Do not cancel or refund them automatically. | Report of the count and ids; no money moved. |
| **R8** | Host contact for "Message the host/teacher/organiser" | Add a server-only lookup, authenticated with a shared secret and limited to the website server, that returns a host's published WhatsApp number (or a relay). Until then, the link opens WhatsApp with no recipient. | The website redirect includes the host number; public responses still carry no phone numbers. |
| **R9** | Razorpay InstaKYC (from 2B) | List and expire the open links, then retire `verify-payment`. Keep the `razorpay_*` history read-only. | No new Razorpay link can be created; past ones are still readable. |
| **R10** | Config | Confirm `PAYPAL_WEBHOOK_ID`, the registered webhook URL and the Cashfree account in use. Production must never use sandbox keys, and preview must never use live keys. | A written confirmation from the owner. |

## 6. External-backend items that can't be tested or verified here

| Item | Status | Why |
|---|---|---|
| The main backend honours `X-Billing-Country` on the 5 hold routes (R1) | **UNVERIFIED** | Testing would create real holds or bookings upstream |
| The main backend refuses non-India holds from direct callers (mobile app, scripts) (R1, R2) | **BLOCKED** | External, not implemented as far as this workspace can see |
| Upstream capacity is unchanged on refusals (seat and slot counters) | **UNVERIFIED** upstream | Verified only that refusals never reach upstream (0 calls) |
| India-only Cashfree order creation upstream (R3) | **UNVERIFIED** | External. A real order is blocked by the lock, the preview guard and the missing sandbox keys. |
| Rejection of international Cashfree orders upstream (R4) | **UNVERIFIED** | The website gateway refuses them; direct calls were not attempted |
| PayPal webhook security upstream (R5) | **BLOCKED** | Not built or approved upstream (Prompt 3 awaits approval) |
| PayPal capture ownership and amount checks (R6) | **BLOCKED** | Same |
| Existing pre-2C holds from non-India buyers (R7) | **UNVERIFIED** | No upstream read access to holds |
| Host WhatsApp number for "Message the host" (R8) | **BLOCKED** | The directory exposes no numbers; kept as is by founder decision |
| A real Cashfree order on any journey | **BLOCKED** | Money lock ON, preview guard, no sandbox keys |
| India group hold and group-batch enrolment in preview | **Not exercised** | They have no preview guard (unchanged), so they would create real upstream holds. Covered offline only. |
| Paid-event and group-batch forms in a browser | **UNVERIFIED in a browser** | Preview has no paid events or invite tokens. Covered by engine and Node tests plus code review (iteration 189). |

### 6c. Website decisions for you (not changed)
- **Preview guard on the group hold and group-batch enrolment.** In preview these still forward India requests to the real main backend, as they did before 2C, because they take no on-platform payment at that step. A guard would make them return 503 in preview.
- **The four items in 4d.**

## 7. Financial lock and "nothing real happened"

**Lock and checkout:**
- **Lock:** `financial_lock.locked() = True`, and `FINANCIAL_ACTIONS_UNLOCKED` is absent. Wallet top-up is still refused with 423 (offline gateway test and the live workflow test).
- **Checkout disabled:** in preview every pay and order step returns 503 test mode, and PayPal create-order returns 503. No checkout was enabled.
- **No `.env` value, deployment or publish was changed.**

**No provider calls and no transactions:**
- The offline suites use a mock upstream or an intercepted `fetch`.
- Live checks were refused before the main backend. The only main-backend calls were sign-ins and page reads.
- No money moved, and no historical financial record was changed.

**Side effects disclosed:**
- `ai_onboarding_webhook_events` gained 4 rows today at 05:25 UTC, all status `ignored` / `unknown_order`. They were written by the existing `test_p0_inbound_payments.py` fixtures (unsigned webhooks with unknown orders). They are linked to no order and no money, and were left in place.
- The built-in error monitor sent **7 alert emails** to its own alert inbox between 05:18 and 05:44 UTC. They were about the 503/423 refusals and the rate-limited emails that test traffic triggered.
  - Existing regression tests tried to send registration emails to QA addresses. The email provider rejected them (429/422).
  - No customer was emailed.

**Still on hold (unchanged):** Prompt 3 (PayPal, awaiting your approval), Phase 4 Google indexing release, Guru Nominations, B4.9 Payouts and Billing, B5.2 Tax/Legal wording.
