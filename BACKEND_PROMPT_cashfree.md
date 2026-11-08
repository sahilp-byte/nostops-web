# Backend prompt — complete Cashfree for KYC, 1:1 booking, wallet top-up + go-live

Paste everything below to your backend agent/team.

---

You are working on the **NOSTOPS FastAPI + MongoDB backend**. Cashfree Payments is already
partially integrated (module under `/api/payments/cashfree/*` and `/api/v1/payments/*`, currently
running in **mock mode** — `POST /api/payments/cashfree/orders` returns `"mode":"mock"`). The web
frontend already has a Cashfree checkout foundation wired to your endpoints and is waiting on the
backend pieces below. **Do all 4 tasks. Do not break the existing Razorpay KYC flow. Keep webhook
signature verification, idempotency, and secret handling server-side only.**

## What the frontend already does (do not change these contracts)
- `POST /api/payments/cashfree/orders` with `{amount, currency:"INR", order_type, reference_id,
  customer_id, customer_name, customer_email, customer_phone, note}` → expects back
  `{order_id, payment_session_id, checkout_url, web_return_url, amount, currency, status, mode}`.
- After hosted checkout, the browser is redirected to `web_return_url`; the frontend page
  `/cashfree-return?order_id=...` then calls `GET /api/payments/cashfree/orders/{order_id}` and
  reads `order_status` (expects `PAID` / `FAILED` / `ACTIVE`).
- All money/business state changes must happen on the **Cashfree webhook**
  (`POST /api/payments/cashfree/webhook`), never trusted from the client.

---

## TASK 0 — Go-live config + return URL
1. Move Cashfree out of mock mode using **production** credentials read from backend env/secret store
   (never hardcode, never return the secret in any response):
   - `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` (production).
   - A `CASHFREE_ENV` flag (`sandbox`/`production`) that also controls the `mode` field returned.
2. **Return URL host bug:** `web_return_url` is currently built from the backend's own base URL, so
   when the web app and API are on different hosts the post-checkout redirect 404s. Fix by EITHER:
   - (preferred) driving the return/redirect base from a configurable `WEB_APP_BASE_URL` env
     (e.g. `https://www.nostops.org`) so it becomes `{WEB_APP_BASE_URL}/cashfree-return?order_id=...`, OR
   - accept an optional `return_url` field on `POST /api/payments/cashfree/orders` (and
     `/api/v1/payments/orders`) and use it for the Cashfree `return_url` / redirect.
3. Keep the mock-checkout flow working when `CASHFREE_ENV=sandbox` so QA still works without real money.

**Acceptance:** creating an order in production mode returns a real Cashfree `payment_session_id` +
`checkout_url`, and `web_return_url` points at the WEB app host.

---

## TASK 1 — InstaKYC ₹799 via Cashfree
Today KYC payment lives in a **separate** store (`POST /api/kyc/sandbox/create-payment` →
Razorpay short link; `POST /api/kyc/sandbox/verify-payment`). A generic Cashfree order with
`order_type=instakyc` does **not** currently mark KYC paid (verified).

Implement so a Cashfree payment can satisfy the KYC fee:
- Recognize KYC orders (e.g. `order_type == "instakyc"`, `reference_id == teacher_id`,
  `amount == 799`) and, **on the Cashfree webhook when the order is PAID**, set the same
  `kyc_paid`/KYC-order state that `verify-payment` reads today (so `POST /kyc/sandbox/verify-payment`
  and the teacher's `kyc` status reflect paid).
- Keep the existing Razorpay KYC path intact (both providers should be able to satisfy KYC).
- Idempotent: replaying the webhook must not double-mark.

**Acceptance:** create Cashfree order `{order_type:"instakyc", amount:799, customer_id:<teacher_id>,
reference_id:<teacher_id>}` → complete → webhook fires → `GET`/verify shows KYC **paid** for that teacher.

---

## TASK 2 — 1:1 booking create + Cashfree payment → confirm
Today there is **no booking-create endpoint** for the learner web flow, and
`POST /api/v1/payments/orders` requires a pre-existing `booking_id`. Provide the full path:
1. `POST /api/one-on-one/bookings` (or your chosen path) — body `{teacher_id, slot_iso, learner_name,
   learner_phone, note?}`, auth = learner session → creates a **PENDING_PAYMENT** booking and returns
   `{booking_id, amount, teacher_name, slot_iso}`.
2. Ensure `POST /api/v1/payments/orders {booking_id, student_email, student_phone, amount}` creates a
   Cashfree order tied to that booking and returns `checkout_url` (+ `web_return_url` per Task 0).
3. **On the Cashfree webhook (PAID)** → mark the booking **CONFIRMED** and make it appear in
   `GET /api/one-on-one/my-bookings` (learner) and the teacher's bookings/sessions. On FAILED/EXPIRED
   → release the slot.
- Idempotent; do not double-confirm.

**Acceptance:** create booking → pay via Cashfree → webhook → booking shows CONFIRMED for both learner
and teacher; failed payment leaves it unconfirmed and frees the slot.

---

## TASK 3 — Wallet top-up via Cashfree
The teacher wallet is currently earnings + withdrawals only (`GET /api/teachers/{teacher_id}/wallet`,
`/wallet/transactions`). Add top-up:
1. Accept a Cashfree order with `order_type == "wallet_topup"`, `customer_id == teacher_id`,
   `amount == top-up amount`.
2. **On the webhook (PAID)** → credit the teacher's wallet balance and add a `wallet_topup`
   transaction visible in `/wallet/transactions`.
- Idempotent per `order_id`.

**Acceptance:** create `{order_type:"wallet_topup", customer_id:<teacher_id>, amount:N}` → complete →
webhook → wallet balance increases by N and a transaction is recorded.

---

## Cross-cutting requirements
- **Security:** verify the Cashfree webhook signature; never log or return the secret; never expose the
  bearer/secret to clients. All state changes happen on the verified webhook.
- **Idempotency:** every webhook handler keyed by `order_id`/`cf_payment_id`; safe to replay.
- **Statuses:** `GET /api/payments/cashfree/orders/{order_id}` must return `order_status` in
  `{PAID, FAILED, ACTIVE, EXPIRED}` consistently for the frontend return page.
- **Do not change** the existing request/response field names the frontend already uses (Task 0 list).
- Add/extend tests for each flow (order created → mock/real webhook → business state asserted).

When done, reply with: the exact endpoint paths + payloads for booking-create, and confirmation that
KYC/booking/wallet each flip their business state on a PAID Cashfree webhook.
