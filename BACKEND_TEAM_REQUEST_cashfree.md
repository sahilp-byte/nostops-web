# NOSTOPS → Remote Backend Team — Cashfree Migration Implementation Request
**Goal:** Cashfree becomes the sole gateway for ALL new NOSTOPS payments. Razorpay stops taking new payments (historical records/refunds retained). The local app is proxy/BFF/frontend only — these changes are required on the **remote backend** (`pro-learn-connect-1.emergent.host`).

> Verified against your live `/openapi.json` (619 paths) + `/api/payments/cashfree/diag`. **Blocker:** diag shows `env=production, gateway=live` but `cashfree_auth_check = { http_status: 401, creds_valid: false }` → install valid production Cashfree keys for the NOSTOPS Proprietorship Merchant Account first; this currently breaks even the already-Cashfree flows (1:1 / InstaKYC / Wallet) and is the cause of the 424 at checkout.

## A. Current Razorpay dependency — what must be replaced (NEW payments only)
1. **Fast-Track ₹4,999:** `POST /api/empanelment/fast-track/{request_id}/razorpay-create` + `/razorpay-verify`.
2. **Retreat reservation:** `POST /api/retreats/{retreat_id}/reservations/{reservation_id}/create-payment-link` (returns Razorpay `short_url`).
3. **Group/Corporate invite:** `POST /api/bookings/invite/{token}/payment-link` (returns Razorpay `short_url`).
4. The **Razorpay webhook** (`/api/payments/razorpay/webhook`) currently activates these 3 flows.
   Keep all Razorpay endpoints + records for **historical read/refund/audit** only.

## B. Required Cashfree APIs — what must be created / confirmed
- **Confirm** `POST /api/payments/cashfree/orders` accepts `order_type ∈ {empanelment_fast_track, retreat_reservation, group_booking}` with `reference_id` = `request_id` / `reservation_id` / `booking_id`(or invite `token`), and **derives the authoritative amount server-side** from the referenced object (ignore any client amount).
- **OR** add gateway-neutral Cashfree endpoints that internally use the existing Cashfree module and return `{order_id, payment_session_id, checkout_url}`:
  - `POST /api/empanelment/fast-track/{request_id}/cashfree-create`
  - `POST /api/retreats/{retreat_id}/reservations/{reservation_id}/cashfree-checkout`
  - `POST /api/bookings/invite/{token}/cashfree-checkout`
- Install valid production Cashfree credentials (see blocker above).

## C. Required webhook behavior
On the existing `POST /api/payments/cashfree/webhook` (already accepts `x-webhook-signature`, `x-webhook-timestamp`, `x-idempotency-key`):
- **Verify signature**; reject unsigned/invalid.
- On a PAID event, map `order_type` + `reference_id` → business object and **activate**:
  - `empanelment_fast_track` → mark request `paid` + enter Council queue.
  - `retreat_reservation` → confirm the seat, decrement inventory, mark reservation paid.
  - `group_booking` → confirm participant enrollment.
- **Idempotent**: keyed on `order_id`/`idempotency-key` so duplicate/late deliveries cause **no** double transaction, double booking, double fast-track activation, double retreat seat, double enrollment, or double teacher earning.

## D. Required refund behavior
- **New Cashfree orders → Cashfree refunds** via existing `POST /api/payments/cashfree/orders/{order_id}/refunds { amount, refund_id?, note? }`. Wire retreat `cancel-with-refund`, teacher-decline auto-refund, and group cancellations to this for new orders.
- **Historical Razorpay → Razorpay refund only** (retain). **Never** convert a Razorpay transaction into a Cashfree one.
- Refund capability must not be removed.

## E. Required database changes
- Add/confirm **gateway-neutral** fields on each payable business object (1:1 booking, fast-track request, retreat reservation, group booking):
  `payment_provider` (`cashfree` | legacy `razorpay`), `payment_order_id`, `payment_id`, `payment_status`, `amount_inr`, `currency`, `reference_id`, `refund_id`, `refund_status`.
- **Keep legacy `razorpay_*` columns** on historical rows (read-only, for audit).
- **Important for the 1:1 accept/decline gate:** ensure a **neutral `payment_status`/`payment_id`** is set on Cashfree-paid 1:1 bookings surfaced by `GET /api/one-on-one/my-bookings` (today the app reads `razorpay_payment_id`, which a Cashfree payment won't populate — see F/G).

## F. Required identifiers (association chain)
```
Seeker (user_id / customer_id)
  → Payment (Cashfree order_id + payment_id)
  → Business transaction (NOSTOPS txn id — gateway-neutral)
  → Teacher / service (teacher_id / handle)
  → Booking (business reference_id: booking_id | reservation_id | request_id | invite token)
  → Refund (refund_id linked to order_id)
```
Every payment must be resolvable by `reference_id` + `order_id`. **No Razorpay identifier may be mandatory** in the new model.

## G. Required response contracts (what the NOSTOPS BFF/frontend needs)
- **Create order** → `{ order_id, payment_session_id, checkout_url, amount, currency, status, order_type, reference_id }`
- **Order status** → `{ order_id, status ∈ {PAID,ACTIVE,PENDING,FAILED,EXPIRED}, amount, currency, order_type, reference_id, payment_id? }`
- **Refund** → `{ refund_id, order_id, status, amount }`
- **Per-flow business status** stays readable: fast-track `payment.status`; `GET /api/retreats/reservation/{id}/payment-status` = paid; group enrollment = confirmed.
- **No secrets/keys** in any response. Support a `return_url` on order creation (already in `OrderCreateReq`) so the BFF can set the correct same-origin return in each environment.

## Out of scope (do NOT change unless you explicitly decide to)
- **Teacher payouts/settlement** (`/api/teacher-wallet/*` PIN+OTP, `/api/teachers/me/payout*`, `/api/admin/payouts/*`, `/api/v1/payouts/*`) — this is separate from seeker payment collection; keep as-is.
- **International** currently = PayPal (`/api/international/paypal/*`). Moving international to Cashfree IPG is a separate merchant-enablement decision (see the international checklist in `CASHFREE_MIGRATION_GAP_ANALYSIS.md`).
