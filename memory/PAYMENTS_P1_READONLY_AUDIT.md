# NOSTOPS Payments — Prompt 1: Read-Only Audit (Cashfree domestic · PayPal international)

**Date:** 27 Oct 2026 · **Environment:** preview workspace only · **Status:** AUDIT ONLY — stop for review.

**What was done:** source, config (key NAMES only), local preview DB (counts and state values only) and the main
backend's saved API list (`backend/tests/fixtures/main_backend_openapi_2026-10.json`, 648 paths, 26 Oct) were read.
**Not done:** no code or configuration change, no production API call, no payment, refund, payout, transfer or
settlement, no secret value read or printed. The only live request was ONE `POST /api/qa-audit-probe/refunds` to the
local gateway (`localhost:8001`), a path that the gateway refuses before anything is forwarded (result: `423`, rule
`money-keyword`).

---

## 0. Headline findings

| # | Finding | Severity |
|---|---|---|
| F1 | There are **two payment systems**. (a) This website (Next.js BFF + local FastAPI gateway/engine). (b) The **remote main backend** `pro-learn-connect-1.emergent.host`, outside this workspace. The main backend owns most money flows, its own **live** Cashfree keys and its own **PayPal** module. | Context |
| F2 | **The variable `MONEY_OPS_FROZEN` does not exist** anywhere in the code, the `.env` files or the running processes. The real lock is **`FINANCIAL_ACTIONS_UNLOCKED`**, which is locked unless it equals `"true"` (fail closed). Evidence that the lock is ON: the variable is absent from both `.env` files and from every running backend and Next.js process, and the live probe was refused with 423. → "MONEY_OPS_FROZEN verified" **cannot be claimed**. "Financial lock (`FINANCIAL_ACTIONS_UNLOCKED` absent) ON" **is verified**. | High (naming) |
| F3 | **By founder decision 2, the lock does NOT stop money coming in.** In production, order creation and inbound webhooks are forwarded. Only preview is blocked from checkout, by a separate host guard (503). "Lock ON" therefore means *no refunds, payouts, releases or credits*, **not** *no payments*. | High (understanding) |
| F4 | **The routing rule is broken today. International customers go through Cashfree:** (a) the main backend has `POST /payments/cashfree/international/create-order` (international 1:1 sessions charged in **INR via Cashfree**), and the gateway forwards it in production; (b) the website 1:1 booking charges every seeker in INR via Cashfree, with USD shown only as an estimate (`lib/currency.ts`, 83.5); (c) the venue AI-onboarding "International" plan is **US$30 via Cashfree** (`backend/ai_onboarding.py` PRICING.INTL), and the region is self-declared; (d) institutional event fees are always INR via Cashfree. **No customer-country check exists anywhere.** | **High** |
| F5 | **PayPal:** there is **no website code, keys or SDK.** The main backend has `/api/international/paypal/{config, create-order, capture/{order_id}, webhook}`, for **international 1:1 sessions only**. The gateway forwards all four in production. Only `create-order` is blocked in preview. The upstream webhook **accepts unsigned events when `PAYPAL_WEBHOOK_ID` is unset** (its own docs), and the gateway does not require PayPal signature headers. | **High** |
| F6 | **A legacy Razorpay path is still open:** `POST kyc/sandbox/create-payment` (a Razorpay payment link for InstaKYC) and `kyc/sandbox/verify-payment` (sets `kyc_paid=True`) are deliberately left open as "inbound" and pinned in `test_p0_freeze_gateway.py` INBOUND. They are **not** blocked in preview either, because the preview-guard pattern does not match them. Every other Razorpay route is refused (ALWAYS). | **High** |
| F7 | **Cashfree sandbox readiness: the code is ready but has never been run.** The preview `.env` has `CASHFREE_API_BASE` pointing at **production** (mode = production), with `CASHFREE_API_VERSION=2025-01-01` and credentials that the owner reported as rotated. Preview checkout is therefore refused (`preview_live_keys`). No sandbox keys exist, `WEB_APP_BASE_URL` and `CASHFREE_CHECKOUT_ORIGIN` are unset, and 8 sandbox tests are skipped. | Medium |

---

## 1. Architecture (as is)

```
                         ┌──────────────────────────── Browser ────────────────────────────┐
                         │ Cashfree hosted checkout (redirect)    cashfree.js v3 (venue only) │
                         └──────────┬───────────────────────────────┬─────────────────────────┘
                     /bff/* (Next.js 16, BFF)                    /api/* (ingress)
                                    │                               │
   ┌────────────────────────────────▼──────────────┐   ┌────────────▼──────────────────────────────┐
   │ Next.js BFF  (app/bff/**)                      │   │ Local FastAPI gateway (backend/server.py) │
   │  • badOrigin/CSRF, session, server-side amount │   │  1 financial_lock.rule_for → 423          │
   │  • paymentsDisabled() → 503 on preview hosts   │   │  2 unsigned Cashfree webhook → 400        │
   │  • backendFetch → refuseFinancialCall → 423    │   │  3 admin gate · 4 policy gate             │
   │  • lib/offers.ts, lib/pricing.ts (amounts)     │   │  5 preview payment guard → 503            │
   └───────┬──────────────────┬─────────────────────┘   │  6 forward → main backend                 │
           │ backendFetch      │ institutionalFetch      └────────────┬──────────────────────────────┘
           │ (bearer)          │ (X-Pulse-Secret)                     │
           │                   ▼                                      │
           │   ┌──────────────────────────────────────┐               │
           │   │ Local engine :8001 (same FastAPI)     │               │
           │   │  /api/institutional  (events, regs,   │               │
           │   │     payment intent/attach/confirm)    │               │
           │   │  /api/ai-onboarding (own Cashfree     │──► Cashfree PG REST 2025-01-01
           │   │     keys, own webhook)                │    (sandbox|production by CASHFREE_API_BASE)
           │   │  /api/verification (unified offer,    │
           │   │     paused) · Mongo nostops_web       │
           │   └──────────────────────────────────────┘
           ▼                                                          ▼
   ┌───────────────────────────────────────────────────────────────────────────────────────────┐
   │ REMOTE main backend  pro-learn-connect-1.emergent.host  (not in this workspace)            │
   │  Cashfree LIVE: /payments/cashfree/{orders,orders/{id},webhook,refunds,international/...}  │
   │  v1 Cashfree:   /v1/payments/{orders,webhook,return,admin/refund}                          │
   │  PayPal:        /international/paypal/{config,create-order,capture/{id},webhook}           │
   │  Razorpay (legacy): /payments/razorpay/*, /kyc/sandbox/*, *payment-link                    │
   │  Wallet/escrow/payouts/refunds/settlement, group quotes, 15% platform fee                  │
   └───────────────────────────────────────────────────────────────────────────────────────────┘
Inbound webhooks: Cashfree → main backend (/payments/cashfree/webhook, /v1/payments/webhook) ·
Cashfree → local /api/ai-onboarding/webhook · PayPal → /international/paypal/webhook.
Which URLs are actually registered in the provider dashboards cannot be checked from here.
```

---

## 2. File / endpoint inventory

### 2.1 Website: payment-relevant files
| File | Role |
|---|---|
| `frontend/app/bff/payments/cashfree/orders/route.ts` | Creates the order on remote `/payments/cashfree/orders` (INR only). Amount comes from `lib/offers.ts`; the 1:1 amount is re-read from remote `my-bookings`. Wallet top-up is locked. Preview → 503. |
| `frontend/app/bff/payments/cashfree/orders/[orderId]/route.ts` | Order status re-read (remote). Marks the local 1:1 audit ledger PAID. |
| `frontend/app/(public)/cashfree-return/page.tsx`, `components/payments/CashfreeReturn.tsx` | Return page. Ignores the URL and polls the status. |
| `frontend/components/payments/CashfreePayButton.tsx` | Calls the order BFF and redirects to `checkout_url`. |
| `frontend/app/bff/institutional/participant/payment/{order,confirm}/route.ts`, `lib/server/participant.ts` | Paid event registration. The amount comes from the engine `intent`. Confirm re-reads the remote order, then the engine `confirm`. |
| `frontend/app/bff/retreats/[id]/reservations/[rid]/pay/route.ts` | Retreat seat → remote `.../cashfree-order`. |
| `frontend/app/bff/booking-invite/[token]/[action]/route.ts` | Group invite. Allow-list `register` and `cashfree-order` only. |
| `frontend/app/bff/retreats/[id]/group-quote`, `.../group-book` | Group quote (read) and group hold (no online payment). |
| `frontend/app/bff/teacher/empanelment/fast-track/[...action]/route.ts` | Fast-Track → remote `.../cashfree-order`. |
| `frontend/app/bff/venue-onboarding/{checkout,status}` + `components/venues/AiOnboardingPurchase.tsx` | Local Cashfree checkout (cashfree.js v3 from the CDN). |
| `frontend/app/bff/org/bookings/route.ts` | Legacy batch creation, **closed (410)**. |
| `frontend/lib/financial-lock-rules.ts`, `lib/server/financial-lock.ts`, `lib/api.ts` | Website copy of the lock rules (parity-tested with Python). |
| `frontend/lib/payment-mode.ts`, `lib/server/payment-guard.ts` | Preview/local/unknown host → no checkout. |
| `frontend/lib/offers.ts`, `lib/pricing.ts`, `lib/cancellation.ts`, `lib/currency.ts` | Prices, hierarchy, refund tiers, indicative USD. |
| `backend/server.py`, `financial_lock.py`, `payment_guard.py`, `cashfree_diag.py`, `admin_gate.py` | Gateway: lock, preview guard, admin-only Cashfree diag. |
| `backend/ai_onboarding.py` | Local Cashfree module (orders, webhook, entitlements). |
| `backend/institutional.py` §12/§13 (≈ L3386–3500) | Payment intent, attach-order and confirm (idempotent, amount/currency/reference check). |
| `backend/verification.py` (≈ L2478, L2580) | Unified offer ₹2,499 / US$99 (**paused**). `payment/confirm` with unique `payment_reference`. |

### 2.2 Remote endpoints the website uses
`POST /payments/cashfree/orders` · `GET /payments/cashfree/orders/{id}` · `POST /retreats/{id}/reservations/{rid}/cashfree-order` ·
`POST /bookings/invite/{token}/cashfree-order` · `POST /empanelment/fast-track/{id}/cashfree-order` · `GET /retreats/{id}/group-quote` ·
`POST /retreats/{id}/group-book` · `POST /retreats/{id}/reserve` · `one-on-one/bookings`, `my-bookings` · `GET /payments/cashfree/diag` (admin, minimal).

### 2.3 Remote money endpoints the website does NOT use (still in the API list)
PayPal ×4 · `payments/cashfree/international/create-order` · `v1/payments/*` · `v1/bookings/group` · `bookings/{id}/employees/{eid}/cashfree-order` ·
`bookings/{id}/close-and-request-payment` · Razorpay ×6 · `kyc/sandbox/*` · `*payment-link` (marked DECOMMISSIONED upstream) · refunds, payouts, wallet.

### 2.4 Gateway decision per route (computed offline with `financial_lock.rule_for` + `server._PAYMENT_WRITE`)
| Route | Lock ON | Preview blocked | Note |
|---|---|---|---|
| `POST international/paypal/create-order` | forwarded | yes | production: forwarded |
| `POST international/paypal/capture/{id}` | forwarded | **no** | no security scheme in the API list |
| `POST international/paypal/webhook` | forwarded | **no** | no signature check at the gateway |
| `POST payments/cashfree/international/create-order` | forwarded | yes | **international via Cashfree** |
| `POST kyc/sandbox/create-payment` / `verify-payment` | forwarded | **no** | **Razorpay, still open** |
| `POST payments/cashfree/orders` (non-wallet) | forwarded | yes | wallet top-up → 423 |
| `POST payments/cashfree/webhook`, `v1/payments/webhook` | forwarded | — | must carry the Cashfree signature headers |
| `POST payments/cashfree/orders/{id}/refunds` | **423** | yes | locked |
| `POST payments/razorpay/*` | **423 ALWAYS** | yes | refused |

---

## 3. Entry points

**Individual enrolment**
1. **1:1 session (seeker):** `BookingForm` → `/bff/one-on-one/bookings` → `CashfreePayButton` (`one_on_one`) → `/cashfree-return`. `PendingPaymentReminder`.
2. **Institutional event (participant, magic-link):** `/events/[slug]/register` → `ParticipantPayStep` → `/bff/institutional/participant/payment/order` (`institutional_event`) → `/participant/payment/return` → confirm. *Preview data: 0 PAID events. All 13 registrations are FREE/CONFIRMED/INR.*
3. **Retreat seat:** `RetreatReserve` → `/bff/retreats/[id]/reserve`; pay via `/bff/retreats/[id]/reservations/[rid]/pay`; also `app/app/reservations`.
4. **Teacher:** `InstaKycFlow` (₹279), `FastTrackApply` (₹4,999), `WalletTopUp` (locked).
5. **Venue AI onboarding:** `AiOnboardingPurchase` (₹2,359 IN / US$30 INTL, local Cashfree).

**Group booking**
1. **Retreat group:** `GroupBook.tsx` → `group-quote` (live tiers) → `group-book` (holds seats; "host shares payment details"; no online charge in this step).
2. **Corporate/HR batch invite:** `PayNow.tsx` → `/bff/booking-invite/[token]/cashfree-order` (remote `order_type=batch`).
3. **Organisation programmes (institutional events):** flat per-participant fee. No group pricing.
4. **Not used by the website:** remote `v1/bookings/group` (Σ capacity × price per head). Legacy batch creation is closed (410).

---

## 4. Pricing-rule sources

| Rule | Authoritative source | Website copy / display | Risk |
|---|---|---|---|
| Retreat group discount tiers + min group size | **Remote** `GET /retreats/{id}/group-quote` (per retreat), applied by `POST group-book` (+15% platform fee) | `lib/pricing.ts` `resolveBooking` (uses the quote total when present). `DEFAULT_GROUP_TIERS` 5→5 %, 10→10 %, 20→15 % on public pages (`retreats/[id]/group`, `retreats/in/[city]/[retreat]`) | The default ladder is **unverified** against the remote, so a page can show a different discount than the quote |
| One-benefit hierarchy (standard → early-bird → limited-time → cohort → group; lowest wins, never combined) | **Website only** `lib/pricing.ts` | same | The remote enforces only the group tiers ("backend enforces only group tiers today") |
| Teacher cohort models A–D | **Website only** `lib/pricing.ts` (honoured by the teacher) | same | Not enforced server-side |
| Teacher group class | Remote `v1/bookings/group`: Σ capacity × `price_per_head_inr` | — | Unused |
| 1:1 rate | Remote booking `amount_inr` (tier min/max: `teachers/me/tier-pricing-rules`) | BFF re-derives it and rejects a different browser amount | — |
| Institutional event fee | **Local engine** `participant_fee` (int INR 0–1,000,000), currency fixed to INR | `payment/intent` | No international pricing |
| InstaKYC ₹279 incl. GST | **Two sources:** `lib/pricing.ts` `INSTAKYC_PRICE_INR` (sent as the amount) **and** remote `GET /kyc/pricing` ("single source of truth") | `lib/offers.ts` | Drift risk |
| Fast-Track ₹4,999 | Remote offer (`empanelment/fast-track/offer`) | `FAST_TRACK_PRICE_INR` (display) | — |
| Venue AI onboarding | `backend/ai_onboarding.py` `PRICING` (IN 1,999 + 18 % = 2,359 INR; INTL 30 USD) | `AiOnboardingPurchase` PRICE | INTL runs on Cashfree |
| Unified offer ₹2,499 / US$99 | `backend/verification.py` | — | **Paused** |
| Refund tiers 30+/15–29/<15 days → 100/50/0 % | Remote refund calculator (`refund-preview`) | `lib/cancellation.ts` mirror | Mirror drift |
| Platform 15 % / teacher 85 % | Remote | display only | — |
| USD estimate | `lib/currency.ts` `INR_PER_USD = 83.5` (display only) | `TeacherCard` | Not a charge amount |

---

## 5. Order / payment states and idempotency

| Store | States | Idempotency / guards |
|---|---|---|
| Remote Cashfree orders (from its API docs; **not verified by calls**) | ACTIVE → PAID / EXPIRED …; refunds ≤ captured | Webhook HMAC (timestamp + raw body), 5-min window, de-dupe by event id / body hash; v1 webhook amount-guarded |
| Local `ai_onboarding_orders` / `_entitlements` / `_webhook_events` | order `mode` stored; latest attempt FAILED / USER_DROPPED | Signature → 24 h replay window → preview isolation → de-dupe (`x-idempotency-key` or payload hash) → authoritative re-read; idempotent entitlement upsert; 30-min checkout reuse. **TVR-24 open:** two simultaneous checkouts can create two orders |
| Local `inst_registrations` | `booking_status` PENDING_PAYMENT → CONFIRMED; `payment_status` NOT_REQUIRED / PAID | `payment_order_ids` ($addToSet); confirm is idempotent; amount, currency and reference must match; duplicate or not-pending payments are recorded (audit), never lost. **No webhook:** confirmation happens only from the return page |
| Local `audit_ledger` (1:1) | PENDING_PAYMENT → PAYMENT_INITIATED → PAID | seeker-scoped mark-paid by order id |
| Local `verification_payments` | — | unique `payment_reference` |
| Remote PayPal (from its API docs) | create-order → capture(order_id, booking_id) → webhook CAPTURE.COMPLETED / DENIED / REFUNDED | Signature verified **only if `PAYPAL_WEBHOOK_ID` is set** |

Preview DB snapshot (counts only): ai_onboarding_orders 0 · entitlements 0 · webhook_events 16 (all `ignored`) · audit_ledger 0 ·
inst_registrations 13 (FREE) · inst_settlements 0 · PAID events 0 · verification_payments 6 (INR + USD, QA).

---

## 6. Financial safeguards and test status

**Safeguards in place:** gateway and website lock rules with a parity test (ALWAYS: mock checkout, mock card, Razorpay, self-empanel;
LOCK: payouts, wallet heal, withdraw, refunds, mark-paid, release, splits, credits, plus a money-keyword catch-all); unsigned Cashfree
webhook → 400; preview payment guard (BFF + gateway) → 503; server-side amounts everywhere; the redirect is never treated as proof;
Cashfree diag is admin-only and minimal; sandbox/live host binding (`checkout_decision`); CSRF/origin checks on every money BFF route.

**Run now (offline, mock upstream; nothing forwarded, nothing written):**
| Suite | Result |
|---|---|
| `test_cashfree_sandbox_guard.py`, `test_p0_freeze_gateway.py`, `test_p0_razorpay_callback.py`, `test_p0_cashfree_diag.py`, `test_p0_encoded_delimiter_bypass.py` | **429 passed, 12 skipped** (the skips are reviewed `LEFT_OPEN` no-money routes) |
| `npm run test:pricing` | **passed** (₹279 = ₹236 + ₹43) |

**Not run, on purpose** (they call the live main backend, log in demo users or write local QA rows): `workflow/test_wf_financial_safety.py`,
`test_wf_b47_privacy_payments.py`, `test_p0_live_gateway_iter.py`, `test_p0_inbound_payments.py`, `test_participant_paid_payment_chain.py`,
`test_b23_*`, `workflow/test_wf_ai_onboarding.py` (its 8 sandbox tests would skip anyway). Last recorded results: `CASHFREE_SANDBOX_COMPLETION_REPORT.md`.

**No tests exist for:** PayPal (anywhere), provider routing by customer country, or international pricing.

---

## 7. Legacy gateway references

| Reference | Where | Active? |
|---|---|---|
| `payments/razorpay/*` (create-order, verify, verify-payment-link, recover, webhook, GET callback) | Remote | **Refused (ALWAYS)** at the gateway |
| `empanelment/fast-track/{id}/razorpay-create|verify`, `.../pay` | Remote | Refused (ALWAYS) |
| **`kyc/sandbox/create-payment|verify-payment` (Razorpay link → `kyc_paid`)** | Remote | **OPEN** (pinned as inbound), not preview-blocked |
| `bookings/invite/{token}/payment-link`, reservation `create-payment-link` | Remote | Marked DECOMMISSIONED upstream (not verified); the website never calls them; the gateway forwards them |
| `bookings/{id}/cancel` docstring "full Razorpay refunds" | Remote | Locked (refund) |
| `razorpay_payment_id` field read | `frontend/lib/server/one-on-one.ts` | Read-only data coupling |
| Razorpay/PayPal mentions in old docs (`BUSINESS_LOGIC.md`, `MOBILE_TO_WEB_*`, `YOGA_SEEKER_JOURNEY_AUDIT.md`) | Docs | Out of date (they say PayPal is absent, which is wrong) |
| Remote mock mode (`mock-checkout`) | Remote | Refused (ALWAYS) |

---

## 8. Missing configuration, permissions and live approvals

**Cashfree (domestic)**
- Sandbox: `CASHFREE_CLIENT_ID` / `CASHFREE_CLIENT_SECRET` (sandbox), `CASHFREE_API_BASE=https://sandbox.cashfree.com/pg`, `WEB_APP_BASE_URL`,
  `CASHFREE_CHECKOUT_ORIGIN` (both set to the preview origin). **None are set.** The preview `.env` currently points at production.
- Dashboard: whitelist the preview and `www.nostops.org` origins; register webhook URLs; confirm which Cashfree account the **main backend** uses
  (the same approved Indian proprietorship account or not).
- Account confirmations (owner/Cashfree): permitted business category and payment modes; settlement account; **international payments
  disabled**, so a USD order is refused (the code already expects "currency not enabled").

**PayPal (international)**
- Nothing exists locally: no `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` or `PAYPAL_API_BASE` (sandbox/live).
- Account approval alone does **not** prove: a REST app exists (sandbox + live), the Orders v2 / Checkout permissions, a webhook ID,
  the **currencies enabled for receiving** (USD and any others; auto-accept vs manual), refund permission, or the bank withdrawal setup.
- To confirm with PayPal for an Indian business account: cross-border-only receiving (no domestic Indian buyers), the export purpose code /
  FIRC requirements, and auto-withdrawal rules.
- Main backend PayPal module: confirm `PAYPAL_WEBHOOK_ID` is set in production, the registered webhook URL, and that `capture` is bound to
  the booking owner. **None of this can be verified from here.**
- Tax: GST on international (export) services and LUT wording belongs to **B5.2, which is blocked**. No tax copy should be written until it is approved.

---

## 9. Risks (ranked)

1. **R1 High:** international payments currently run on Cashfree (F4). This violates the mandatory routing.
2. **R2 High:** the PayPal webhook may accept unsigned events upstream, and the gateway does not check them. `capture` has no declared auth.
3. **R3 High:** the legacy Razorpay InstaKYC payment link plus the `kyc_paid` flip are still reachable in production (F6).
4. **R4 Medium:** "lock ON" does not stop collection (F3). Once live keys are present and the site is published, payments are taken even with the lock on.
5. **R5 Medium:** no country-of-customer rule exists, and the region is self-declared (venue). Spoofing → wrong provider or wrong price.
6. **R6 Medium:** prices live in two places (InstaKYC website vs remote; group tiers default vs remote quote; refund tiers mirror).
7. **R7 Medium:** paid institutional registrations have no webhook or reconciler, so a payment stays PENDING if the browser closes.
8. **R8 Medium:** TVR-24 duplicate concurrent orders (local module).
9. **R9 Medium:** most money logic, plus PayPal, lives on a remote backend this workspace cannot change or inspect. Remote config is unverifiable here.
10. **R10 Low:** the control is called `MONEY_OPS_FROZEN` in conversation but `FINANCIAL_ACTIONS_UNLOCKED` in code. Reports must use the real name.

---

## 10. Minimal implementation plan (for review — nothing is built yet)

**Step 0: decisions and config (owner).** See the questions below. Fill the Cashfree **sandbox** test slots. Create a PayPal **sandbox**
REST app plus a webhook ID. Confirm the PayPal receiving currencies.

**Step 1: gateway hardening (no money movement; preview + tests).**
- Refuse `payments/cashfree/international/create-order` (routing rule).
- Refuse the Razorpay `kyc/sandbox/create-payment|verify-payment` (reverses an earlier "left open" decision, so it needs your approval).
- Require the PayPal transmission signature headers on `international/paypal/webhook` before forwarding.
- Block `international/paypal/capture/*` in preview.
- Update the pinned test lists and the website rule copy, keeping the parity test green.

**Step 2: one routing rule (pure function, Python + TS copies with a parity test).**
`decide(flow, billing_country, currency)`: **Cashfree** only for India + INR; **PayPal** only for an eligible flow + a non-India billing country +
an enabled currency; anything else → **refuse** (fail closed). Every checkout BFF calls it server-side. The amount stays server-side.

**Step 3: PayPal module, sandbox only, off by default** (`PAYPAL_ENABLED` unset → refused). This would be an isolated local module like
`ai_onboarding.py`: Orders v2 create/capture, server-side amount and currency, capture idempotent per order id, amount/currency/reference
check, webhook verified through the verify-webhook-signature API (refused when `PAYPAL_WEBHOOK_ID` is unset), sandbox only on the preview
origin and live only on a production host (same pattern as `checkout_decision`). No refunds or payouts.

**Step 4: first flow.** Move the venue AI-onboarding **International US$30** from Cashfree to PayPal (local, already USD-priced, isolated).
Then institutional event fees (only if an international price is approved). 1:1 international sessions would use the **main backend's** PayPal
module, after its owner confirms webhook verification. That is a backend-owner task.

**Step 5: Cashfree domestic sandbox validation** of the existing flows. Run the 8 skipped tests and do browser success/failure/cancel checks.

**Step 6: read-only reconciliation report (admin).** Compare local orders with the provider status. No refunds, no settlement.

**Out of scope while the lock is on:** refunds, payouts, transfers, settlements (B4.9), tax/legal wording (B5.2).

### Questions for your review
1. Which flows count as **eligible international**: venue AI onboarding only, institutional events, 1:1 sessions, retreats?
2. How is a customer "international": the declared billing country, a phone/IP check, or both? What happens for an Indian customer abroad?
3. Which currencies should PayPal accept (USD only?), and who sets the international prices?
4. For 1:1 international sessions: use the main backend's existing PayPal module (needs its owner), or keep 1:1 on Cashfree until later?
5. Do you approve the Step 1 hardening, including closing the legacy Razorpay InstaKYC route that was deliberately left open?

**STOP — end of read-only audit. No code or configuration was modified.**
