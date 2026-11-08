# Cashfree — backend work required to complete the 3 requested flows

**Frontend foundation is DONE & verified (mock mode):** create-order BFF
(`POST /bff/payments/cashfree/orders`, customer derived from the session — no
secret client-side), status BFF (`GET /bff/payments/cashfree/orders/{id}`), the
`/cashfree-return` result page, and a reusable `<CashfreePayButton>`. Verified
end-to-end: pay → Cashfree hosted checkout → complete → `/cashfree-return` shows
"Payment successful" (confirmed via the status BFF).

The web agent CANNOT modify the FastAPI backend or MongoDB. The items below need
the backend team.

## 0. Config / environment (do NOT put the secret in the frontend)
- Set the Cashfree **production** credentials in the BACKEND config:
  - App ID: `1361249f58d46386df83dcd77819421631`
  - Secret: `cfsk_ma_prod_…` (provided privately — keep server-side only)
  Currently `POST /payments/cashfree/orders` returns `"mode":"mock"`. Real
  payments require these on the backend + switch out of mock mode.
- **Return-URL host:** the backend builds `web_return_url` from its OWN base URL.
  When the app and `/api` are served from DIFFERENT hosts (as in preview:
  app=`connect-platform-web.preview…`, api=`pro-learn-connect-1.emergent.host`),
  the post-checkout redirect lands on the API host's `/cashfree-return` (404).
  Fix EITHER: (a) serve the app and `/api` **same-origin** in production
  (`www.nostops.org` + proxied `/api`) — then `/cashfree-return` resolves; OR
  (b) add an optional `return_url` field to `POST /payments/cashfree/orders`
  (and `/v1/payments/orders`) so the frontend can pass its own
  `https://www.nostops.org/cashfree-return`.

## Flow 1 — Teacher InstaKYC ₹799
- **Current:** KYC paid-state lives in a SEPARATE store (`/kyc/sandbox/create-payment`
  → Razorpay link; `/kyc/sandbox/verify-payment`).
- **Verified empirically:** completing a generic Cashfree order
  (`order_type=instakyc`) does **NOT** flip `kyc_paid` — the Cashfree webhook is
  not bridged to the KYC module.
- **Needed:** on a settled Cashfree KYC order, mark the teacher's KYC paid
  (bridge `order_type=instakyc` + `customer_id` → KYC module) — OR add a Cashfree
  option to `/kyc/.../create-payment` that returns a Cashfree `checkout_url` and
  reconciles KYC on the webhook.

## Flow 2 — 1:1 booking payment
- **Current:** there is **no booking-create endpoint** for the web, and
  `POST /v1/payments/orders` requires a pre-existing `booking_id`. The web
  `BookingForm` is a stub ("checkout is being finalised").
- **Needed:** (a) a create-booking endpoint (learner picks a slot → returns
  `booking_id`), then (b) `POST /v1/payments/orders {booking_id, …}` → Cashfree
  checkout → webhook **confirms the booking**. Please share the create-booking
  contract.

## Flow 3 — Wallet top-up
- **Current:** the teacher wallet is earnings + withdrawals only; there is **no
  top-up endpoint**.
- **Needed:** a wallet-topup create-order (`order_type=wallet_topup`,
  `customer_id=teacher`) whose Cashfree webhook **credits the teacher wallet**,
  reflected in `/teachers/{id}/wallet`.

## Once the above exist
Wiring the UI is trivial — drop `<CashfreePayButton amount orderType referenceId>`
into each flow; `/cashfree-return` already confirms the status. No further backend
call is needed from the browser (secret stays server-side; webhook drives the
business action).
