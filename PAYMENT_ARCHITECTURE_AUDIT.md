# NOSTOPS — Complete Payment Architecture Audit (READ-ONLY)
**Status:** Audit only. No code modified. No Razorpay removed. No deploy. Awaiting implementation authorization.
**Business rule (target):** Cashfree = the ONLY active NOSTOPS payment gateway. Razorpay = fully removed from any active payment path (historical records retained).

---

## 0. ARCHITECTURE REALITY (critical context for the whole plan)

- **The business backend is REMOTE and FROZEN** (`BACKEND_ORIGIN = https://pro-learn-connect-1.emergent.host`). It owns ALL money logic: order creation, gateway keys, webhooks, settlement, refunds, teacher wallet/payout. `/app/backend/server.py` is a **thin pass-through proxy** with only `/api/health` + a catch‑all `/api/{path}` proxy. It contains **no payment logic and no webhook handler**.
- The Next.js app talks to the remote backend through a **BFF** layer (`/app/frontend/app/bff/*`) that attaches the bearer server‑side and enforces CSRF.
- The **only local persistence** is an isolated Mongo `audit_ledger` (via `/app/backend/audit.py`) used purely for **admin/teacher/seeker visibility of 1:1 sessions** — it is NOT the system of record.
- **Consequence:** The frontend can freely remove Razorpay *branding, UI copy, and BFF action names*, and can re‑point flows to the already‑existing generic Cashfree order endpoint. **But the three remaining active Razorpay charges are executed by REMOTE endpoints we cannot edit.** Truly killing those Razorpay paths requires the remote backend to expose Cashfree equivalents (or re‑route those order types through its existing Cashfree module). **This is the #1 migration blocker (see Risk Register R1).**

---

## A. PAYMENT TOUCH-POINT MATRIX

| # | Touch Point | Persona | Purpose | Amount | Cur | Current Gateway | Cashfree Req? | Razorpay Dependency | DB Record | API path | Webhook | Refund | Teacher Impact | Admin Impact |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **1:1 session booking payment** | Seeker | Pay teacher for a 1:1 | teacher rate (≥₹500) | INR | **Cashfree** ✅ | Yes (done) | none in charge path; *field read only* (see #9) | local `audit_ledger` + remote booking | `/bff/payments/cashfree/orders` → remote `/payments/cashfree/orders`; status `/bff/payments/cashfree/orders/[orderId]` | remote (Cashfree) | backend on teacher decline | earns 85% net | shown in Admin 1:1 ledger |
| 2 | **InstaKYC paywall** | Teacher | Identity verification | ₹799 | INR | **Cashfree** ✅ | Yes (done) | none | remote KYC state | `CashfreePayButton orderType=instakyc` → same order endpoint | remote | n/a | unlocks KYC steps | KYC admin |
| 3 | **Wallet top-up** | Teacher | Add balance | variable | INR | **Cashfree** ✅ | Yes (done) | none | remote wallet | `CashfreePayButton orderType=wallet_topup` | remote | n/a | wallet credit | — |
| 4 | **Empanelment Fast-Track** | Teacher | Priority Council review | ₹4,999 | INR | **RAZORPAY** ❌ | Yes (MIGRATE) | `razorpay-create` + `razorpay-verify` (remote) + `FastTrackApply.tsx` | remote fast-track request | `/bff/teacher/empanelment/fast-track/[id]/razorpay-create` → remote | remote (Razorpay) | backend | n/a | Council queue |
| 5 | **Retreat seat reservation → pay** | Seeker | Pay for a retreat seat | price/seat | INR | **RAZORPAY hosted link** ❌ (or off-platform UPI/bank) | Yes (MIGRATE) | remote `create-payment-link` returns Razorpay `short_url` | remote reservation | `/bff/retreats/[id]/reservations/[rid]/pay` → remote `create-payment-link` | remote | backend `cancel-with-refund` | host settlement | host/reservations |
| 6 | **Group / Corporate booking-invite “Pay now”** | Seeker/Employee | Pay locked group seat | per-seat | INR | **RAZORPAY hosted link** ❌ | Yes (MIGRATE) | remote `payment-link` returns Razorpay `short_url`; `PayNow.tsx` copy | remote booking | `/bff/booking-invite/[token]/payment-link` → remote | remote | backend | host/teacher earnings | Org participant mgr |
| 7 | **Retreat group booking (host-arranged)** | Group lead | Reserve a group | variable | INR | **Manual** (“Razorpay link or bank transfer” copy) | Depends on host | `GroupBook.tsx` copy; `CloseEnrollment.tsx` copy | remote | `/bff/retreats/[id]/reserve` | n/a | backend | host | Org |
| 8 | **Teacher wallet withdrawal (payout)** | Teacher | Withdraw net earnings | variable | INR | **NOT a checkout gateway** — backend PIN+OTP + bank/UPI settlement | N/A (payout ≠ Cashfree checkout) | none | remote wallet ledger | `/bff/teacher/wallet/[action]` → remote `/teacher-wallet/*` | n/a | n/a | receives net | Admin Payouts queue |
| 9 | **Teacher 1:1 earnings display / accept-decline gate** | Teacher | See earnings, gate actions | derived | INR | display only | n/a | **reads `razorpay_payment_id`** to compute `paid` (`lib/server/one-on-one.ts`) | remote `my-bookings` | read-only | n/a | n/a | 85% net | — |
| 10 | **Cancellation & refund policy display** | Seeker | Show refund tiers | derived | INR | display only | n/a | none | — | `lib/cancellation.ts` mirrors backend calc | n/a | backend executes | — | — |
| 11 | **Currency orientation (intl)** | Seeker (outside India) | Show ~USD next to ₹ | approx | USD label / INR charge | display only | n/a | none | — | `lib/currency.ts` (INR_PER_USD=83.5) | n/a | n/a | — | — |

**Summary:** 3 flows already Cashfree (1,2,3). **3 active Razorpay charge paths remain (4,5,6)** + 1 manual/mixed (7) + 1 data-field coupling (9) + Razorpay UI copy in 3 components.

---

## B. RAZORPAY DEPENDENCY REGISTER

| File | Component | What it does | Dependency Type | Business Workflow | Replacement Required | Risk |
|---|---|---|---|---|---|---|
| `app/bff/teacher/empanelment/fast-track/[...action]/route.ts` (L17–18) | Fast-Track BFF | maps `razorpay-create` / `razorpay-verify` → remote `/empanelment/fast-track/{id}/razorpay-create` & `/razorpay-verify` | **ACTIVE charge (remote endpoint)** | #4 | Re-point to Cashfree order (needs remote support) | **HIGH** — remote/frozen |
| `components/app/teacher/FastTrackApply.tsx` (L114) | Fast-Track UI | calls `…/razorpay-create`, opens `short_url` | ACTIVE charge (client) | #4 | Swap to Cashfree flow + copy | HIGH |
| `app/bff/retreats/[id]/reservations/[rid]/pay/route.ts` (L7 comment, logic) | Retreat pay BFF | remote `create-payment-link` → Razorpay `short_url` | **ACTIVE charge (remote endpoint)** | #5 | Remote must return Cashfree link OR use Cashfree order | **HIGH** — remote/frozen |
| `components/retreats/RetreatReserve.tsx` (L105–110) | Retreat reserve UI | redirects to `short_url` | ACTIVE charge (client) | #5 | Neutral (works with any link) — copy only | MED |
| `app/app/reservations/page.tsx` (L55–60) | Reservations list | redirects to `short_url` | ACTIVE charge (client) | #5 | Neutral | LOW |
| `app/bff/booking-invite/[token]/[action]/route.ts` (`payment-link`) | Group invite BFF | remote `/bookings/invite/{token}/payment-link` → Razorpay `short_url` | **ACTIVE charge (remote endpoint)** | #6 | Remote must return Cashfree link | **HIGH** — remote/frozen |
| `components/booking/PayNow.tsx` (L7,27,43) | Group PayNow UI | “Pay now via Razorpay →”, redirects `short_url` | ACTIVE charge + **branding** | #6 | Re-copy to Cashfree/neutral | MED |
| `components/retreats/GroupBook.tsx` (L179) | Group book UI | fallback text “Razorpay link or bank transfer” | **branding/copy** | #7 | Re-copy | LOW |
| `components/app/org/CloseEnrollment.tsx` (L64) | Org close UI | copy “pay … via Razorpay” | **branding/copy** | #6/#7 | Re-copy | LOW |
| `lib/server/one-on-one.ts` (L52, L64) | Teacher 1:1 data layer | `paid = !!s.razorpay_payment_id …`; `paymentId = s.razorpay_payment_id` | **gateway-named field in business logic** | #9 | Make gateway-neutral (`payment_id`/status) | MED |

**Note:** No `razorpay` npm package, SDK import, key, secret, or env var exists in this repo. All Razorpay keys/webhooks live on the **remote backend**. The only local Razorpay presence is: remote endpoint *names*, `short_url` redirects, one DB *field name* read, and UI copy.

---

## C. CASHFREE CAPABILITY MATRIX

| Workflow | Cashfree today? | How |
|---|---|---|
| 1:1 booking payment (#1) | ✅ Full | `/bff/payments/cashfree/orders` → remote `/payments/cashfree/orders`; hosted checkout; `/cashfree-return` verifies server-side |
| InstaKYC ₹799 (#2) | ✅ Full | same order endpoint, `order_type=instakyc`, reference_id resolved server-side |
| Wallet top-up (#3) | ✅ Full | same order endpoint, `order_type=wallet_topup` |
| Fast-Track ₹4,999 (#4) | ❌ Razorpay | needs `order_type=empanelment_fast_track` + `reference_id=request_id` on the existing Cashfree order endpoint **IF remote links it back to the request** |
| Retreat reservation pay (#5) | ❌ Razorpay link | remote `create-payment-link` is Razorpay; needs remote Cashfree equivalent |
| Group booking-invite pay (#6) | ❌ Razorpay link | remote `payment-link` is Razorpay; needs remote Cashfree equivalent |
| Server-side status verification | ✅ | `/bff/payments/cashfree/orders/[orderId]` re-reads remote gateway status (`PAID`/`SUCCESS`) |
| Webhook signature / idempotency | ⚠️ Remote-owned | No local webhook. Remote backend owns webhook + settlement (frozen) |
| Refund via Cashfree | ⚠️ Remote-owned | No refund API called locally; backend executes refunds |
| International (Cashfree intl cards / INR settlement) | ⚠️ Not enabled in code | Only indicative USD label; charge always INR. Enablement = **merchant-account config** |

**Existing Cashfree order-endpoint contract (already live):** POST `/payments/cashfree/orders` with `{amount, currency:'INR', order_type, reference_id, customer_*}` → returns `{order_id, payment_session_id, checkout_url, amount, currency, status, mode}`. GET `/payments/cashfree/orders/{orderId}` → `{order_status|status, amount, order_type}`. `web_return_url = /cashfree-return?order_id=…`.

---

## D. DATABASE IMPACT REPORT

**Remote DB (frozen, cannot change):** owns real orders/payments/refunds/settlements incl. the `razorpay_payment_id` field surfaced on 1:1 `my-bookings`. **Retain all historical Razorpay records.**

**Local `audit_ledger` (Mongo `nostops_web`, editable):**
- Fields: `_id/booking_id`, `teacher_id/handle/name`, `seeker_user_id/name/email/phone`, `amount_inr`, `currency`, **`gateway`** (free string), `order_id`, `status` (`PENDING_PAYMENT`→`PAYMENT_INITIATED`→`PAID`), `session_mode`, `matrix_reason`, `note`, `slot_iso`, `events[]`, timestamps.
- The `gateway` field is **already gateway-neutral in shape**; the 1:1 BFF only ever writes `gateway:'cashfree'`. No Razorpay values are written locally.
- **Recommended changes (low-risk):** (a) keep `gateway` but treat it as informational; (b) make the 1:1 “paid” logic depend on **status only** (already true locally); (c) if we ever mirror Fast-Track/retreat payments into a ledger, store a gateway-neutral `payment_ref` rather than a gateway-named field. **No destructive migration. No deletion of historical rows.**

---

## E. API / WEBHOOK MIGRATION MAP (Razorpay → Cashfree)

| Flow | Today (Razorpay) | Target (Cashfree) | Who must change |
|---|---|---|---|
| #4 Fast-Track | remote `/empanelment/fast-track/{id}/razorpay-create` + `/razorpay-verify` | Option A: remote adds `…/cashfree-create` (mirror). Option B: reuse `/payments/cashfree/orders` with `order_type=empanelment_fast_track`, `reference_id=request_id`, and remote webhook flips the request to paid | **Remote backend** + FE re-point (`FastTrackApply`, BFF action map) |
| #5 Retreat pay | remote `…/create-payment-link` (Razorpay `short_url`) | remote returns a **Cashfree** `checkout_url`/`payment_session_id` for the same reservation, OR FE switches to `/payments/cashfree/orders` `order_type=retreat_reservation`, `reference_id=reservation_id` | **Remote backend** + FE (`pay` route stays neutral) |
| #6 Group invite pay | remote `/bookings/invite/{token}/payment-link` (Razorpay) | remote returns a **Cashfree** link for the invite, OR Cashfree order `order_type=group_booking`, `reference_id=booking_id/token` | **Remote backend** + FE (`PayNow` copy) |
| #9 Field coupling | `razorpay_payment_id` | gateway-neutral `payment_id` + rely on `status ∈ {paid,confirmed}` | **FE only** (defensive: read both while remote still emits the old field) |
| Webhooks | Razorpay webhook on remote | Cashfree webhook on remote (signature verify, idempotent, no double-booking/double-earning/double-refund) | **Remote backend** (frozen) |
| Refunds | Razorpay refunds on remote for #4/#5/#6 | Cashfree refunds on remote once those move to Cashfree | **Remote backend** |

---

## F. USER JOURNEY IMPACT REPORT

**Yoga Seeker:** #1 (1:1) is already `NOSTOPS → Cashfree → confirmation`. #5 (retreat) and #6 (group invite) still route to Razorpay hosted links — the seeker currently sees Razorpay branding/copy in `PayNow` and via the hosted page. Target: identical Cashfree experience, no gateway name shown. `/cashfree-return` already gives a clean NOSTOPS confirmation for #1/#2/#3.

**Yoga Teacher:** #4 (Fast-Track ₹4,999) still opens a Razorpay hosted link in a new tab. Teacher earnings (1:1) show net 85% and a `paymentId` that today comes from `razorpay_payment_id` (field coupling #9). Wallet **withdrawal/payout (#8)** is NOT a gateway checkout — it’s the remote backend’s PIN+OTP + bank/UPI settlement; **the gateway does not perform teacher payouts.** Teacher UI already avoids most gateway jargon except the Fast-Track button/flow.

**Admin:** 1:1 ledger admin (`/app/admin/one-on-one`) shows a **`gateway` column** (renders “Cashfree” for all 1:1 rows) — there is **no Razorpay selector anywhere in admin**, and no admin control to choose a gateway. Payouts queue (`/app/admin/payouts`) and Reports (`/app/admin/reports`) show revenue/refunds pending but no gateway selection. Minimal admin impact.

**Clear separation (for section 4 of the brief):**
- **Seeker payment** = gross the seeker pays (Cashfree order amount).
- **NOSTOPS revenue** = 15% platform fee.
- **Teacher earnings** = 85% net (computed locally for 1:1; remote wallet for the rest).
- **Teacher settlement/payout** = separate backend PIN+OTP + bank/UPI flow (`/teacher-wallet/*`), **not** a gateway payout.

---

## G. RISK REGISTER

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| **R1** | Fast-Track/Retreat/Group charges execute on **remote frozen endpoints** — FE cannot switch their gateway alone | **BLOCKER** | Requires remote backend to expose Cashfree for these order types (see E). If unavailable, we can only remove Razorpay *branding/copy* + keep the neutral redirect, and must flag the remaining path to the backend team. Do NOT delete these flows. |
| R2 | Removing Razorpay copy without a working Cashfree charge would leave a dead “pay” button | HIGH | Only remove/replace once the Cashfree charge for that flow is confirmed working end-to-end. |
| R3 | `razorpay_payment_id` field removal could break the teacher accept/decline gate (`awaitingTeacher`) if remote still emits only that field | MED | Read both `razorpay_payment_id` **and** a neutral `payment_id`, and prefer `status`. Keep backward-compatible until remote renames. |
| R4 | Local ledger PAID relies on the client-triggered `/cashfree-return` poll — there is **no local webhook**; a closed browser can leave the local row at `PAYMENT_INITIATED` even though the remote (system of record) is paid | MED | Acceptable for now (remote is source of truth). Optional: add a local reconcile that re-reads remote status for stale `PAYMENT_INITIATED` rows. Do NOT treat redirect as proof (already correct). |
| R5 | International: Cashfree intl cards / INR settlement may not be enabled on the merchant account | MED | **Manual Cashfree merchant-account action** — flag to owner; not a code fix. Currency label logic (`lib/currency.ts`) is display-only and fine. |
| R6 | Refunds for #4/#5/#6 currently go through Razorpay on the remote backend | MED | Refund capability must NOT be removed; it follows whichever gateway processed the original charge. Backend must add Cashfree refunds when those flows migrate. |
| R7 | Webhook security (signature/idempotency/double-earning) is entirely remote-owned | MED | Cannot implement here; include as a backend requirement + verify with backend team. |

---

## PAYMENT-STATUS SECURITY VERDICT (section 9 of the brief)
✅ **The app does NOT treat a frontend redirect as proof of payment.** `/cashfree-return` ignores the URL and polls the BFF, which **re-reads the remote gateway status server-side**; the local ledger flips to `PAID` only on confirmed `PAID/SUCCESS`, and `mark-paid` is **idempotent + seeker-scoped**. Edge cases: refresh/duplicate → idempotent; browser close/network drop → local row may stay `PAYMENT_INITIATED` (remote still authoritative — R4); failed/pending → shown honestly with auto-refund note.

## WEBHOOK VERDICT (section 10)
No webhook exists in this repo (frontend or local FastAPI). All webhook processing (signature verify, idempotency, no double-booking/earning/refund) is on the **remote frozen backend**. This must be confirmed with the backend team; it cannot be built or verified from this app.

## ENV/SECRET VERDICT (section 17) — names only
Local repo contains **no** `RAZORPAY_*` or `CASHFREE_*` variables. Present names: `BACKEND_URL`, `BACKEND_ORIGIN`, `PULSE_API_URL`, `PULSE_SHARED_SECRET`, `MONGO_URL`, `DB_NAME`, `EMERGENT_LLM_KEY`, `EMERGENT_EMAIL_KEY`, `EMAIL_FROM_NAME`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`. **There are no Razorpay secrets to remove locally** — all gateway keys live on the remote backend.

---

## WHAT CAN BE DONE FRONTEND-ONLY vs. WHAT NEEDS THE BACKEND
**Frontend-only (safe, no remote dependency):**
- Remove Razorpay **branding/copy** (`PayNow`, `GroupBook`, `CloseEnrollment`) → neutral “Secure payment” / Cashfree.
- Make `lib/server/one-on-one.ts` **gateway-neutral** (read `payment_id` + status; keep reading legacy field as fallback).
- Rename BFF Fast-Track action names away from `razorpay-*` **once** the remote Cashfree action exists.

**Requires remote (frozen) backend — BLOCKER, must be raised with backend team:**
- Cashfree charge for Fast-Track (#4), Retreat reservation (#5), Group invite (#6).
- Cashfree refunds for those flows.
- Cashfree webhook (signature/idempotency) + international enablement.

---

**STOP.** End of read-only audit. No production code modified. Awaiting the next instruction to authorize implementation.
