# NOSTOPS_CASHFREE_BACKEND_MIGRATION_SPEC

**Objective:** Cashfree becomes the sole gateway for **all new** NOSTOPS payments; **zero new Razorpay transactions**; historical Razorpay records preserved for audit.
**Status:** SPECIFICATION ONLY. Remote backend NOT modified (frozen, no authorization). No fake Cashfree. No Razorpay calls removed. Migration is **BLOCKED** on the remote backend + merchant-account items in §18. **This migration is NOT complete.**
**Evidence base:** remote live `/openapi.json` (619 paths) + `/api/payments/cashfree/diag` (read-only; no secrets). Local repo `/app/frontend` (Next.js BFF/frontend) + `/app/backend` (thin proxy + local audit ledger).

---

## 1. Current architecture
- **Remote business backend** (`https://pro-learn-connect-1.emergent.host`) is **FROZEN** and owns everything financial: gateway credentials, order creation, verification, webhooks, refunds, settlement, teacher payouts.
- **Local `/app/backend/server.py`** = thin FastAPI **pass-through proxy** (`/api/health` + catch-all `/api/{path}`) + an **isolated local Mongo audit ledger** (`/app/backend/audit.py`, collection `audit_ledger`) used only for admin/teacher/seeker **visibility** of 1:1 sessions (never the system of record).
- **Local `/app/frontend`** = Next.js App Router + a **BFF** (`app/bff/*`) that attaches the bearer server-side and enforces CSRF; the browser never holds the backend token or gateway keys.

## 2. Current Razorpay dependencies (in this repo)
| Type | Location | Note |
|---|---|---|
| Active charge (remote) | Fast-Track BFF `app/bff/teacher/empanelment/fast-track/[...action]/route.ts` → `razorpay-create`/`razorpay-verify` | ₹4,999 |
| Active charge (client) | `components/app/teacher/FastTrackApply.tsx` (opens Razorpay `short_url`) | |
| Active charge (remote) | Retreat pay BFF `app/bff/retreats/[id]/reservations/[rid]/pay/route.ts` → remote `create-payment-link` (Razorpay link) | |
| Active charge (client) | `components/retreats/RetreatReserve.tsx`, `app/app/reservations/page.tsx` (redirect `short_url`) | gateway-neutral redirect |
| Active charge (remote) | Group invite BFF `app/bff/booking-invite/[token]/[action]/route.ts` → remote `payment-link` (Razorpay link) | |
| Active charge (client) + branding | `components/booking/PayNow.tsx` ("Pay now via Razorpay →") | |
| Branding/copy only | `components/retreats/GroupBook.tsx`, `components/app/org/CloseEnrollment.tsx` | |
| Field coupling | `lib/server/one-on-one.ts` reads `razorpay_payment_id` for the teacher accept/decline gate | |
> No Razorpay npm SDK, keys, secrets, or env vars exist locally. All Razorpay keys/webhooks live on the remote backend.

## 3. Existing Cashfree architecture (already built on the remote — live mode)
- `GET/POST /api/payments/cashfree/orders`, `GET …/orders/{order_id}`, `POST …/orders/{order_id}/refunds`, `POST …/cashfree/webhook` (headers `x-webhook-signature`, `x-webhook-timestamp`, `x-idempotency-key`), `GET …/cashfree/checkout/{order_id}`, `…/mock-checkout/*`, `…/diag`.
- Diag: `env=production, gateway=live, api_base=https://api.cashfree.com/pg, api_version=2025-01-01, web_app_base_url=https://www.nostops.org`.
- **Live NOSTOPS flows already on Cashfree:** 1:1 session booking (`order_type=one_on_one`), InstaKYC ₹799 (`instakyc`), Wallet top-up (`wallet_topup`) — all via the local BFF `app/bff/payments/cashfree/orders/*`, with server-side status re-read at `/cashfree-return`.
- A newer provider-neutral module exists too: `/api/v1/payments/*` (create `{booking_id,student_email,student_phone}`, status, checkout, return, webhook, admin/refund).

## 4. Three blocked payment workflows (must move to Cashfree)
1. **Teacher Empanelment Fast-Track — ₹4,999** (Razorpay create/verify).
2. **Retreat Seat Reservation** (Razorpay hosted `create-payment-link`).
3. **Group / Corporate "Pay Now"** (Razorpay hosted `payment-link`).
(The `fast-track/{id}/pay` endpoint is a **MockCardPayment** sandbox — not a real Cashfree path.)

## 5. Current API contracts (the 3 blocked flows)
- **Fast-Track:** `POST /api/empanelment/fast-track/{request_id}/razorpay-create` (no body) → hosted-link payload (`short_url`); `POST …/razorpay-verify` (Razorpay signature payload). Business ref = `request_id`; status via `/empanelment/fast-track/my-status` (`payment.status`). Refund/webhook = Razorpay (remote).
- **Retreat:** `POST /api/retreats/{retreat_id}/reservations/{reservation_id}/create-payment-link` (empty body) → `{short_url|payment_link|checkout_url}` (Razorpay). Status `GET /api/retreats/reservation/{reservation_id}/payment-status`. Reservation created by `POST /api/retreats/{id}/reserve`. Refund via backend `cancel-with-refund` (Razorpay).
- **Group invite:** `POST /api/bookings/invite/{token}/payment-link` (`{email}`) → `{short_url}` (Razorpay). Business ref = `token`/`booking_id`.

## 6. Required Cashfree contracts (target)
Reuse the live `POST /api/payments/cashfree/orders`:
`OrderCreateReq { amount*, currency(INR|USD|EUR|GBP), order_type(string), reference_id?, customer_id*, customer_name?, customer_email?, customer_phone*, note?, return_url? }` → `{ order_id, payment_session_id, checkout_url, amount, currency, status, mode }`.
- Fast-Track: `order_type=empanelment_fast_track`, `reference_id=request_id`.
- Retreat: `order_type=retreat_reservation`, `reference_id=reservation_id`.
- Group: `order_type=group_booking`, `reference_id=booking_id`/`token`.
Amount MUST be derived server-side from the referenced object (never trust client). `return_url` set per-environment by the BFF.
**Alternative:** add neutral `…/cashfree-create` / `…/cashfree-checkout` endpoints per flow returning the same shape.

## 7. Webhook requirements (remote `POST /api/payments/cashfree/webhook`)
- Verify `x-webhook-signature` (+ timestamp); reject invalid.
- On PAID, map `order_type`+`reference_id` → business object and activate: fast-track→paid+queue; retreat→seat confirmed + inventory decrement; group→enrollment confirmed.
- **Idempotent** on `order_id`/`x-idempotency-key`: no double transaction / booking / fast-track activation / retreat seat / enrollment / teacher earning under duplicate or late/out-of-order delivery (webhook-before-return and return-before-webhook must both converge).
- Emit/record `payment_id` + final `payment_status` on the business object.

## 8. Refund requirements
- **New Cashfree orders → Cashfree refunds:** `POST /api/payments/cashfree/orders/{order_id}/refunds { amount*, refund_id?, note? }`. Wire retreat `cancel-with-refund`, teacher-decline auto-refund, group cancellations for new orders.
- **Historical Razorpay → Razorpay refunds only** (retain). Never convert a historical Razorpay ID into a fake Cashfree transaction. Refund capability is never removed.

## 9. Database requirements
- Gateway-neutral fields on every payable object (1:1 booking, fast-track request, retreat reservation, group booking): `payment_provider` (`cashfree`|legacy `razorpay`), `payment_order_id`, `payment_id`, `payment_status`, `amount_inr`, `currency`, `reference_id`, `refund_id`, `refund_status`.
- Retain legacy `razorpay_*` columns on historical rows (read-only, audit).
- **1:1 accept/decline dependency:** set a neutral `payment_status`/`payment_id` on Cashfree-paid bookings surfaced by `GET /api/one-on-one/my-bookings` (today the app keys off `razorpay_payment_id`, which Cashfree won't populate).
- Local `audit_ledger` already stores neutral `gateway`+`order_id`+`status` — keep; treat `gateway` as informational.

## 10. Gateway-neutral identifier requirements
```
Seeker (user_id/customer_id) → Payment (Cashfree order_id + payment_id)
  → Business transaction (NOSTOPS txn id) → Teacher/service (teacher_id/handle)
  → Booking (reference_id: booking_id|reservation_id|request_id|token) → Refund (refund_id ↔ order_id)
```
Every payment resolvable by `reference_id`+`order_id`. **No Razorpay identifier is mandatory** in new code.

## 11. International payment requirements
- Current: indicative USD label only (`lib/currency.ts`), **charge is INR**. International today = **PayPal** (`/api/international/paypal/*`), not Razorpay.
- To make Cashfree handle international: enable **Cashfree IPG** + **Pay Native/DCC** (seeker pays home currency, NOSTOPS settles INR ~T+2). Presentment currencies `INR/USD/EUR/GBP`. This is **merchant-account enablement**, a separate decision from Razorpay removal.
- **Do NOT** implement fake FX or present USD as the charged currency unless the architecture genuinely charges USD.

## 12. Teacher payout separation (unchanged)
Seeker payment collection (money IN, Cashfree checkout) and teacher payout/settlement (money OUT, wallet **PIN+OTP** + bank/UPI, admin-approved) remain **separate**. Endpoints left as-is: `/api/teacher-wallet/*`, `/api/teachers/me/payout*`, `/api/admin/payouts/*`, `/api/v1/payouts/*`. Do not fold payouts into Cashfree Payments merely because checkout is Cashfree. Money map: gross → 15% NOSTOPS → 85% teacher net → wallet → withdraw. Only the backend team may change payout architecture.

## 13. Local / frontend changes (T13 — SAFE to prepare now; break nothing)
> These do **not** remove any Razorpay call and do **not** claim Cashfree where money still flows via Razorpay.
1. **Gateway-neutral 1:1 field read** — `lib/server/one-on-one.ts`: `paid = PAID_STATUSES.has(status) || !!(payment_id||cashfree_payment_id||razorpay_payment_id)`; `paymentId = payment_id||cashfree_payment_id||razorpay_payment_id||null`. Backward-compatible; fixes Cashfree-paid 1:1 accept/decline without breaking historical Razorpay.
2. **Neutral BFF alias routes (additive)** — add `/bff/payments/create`, `/bff/payments/status/[orderId]`, `/bff/payments/refund` that proxy the **existing** remote Cashfree endpoints; keep current routes working. Frontend can adopt neutral names; provider stays server-side.
3. **De-brand Razorpay copy → neutral (not "Cashfree")** — `PayNow.tsx`, `GroupBook.tsx`, `CloseEnrollment.tsx`: replace "Razorpay" with "secure payment link"/"secure checkout". Honest (those flows still charge via the remote link) and removes provider branding.
4. **Return-URL passthrough** — pass `return_url` in the Cashfree order BFF (supported by `OrderCreateReq`) so preview returns resolve (improves the already-Cashfree flows).
5. **Feature-flag scaffolding (default OFF)** — a config switch so, once the backend ships Cashfree for the 3 flows, the FE re-points from `razorpay-create`/`create-payment-link`/`payment-link` to the Cashfree order endpoint without a rewrite.
6. **Docs** — keep `PAYMENT_ARCHITECTURE_AUDIT.md`, `CASHFREE_MIGRATION_GAP_ANALYSIS.md`, `BACKEND_TEAM_REQUEST_cashfree.md` as source of truth.
> **Still BLOCKED (must NOT do now):** removing `razorpay-create/verify`, switching retreat/group pay to Cashfree, or deleting Razorpay endpoints — until the backend ships the Cashfree equivalents and they pass §16.

## 14. Remote backend changes (required — see `BACKEND_TEAM_REQUEST_cashfree.md`)
- Accept `order_type ∈ {empanelment_fast_track, retreat_reservation, group_booking}` (+ `reference_id`) on `/api/payments/cashfree/orders` **or** add neutral Cashfree endpoints per flow.
- Extend the Cashfree webhook to activate those 3 flows (signature + idempotent).
- Wire their refunds to Cashfree; keep Razorpay for historical.
- Persist gateway-neutral fields (§9), incl. neutral `payment_status`/`payment_id` on 1:1.
- Stop routing NEW payments to Razorpay once Cashfree covers all flows.
- (Optional) converge on `/api/v1/payments/*` as the single neutral surface.

## 15. Merchant-account configuration requirements (NOSTOPS Proprietorship Cashfree)
1. 🔴 **Valid production credentials** — diag `creds_valid:false / 401`; install correct `client_id`/`secret` (blocks ALL Cashfree payments today; cause of the 424).
2. Business go-live/activation approved; payment methods (cards/UPI/netbanking) activated.
3. Webhook URL + signing secret registered (prod).
4. Return/redirect URL allow-listed (`web_app_base_url = https://www.nostops.org`).
5. Refund permission enabled; `api_version 2025-01-01` compatible.
6. **International (if pursued):** enable IPG + Pay Native/DCC; KYC/docs (PAN, GSTIN, CIN, bank proof, signatory PAN, refund & privacy policies); RBI PA-CB verification where applicable; INR settlement (~T+2).

## 16. Testing requirements
- **Per flow (Fast-Track, Retreat, Group, + regression on 1:1/KYC/Wallet):** create order → hosted checkout → PAID → webhook activation → business state confirmed → receipt/status → refund.
- **Webhook security:** valid vs tampered signature; duplicate event (idempotent, single activation); delayed webhook; webhook-before-return AND return-before-webhook both converge; failed/pending/expired handled honestly.
- **No-trust-redirect:** confirm status only via server-side re-read (already implemented for Cashfree).
- **Refunds:** Cashfree refund for new orders; Razorpay refund still works for historical; amounts/ledger reconcile.
- **International (if enabled):** intl card via IPG, DCC display, INR settlement, refund, reconciliation.
- **Reconciliation:** every payment traceable via `reference_id`+`order_id`; admin 1:1 ledger + reports reflect real PAID revenue; no double-count.
- **QA note:** production creds → coordinate a sandbox/test-mode window or small-value live tests; do not leave orphan orders.

## 17. Go-live checklist
- [ ] Valid production Cashfree creds installed (diag `creds_valid:true`).
- [ ] 1:1 / InstaKYC / Wallet Cashfree charge succeeds end-to-end (fixes 424).
- [ ] Backend: Cashfree covers Fast-Track, Retreat, Group (create + webhook activation + refund).
- [ ] Gateway-neutral DB fields populated (incl. 1:1 `payment_status`/`payment_id`).
- [ ] FE: neutral BFF routes live; 1:1 field read neutralized; Razorpay copy de-branded; feature flag flipped ON per flow only after each passes §16.
- [ ] Razorpay endpoints stop receiving NEW payments (historical retained).
- [ ] Webhook signature + idempotency verified; reconciliation clean.
- [ ] (Optional) International via Cashfree IPG enabled + tested.
- [ ] Post-cutover monitoring: **zero new Razorpay transactions**.

## 18. Explicit blockers
- **B1 🔴 Invalid production Cashfree credentials on the remote backend** (`creds_valid:false`, 401) — blocks ALL Cashfree payments incl. already-migrated flows; root cause of the 424. Merchant + backend-env action.
- **B2 🔴 Remote is frozen** — Fast-Track/Retreat/Group charges, their Cashfree webhook activation, and their Cashfree refunds are remote-owned; cannot be done from this app.
- **B3 🟠 Cashfree webhook activation of the 3 order_types** unverified — must be implemented/confirmed by the backend team.
- **B4 🟠 1:1 neutral payment field** — backend should set a neutral `payment_status`/`payment_id` on Cashfree-paid 1:1s (FE fallback mitigates but confirm).
- **B5 🟡 International** — PayPal today; Cashfree IPG is a separate merchant-enablement decision.
- **B6 🟡 Do not remove Razorpay calls / do not claim completion** until B1–B3 are done and §16 passes.

---

### FINAL STATUS
**Razorpay migration is NOT complete.** Completion is defined as: **NOSTOPS Proprietorship → Cashfree → all new NOSTOPS payment flows** with secure verification, Cashfree webhooks, Cashfree refunds, domestic (and applicable international) payments, full reconciliation, and **ZERO new Razorpay transactions** — with historical Razorpay records preserved for audit. Until the remote backend confirms it has stopped creating Razorpay payments, this remains a specification with the blockers in §18 outstanding.
