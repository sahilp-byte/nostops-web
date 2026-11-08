# NOSTOPS — Prompt 3, first deliverable: pricing inventory (read-only)

**Date:** 28 Oct 2026 (container clock).
**Status:** inventory only. **No code, configuration, price or data was changed.** I have paused for your review, as you asked.

**Not done:**
- No provider call, order, payment, refund or payout.
- No deployment.
- No change to the external main backend.

**Confidence labels used below:**
- **Code-read:** checked by reading this workspace's code.
- **Doc:** taken from an earlier report (`PAYMENTS_P1_READONLY_AUDIT.md`), not re-checked.
- **Unknown:** owned by the main backend, whose code is not available here.

---

## 0. Safety pre-checks (section 2 of the prompt)

| Check | Result |
|---|---|
| 2G: preview never emails a real alert; test-address email is held | **Confirmed** (2G report, item 1, Verified). |
| 2G: preview never writes to the main backend | **Confirmed.** In the 2G full run, the only requests to `pro-learn-connect-1` were 16 untagged logins and reads. The preview write guard (`lib/server/preview-isolation.ts`) is unchanged. |
| Unresolved 2G P0 safety issue | **None.** The open 2G items are leftover test data and old test failures. You chose to keep these as an open item. |
| Money lock | `FINANCIAL_ACTIONS_UNLOCKED` is **not set** in either `.env`, so the lock is ON: `backend/financial_lock.py:89` and `frontend/lib/server/financial-lock.ts:9` both treat anything except `"true"` as locked. |
| Lock name in earlier notes | The name `MONEY_OPS_FROZEN` from earlier handoff notes **does not exist** in the code. The real lock is `FINANCIAL_ACTIONS_UNLOCKED`. |
| Checkout in preview | Off. The preview payment guard (`payment-guard.ts` / `payment_guard.py`) answers 503 on preview hosts. International checkout is refused everywhere (`PAYPAL_CHECKOUT_FLOWS` is empty). |

### Who owns what

| Part | Where | Can I change it? |
|---|---|---|
| Website server (Next.js BFF routes, `frontend/lib/**`) | this workspace | yes |
| Website backend (FastAPI): `ai_onboarding.py`, `institutional.py`, `payment_routing.py`, `audit.py`, `verification.py`, `empanelment_policy.py` | this workspace (`/app/backend`) | yes |
| Main backend `pro-learn-connect-1` | external | **No.** HTTP only: no code access, and preview writes are refused. |

**Owned by the main backend (Unknown here):**
- Retreat seat and group prices
- 1:1 booking amounts and the 1:1 rate bounds
- Fast-Track order amount
- InstaKYC `/kyc/pricing`
- Refund calculator
- Commissions, payouts and wallets
- Corporate batch close-enrollment rates
- The Cashfree order module

---

## 1. Inventory, by product

Column meanings:
- **Where it runs:** client (C), server (S), or both.
- **Main backend?** whether it depends on the external main backend.
- **Money effect now:** whether it can create a financial side effect today.

| # | Product / rule | File, route or function | Current calculation and source of truth | Where it runs | Duplicated? | Main backend? | Money effect now |
|---|---|---|---|---|---|---|---|
| 1a | **1:1 session: rate setting** | `bff/teacher/premium/route.ts`, `bff/teacher/premium-config/route.ts`, `lib/server/teacher.ts getPremiumConfig` | The teacher sets `rate_inr`; the **main backend** checks it against tier bounds (`tier_rules`). | S (BFF) + remote | **Yes, bounds disagree:** see 3.11 | yes | no (a settings write) |
| 1b | **1:1 session: booking amount** | `bff/one-on-one/bookings`; `bff/payments/cashfree/orders` + `lib/offers.ts checkBookingAmount` | The main backend's booking `amount_inr` is authoritative. The BFF re-reads it and refuses a different amount sent by the browser. | S | no | yes | Preview: **no** (guard). Production: a slot hold and a Cashfree order, which the money lock does not stop (P1 R4, Doc) |
| 1c | **1:1 session: teacher share 85% / platform 15%** | `backend/audit.py TEACHER_NET=0.85`; `components/app/teacher/TeacherOneOnOneSnapshot.tsx` (`Math.round(amount × 0.85)`); `lib/server/teacher.ts feePct: 15` | **Fixed constants** for display. The real split is remote (Unknown). | S (Python stats) + C (row display) | **Yes, 3 copies with different rounding:** see 3.14 | yes (the real split) | no (display only) |
| 2a | **Retreat seat price** | `bff/teacher/retreats/create` (₹500–₹5,00,000; venue cost ≤ price) → main backend `price_per_seat_inr` | Set by the teacher, stored remotely. The amount actually charged comes from the remote `cashfree-order`. | S + remote | no | yes | Preview: no. Production: a seat hold and an order |
| 2b | **Retreat early-bird / limited-time offers** | `lib/retreat-content.ts parseRetreatContent` reads the offers **from the retreat description text**; `bestActivePrice()`; `lib/pricing.ts resolveBooking()` | Lowest active offer wins; never combined; date-limited. | C and S-render (display only) | **Yes, two pickers that break ties differently:** see 3.2 | **Unknown** whether the main backend charges the offer price | no (display only) |
| 2c | **Teacher cohort benefits A–D** | `lib/pricing.ts cohortPerSeat()` | Flat / percentage / every-Nth-seat-free / returning-student rates, honoured by the teacher. | C (display) | no | **Not enforced** by any server | no |
| 3 | **Retreat group booking** | `bff/retreats/[id]/group-quote` → remote `GET /retreats/{id}/group-quote`; `bff/retreats/[id]/group-book` (sends only `group_size`); `components/retreats/GroupBook.tsx` | **Remote quote is authoritative** (tiers, `min_group_size`, `effective_total_inr`). The browser derives a per-seat price as `round(total ÷ size)` and runs `resolveBooking` to say which benefit applies (display). | remote + C | **Yes:** default ladder 5→5%, 10→10%, 20→15% appears in `lib/pricing.ts DEFAULT_GROUP_TIERS`, again in `RetreatPriceBreakdown.tsx GROUP_TIERS`, and on the `retreats/[id]/group` page. It is not checked against the remote quote | yes | Preview: no. Production: a group hold; the host collects payment off-platform |
| 4 | **Retreat economics and ledger** (teacher, venue owner, admin) | `lib/economics.ts computeTeacherEconomics / ledgerLine / ledgerTotals`; `lib/server/retreat-host.ts`; `VenueOwnerHome.tsx`; `TeacherGroupDashboard.tsx` | teacher net = paid − platform fee % − venue cost per seat × seats. `platform_fee_pct` comes from remote, **falling back to 15** when missing (retreat-host.ts, 3 places). The venue owner page falls back to **0** | S-render + C | **Yes, fallback disagrees:** see 3.12 | yes | no (display; payouts locked) |
| 4b | **Private retreat cost calculator** | `components/app/teacher/RetreatEconomicsCalculator.tsx` | Entirely in the browser, teacher's own what-if numbers; nothing is sent anywhere. | C | no | no | no |
| 5 | **Paid institutional events** (website backend) | `backend/institutional.py`: `participant_fee` (int INR 0–10,00,000), `_normalise_pricing`, publish check (`paid_event_requires_fee`), `pricing_locked_after_publish`; at registration `amount = fee`, `currency = "INR"`; `POST /participant/payment/intent`; confirm (amount ±0.01 + currency). BFF `bff/institutional/participant/payment/order` | **The organiser types a flat fee** per participant (per session for repeating programmes). The server snapshots it onto the registration. **No group discount, no tax, no allocation.** | S (website backend) | **Yes, bounds disagree:** wizard maximum ₹1,00,000 (`ParticipantFee.tsx FEE_MAX`) vs backend ₹10,00,000. See 3.10 | the Cashfree order is created on the main backend | Preview: **no** (payment guard + preview write refusal + `refuseFinancialCall`). Production: a Cashfree order. On completion a PENDING `inst_settlements` row is created (no amount, no money moves) |
| 5b | **Unused pricing audit store** | `institutional.py:348` `inst_pricing_calculations` (NOSTOPS-PRC ids); indexes only, **never written** | Reserved for a pricing record. | – | – | – | no |
| 6a | **Company / startup / campus rate card** | `frontend/lib/org/pricing.ts` (`COHORT_RATES`, `DISCOUNT_TIERS`, `tierFor`, `commitmentMonths`, `estimate`) | See the rate card below. | **C only.** The module is used in browser and server-rendered pages; there is no server authority | used in 6 places: `OrgPricing`, `CohortPricing`, `PricingEstimator`, `proposal-templates` (admin emails), `EventCreatorWizard` (suggested fee), `cohort-copy` FAQs | no | no. It only *suggests* the fee (`Math.round(rate)`); the organiser can type any fee |
| 6b | **Older corporate batch bookings** | `CloseEnrollment.tsx` tiers 18→10%, 29→20%, 40→30%; `booking-invite/[token]` page; remote `POST /bookings/{id}/close-enrollment`; batch invite `cashfree-order` | **Main backend** locks the final rate when enrollment closes. New batches are closed (`LEGACY_BATCH_CREATION_ENABLED=false`); existing batches can still close and pay. | remote + C | **Yes:** these tiers conflict with 6a. See 3.8 | yes | Production: the batch invite order (preview blocked) |
| 6c | **ROI calculator** | `bff/org/roi` → remote `/corporate/roi-calculator` | Remote figures. **Hidden** (`ROI_CALCULATOR_ENABLED=false`). | remote | a third org figure source | yes | no |
| 6d | **Institutional revenue share 70 / 80 / 85%** | `lib/org/pricing.ts REVENUE`, `become-a-teacher/page.tsx`, `become-a-teacher/[city]/page.tsx`, `app/coordinator/agreement/page.tsx` (NOSTOPS 30/20/15), `faq/page.tsx`, `lib/server/cities.ts`, and "Keep 70–85%" copy in widgets, ReferShare and TeacherJoinForm | Teacher keeps 70% (3 months), 80% (6 months), 85% (12 months). **Copy only; no code calculates it.** No rule exists for a 1-month starter. | C | **Yes, 6+ copies** | no | no |
| 7 | **Venue AI onboarding** (website backend, its own Cashfree) | `backend/ai_onboarding.py PRICING`: IN `{base 1999, gst_pct 18, total 2359}`, INTL `{USD 30, gst 0}`; `GET /api/ai-onboarding/pricing`; `create-order` (only the region comes from the client; region must match billing country; INTL refused); Cashfree amount + currency re-checked on verify. Labels: `components/venues/AiOnboardingPurchase.tsx PRICE` | **Server constant** with a hard-coded total. 1999 × 1.18 = 2358.82, rounded up to 2359, so the GST shown is 360. | S (+ C labels) | **Yes:** the website labels repeat the backend numbers | no (local Cashfree) | Preview: **no** (sandbox only with sandbox keys, and none are set). Production: a real INR order. USD is never sent to Cashfree |
| 8a | **InstaKYC ₹279 incl. 18% GST** | `lib/pricing.ts INSTAKYC_PRICE_INR / _BASE_INR / _GST_INR` (₹236 + ₹43, the split worked out in the website); `lib/offers.ts resolveCheckoutAmount` (BFF refuses any other amount); `InstaKycFlow.tsx`; `tests/verify_instakyc_pricing.ts` | **Website constant**, GST included. | S (BFF check) + C (display) | **Yes:** the remote `GET /kyc/pricing` also calls itself the source (Doc). See 3.5 | the order is created on the main backend | Preview: no. Production: a Cashfree order (not under the lock) |
| 8b | **Fast-Track ₹4,999** (expedited assessment) | `lib/offers.ts FAST_TRACK_PRICE_INR` (display); `backend/empanelment_policy.py fee_inr: 4999` (policy text); remote offer sets the order amount | Remote amount. **Tax treatment undocumented.** | C + remote | **Yes, 3 copies** | yes | Production: order (preview blocked); the reviewer split is locked |
| 8c | **Combined verification + empanelment ₹2,499 + taxes / US$99** | `backend/verification.py DEFAULT_PLATFORM_CONFIG` (admin-editable in the database) | **PAUSED** (`UNIFIED_OFFER_PURCHASABLE=False`): no price is shown and nothing can be bought. | S | – | no | no |
| 8d | **Wallet top-up ₹100–₹1,00,000** | `lib/offers.ts` | The teacher chooses the amount. **Blocked by the money lock.** | S | – | yes | no (locked) |
| 8e | **Membership** | `lib/offers.ts` | Not active. | – | – | – | no |
| 9 | **Taxes** | see 3.4 | Only two products state a treatment:<br>• InstaKYC: GST **included**<br>• AI onboarding: GST **added** (exclusive), with a hard-coded total<br><br>Everything else:<br>• Combined offer: "+ applicable taxes" (paused)<br>• Retreats: the text "As applicable" or the teacher's own note; nothing is calculated<br>• Rate card, event fees, 1:1 and Fast-Track: **no treatment defined**<br><br>B5.2 tax wording is blocked. | mixed | – | – | no |
| 10 | **Platform commission and teacher share** | 1c, 4, 6d; venue partnerships (`ownerSharePct`, `platformFeePct`, `guestFeeInr` from remote); referral `total_commission` (remote, read); coordinator and council bonuses ("from NOSTOPS' share", copy) | Real splits are on the main backend; locally they are display only. | remote + display | yes (above) | yes | Credits, releases and splits are **locked** |
| 11a | **Coupons / promo codes** | – | **None exist** anywhere in this workspace. | – | – | – | – |
| 11b | **Refunds and cancellations** | `lib/cancellation.ts` (30+ days 100%, 15–29 days 50%, under 15 days 0%; `refundFor` uses `Math.round`); `refunds/page.tsx`; the retreat page refund FAQ (a hard-coded sentence plus `refundFor(20, price)`); institutional `PAY_REFUNDED` status (no flow); AI onboarding duplicate payment flagged for a manual refund | Copies the **remote refund calculator** (Doc). The real refunds are remote and **locked**. | C / S-render | **Yes, 4 copies** | yes | no (locked) |
| 12 | **Currency display, rounding, money types** | `lib/format.ts inr()` (en-IN, 0 decimals); `lib/org/pricing.ts inr()` / `inrRate()` (2 decimals when fractional); `lib/pricing.ts rupee()`, `instaKycPriceLabel()`; `institutional._fmt_amount`; `receipt_pdf.format_money_pdf`; AI onboarding admin (`US$` / `₹`) | See 3.13 and 3.14. | mixed | **Yes, 6 formatters** | – | no |

**Rate card (row 6a):**
- **Per participant, per session:** campus ₹175 (flat, no discounts); company and startup ₹300.
- **Sessions:** 2 a week (8 a month).
- **Commitment discounts** for 1 / 3 / 6 / 12 months, companies and startups only:
  - 15–28 people: 0 / 10 / 12.5 / 15%
  - 29–40 people: 0 / 20 / 25 / 30%
- **Group sizes outside 15–40:** the nearest band applies.
- **Commitment length from the programme span:** 83 days or more counts as 3 months, 167 as 6, 335 as 12.
- **Calculation** (decimal numbers, not whole paise): rate × (100 − %) ÷ 100 × sessions × participants.

**International pricing:**
- The only international price anywhere in this workspace is AI onboarding US$30. It is refused at checkout because PayPal is not built.
- No USD amount is ever worked out from an INR one. The `INR_PER_USD = 83.5` noted in the Prompt 1 audit no longer exists (`lib/currency.ts` is gone).
- Every other product has `international: None` in `payment_routing.FLOWS`.

---

## 2. Can this workspace hold the authoritative price?

| Path | Authoritative here? | Why |
|---|---|---|
| Venue AI onboarding (IN, INTL) | **Yes** | Local backend constant and local Cashfree order. |
| Institutional event fee | **Yes** | Local backend; the organiser's fee is snapshotted. |
| Organisation rate card (suggestion, estimate, proposal) | **Yes, as an ESTIMATE** | Nothing is charged from it. |
| InstaKYC amount check | **Partly** | The website sets the amount sent; the main backend creates the order and has its own `/kyc/pricing`. |
| Fast-Track, 1:1, retreat seat, retreat group, corporate batch | **No** (main backend) | The engine can only show the remote amount, label it, and compare it; it cannot set it. |
| Refunds, commissions, payouts, wallet | **No** (main backend, locked) | Display of a proposed allocation at most. |

---

## 3. Discrepancies and rules that need your decision

*(I won't guess any of these. Unless you approve otherwise, each keeps today's behaviour, and the engine reports an unknown as "unavailable".)*

1. **Rounding rule** (no documented rule). The website uses round-half-up (`Math.round`); the Python backend uses round-half-even (`round()`).
   - Example: a ₹1,250 1:1 session, teacher's 85% = ₹1,062.50.
   - Server stats show **₹1,062**; each row on the same page shows **₹1,063**.
2. **Equal-price offers, two labels.**
   - When early-bird and limited-time give the same price, the retreat breakdown says "Early-bird" (`bestActivePrice` keeps the first), while the pricing hierarchy says "Limited-time" (`resolveBooking` prefers the later one).
   - The amount is the same; only the label differs.
3. **Early-bird and limited-time** live only in the retreat description text. **Unknown** whether the main backend charges the offer price. The "You pay" figure could differ from the amount charged.
4. **Tax treatment** is undefined for:
   - rate card and institutional event fees
   - 1:1 sessions
   - retreats
   - Fast-Track ₹4,999 (included or added?)
5. **InstaKYC: two sources** (website constant ₹279 and remote `/kyc/pricing`). Which one governs?
6. **AI onboarding US$30:** please confirm it is an *approved* international price. Today the code treats it as approved (`FLOWS.international = "USD"`), but it is refused at checkout.
7. **Default retreat group ladder** (5→5%, 10→10%, 20→15%, from 5 seats):
   - It is shown on public pages but never checked against each retreat's remote quote.
   - `GroupBook` assumes a minimum group of 2 when the quote doesn't give one, while `lib/pricing.ts` assumes 5.
8. **Two organisation discount ladders:**
   - Rate card: 15–28 / 29–40 people, by duration.
   - Older batch ladder: 18→10%, 29→20%, 40→30%, by headcount only.
   - Which one is current for existing batches?
9. **The 12.5% discount gives a fractional rate:** ₹300 → ₹262.50 a session.
   - The rate card shows **₹262.50**; the wizard suggests **₹263** (`Math.round`).
   - Should quotes use paise or whole rupees?
10. **Event fee maximum:** the wizard allows ₹1,00,000, the backend ₹10,00,000.
11. **1:1 rate bounds disagree:**
    - BFF premium route: any whole number above 0.
    - BFF premium-config route: ₹100–₹1,00,000, defaulting to ₹1,500.
    - Fallback when the backend sends none: ₹750–₹2,000.
    - Route comment: "₹1,500–5,000".
    - Main backend `tier_rules`: Unknown.
12. **Missing retreat platform fee:** when the main backend sends no `platform_fee_pct`, `retreat-host.ts` assumes **15%** while the venue owner page assumes **0%**. Neither default is documented.
13. **AI onboarding GST** is a hard-coded total (2359, i.e. GST ₹360), not calculated as 1999 × 18% = ₹359.82. Keep it as is?
14. **Institutional 70/80/85% split:**
    - It doesn't say whether it applies to *participant-paid* event fees.
    - There is no rule for a 1-month starter.
    - Nothing currently calculates it.
15. **Money as floats:**
    - `payment_routing` decisions and AI onboarding orders hold amounts as floats.
    - Institutional fees are whole rupees.
    - Nothing uses paise.
16. **Formatting:**
    - The backend `_fmt_amount` prints ₹100,000 (Western grouping) where the website prints ₹1,00,000.
    - PDF receipts print "INR 1,234.00".

---

## 4. Proposed engine (needs your approval; not started)

**One canonical engine in the website backend:**
- `backend/pricing_engine.py`: pure functions.
- Money held as **integer paise**; percentages handled as `Decimal`.
- One rounding rule (per your answer to 3.1).
- A versioned rule set holding today's values copied exactly (rule version, e.g. `P3-2026-10.1`).

**A read-only quote endpoint, `POST /api/pricing/quote`:**
- Validates the product id, quantity or participants, currency and country.
- Returns one of three statuses: `APPROVED_PRICE`, `ESTIMATE`, or `UNAVAILABLE`, each with a reason.
- Also returns line items, discount, tax (only where configured), the total, an allocation marked "for review only", the rule version, and a correlation id.
- Never returns `payment_ready`.
- Creates no order, hold, registration or payment.

**Wire up, without changing any amount:**
- AI onboarding `create-order` and `/pricing` read the engine.
- Institutional fee checks use the engine's validation.
- The BFF checks in `lib/offers.ts`, and the rate card in `lib/org/pricing.ts`, stay as copies kept in step by a parity test (the same pattern as `financial-lock-rules`).
- Pages show the server breakdown only where they already show a calculated price.

**Remote-owned paths:**
- The engine reports `REMOTE_AUTHORITATIVE`, with the remote amount compared but never replaced.

**Audit:**
- A structured log line for each quote.
- Optionally, a row in the unused `inst_pricing_calculations` store. This is your call: a row is a database write, even in preview.

**Tests:**
- Offline only, in-process, against a throwaway database.
- No main-backend call and no persistent rows.

**Next step:** wait for your answers to section 3 (or "keep everything as it is" for all of them), then build section 4.
