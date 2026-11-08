# NOSTOPS — Remote Backend Cashfree Migration Gap Analysis
**Status:** Read-only analysis. No code changed. No Razorpay removed. No deploy. No flow modified. Awaiting authorization to implement.
**Method:** Verified against the remote backend's live OpenAPI (`https://pro-learn-connect-1.emergent.host/openapi.json`, 619 paths) + its Cashfree diagnostics endpoint. No secrets exposed. No side-effecting POST calls were made.

---

## 0. CRITICAL CURRENT STATE (read this first — changes the whole plan)

**Finding 0.1 — Cashfree is ALREADY fully built on the remote backend (live mode):**
- `GET/POST /api/payments/cashfree/orders` (create + list)
- `GET /api/payments/cashfree/orders/{order_id}` (authoritative status)
- `POST /api/payments/cashfree/orders/{order_id}/refunds` (**Cashfree refund exists**)
- `POST /api/payments/cashfree/webhook` (headers `x-webhook-timestamp`, `x-webhook-signature`, `x-idempotency-key` → **signature verification + idempotency already designed in**)
- `GET /api/payments/cashfree/checkout/{order_id}` (hosted checkout) + `mock-checkout/*` (sandbox) + `diag`
- Diag reports: `env=production`, `gateway=live`, `api_base=https://api.cashfree.com/pg`, `api_version=2025-01-01`, `web_app_base_url=https://www.nostops.org`.

**Finding 0.2 — 🔴 The production Cashfree credentials are currently INVALID:**
`cashfree_auth_check → { http_status: 401, creds_valid: false, message: "authentication Failed" }`.
➜ **This is why checkout returns HTTP 424 today.** Until the correct **NOSTOPS Proprietorship Merchant Account** Cashfree `client_id`/`secret` are installed on the remote backend env, **no Cashfree order can be created for ANY flow** (including the already-migrated 1:1 / InstaKYC / Wallet flows). **This is a backend-env / merchant-account action (user + backend team) — not a code fix.**

**Finding 0.3 — International = PayPal, not Razorpay:** `/api/international/paypal/{config,create-order,capture,webhook}`. There is **no Razorpay international path.** (Note for the "Cashfree = sole gateway" rule: PayPal is a *separate* international gateway; retiring it in favour of Cashfree international is a distinct, backend + merchant-enablement decision, outside the Razorpay-removal scope.)

**Finding 0.4 — There is also a newer generic module** `/api/v1/payments/*` (create `{booking_id, student_email, student_phone}`, status, checkout, return, webhook, admin/refund, admin/paid-bookings) and `/api/v1/payouts/*` (withdraw `{amount_inr}`, webhook, `{transfer_id}`) — the payouts module is the teacher **settlement** path (Cashfree Payouts), distinct from checkout.

---

## TASK 1 — CURRENT REMOTE API CONTRACTS (the 3 Razorpay-dependent flows)

### Flow 1 — Teacher Empanelment Fast-Track (₹4,999)
| Aspect | Detail |
|---|---|
| Endpoint(s) | `POST /api/empanelment/fast-track/{request_id}/razorpay-create`, `POST /api/empanelment/fast-track/{request_id}/razorpay-verify`. Also a **mock** `POST /api/empanelment/fast-track/{request_id}/pay` (`MockCardPayment{card_number,card_holder,expiry_month,expiry_year,cvv}`) — sandbox only, **not** a real Cashfree checkout. |
| Method | POST |
| Request | `razorpay-create`: no body (request_id in path). `razorpay-verify`: Razorpay verification payload. |
| Response | `razorpay-create` returns a hosted-link payload → FE reads `short_url` (`FastTrackApply.tsx` L114-119, opens new tab). |
| Auth | Bearer (session) via BFF `backendFetch`. |
| Amount / Currency | ₹4,999 / INR (from `/empanelment/fast-track/offer`). |
| Reference / Order / Payment ID | Business ref = `request_id`; gateway order/payment IDs are Razorpay's (internal to remote). |
| Status | `submitted → pending_payment → paid → in_review → scheduled → approved/rejected`; FE reads `payment?.status` (`lib/server/teacher.ts`). |
| Redirect / Callback | FE opens Razorpay `short_url`; confirmation via Razorpay webhook on remote. |
| Webhook | `POST /api/payments/razorpay/webhook` (remote). |
| Error | `{detail}`/`{message}` surfaced by BFF. |
| Refund | Razorpay (remote); no FE call. |

### Flow 2 — Retreat Seat Reservation
| Aspect | Detail |
|---|---|
| Endpoint | `POST /api/retreats/{retreat_id}/reservations/{reservation_id}/create-payment-link`; status `GET /api/retreats/reservation/{reservation_id}/payment-status`. |
| Method | POST (empty body) / GET |
| Request | Path IDs only; reservation created earlier via `POST /api/retreats/{id}/reserve` `{name,email,phone,…,attribution?}`. |
| Response | `{ short_url \| payment_link \| checkout_url }` → **Razorpay hosted link** (`pay/route.ts` L25); FE redirects (`RetreatReserve.tsx`, `reservations/page.tsx`). |
| Auth | Bearer (session). |
| Amount / Currency | retreat `price_per_seat_inr` / INR. |
| Reference / Order / Payment ID | Business ref = `reservation_id`; gateway IDs Razorpay-internal. |
| Status | reservation `pending → confirmed`; `payment-status` endpoint reports it. |
| Redirect / Callback / Webhook | Razorpay hosted page → Razorpay webhook (remote). Fallback: off-platform UPI/bank via host WhatsApp. |
| Refund | Backend `cancel-with-refund` (Razorpay). |

### Flow 3 — Group / Corporate Booking Invitation ("Pay Now")
| Aspect | Detail |
|---|---|
| Endpoint | `POST /api/bookings/invite/{token}/payment-link` (`ParticipantPayIn{email}`). Related: `/bookings/{id}/pay` (mock), `/bookings/{id}/employees/{eid}/payment-link`, `/bookings/{id}/close-and-request-payment`, `/bookings/{id}/send-payment-requests`. |
| Method | POST |
| Request | `{ email }` (the enrolled participant's email). |
| Response | `{ short_url }` → **Razorpay hosted link** (`PayNow.tsx` L17-20). |
| Auth | Public token (CSRF double-submit); token pattern-validated in BFF. |
| Amount / Currency | locked per-seat group price / INR. |
| Reference / Order / Payment ID | Business ref = invite `token` / `booking_id`; gateway IDs Razorpay-internal. |
| Status | enrollment `pending → confirmed`. |
| Redirect / Callback / Webhook | Razorpay hosted page → Razorpay webhook (remote). |
| Refund | Backend (Razorpay). |

---

## TASK 2 — REQUIRED CASHFREE CONTRACT (target lifecycle per flow)

**Existing reusable Cashfree order contract (already live):**
`POST /api/payments/cashfree/orders` → `OrderCreateReq { amount*, currency(INR|USD|EUR|GBP), order_type(string), reference_id(string|null), customer_id*, customer_name, customer_email, customer_phone*, note, return_url }` → returns `{ order_id, payment_session_id, checkout_url, amount, currency, status, mode }`. Status: `GET …/orders/{order_id}`. Refund: `POST …/orders/{order_id}/refunds { amount*, refund_id?, note? }`. Webhook: `POST …/cashfree/webhook`.
> Note: `return_url` is a first-class field → our BFF can pass it to fix the split-host preview return (PRD's 424/return note).

- **Fast-Track:** Teacher → application (`request_id`) → Cashfree order `order_type=empanelment_fast_track`, `reference_id=request_id` → hosted checkout → payment → **cashfree webhook flips the fast-track request to `paid`** → status updated. Refund via cashfree refunds.
- **Retreat:** Seeker → `reserve` (`reservation_id`) → Cashfree order `order_type=retreat_reservation`, `reference_id=reservation_id` → checkout → **webhook confirms the seat** → `payment-status`=paid → receipt.
- **Group / Corporate:** Participant → invite `token` (→ `booking_id`) → Cashfree order `order_type=group_booking`, `reference_id=booking_id/token` → checkout → **webhook confirms enrollment**.

---

## TASK 3 — CAN WE REUSE THE EXISTING CASHFREE ORDER INFRA? (verify, don't assume)

**HTTP-contract level: YES.** `order_type` (free string) and `reference_id` are already accepted by `POST /api/payments/cashfree/orders`, exactly as the live 1:1 (`order_type=one_on_one`), InstaKYC (`instakyc`) and Wallet (`wallet_topup`) flows use them. The BFF already resolves `reference_id` + amount server-side and never trusts the client. So the frontend *can* create Cashfree orders for `empanelment_fast_track` / `retreat_reservation` / `group_booking` with the same pattern.

**Business-linkage level: UNVERIFIED — must be confirmed by the backend team (do NOT assume).** Creating a Cashfree order is only half the lifecycle. For the flow to actually complete, the remote backend must, **on the Cashfree webhook**, map each `order_type`+`reference_id` back to its business object and perform the state change:
- `empanelment_fast_track` → set fast-track request `paid` + enter Council queue,
- `retreat_reservation` → confirm the seat (decrement inventory, mark reservation paid),
- `group_booking` → confirm participant enrollment.
The remote Cashfree webhook handler exists, but **whether it recognises these three order_types and triggers the correct activation is internal to the frozen backend and cannot be verified from the OpenAPI schema.** Today those activations are wired to the **Razorpay** webhook, not the Cashfree one.

**Also note:** the gateway-neutral `POST /api/empanelment/fast-track/{request_id}/pay` is a **MockCardPayment** (sandbox), NOT a real Cashfree checkout — it must not be treated as the production Cashfree path.

**Verdict:** Reuse is the right target and the HTTP surface supports it, but it is **blocked** on (a) valid live Cashfree creds (Finding 0.2) and (b) backend confirmation/implementation that the Cashfree webhook activates these three order_types. **Do not remove the Razorpay calls until both are true.**

---

## TASK 4 — REQUIRED REMOTE BACKEND CAPABILITIES (spec for the backend team)

| Capability | Exists on remote? | Gap / Action required |
|---|---|---|
| **Cashfree payment creation** | ✅ `POST /api/payments/cashfree/orders` (order_type + reference_id) | Confirm it accepts `order_type ∈ {empanelment_fast_track, retreat_reservation, group_booking}` and computes the authoritative amount server-side from the referenced object. |
| **Server-side verification / status** | ✅ `GET /api/payments/cashfree/orders/{order_id}` | None (FE already re-reads it). |
| **Webhook (secure)** | ✅ `POST /api/payments/cashfree/webhook` (signature + idempotency headers) | Confirm/extend so the handler **activates all three business flows** on paid, not just 1:1/KYC/wallet. |
| **Idempotency** (no duplicate txn/booking/fast-track/seat/enrollment/earning) | ✅ `x-idempotency-key` supported | Confirm dedupe keyed on `order_id`/`reference_id` for the 3 flows. |
| **Refund** | ✅ `POST /api/payments/cashfree/orders/{order_id}/refunds` | Wire retreat `cancel-with-refund` + fast-track/group refunds to Cashfree refunds instead of Razorpay. |
| **Authoritative status lookup** | ✅ orders/{id} + `/api/retreats/reservation/{id}/payment-status` | None. |
| **Valid production credentials** | 🔴 **NO — `creds_valid:false` (401)** | Install correct NOSTOPS Proprietorship Merchant Account Cashfree keys in remote env (**merchant + backend-env action**). Blocks ALL Cashfree flows today. |
| **Cashfree link for the 3 legacy endpoints** (optional path) | ❌ | Either (A) have `create-payment-link` / `fast-track razorpay-create` / `invite payment-link` return a **Cashfree** link, or (B) FE switches those flows to `POST /api/payments/cashfree/orders`. |
| **Retire Razorpay** | Razorpay endpoints still present (`/api/payments/razorpay/*`, `fast-track/{id}/razorpay-*`) | After Cashfree covers 1–3, backend should stop routing NEW payments to Razorpay (keep historical records + read endpoints for audit). |
| **International (rule: Cashfree sole gateway)** | International = **PayPal** (`/api/international/paypal/*`) | Separate decision: enable Cashfree international (INR settlement / intl cards = merchant enablement) if PayPal is to be retired. Out of Razorpay-removal scope; flag to owner. |

---

## TASK 5 — GATEWAY-NEUTRAL INTERNAL IDENTIFIER MODEL

Every payment should be traceable through a gateway-neutral tuple; **no Razorpay identifier is mandatory**:

```
NOSTOPS Transaction ID   (internal, gateway-agnostic)   — canonical audit key
  + Business Reference ID  (booking_id | reservation_id | request_id | invite token)
  + Cashfree Order ID      (payments/cashfree/orders → order_id)
  + Cashfree Payment ID    (from webhook / order status; where applicable)
  [ + legacy Razorpay Order/Payment ID — OPTIONAL, historical only ]
```

**Frontend-only, safe changes to align now (no remote dependency):**
- `lib/server/one-on-one.ts`: replace `paid = !!s.razorpay_payment_id` / `paymentId = s.razorpay_payment_id` with gateway-neutral logic — prefer `status ∈ {paid, confirmed}`, read a neutral `payment_id` and keep `razorpay_payment_id` **only as a backward-compatible fallback** while the remote still emits it. (Prevents breaking the teacher accept/decline gate — Risk R3.)
- Local `audit_ledger` already stores a neutral `gateway` string + `order_id`; keep those and treat `gateway` as informational.

**Do NOT** introduce or require any Razorpay identifier in new code paths.

---

## BOTTOM LINE / SEQUENCING (nothing implemented yet)
1. 🔴 **Unblock creds first:** install valid production Cashfree keys on the remote backend (fixes the 424 for the flows that are *already* Cashfree). Backend/merchant action.
2. 🟠 **Backend confirms/extends** the Cashfree webhook to activate `empanelment_fast_track`, `retreat_reservation`, `group_booking` (order_type + reference_id) and to refund via Cashfree.
3. 🟢 **Then** the frontend can (a) re-point Fast-Track/Retreat/Group to `POST /api/payments/cashfree/orders`, (b) neutralise the `razorpay_payment_id` read, (c) remove Razorpay UI copy. Only after each flow is proven end-to-end on Cashfree.
4. Razorpay endpoints + records are **retained for audit**; they simply stop receiving NEW payments.

---

## TASK 6 — RAZORPAY PAYMENT-ID COUPLING (`lib/server/one-on-one.ts`)

**Current code (L52, L64):**
```
const paid = !!s.razorpay_payment_id || status === 'paid' || status === 'confirmed';
...
paymentId: s.razorpay_payment_id || null,
```
`paid` feeds the teacher accept/decline gate: `awaitingTeacher = paid && !confirmed && !terminal`.

**Investigation result:**
- The remote `/api/one-on-one/my-bookings` returns a **free-form dict** (no typed schema); `razorpay_payment_id` appears in the OpenAPI **only inside Razorpay *verify* request bodies**, not on the booking record.
- 1:1 bookings are now charged via **Cashfree** (`order_type=one_on_one`). A Cashfree-paid booking is unlikely to carry a Razorpay-named `razorpay_payment_id`. Today the gate still works **only because of the `|| status === 'paid' || 'confirmed'` clause** — the `razorpay_payment_id` half is legacy and increasingly dead for new payments.

**Recommendation (gateway-neutral; frontend-only; backward-compatible):**
```
// paid is derived from gateway-neutral signals, preferring server status.
const PAID_STATUSES = new Set(['paid','confirmed','awaiting_teacher','completed', ...]);
const paymentId = s.payment_id || s.cashfree_payment_id || s.razorpay_payment_id || null; // neutral, legacy fallback last
const paid = PAID_STATUSES.has(status) || !!paymentId;
```
- **Primary signal = `payment_status`/`status`** (whatever the remote authoritatively sets on payment).
- **Neutral `payment_id`** read first; `cashfree_payment_id` next; `razorpay_payment_id` retained **only as a legacy fallback** so historical Razorpay-paid bookings still resolve.
- **Rule preserved exactly:** `awaitingTeacher`/`canComplete`/`canReassign` logic is unchanged; only the *definition of "paid"* becomes gateway-neutral. This makes Cashfree-paid 1:1s correctly show accept/decline **and** keeps old Razorpay-paid ones working. No teacher workflow change.
- **Verify before shipping:** confirm the exact field the remote sets for a Cashfree-paid 1:1 (`status` value and/or a `payment_id`/`payment_status` field) so `PAID_STATUSES` matches reality. This is the one item to confirm with the backend team; the fallback chain makes the change safe even if we can't.

**This is a safe frontend-only change** (no remote dependency) and should be part of the eventual implementation, not now.

---

## TASK 7 — REFUNDS MIGRATION

| Case | Rule |
|---|---|
| **NEW NOSTOPS transaction** (post-migration) | Charged on Cashfree → refunded on Cashfree via `POST /api/payments/cashfree/orders/{order_id}/refunds { amount*, refund_id?, note? }` (endpoint already exists on remote). |
| **Historical Razorpay transaction** | **Retain the original gateway.** Refund via the historical Razorpay refund path **only if** legitimately required by the existing accounting/business/legal process. Keep Razorpay refund + records readable for audit. |

**Hard rules:**
- **Do NOT** convert a historical Razorpay transaction ID into a fake Cashfree transaction. A refund must always go back through the gateway that took the original money.
- Refund capability must **not** be removed at any point.
- Flow-specific work (backend-owned): once Fast-Track / Retreat / Group move to Cashfree, their refund triggers (`retreat cancel-with-refund`, teacher-decline auto-refund, group cancellations) must call the **Cashfree** refund endpoint for those new orders. The frontend does not call refunds directly; it only surfaces refunded state (`SettlementLedger`, booking status badges).

---

## TASK 8 — INTERNATIONAL PAYMENTS — CASHFREE MERCHANT-ACCOUNT PRODUCTION-READINESS CHECKLIST

**Current reality:** intl seekers see an **indicative USD label** (`lib/currency.ts`, INR_PER_USD=83.5) but the **charge is INR** via the domestic Cashfree PG. The backend `Currency` enum already lists `INR, USD, EUR, GBP`. Genuine international acceptance is a **Cashfree merchant-account configuration**, not a frontend change. **Do NOT** implement fake FX or present USD as the charged currency unless the architecture genuinely charges USD.

**Checklist for the NOSTOPS Proprietorship Cashfree Merchant Account (owner + backend actions):**

1. **International payments enablement** — Activate **International Payment Gateway (IPG)** on the merchant dashboard (Settings → Payment Gateway → Payment Methods → request International activation). (Global Collections — settling into overseas accounts in 16+ currencies — is *not* needed since NOSTOPS settles INR in India.)
2. **Supported currencies** — IPG accepts 140+ presentment currencies; NOSTOPS UI needs at most `INR, USD, EUR, GBP` (matches backend enum). Decide presentment currencies to expose.
3. **International card acceptance** — IPG covers Visa, Mastercard, American Express, Diners. Enable **Pay Native / DCC** so an overseas seeker can pay in their home currency while **NOSTOPS settles in INR** — this aligns with the current "charge is INR" model and avoids a USD-settlement build.
4. **Settlement configuration** — IPG settles to the Indian bank account, typically **T+2 in INR**. Confirm the settlement bank account + cycle on the dashboard.
5. **Required KYC / business documentation** — Merchant registration + KYC: business PAN, **GSTIN, CIN**, bank account proof, **authorised-signatory PAN**, business/website details, product/service descriptions, and published **refund & privacy policies** (NOSTOPS already has `/privacy`, `/terms`). For cross-border collections from Indian customers, **RBI PA-CB** verification (importer name/address/PAN, invoice number, LRS/TCS declarations) may be required — submitted at order creation or via Cashfree's Upload Payment Verification Details API.
6. **Webhook configuration** — Register the production webhook URL for the merchant and confirm the signing secret; the backend already implements `POST /api/payments/cashfree/webhook` with `x-webhook-signature` + `x-idempotency-key`. Ensure international payment events are delivered to the same handler.
7. **Production credentials** — 🔴 Install the **valid** production `client_id` / `secret` for the NOSTOPS merchant account in the remote backend env. (Diag currently: `env=production, gateway=live` but `creds_valid:false / 401` — the current keys authenticate = FAIL. This blocks ALL Cashfree payments, domestic and international.)
8. **Cashfree dashboard configuration** — Confirm: business go-live/activation approved; payment methods (cards/UPI/netbanking domestic + international cards) activated; webhook + secret set; return/redirect URL allow-listed (`web_app_base_url` currently `https://www.nostops.org`); refund permission enabled; `api_version 2025-01-01` compatible.

**Frontend implication (later, not now):** if genuine international charging is enabled, the UI can show the actual presentment currency from the Cashfree order (not a hardcoded 83.5 estimate). Until then, keep the current honest "indicative ₹→$ orientation, billed in INR" labelling — **no fake conversion, no USD-as-charged claim.**

---

---

## TASK 9 — TEACHER PAYOUTS (keep separate from the gateway)

**Confirmed:** teacher withdrawal/settlement is a **distinct financial concept** from seeker payment collection and must stay that way. Remote endpoints (all to be left unchanged):
- `GET /api/teacher-wallet/balance`, `/unified-summary`, `/transactions`, `/pin-status`
- `POST /api/teacher-wallet/setup-pin`, `/change-pin`, `GET/POST /payout-details`
- `POST /api/teacher-wallet/withdraw`, `/withdraw/otp/start`, `/withdraw/otp/verify` (**PIN + OTP** gated)
- `POST /api/teachers/me/payout-request`, `GET /api/teachers/me/payouts`, `/payouts/report`
- `POST /api/admin/payouts/{approve,reject}`, `GET /api/admin/payouts/{list,sweep}` (admin approval queue)
- `POST /api/v1/payouts/withdraw`, `/webhook`, `GET /api/v1/payouts/{transfer_id}` (bank/UPI settlement rail)

**Rules:**
- **Do NOT** replace the teacher payout system with Cashfree Payments just because Cashfree is the checkout gateway. (Even if `/api/v1/payouts/*` happens to use a Cashfree Payouts rail internally, that is a backend implementation detail — the app keeps the existing PIN+OTP withdraw UX.)
- **Seeker payment collection** (money IN, via Cashfree checkout) and **Teacher payout/settlement** (money OUT, via wallet PIN/OTP + bank/UPI) remain **separate**. Money map: Seeker pays gross → NOSTOPS keeps 15% → Teacher net 85% accrues to wallet → Teacher withdraws via the payout rail (admin-approved). The gateway does **not** perform teacher payouts.
- Only the **remote backend team** may change the payout architecture. No frontend change here.

---

## TASK 11 — TARGET (GATEWAY-NEUTRAL) API CONTRACT

**Comparison with the existing architecture — two remote payment surfaces already exist:**
1. `POST /api/payments/cashfree/orders` (+ `/{id}`, `/{id}/refunds`, `/webhook`) — **provider-named but generic** (`order_type` + `reference_id`). This is what the BFF uses today.
2. `POST /api/v1/payments/{orders,orders/{id}/status,checkout/{id},return,webhook,admin/refund}` — **already provider-neutral names**, but `create` is currently **booking-scoped** (`{booking_id, student_email, student_phone}`), not generic.

Locally, the BFF route is `/bff/payments/cashfree/orders` (leaks the provider name) and the Fast-Track BFF encodes `razorpay-create`/`razorpay-verify` (provider-named business actions).

**Recommendation (safest, staged — do not create names blindly):**
- **Now / frontend-only (safe):** rename the **BFF** routes to NOSTOPS-oriented, gateway-neutral names so the frontend never encodes a provider:
  - `/bff/payments/create` → proxies to the current remote create (`/api/payments/cashfree/orders`)
  - `/bff/payments/status/{orderId}` → remote order status
  - `/bff/payments/refund` (admin-guarded) → remote Cashfree refund
  The provider name stays hidden behind the BFF; the browser sees only neutral routes. Keep the existing remote path until the backend converges (Option below).
- **Backend convergence (request to backend team):** standardise on the **provider-neutral `/api/v1/payments/*`** surface, extended to accept `order_type` + `reference_id` for ALL flows (1:1, InstaKYC, wallet, fast-track, retreat, group) — a single neutral contract (`create` / `status` / `refund` / `webhook`) that internally uses Cashfree. Retire the provider-named `…/razorpay-create` business actions.
- **Do NOT** invent `/payments/create` etc. on the frontend without a real backend endpoint behind them — every neutral BFF route must map to a verified remote endpoint. Rename only after the target remote path is confirmed working.

**Net:** frontend/BFF should speak **NOSTOPS-oriented, gateway-neutral** endpoints; the provider (Cashfree) lives entirely server-side. Razorpay-named routes/actions are removed from the app surface once the neutral Cashfree path is proven end-to-end.

---

**STOP.** End of gap analysis (Tasks 1–11). Backend-team handoff spec: `/app/BACKEND_TEAM_REQUEST_cashfree.md`. No production code modified. Awaiting authorization to implement.
