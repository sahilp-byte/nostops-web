# BACKEND REQUEST — InstaKYC price change ₹799 → ₹279

**Owner:** NOSTOPS remote backend team (`pro-learn-connect-1.emergent.host`)
**Requested by:** Web/frontend
**Priority:** P1 (money-facing)
**Date:** 2026-06

## Summary
The official InstaKYC teacher-verification fee is now **₹279 (all-in, incl. 18% GST)**, down from ₹799.
The web app has been fully updated (single source of truth: `frontend/lib/pricing.ts → INSTAKYC_PRICE_INR = 279`).

## What the frontend already does (no backend change needed for the CHARGE)
- The InstaKYC Cashfree order is created via `POST /api/payments/cashfree/orders` with
  `{ order_type: "instakyc", amount: 279, currency: "INR", ... }`.
- **Verified against the live backend:** the order-create endpoint records the client-supplied `amount`
  verbatim for `order_type=instakyc` (we created test orders at amounts 279, 123 and 799 — each was stored
  exactly as sent). So changing the frontend to send `279` makes the gateway charge **₹279** immediately.
  Amount unit is **rupees** (the API stored `279.0`), i.e. NOT paise.

## Please action on the backend (only if any of these exist)
1. **Hardcoded InstaKYC price / server-side validation.**
   If the backend has an InstaKYC price constant, config row, env var, or a validation that asserts/forces the
   InstaKYC order amount (e.g. `amount == 799`, `INSTAKYC_PRICE`, `kyc_fee`), update it to **279**.
   Historical orders must keep their own stored amount — change applies to NEW orders only.

2. **⚠️ Security hardening (recommended).**
   The order-create endpoint currently **trusts the client `amount`** for `order_type=instakyc` (any value is
   accepted). Recommend the backend derive/validate the InstaKYC amount **server-side** from an authoritative
   config (₹279) and reject mismatches, so the fee cannot be tampered with from the client.

3. **Receipts / invoices / payment-confirmation emails / SMS / WhatsApp.**
   Any template that prints a hardcoded "₹799" for InstaKYC → derive from the order's actual amount (will show
   ₹279 for new orders). Do NOT rewrite historical receipts/invoices.

4. **Admin dashboard "current InstaKYC price" label(s).**
   If the admin UI shows a configured current price for InstaKYC, set it to **₹279**.
   Transaction/revenue reports must continue to show each transaction's **actual** paid amount (historical ₹799
   orders stay ₹799).

## Must NOT change
- Historical InstaKYC transactions, receipts, invoices, payouts, or ledger entries created at ₹799.
- Any unrelated product/service priced at ₹799.
- Payment gateway architecture, webhook processing, KYC-status-on-success logic, refund logic, duplicate-payment
  protection, or transaction IDs.

## Acceptance
- New InstaKYC order → amount **₹279**, gateway charges **₹279**, success still marks KYC paid/verified.
- Historical ₹799 orders unchanged.
- New receipts/emails/invoices/admin "current price" show **₹279**.

## Concrete endpoints & findings (from the live web app — to save you time)
Active InstaKYC **fee** charge path (the one that matters):
- Create order: `POST /api/payments/cashfree/orders`
  body → `{ "order_type": "instakyc", "amount": 279, "currency": "INR", "reference_id": <teacher_id>, "customer_id", "customer_email", "customer_phone" }`
  (amount is in **rupees**; response returns `amount`, `order_id`, `status`, `mode` — observed `mode: production`).
- Order status: `GET /api/payments/cashfree/orders/{orderId}` → `{ amount, order_status|status }` (the web success screen shows status only, no amount).

InstaKYC **identity** verification (Sandbox.co.in — NOT a fee): `/kyc/sandbox/aadhaar/otp`, `/kyc/sandbox/aadhaar/verify`,
`/kyc/sandbox/pan/verify`, `/kyc/sandbox/bank/verify`.

Whitelisted in the web proxy but **not called** by the current web app: `/kyc/sandbox/create-payment`,
`/kyc/sandbox/verify-payment`. If the backend still prices/charges InstaKYC through either of these, make sure they also use **₹279**.

Confirmed on the web side: the app NEVER displays a backend-sourced InstaKYC price (it uses its own ₹279 config) and the
post-payment screen shows status only. Therefore any ₹799 a user could still see now can ONLY originate from
**backend-generated** artifacts — receipts, invoices, confirmation emails/SMS/WhatsApp, or an admin "current price" label —
which is exactly what items 1–4 above cover.

