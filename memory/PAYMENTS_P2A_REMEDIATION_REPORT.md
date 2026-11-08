# NOSTOPS Payments — Prompt 2A: Safety Remediation and Routing Design (deliverable report)

**Date:** 27 Oct 2026 · **Environment:** preview workspace only · **Status:** DONE AND TESTED. Stopped for founder review before Prompt 3.

**Boundaries kept:** nothing was deployed or published. The money lock is still ON (its real name is `FINANCIAL_ACTIONS_UNLOCKED`, and it is
absent, so locked; see audit F2). I made no live payment, refund, payout, transfer or settlement, edited no historical record, sent no
write to the main backend (`pro-learn-connect-1`), and read or printed no secret value. Every payment test ran offline (mock PayPal,
mock main backend, a throwaway database that is dropped afterwards), or sent requests that are refused before anything is forwarded.

---

## 1. Routing rule now enforced (one server-side policy: `backend/payment_routing.py`, version `2026-10-27.1`)

| Billing country (chosen explicitly at checkout) | Provider | Currency | Result this phase |
|---|---|---|---|
| India (`IN`) | **Cashfree** | **INR only** | Allowed (still refused in preview by the test-mode guard) |
| India + any other currency | — | — | Refused: "Payments with an India billing address are taken in Indian rupees (INR) only…" |
| Outside India, product has an approved USD price (venue AI onboarding US$30) | **PayPal** | **USD only** | **Refused, 503:** "International checkout temporarily unavailable. PayPal checkout is being prepared. No payment has been taken." (no PayPal checkout is built: `PAYPAL_CHECKOUT_FLOWS` is empty) |
| Outside India, product has no international price (events, 1:1, InstaKYC, wallet, Fast-Track, retreat seat, group invite) | — | — | Refused: "International payment for this item is not available yet…" |
| PayPal-unsupported country (CU, IR, KP, SY, RU; to be confirmed with PayPal) | — | — | Refused |
| Missing, invalid (`India`, `USA`, `XX`), or conflicting with the account country | — | — | Refused (400 / 422) |
| IP country differs | — | — | **Risk flag only** (`ip_country_mismatch`), never decisive. A phone number is not used. |

- **Never via Cashfree:** a test checks every non-India country × every flow × currency × PayPal state (31,744 combinations). None returns Cashfree.
- **No silent fallback:** a PayPal decision can never become a Cashfree order, and an unknown input is refused, not granted.

## 2. Updated dependency diagram

```
 Browser ── /venues/ai-onboarding (billing-country select, no default)
   │  IN → "Pay ₹2,359" (Cashfree, INR)        non-IN → amber "International checkout temporarily unavailable", button disabled
   ▼
 Next.js BFF /bff/venue-onboarding/checkout
   1 CSRF  2 billing country: missing/invalid → 400 · non-IN → 503 (nothing sent)  3 preview guard → 503 test mode
   ▼ X-Pulse-Secret
 Local FastAPI  /api/ai-onboarding/create-order
   1 secret  2 price region must match billing country (422)  3 payment_routing.decide() → must be cashfree
   4 checkout_decision (sandbox only on preview, live only on production)  5 venue link  6 Cashfree order (records routing)
                                                                            └─► Cashfree PG (INR)
 Local FastAPI gateway /api/*  (server.py proxy, order of checks)
   1 bad path → 400   2 financial lock → 423   3 payment_routing.gateway_refusal():
        POST payments/cashfree/international/*  → 403 (international via Cashfree)
        POST kyc/sandbox/create-payment         → 410 (retired Razorpay link; switch LEGACY_RAZORPAY_KYC_CHECKOUT=allow)
   4 international/paypal/webhook → paypal_webhook.handle() (verify, then forward once)
   5 unsigned Cashfree webhook → 400   6 Cashfree diag   7 Policy V2 gate   8 admin gate
   9 preview payment guard → 503 (now also PayPal capture + kyc/sandbox create|verify-payment)   10 forward
                                                                            └─► REMOTE main backend (not changed)
 PayPal ──► /api/international/paypal/webhook ──► [config + host binding] ──► [headers, cert URL, algorithm, time]
          ──► PayPal verify-webhook-signature (OAuth) ──► [merchant, capture + order ids] ──► one record per event id
          ──► COMPLETED/DENIED forwarded once · REFUNDED/REVERSED HELD (money lock) · others IGNORED · older = STALE
 BFF-callable routing API (shared secret): POST /api/payment-routing/decide · POST /api/payment-routing/decisions/{id}/order
```

## 3. Changed files

| File | Change |
|---|---|
| `backend/payment_routing.py` (new) | The policy (`decide`), the 249 ISO country codes, provider messages, gateway refusals, and the BFF routing API with decision recording (provider, currency, pricing snapshot, policy version, risk flags). Linking an order is done once, with a currency and amount check. |
| `backend/paypal_webhook.py` (new) | Gateway PayPal webhook verification (§5). |
| `backend/payment_guard.py` | `paypal_mode` / `paypal_env_decision`: exact API host, https only, sandbox only on preview, live only on production. |
| `backend/server.py` | Mounts the routing API; the gateway runs the routing refusals and PayPal verification; the preview guard now also covers `capture` and `kyc/sandbox/(create\|verify)-payment`. |
| `backend/ai_onboarding.py` | Checkout requires `billing_country`. The price region must match it. Routing runs before any venue lookup or Cashfree call. The order stores `billing_country`, `provider`, `routing`, `pricing_snapshot`. |
| `backend/institutional.py` | Event-fee attach can store a routing decision id (optional; **not called yet**, see §8). |
| `frontend/lib/countries.ts`, `frontend/lib/payment-routing.ts` (new) | Website copy of the country list and messages (a test checks they match the Python copy). |
| `frontend/components/venues/AiOnboardingPurchase.tsx` | The India/International toggle is replaced by a required billing-country select. International shows the unavailable notice with a disabled button. The Cashfree INR note and legal line show only when allowed. |
| `frontend/app/bff/venue-onboarding/checkout/route.ts`, `frontend/lib/server/venue-onboarding.ts` | Refuses before anything is sent; the region now comes from the billing country, not from the browser. |
| `frontend/app/bff/teacher/kyc/[...action]/route.ts` | No longer forwards `create-payment` (Razorpay link). `verify-payment` is kept. |
| `backend/tests/test_p2a_payment_routing.py` (new, 197 cases), `backend/tests/test_p2a_http_live.py` (new, by the testing agent, 26), `backend/tests/workflow/test_wf_ai_onboarding.py` (+7 routing cases; helpers send `billing_country`) | Tests |

*`frontend/yarn.lock` shows changes I didn't make. It was already modified at the start of this session, and `package.json` is unchanged. Left as found.*

## 4. Venue AI-onboarding International US$30 checkout: disabled at three layers
1. **Page:** a non-India country shows the amber notice, and the button is disabled. No request is sent.
2. **BFF:** non-India → 503 `provider_unavailable`. An `IN` region sent with a foreign country is refused too.
3. **Backend:** INTL → 503. A price/country mismatch → 422. A Cashfree order is never created. This holds even with PayPal sandbox keys configured.

## 5. PayPal webhook security (gateway, fail closed)
- **Config must be complete:** `PAYPAL_API_BASE` (exactly `api-m.sandbox.paypal.com` or `api-m.paypal.com`), client id + secret,
  `PAYPAL_WEBHOOK_ID` and `PAYPAL_MERCHANT_ID`, plus host binding. Otherwise **503, nothing recorded, nothing forwarded** (today's state: no keys).
- **Before PayPal is asked:** all 5 transmission headers; the cert URL must be https `*.paypal.com` in the same environment; `SHA256withRSA`;
  transmission time no more than 3 days old (+1 h grace) and no more than 5 min ahead; a well-formed event (`WH-…` id, type, resource); UTF-8.
- **Signature:** PayPal's `verify-webhook-signature` (OAuth), with the raw body embedded byte for byte. Anything except `SUCCESS` → 400. PayPal unreachable → 503.
- **After verification:** the merchant must match, and the capture id + order id must be present. A REJECTED event is checked again on PayPal's retry, so a corrected setting still delivers it.
- **Idempotency:** one record per event id. An event is forwarded once, even under simultaneous deliveries (atomic claim, 2-min takeover).
  If the main backend fails, the event is marked FORWARD_FAILED and is delivered once on PayPal's retry. An older event after a newer one for the same capture
  is STALE. Refunds and reversals are matched to their capture through the `up` link.
- **Money lock:** `PAYMENT.CAPTURE.REFUNDED` / `REVERSED` are **HELD**: recorded and acknowledged, not forwarded. Nothing here marks an order paid.

## 6. Test results (27 Oct 2026, preview)
| Suite | Result |
|---|---|
| `tests/test_p2a_payment_routing.py` (new, offline) | **197 passed** |
| Existing gateway/payment suites (`test_p0_freeze_gateway`, `test_cashfree_sandbox_guard`, `test_p0_razorpay_callback`, `test_p0_cashfree_diag`, `test_p0_encoded_delimiter_bypass`) | **429 passed, 12 skipped** (the reviewed `LEFT_OPEN` routes; unchanged) |
| `tests/workflow/test_wf_ai_onboarding.py` (local server) | **33 passed, 8 skipped** (they create Cashfree **sandbox** orders; no sandbox keys) |
| `tests/test_p2a_http_live.py` (local gateway + preview BFF, refusals only) | **26 passed** |
| Website: `tsc`, `eslint`, `npm run test:pricing` | clean / passed |
| testing_agent iteration 186 (UI at 390×844 and desktop, BFF, gateway) | All requested checks passed. Its 5 logic gaps were fixed and re-tested (rejected-event retry, refund↔capture staleness, attach amount/race, clearer mismatch message, no DB defaults in the new modules) |

## 7. Razorpay InstaKYC: migration plan (feature-flagged, nothing deleted)
**Done now (step 1):**
- The gateway refuses `POST kyc/sandbox/create-payment` with **410**, and the website BFF no longer forwards it.
- Reversible switch: `LEGACY_RAZORPAY_KYC_CHECKOUT=allow`. Exact value only, and preview stays blocked.
- `kyc/sandbox/verify-payment` is **kept** on production, so a link paid before the change still sets `kyc_paid`. It is blocked in preview.
- No record was touched.

**Dependencies mapped:**
- **Who pays and how:** the website InstaKYC flow pays ₹279 through Cashfree (`/payments/cashfree/orders`, `order_type=instakyc`). The website never used the Razorpay link.
- **Teacher status:** it reads `kyc/sandbox/status` and `kyc_paid` / `instakyc_paid` from the main backend. It is unchanged.
- **The other `kyc/sandbox/*` calls** (Aadhaar, PAN and bank checks) are not payments and are unchanged.
- **Mobile app:** it may still call the old link through the main backend directly. That can't be controlled from here.

**Next steps (need the main-backend owner, BLOCKED here):**
1. List the open, unpaid Razorpay InstaKYC links. Then let them expire, or cancel them.
2. Once none can still be paid, retire `verify-payment` the same way (410 + switch).
3. Mark the main-backend Razorpay endpoints decommissioned. Keep every historical `razorpay_*` record read-only for audit.
4. Make `GET /kyc/pricing` the only source of the ₹279 price (today the website constant duplicates it).

## 8. Blocked or open tasks (not claimed as done)
**External main backend (`pro-learn-connect-1`), BLOCKED. This workspace can't change it. Patch specification:**
1. **PayPal webhook** (`POST /api/international/paypal/webhook`): refuse when `PAYPAL_WEBHOOK_ID` is unset (503). Verify every event with
   `verify-webhook-signature`, using the raw body. Check `resource.payee.merchant_id`. De-duplicate by event id. Ignore out-of-order events per capture.
   Never apply REFUNDED/REVERSED while the money lock is on. Register PayPal to call **through the website gateway** (`www.nostops.org/api/…`), or
   apply the same checks upstream, because a direct call to the main backend bypasses the gateway.
2. **PayPal capture** (`/international/paypal/capture/{order_id}`): require the booking owner's session and check amount, currency and booking id against the server price.
3. **Remove or refuse `POST /payments/cashfree/international/create-order`** upstream too. The gateway refuses it, but direct calls reach the main backend.
4. Confirm the production values of `PAYPAL_WEBHOOK_ID`, the registered webhook URL and the Cashfree account in use.

**Website, open (planned for Prompt 3, after approval):**
- **Other checkouts still have no billing-country step:** the 1:1 session, institutional event fee, retreat seat, Fast-Track, InstaKYC and group invite.
  These go to the main backend or the local engine and charge INR through Cashfree. Preview blocks them, but **after a publish an
  international buyer could still pay in INR on them.** The routing API (`/api/payment-routing/decide` + `/decisions/{id}/order`) and the
  event-fee attach field are ready for each BFF to call. The UI step for each checkout is not built.
- Public copy still says "International US$30" (`/venues`, `/venues/ai-onboarding`, `/list-your-venue`), while checkout says it is unavailable.
  Wording decision for you.
- From the audit, not in scope of 2A: event-fee payments have no webhook or reconciler (R7); two simultaneous venue checkouts can create two orders (TVR-24); the InstaKYC price is set in two places (R6).

**Config the founder/owner must supply before any sandbox run:**
- **Cashfree sandbox:** keys, `CASHFREE_API_BASE`, `WEB_APP_BASE_URL`, `CASHFREE_CHECKOUT_ORIGIN`.
- **PayPal sandbox:** a REST app with client id/secret, `PAYPAL_API_BASE`, a webhook ID, the merchant ID, and confirmation of USD receiving and the unsupported-country list.
- Tax and GST wording stays under **B5.2 (blocked)**. Payouts and refunds stay under **B4.9 (blocked)**.

---
**STOP. Prompt 2A is complete in preview. Waiting for explicit founder approval before Prompt 3.**
