# Prompt 4, Stage A: payment architecture audit (read-only)

**Date:** 29 Oct 2026 (container clock). **Environment:** preview workspace only.
**Status:** audit complete. **Stopped for your review.** Nothing was implemented.

**How this audit was done:**
- Read the website code, the backend code and the earlier payment reports (P1 audit and P2A–P2G).
- Read the main backend's saved API list: `backend/tests/fixtures/main_backend_openapi_2026-10.json` (648 paths, saved 26 Oct).
- Checked which environment-variable **names** exist. No values were printed, except two non-secret facts: the Cashfree mode, and whether the money lock is set.
- Counted records in the local database (counts only).
- Ran one offline calculation (`/app/test_reports/p4a/gateway_matrix.py`). It feeds each money route through the same gateway rules the server uses, sending nothing anywhere.
- The demo-data snapshot before and after the audit is **identical** (`test_reports/p3c/s14` → `s15`).

**Labels used:**
- **V = verified**: checked in this audit by reading code or config, or by an offline calculation.
- **I = inferred**: follows from verified facts, but was not checked directly.
- **U = unresolved**: needs evidence or a decision this audit cannot obtain.

Nothing about Cashfree's or PayPal's accounts, the main backend's live behaviour or production was checked. Every such claim is marked I or U.

---

## 1. Executive summary

1. **There are two payment systems.** **V**
   - **(a) This website:** the Next.js website server plus the local FastAPI gateway and pricing engine.
   - **(b) The main backend** `pro-learn-connect-1`: it owns most money flows, its own live Cashfree keys, its own PayPal module, and wallets, payouts and refunds.
   - The website takes payment itself for **one product only**: venue AI onboarding (local Cashfree, its own keys).
   - Sources: `backend/ai_onboarding.py`, the saved API list, `PAYMENTS_P1_READONLY_AUDIT.md`.
2. **One routing policy already exists** (`backend/payment_routing.py`, version `2026-10-27.1`). **V**
   - India → Cashfree, INR only.
   - Outside India → PayPal, USD only, and only for a product with an international price.
   - Anything else is refused. There is no automatic fallback to the other provider.
   - It runs in the website server and again at the `/api` gateway.
3. **PayPal checkout does not exist on the website**, and no PayPal settings are configured (all `PAYPAL_*` names are absent). **V**
   - The gateway refuses PayPal order creation (503).
   - It verifies PayPal notifications itself, but without settings it refuses them (503).
   - **No product has an approved USD price.** Venue onboarding's US$30 is recorded only; the US$99 combined offer is paused.
4. **The money lock is ON.** **V**
   - `FINANCIAL_ACTIONS_UNLOCKED` is absent from both `.env` files and from the running backend process, and `financial_lock.locked()` returns true.
   - In preview, **0 of 63 money-related write routes are forwarded** (offline matrix).
5. **In production, the lock does not stop money coming in.** **V (code), U (production itself)**
   - By an earlier founder decision, payment orders and incoming payment notifications pass the lock.
   - With an India billing country, **21 money-related write routes would be forwarded in production**.
   - **5 of them have no billing-country check at all:**
     - `POST v1/payments/orders`
     - `bookings/{id}/close-and-request-payment`
     - `bookings/{id}/send-payment-requests`
     - `bookings/hr/send-all-payment-requests`
     - `international/paypal/capture/{id}`
   - "Checkout disabled" is therefore enforced **only in preview**. Whether production currently runs this code was not checked.
6. **The customer chooses their own billing country from a dropdown.** **V**
   - The server checks it is valid and consistent, compares it with the account's country when one is supplied, and treats the IP country as a warning only.
   - There is no authoritative billing-address source, which falls short of brief §5.
7. **These checks only cover traffic that passes through this website's gateway.** **I**
   - The main backend is a separate public service, so a client that calls it directly bypasses them.
8. **The main backend still has payout endpoints**: `v1/payouts/withdraw`, `v1/payouts/webhook`, `teacher-wallet/withdraw` and `admin/payouts/*`. **V (API list and lock rules)**
   - They are refused only **while the lock is on**.
   - Your Cashfree account does not support payouts (your statement). These should therefore be refused permanently, not only while locked.
9. **Several journeys cannot go live until a commercial decision is made** (§7): tax, InstaKYC source, the event-fee maximum, 1:1 limits, retreat group quotes and the US$30 approval. **V (rules file)**
10. **Nothing is ready to take money.** The recommended next stage (B, §14) is gateway hardening only, with no money movement.

---

## 2. Payment journeys

| # | Journey | Website entry → upstream | Amount source | Provider / currency today | Status (code) | Class |
|---|---|---|---|---|---|---|
| 1 | **InstaKYC** ₹279 incl. GST (provisional) | `InstaKycFlow` → `/bff/payments/cashfree/orders` (`instakyc`) → main `POST payments/cashfree/orders` | Website `lib/offers.ts` (`INSTAKYC_PRICE_INR`, tamper-checked) **and** main `GET kyc/pricing` | Cashfree INR (main backend's account) | Preview 503; production forwarded for India | V; source U |
| 1b | InstaKYC **legacy Razorpay link** | main `kyc/sandbox/create-payment` / `verify-payment` | main | Razorpay | create → **410** (reversible switch, off). `verify-payment` **forwarded in production** (sets `kyc_paid` for earlier links); blocked in preview | V |
| 2 | **Fast-Track empanelment** ₹4,999 | `FastTrackApply` → `/bff/teacher/empanelment/fast-track/{initiate, {id}/cashfree-order}` | main offer | Cashfree INR (main) | Both steps routing-checked. Razorpay create/verify **ALWAYS** refused. `/{id}/pay` (mock card) ALWAYS refused. `decide` (split) LOCK | V |
| 3 | Combined verification + empanelment offer ₹2,499 / US$99 | `verification.py` (local) | local | — | **Paused** (`UNIFIED_OFFER_PURCHASABLE = False`) | V |
| 4 | **One-to-one sessions** | `BookingForm` → `/bff/one-on-one/bookings` (hold) → `CashfreePayButton` → `/bff/payments/cashfree/orders` (`one_on_one`) | main booking amount (re-read from `my-bookings`) | Cashfree INR (main). Main's Cashfree international route → **403**. Main's PayPal module: create-order **503**; capture **forwarded in production** | Preview 503 | V |
| 5 | **Retreat seat** | `RetreatReserve` → `/bff/retreats/{id}/reserve` (hold) → `/reservations/{rid}/pay` → main `.../cashfree-order` | main `price_per_seat_inr` (listed price) | Cashfree INR (main) | Routing-checked; refunds LOCK | V |
| 6 | **Retreat group** | `GroupBook` → `group-quote` (read) → `group-book` (hold) | main quote, whose tier discount is UNAPPROVED (not shown since P3C) | No online charge in this step; "host shares payment details" | Routing-checked hold | V; collection path I |
| 7 | **Paid events** (institutional) | `ParticipantPayStep` → `/bff/institutional/participant/payment/order` (`event_fee`) → main `payments/cashfree/orders` (`institutional_event`) → return page → `confirm` | Local engine `payment/intent` (event fee) | Cashfree INR (main account) | Routing-checked. **No webhook or reconciler** (R7). Preview has 84 events, all FREE, and 0 paid registrations | V |
| 8 | **Institutional programmes** | Organisation programmes are institutional events (flat per-participant fee set by the organiser) | engine | as #7 | Rate card ₹300 / ₹175 is UNAPPROVED as a tariff. The 3 / 6 / 12-month 70 / 80 / 85% split is review-only in the engine, with no payment code | V |
| 8b | Legacy **corporate batch** | `BookingRegister` / `PayNow` → main `bookings/invite/{token}/{register, cashfree-order}` | main (18/29/40 ladder, UNAPPROVED) | Cashfree INR (main) | Invite routes are routing-checked. `close-and-request-payment`, `send-payment-requests` and `hr/send-all-payment-requests` are **forwarded with no routing check in production**. Website batch creation is closed (410) | V |
| 9 | **Venue AI onboarding** | `AiOnboardingPurchase` → `/bff/venue-onboarding/checkout` → local `/api/ai-onboarding` | local, server-side: India ₹1,999 + 18% = ₹2,358.82 → **₹2,359**; international **US$30 (recorded)** | **Local Cashfree** (own keys) | India: routing → sandbox/live host binding. Preview refused (the API is set to **production** mode; preview origin not configured). International → **503** (PayPal not built). Region must match the billing country (422) | V |
| 10 | Wallet top-up | `WalletTopUp` → orders route | main | — | **423** (lock) | V |
| 11 | **Refunds and cancellations** | main refund calculator (`refund-preview`, read); writes `orders/{id}/refunds`, `cancel-with-refund`, `student-cancel`, `bookings/{id}/cancel`, `v1/payments/admin/refund` | main; website mirror `lib/cancellation.ts` (display only) | — | All refund writes **423**. PayPal refund/reversal notices **HELD** locally | V |
| 12 | **Payment-status updates** | Cashfree → main `payments/cashfree/webhook`, `v1/payments/webhook`. Cashfree → local `/api/ai-onboarding/webhook`. PayPal → gateway handler. Return pages poll the server | — | — | Forwarded while locked; the gateway refuses only a notification with no signature headers (the main backend checks the HMAC, **I**). Local and PayPal notifications are verified locally (**V**) | V / I |
| 13 | **Teacher payouts, wallet, escrow, settlement, referral credits** | main | main | — | All writes **423** (LOCK); reads allowed | V |

---

## 3. Ownership: website workspace versus main backend

| Capability | Website workspace | Main backend | Evidence |
|---|---|---|---|
| Price | Venue onboarding; event fee; InstaKYC display amount | 1:1, retreats, group quotes, Fast-Track, InstaKYC (`kyc/pricing`), refund tiers, corporate batch | `pricing_rules.PRODUCTS`, API list (V) |
| Order creation | Venue onboarding only (local Cashfree) | Everything else | `ai_onboarding.py`, BFF routes (V) |
| Provider routing | `payment_routing.py` (gateway + website server) | Unknown | V / U |
| Notifications | Venue onboarding (Cashfree); PayPal (verify, then forward) | Cashfree (2 routes), PayPal (records), payouts webhook | V |
| Refunds | None (locked) | All | V |
| Payouts and wallet | None (locked) | All | V |
| Fulfilment | Venue entitlement; event registration confirm | Bookings, seats, KYC flag, empanelment | V |
| Ledger | `audit_ledger` (1:1 display ledger, 0 rows) | Wallet, transactions, settlements | V |

---

## 4. Current provider and currency behaviour

**Policy (`payment_routing.decide`)** **V**
- Unknown flow → 400.
- Missing or invalid country → 400.
- A currency that isn't three letters → 400.
- Account-country conflict → refused.
- India with a currency other than INR → refused.
- Outside India:
  - provider other than PayPal → refused
  - PayPal-unsupported country (CU, IR, KP, SY, RU; **list U**) → refused
  - currency other than USD → refused
  - product with no international price → refused
  - PayPal not ready → 503
- An IP-country mismatch only adds a risk flag.
- There is no conversion and no fallback: a PayPal decision can never become a Cashfree order (`ai_onboarding.py` L212).

**Offline gateway matrix** (`test_reports/p4a/gateway_matrix.json`). It covers 118 money-related routes, 63 of them writes, run through the same rule order as `server.py proxy()`. **V**

| Write outcome | Preview, India country | Production, India country |
|---|---|---|
| 423 (lock / preview read-only) | 44 | 32 |
| 503 (preview payment guard / PayPal) | 11 | 1 |
| 410 (retired Razorpay link / payment links) | 4 | 4 |
| 400 / 403 (routing) | 4 | 4 |
| Handled locally (PayPal notification) | — | 1 |
| **Forwarded** | **0** | **21** |

The 21 routes forwarded in production with an India country:

- **Routing-checked, correct:**
  - `payments/cashfree/orders`
  - `retreats/{id}/reservations/{rid}/cashfree-order`
  - `retreats/{id}/group-book`
  - `bookings/invite/{token}/cashfree-order`
  - `empanelment/fast-track/initiate`
  - `empanelment/fast-track/{id}/cashfree-order`

  Each is refused with no country (400) and with US (422).
- **No routing check (gap):**
  - `v1/payments/orders`
  - `bookings/{id}/close-and-request-payment`
  - `bookings/{id}/send-payment-requests`
  - `bookings/hr/send-all-payment-requests`
  - `international/paypal/capture/{id}`
- **Legacy:** `kyc/sandbox/verify-payment` (Razorpay; sets `kyc_paid`).
- **Not payments** (identity checks and workflow):
  - `kyc/sandbox/{aadhaar/otp, aadhaar/verify, pan/verify, bank/verify}`
  - `empanelment/fast-track/{id}/{claim, schedule}`
  - `group-booking-agreements/{generate, accept}`
  - `cloudinary/webhook/teacher-intro`

Not modelled: the admin gate, the empanelment policy gate and the retreat start-date check. Each needs a database or upstream read, and can only refuse more, never forward more.

---

## 5. India INR / Cashfree route

**In place** (**V**)
- **Server-side amounts:**
  - offers are tamper-checked (`lib/offers.ts`)
  - the event fee comes from the engine `intent`
  - the 1:1 amount is re-read from the main backend
  - the venue price comes from the engine
- **Routing** is checked in the website server and again at the gateway.
- **Preview payment guard** (503) and **preview write isolation** (423).
- **Sandbox/live host binding** (`payment_guard.checkout_decision`): sandbox keys run only on the configured preview origin, live keys only on a production host.
- **Venue notification** checks: HMAC signature, 24-hour replay window, de-duplication (idempotency key or body hash), then an authoritative order re-read before anything is granted. The entitlement write is idempotent.
- **Event-fee confirm** is idempotent, with amount, currency and reference matched, and duplicates recorded.
- **Return pages** never trust the URL.

**Gaps**

| # | Gap | Class | Evidence |
|---|---|---|---|
| C1 | `v1/payments/orders` (main backend v1 Cashfree) is forwarded in production with no routing check. The website doesn't call it | V | Matrix; P1 §2.3 |
| C2 | Corporate-batch payment-request routes are forwarded with no routing check | V | Matrix |
| C3 | Event fees have **no notification and no reconciler**: a paid registration stays PENDING if the browser closes (R7) | V | `institutional.py` §12/§13; P2A–P2B |
| C4 | Two simultaneous venue checkouts can create two orders (TVR-24) | V (code), not reproduced | P2D; `ai_onboarding.py` 30-minute reuse window |
| C5 | Main-backend Cashfree notifications: the gateway checks only that signature headers are **present**; the HMAC is checked upstream | I | `financial_lock.unsigned_webhook` |
| C6 | Preview Cashfree settings point at the **production** API. No sandbox keys exist, and `WEB_APP_BASE_URL` and `CASHFREE_CHECKOUT_ORIGIN` are absent, so no sandbox test is possible. The preview `.env` holds production-mode credentials, which the owner earlier reported as rotated | V (mode, names); U (rotation) | `payment_guard.cashfree_mode` |
| C7 | Which Cashfree account the main backend uses, and its approved business category and payment methods | U | Not checkable here |
| C8 | Your account supports payment acceptance and refunds only, not payouts. The main backend's payout endpoints must never open | V (endpoints); your statement | API list |
| C9 | No price version and no routing-decision ID are stored on any order. Recording a routing decision is built (`record=true`) but no checkout calls it | V | `payment_routing.py` docstring |

---

## 6. International USD / PayPal readiness

- **Website:**
  - no PayPal order or capture code, and no PayPal settings **(V)**
  - the gateway refuses PayPal `create-order` (503) **(V)**
  - `capture/{id}` is **forwarded in production**, and only blocked in preview **(V)**
  - the gateway's PayPal notification handler is built and checks:
    - settings, with sandbox only on preview and live only on production
    - certificate host and algorithm
    - transmission time
    - PayPal's own verify-webhook-signature API
    - merchant ID
    - one record per event
    - stale events
    - refund and reversal notices are held

    It is inert without settings (503). **V**
- **Main backend:**
  - it has a PayPal module for international 1:1 sessions (`config`, `create-order`, `capture`, `webhook`)
  - its own API docs say its notification route accepts unsigned events when `PAYPAL_WEBHOOK_ID` is unset **(I, from the saved docs; not checked live)**
- **Approved USD prices:** none. Venue onboarding US$30 is **RECORDED** (not approved for sale, tax not decided). The US$99 combined offer is paused. **V**
- **Account readiness, all U.** Not established:
  - that a REST app exists (sandbox and live)
  - Orders v2 permission
  - a webhook ID
  - which currencies the account can receive, and whether it accepts them automatically
  - the cross-border rules for an Indian merchant (purpose code, FIRC)
  - settlement and withdrawal
  - the unsupported-country list
- **Verdict:** **not ready.** Route B correctly fails closed today, apart from the `capture` gap.

---

## 7. Missing prices, commercial approvals and tax decisions

From `pricing_rules.UNRESOLVED` and `TAX_RULES` (V), plus the brief. Any journey depending on an open item stays unavailable.

| Item | Affects |
|---|---|
| Tax by product and jurisdiction. Only venue onboarding India 18% is APPROVED; InstaKYC 18% is PROVISIONAL; nothing else is decided (B5.2 blocked) | Every product except venue India |
| InstaKYC source: website ₹279 or main backend `kyc/pricing` | InstaKYC |
| US$30 venue onboarding: approval for sale, and its tax | International venue onboarding |
| **No USD price** for any other product | All international routes |
| Event-fee maximum: wizard ₹1,00,000, backend ₹10,00,000 | Paid events |
| 1:1 rate limits: website routes and main-backend tier rules disagree | 1:1 |
| Retreat group quotes against the 5 / 10 / 15% tiers (UNAPPROVED); early-bird and other host offers (not verified) | Retreat groups and seats |
| Retreat 30% / 70% split; host-specific fee arrangements must not be overwritten | Retreat economics (display only) |
| The revenue base each institutional contract defines for 70 / 80 / 85%; no 1-month share | Contract allocation |
| Organisation discount ladders (rate card suspended; legacy 18/29/40) and the ₹5,000 baseline | Organisation and corporate batch |
| PayPal currencies (USD only, by founder decision) and the unsupported-country list | Route B |
| Refund policy tiers: the website shows a copy of the main backend's calculator | Refund display |

---

## 8. Proposed payment state machine (design only; nothing was built)

**Today, states are spread across separate stores** (V):
- main-backend orders
- `ai_onboarding_orders` (0 rows)
- `inst_registrations` (`booking_status` / `payment_status`; 15 rows, none paid)
- `audit_ledger` (0)
- `verification_payments` (6, QA)
- PayPal notification states (`FORWARDED` / `HELD` / `IGNORED` / `STALE` / `REJECTED`)

There is no shared model, and no record ties together the order, attempt, provider reference and fulfilment.

**Proposed payment states:**
`NOT_INITIATED` → `SESSION_CREATED` → `CUSTOMER_ACTION_PENDING` → `VERIFICATION_PENDING` → `PAID_VERIFIED`, and then `REFUND_REQUESTED` → `REFUND_PROCESSING` → `REFUND_COMPLETED` | `REFUND_FAILED_RECONCILE`.
Side exits: `FAILED`, `CANCELLED` (customer), `EXPIRED` (provider).

| Transition | Allowed only when |
|---|---|
| NOT_INITIATED → SESSION_CREATED | The server creates the order. It records the amount (integer paise, or exact-decimal USD), currency, product, price version, routing decision ID and provider. The approved price must exist |
| SESSION_CREATED → CUSTOMER_ACTION_PENDING | The customer is sent to the provider |
| CUSTOMER_ACTION_PENDING → VERIFICATION_PENDING | A return-page visit **or** a provider notification arrives. Neither on its own counts as proof |
| VERIFICATION_PENDING → PAID_VERIFIED | The provider's **server-side** status is paid, **and** the amount, currency, merchant account and order ID all match |
| VERIFICATION_PENDING → FAILED / CANCELLED / EXPIRED | The provider reports it |
| PAID_VERIFIED → REFUND_REQUESTED | Separately approved (refunds are locked). Amount ≤ captured − already refunded |
| REFUND_* | Driven by the provider status of the same provider, idempotent per refund ID |

**Rejected transitions:**
- Anything else into `PAID_VERIFIED`.
- Any change after `PAID_VERIFIED` other than a refund. A late "failed" event becomes a reconciliation flag, not a state change.
- Any transition into a refund state without approval.

**Fulfilment is tracked separately:** `NOT_FULFILLED` → `FULFILLED` (exactly once per order ID) → `REVOKED` (only after a completed refund, by policy).

**Idempotency:**
- a unique provider event ID
- a unique (order ID, transition) pair
- one fulfilment per order ID
- de-duplicated receipts and ledger lines
- out-of-order events resolved by the provider's own timestamps and status, as the PayPal handler already does

---

## 9. Notifications (webhooks) and idempotency

| Notification | Signature | Replay | De-dup | Amount / currency / merchant | Logging | Status |
|---|---|---|---|---|---|---|
| Cashfree → main `payments/cashfree/webhook`, `v1/payments/webhook` | Gateway: headers present only; HMAC checked upstream (**I**) | Upstream 5-minute window (**I**, docs) | Upstream (**I**) | Upstream; v1 is amount-guarded (**I**) | Upstream | Forwarded while locked |
| Cashfree → local `/api/ai-onboarding/webhook` | HMAC (timestamp + raw body) **V** | 24 hours **V** | Idempotency key or body hash **V** | Authoritative order re-read **V** | Minimal | Ready (no keys in preview) |
| PayPal → gateway `international/paypal/webhook` | PayPal's verify API **V** | Transmission time ≤ 3 days **V** | One record per event ID, stale detection **V** | Merchant ID **V**; capture and order ID required **V** | Minimal | 503 until configured |
| `v1/payouts/webhook` (main) | — | — | — | — | — | 423 (LOCK) |
| Razorpay callback and webhook | — | — | — | — | — | Refused (ALWAYS) |
| Didit (identity, not a payment) | X-Signature-V2, 5-minute skew **V** | **V** | `verification_provider_events` **V** | n/a | — | Unchanged |

**Event fees have no notification at all.** Confirmation relies on the return page (C3).

---

## 10. Refunds and teacher settlements

- **Refunds:**
  - owned by the main backend
  - every refund write is refused while locked (423)
  - the website has no refund code and only displays a copy of the refund tiers
  - PayPal refund and reversal notices are held, not forwarded

  **V**
- **Future refunds** need separate approval. Each refund must go back through the provider that took the payment, be no more than the captured amount, be idempotent per refund ID, and leave an audit link from refund to order to fulfilment.
- **Teacher payouts:**
  - **No Cashfree payouts:** the account doesn't support them (your statement).
  - The main backend still exposes payout, withdrawal and wallet endpoints, refused only while locked. **V**
  - **Recommendation:** refuse them permanently (ALWAYS), so unlocking money actions later can never open payouts by accident.
  - A customer payment is never an authorisation to distribute funds.
  - Any future teacher-payment method needs its own proposal, covering:
    - commercial terms and the contract revenue base
    - legal and tax (including TDS and invoicing; B5.2)
    - KYC of the payee
    - the provider's verified payout capability
    - a reconciliation design

---

## 11. Legacy integrations: dependency and migration matrix

Nothing here was deleted or disabled.

| Component | Owner | Current behaviour | Dependencies | Intended replacement (if approved) | Migration and verification | Rollback | Safe to stay inactive? |
|---|---|---|---|---|---|---|---|
| Razorpay `payments/razorpay/*`, Fast-Track `razorpay-create/verify`, Razorpay callback | main | Refused (ALWAYS) | Historical bookings | Cashfree (India) | Confirm no open Razorpay orders upstream (U) | Remove the gateway rule | Yes |
| `kyc/sandbox/create-payment` (Razorpay InstaKYC link) | main | 410; switch `LEGACY_RAZORPAY_KYC_CHECKOUT=allow` | InstaKYC page | Cashfree InstaKYC order | Done in P2A | Set the switch | Yes |
| `kyc/sandbox/verify-payment` (sets `kyc_paid`) | main | **Forwarded in production**; preview blocked | Links paid before P2A | None (retire after confirming no unpaid links) | Count of outstanding links (U) | Re-allow | Yes, once outstanding links are confirmed |
| Payment links (`*payment-link`) | main | 410 | — | Hosted checkout | — | Remove the rule | Yes |
| `razorpay_payment_id` reads (`lib/server/one-on-one.ts`, `lib/server/empanelment-policy.ts`) | website | Read-only historical fallback | Old paid bookings | Keep (history) | — | — | Must stay (history) |
| Mock checkout / mock card | main | Refused (ALWAYS) | — | — | — | — | Yes |
| `v1/payments/*` (main v1 Cashfree) | main | Orders **forwarded in production with no routing check**; refund locked | Unknown upstream callers (U) | Routing-checked or refused | Add to gateway order routes; test | Revert the rule | Unknown: needs the main-backend owner |
| Main PayPal module | main | create 503; **capture forwarded in production**; notification verified locally | International 1:1 | Approved PayPal route | Main-backend owner confirms notification verification | — | Yes (inactive) |
| `payments/cashfree/international/*` | main | 403 | — | PayPal | Done in P2A | Remove the rule | Yes |
| Corporate batch payment requests | main | **Forwarded with no routing check** | HR batch bookings | Routing-checked or refused | Gateway rule + test | Revert | Unknown (U) |
| `verification.py` combined offer | website | Paused | — | Decision pending | — | Flag | Yes |
| Old documents (`/app/PAYMENT_ARCHITECTURE_AUDIT.md` "Cashfree only", `BUSINESS_LOGIC.md`) | docs | Out of date | — | This report | Mark superseded | — | Yes |

---

## 12. Security and configuration gaps

| # | Gap | Class |
|---|---|---|
| S1 | The billing country is client-supplied (dropdown), with the account country only an optional cross-check | V |
| S2 | All gateway checks can be bypassed by calling the main backend directly | I |
| S3 | 5 money writes have no routing check in production (§4) | V |
| S4 | Payout and withdrawal endpoints are refused only while locked, not permanently | V |
| S5 | Cashfree notifications to the main backend: the gateway checks only that signature headers are present | V |
| S6 | Preview `.env` holds production-mode Cashfree credentials; preview should hold sandbox credentials only | V (mode); U (whether the keys work) |
| S7 | No secrets in public website variables (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID` only) | V |
| S8 | The real lock name is `FINANCIAL_ACTIONS_UNLOCKED`; `MONEY_OPS_FROZEN` does not exist in code | V |
| S9 | In production the lock doesn't stop incoming payments (earlier founder decision); "checkout off" is enforced in preview only | V (code); U (production) |
| S10 | No price version, currency snapshot or routing decision is stored on orders | V |
| S11 | The PayPal unsupported-country list is not confirmed with PayPal | U |
| S12 | When PayPal settings are added, they must live in backend `.env` only and never in `NEXT_PUBLIC_*` | Design rule |

---

## 13. Non-destructive test plan (for later stages)

| Area | How | Already covered | New |
|---|---|---|---|
| India INR route selection | Offline pure function + mock upstream | `test_p2a_payment_routing`, `test_p2b_checkout_routing` | Price-version recorded |
| International USD route | Offline | 2A (31,744 combinations never return Cashfree) | PayPal sandbox (Stage F) |
| Unsupported country / currency | Offline | 2A | — |
| Missing approved price | Offline | 2A (`international_not_offered`) | Per product, from the rules file |
| Browser price / currency tampering | Offline website-server tests | `lib/offers.ts` tamper (P3) | Every order route |
| Duplicate / invalid notifications | Offline, signed fixtures | Venue, PayPal handler (2A) | Event fees (once built) |
| Amount / currency mismatch | Offline | Event-fee confirm | All flows |
| Delayed / out-of-order events | Offline | PayPal stale logic | State-machine tests |
| Duplicate payment attempts | Offline + Cashfree sandbox | TVR-24 (sandbox only, skipped) | Lock or unique index test |
| Failed / cancelled payments | Cashfree sandbox | 8 skipped sandbox tests | Browser success / fail / cancel |
| Refund-state reconciliation | Offline only (refunds locked) | — | State machine |
| Checkout-disabled and lock enforcement | Offline | `test_p0_freeze_gateway`, `test_p2d_preview_isolation`, `test_cashfree_sandbox_guard`, the gateway matrix | Pin the 5 gap routes |
| No duplicate fulfilment | Offline | Venue entitlement upsert | Event fees |
| Contract pricing preserved | Offline | `test_p3_*`, `test_p3c_*` | — |
| No provider fallback | Offline | 2A | — |

All of these run with mocks, a throwaway database, or the provider sandbox. They must not touch the main backend, send email or alerts, or create persistent business records.

---

## 14. Recommended stages (each needs your explicit approval)

- **B. Gateway hardening** (no money movement; preview and offline tests):
  - refuse or routing-check the 5 gap routes
  - make the payout and withdrawal endpoints ALWAYS refused
  - decide on `kyc/sandbox/verify-payment`
  - pin everything in tests
- **C. Billing-country source design:** account-profile country plus explicit confirmation at checkout, both recorded on the order. The IP stays a warning only.
- **D. Order record and state machine** for website-owned flows first (venue onboarding, then event fees):
  - idempotency
  - price version
  - routing decision link
  - an event-fee reconciler (read-only status re-check), or a notification route
- **E. Cashfree sandbox:**
  - needs sandbox keys, `WEB_APP_BASE_URL` and `CASHFREE_CHECKOUT_ORIGIN`
  - run the 8 skipped tests and browser success / fail / cancel checks
  - fix TVR-24
- **F. PayPal sandbox module**, off by default, for the venue US$30 only, after its price and tax are approved and the PayPal account details (§6) are confirmed.
- **G. Main-backend owner handoff:**
  - PayPal notification verification
  - the international 1:1 decision
  - `v1/payments`
  - payouts closed
  - InstaKYC price source
- **H. Production enablement:** one flow at a time, each with separate approval.

---

## 15. Rollback strategy

- Every change ships **fail-closed** behind a switch or a gateway rule, so rolling back means reverting one rule or one setting, with tests pinning the before and after.
- The money lock stays on throughout. Provider dashboards and notification URLs are not changed until a flow is approved.
- Old notification routes keep acknowledging until their replacement is verified.
- No data migration without a backup and a written restore step (snapshot pattern: `test_reports/p3c/demo_snapshot.py`).

---

## 16. Operations not performed

- No call to Cashfree, PayPal, Razorpay or any provider, sandbox or live.
- No call to, and no change in, the main backend `pro-learn-connect-1`.
- No order, booking, registration, payment attempt, refund, payout, settlement or ledger entry.
- No email or alert.
- No change to the money lock, checkout, routing rules, gateway, `.env` or deployment.
- No secret value read or printed. Two non-secret facts were derived: the Cashfree mode (`production`) and that the lock is set (`locked() = True`).
- No deletion or disabling of any legacy component.
- No deployment, publishing or merge. Prompt 5 not started.

**Evidence:**
- `/app/test_reports/p4a/gateway_matrix.py`, `gateway_matrix.json` and `gateway_matrix.log`
- snapshots `test_reports/p3c/s14_after_r3.json` and `s15_after_p4a_audit.json` (identical)
- source files and reports cited in each row
