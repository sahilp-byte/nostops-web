# NOSTOPS — Prompt 3 final report: canonical pricing engine (technical foundation only)

**Date:** 29 Oct 2026 (container clock). **Environment:** this preview only. Nothing was deployed or published.
**Status:** implemented and tested in the preview. **This is not production-ready, and payment integration is not done.** Waiting for your review. Prompt 4 has not been started.

## 0. Safety summary

| Check | Result |
|---|---|
| Money lock | `FINANCIAL_ACTIONS_UNLOCKED` is absent from both `.env` files. `financial_lock.locked()` returns `True`. |
| Checkout | Off. Every quote has `checkout.available = false`, and no quote can create an order. |
| Cashfree / PayPal | No call was made. The socket-level network log shows the only outside connection during the final run: our own preview URL, which answered 401. |
| Main backend (`pro-learn-connect-1`) | Not changed and not called by the pricing engine or its tests. |
| Production configuration | Not changed. No `.env` edits. |
| Customer prices | **No charged amount changed** (see section 6 for the display-only changes). |
| Test leftovers from 2G | Not touched. |
| Records deleted by me | None outside the tests' own exact-id clean-up (see the incident in 8.3). |

## 1. What was built

| File | What it is |
|---|---|
| `backend/pricing_rules.py` (new) | One versioned rule set, `NOSTOPS-PRICING-2026-10-28.2`. Every value is copied from where it already lived, with its source and approval label (APPROVED, PROVISIONAL, RECORDED, UNAPPROVED, UNVERIFIED, UNCONFIRMED). |
| `backend/pricing_engine.py` (new) | Pure functions with no database, network or clock. Money is integer paise or cents; percentages are exact decimals. Same input gives the same quote and `quote_id`. |
| `backend/pricing_api.py` (new) | `POST /api/pricing/quote` and `GET /api/pricing/rules`. Needs the server-only shared secret. **Never writes.** The only read is one event record (6 named fields). It refuses unknown fields and type coercion. Each quote is logged as one structured line with no personal data. |
| `backend/server.py` | Registers the pricing router. |

**Quote statuses**

| Status | Meaning |
|---|---|
| `CONFIRMED` | Computed from an approved or recorded rule here. |
| `ESTIMATE` | Rate-card estimate. Never payable. |
| `UNAVAILABLE` | No rule allows a price. No amount is returned (never ₹0). |
| `REMOTE_REFERENCE` | The main backend owns the price; amounts are compared, never enforced. |
| `ALLOCATION_ONLY` | A revenue split for review. Not executable. |
| `UNAPPROVED_REFERENCE` | New this session, for group bookings (see 2.6). |

## 2. Rules the engine applies

### 2.1 Rounding (R1–R5)

| Rule | What it says |
|---|---|
| R1 | Integer minor units only. |
| R2 | A percentage is rounded half up to the paisa. Example: 85% of ₹1,250 = ₹1,062.50. |
| R3 | GST-inclusive split: base = total ÷ 1.18 to the paisa, tax = the rest. |
| R4 | Whole-rupee rounding only where a whole-rupee amount is required, shown as its own line. |
| R5 | Teacher share + NOSTOPS share always add up to the base exactly. |

### 2.2 Tax (explicit and configurable per product and jurisdiction)

| Product | Treatment | Result |
|---|---|---|
| Venue AI onboarding (India) | ₹1,999 + 18% GST, APPROVED | GST ₹359.82, subtotal ₹2,358.82, rounding +₹0.18 (R4), **total ₹2,359 (unchanged)**. |
| InstaKYC (India) | ₹279 including 18% GST, PROVISIONAL | ₹236.44 + ₹42.56. **Total ₹279 (unchanged).** |
| Everything else | `NOT_CONFIGURED` | Nothing is added and no tax is invented. |

Changing a tax rule changes the quote (tested).

### 2.3 Teacher revenue share (contract terms, APPROVED)

| Term | Teacher | NOSTOPS |
|---|---|---|
| 3 months | 70% | 30% |
| 6 months | 80% | 20% |
| 12 months | 85% | 15% |

- Any other term, including 1 month, gives "no approved split". Nothing is invented.
- Results are always marked `FOR_REVIEW_ONLY` and `executable: false`.

### 2.4 Retreat 30% platform fee: applied only where approved

- The engine applies 30% NOSTOPS / 70% teacher to the amount the main backend reports, but **only when the rule's approval is APPROVED**.
- Today the rule is **UNCONFIRMED**, so it is not applied.
- No 15% or 0% default is used.
- Tests cover both states: today's, and approved (simulated in the test only).

### 2.5 1:1 display split

- 85% teacher / 15% platform, exact to the paisa.
- The main backend still does the real split.

### 2.6 Group booking (your option A)

New product: `org_group_booking_legacy`.

**What it shows**
- The ₹5,000 baseline and the legacy ladder: 18+ people 10%, 29+ 20%, 40+ 30%.
- Example: 29 people gives ₹4,000 per participant; 40 people gives ₹3,500.

**How it is marked**
- Labelled exactly **"UNAPPROVED — NOT A CONFIRMED PRICE — BOOKING UNAVAILABLE."** in `banner`, in the reference's `label` and as the first note.
- `total` and `subtotal` are empty, and there are no line items.
- `payable`, `confirmed` and `bookable` are all false.
- `booking.available` is false.
- `tiers_commercially_approved` is false.

**When it can't be calculated reliably, it is shown as unavailable**
- **Multi-month total:** the older model's own 3-month figure (₹30,000) does not equal 3 × ₹5,000. Any request with `months` therefore returns `term_total: UNAVAILABLE` (`legacy_term_total_inconsistent`).
- **Outside India:** the whole quote is UNAVAILABLE, with no reference.
- The other legacy ladders are reference-only too (`applied: false`): the public retreat group ladder (5%, 10%, 15%) and the corporate batch copy.

### 2.7 Currency

- Billing country is required and must be an ISO code.
- India is quoted in INR. Outside India it is USD.
- A client can only *claim* the server's currency. Examples:
  - IN with USD is refused (422).
  - US with INR is refused (422).
  - EUR or GBP: "not supported".
- No USD price is ever converted from INR. Every international item returns UNAVAILABLE, except the recorded US$30 AI onboarding value, which is shown with checkout disabled.

### 2.8 Tampering

- **Refused (422):**
  - Unknown fields: `total`, `discount_pct`, `price`, `teacher_bp`, `checkout`, and others.
  - Type tricks: `"5"`, `true` or `1.0` where a whole number is expected.
  - Amounts written as `1e3`, `NaN`, `-1`, non-ASCII digits, more than 2 decimals, or above ₹10 crore.
- **Refused with 409:** an old `rule_version`.
- **Compared, never used:** `client_total` (`used: false`).
- **Compared, never enforced:** `remote_amount`.

## 3. The audit-ledger fix (the previously failed edit)

- **File:** `frontend/lib/server/audit.ts`.
- **What was wrong:** the teacher snapshot already used the server's per-booking share (`r.teacher_net_inr`), but the ledger type did not declare that field.
- **Fix:** added `TeacherLedgerRow = LedgerRow & { teacher_net_inr: number | null }` and used it in `TeacherLedgerData.rows`.
- **Checks:**
  - `tsc` exits 0.
  - `eslint` is clean.
  - `test_p3_pricing_parity.py::test_audit_ts_types_carry_the_server_share` passes.

## 4. The 22 integration points

**Note:** the earlier session's list of 22 edit operations was not kept word for word. I rebuilt this list from the git diff: every change in the diff is accounted for, and the failed `audit.ts` edit is point 22.

| # | File | Change | Status |
|---|---|---|---|
| 1 | `backend/server.py` | Registers the pricing router. | Done, tested (live API) |
| 2 | `backend/ai_onboarding.py` | Imports the engine and rules. | Done |
| 3 | `backend/ai_onboarding.py` | `PRICING = pricing_engine.ai_onboarding_table()`, same values. | Done, tested (equals the old table exactly) |
| 4 | `backend/ai_onboarding.py` | New orders record `pricing_rule_version`. Only written when an order is created, and checkout is off. | Done, source-checked |
| 5 | `backend/audit.py` | Imports the engine and rules. | Done |
| 6 | `backend/audit.py` | `FEE_PCT` comes from the rules; the `TEACHER_NET = 0.85` float is gone. | Done, tested |
| 7 | `backend/audit.py` | Each row carries `teacher_net_inr`. | Done, tested (throwaway database) |
| 8 | `backend/audit.py` | `teacher_earnings` uses exact paise; totals = sum of rows. | Done, tested |
| 9 | `backend/institutional.py` | Imports the engine. | Done |
| 10 | `backend/institutional.py` | The payment intent checks the fee with `event_fee_minor`; the amount is unchanged. | Done; source and unit tested; the live chain is **BLOCKED** (see 8.2) |
| 11 | Retreat detail page | Offer label: "…offer listed by the host". | Done, tsc/eslint |
| 12 | `TeacherOneOnOneSnapshot.tsx` | `inrExact` import. | Done |
| 13 | `TeacherOneOnOneSnapshot.tsx` | Stats tiles and monthly rows in exact paise. | Done |
| 14 | `TeacherOneOnOneSnapshot.tsx` | Row shows the server share (`Math.round(× 0.85)` removed). | Done, parity-tested |
| 15 | `GroupBook.tsx` | Tip: "host-listed … not yet confirmed". | Done |
| 16 | `PricingHierarchy.tsx` | "Applied" changed to "Best listed". | Done |
| 17 | `PricingHierarchy.tsx` | Note that offers are not yet confirmed. | Done |
| 18 | `RetreatPriceBreakdown.tsx` | Duplicate `GROUP_TIERS` removed; uses `DEFAULT_GROUP_TIERS`, "Groups (indicative)". | Done, parity-tested |
| 19 | `RetreatPriceBreakdown.tsx` | "You pay" / "Final price" changed to "Listed price", plus a note that offers are not yet confirmed. | Done, parity-tested |
| 20 | `lib/format.ts` | `inrExact` (shows paise only when present). | Done |
| 21 | `lib/pricing.ts` and `tests/verify_instakyc_pricing.ts` | InstaKYC split exact to the paisa. | Done; `verify_instakyc_pricing.ts` 8/8 |
| 22 | `lib/server/audit.ts` | `TeacherLedgerRow` type. Previously **FAILED**. | **Fixed this session**, tsc 0 |

**Other changes this session:**
- `pricing_rules.py`: version `.2`, the legacy group reference, the retreat wording, and one new unresolved item.
- `pricing_engine.py`:
  - the `UNAPPROVED_REFERENCE` product;
  - the retreat 30% fee applied only where approved;
  - plain-ASCII amount parsing;
  - `event_fee_minor` refuses NaN cleanly (it used to raise a ValueError).
- `pricing_api.py`: strict types.
- `frontend/yarn.lock` has an uncommitted change (babel packages) that is **not** part of this work. I left it alone.

## 5. Tests

### 5.1 New Prompt 3 tests (350)

| File | Tests | Result | What it covers |
|---|---|---|---|
| `test_p3_pricing_engine.py` | 200 | 200 passed | Arithmetic R1–R5 (including thousands of values for half-up and reconciliation), the float ban, 18% GST both ways, configurable tax, 70/80/85%, the retreat 30% fee (unconfirmed and approved), 1:1 85%, group reference (8 sizes, banner, never payable, months unavailable), ladders, rate card, event fees, INR/USD, tampering, every product has checkout off, determinism, no I/O imports. |
| `test_p3_pricing_parity.py` | 26 | 26 passed | Website copies match the rules: InstaKYC, Fast-Track, AI onboarding labels, rate card, 70/80/85 copy, 18/29/40 ladder, 5/10/15 ladder, 15% fee, the `audit.ts` type, backend call sites. Unresolved discrepancies are pinned as they are today. |
| `test_p3_audit_earnings.py` | 5 | 5 passed | Same figures as before for whole amounts (₹2,125 / ₹1,700), exact paise for fractions, and the teacher endpoint on a **throwaway database** with exact-id clean-up. |
| `test_p3_pricing_api.py` | 82 | 82 passed | Secret, unknown fields, no type coercion, refusals, logging (allowed keys only, no secret), correlation id. Every product × IN/US/GB is quoted while **all Motor write methods, real HTTP transports and non-loopback sockets are blocked**: 0 violations. Event records live in a throwaway database with exact-id clean-up. |
| `test_p3_pricing_live.py` | 37 | 37 passed | 26 live quotes and 8 tampered requests to the running local backend. The preview URL without the secret answers 401. A fingerprint (count + id hash) of 23 money- and booking-related collections is identical before and after. |

**Clean-up:** the only records these tests create are 5 event rows and 3 ledger rows, in throwaway databases (`nostops_qa_p3_pricing_tmp`, `nostops_qa_p3_audit_tmp`). They are removed with `delete_many({id: {$in: [exact ids]}})` and checked to be 0 afterwards. No pattern deletes, no `drop`. The two throwaway databases remain as empty collections.

### 5.2 Final verification run

Run 4, 03:27 UTC. P3 tests plus the earlier offline payment and isolation set (2A–2G, P0 gateway, sandbox guard).

| Result | Count |
|---|---|
| Passed | **1,676** (350 P3 + 1,326 earlier) |
| Failed | **0** |
| Skipped | **12** (by design: `test_p0_freeze_gateway`, "records no money") |

- **Database:** snapshot before and after shows **no difference** except the snapshot time (`test_reports/p3/diff_s2_s3.txt`). That covers every collection count, the id sets of 24 watched collections and the test outbox.
- **Network:** socket-level log (`test_reports/p3/net_external.jsonl`) shows exactly one outside connection: the preview URL check (401).

### 5.3 Website checks

| Check | Result |
|---|---|
| `tsc --noEmit` | exit 0 |
| `eslint` on the 8 changed frontend files | exit 0 |
| `verify_instakyc_pricing.ts` | 8/8 |
| `verify_checkout_routing.ts` | passed |
| `verify_booking_holds.ts` | passed |
| `verify_preview_isolation.ts` | 97 checks passed |
| `verify_financial_lock.ts` | Not a standalone check: it needs a cases file from pytest, so it is not counted. |
| Smoke screenshot `/retreats` (390 px) | Renders, with the "Test mode — no real payments" banner. |

## 6. Display changes that users can see (no charged amount changed)

| Where | Before | Now |
|---|---|---|
| InstaKYC paywall breakdown | ₹236 + ₹43 | ₹236.44 + ₹42.56 (total still ₹279) |
| Teacher 1:1 earnings | ₹1,062 in the totals, ₹1,063 on the row (disagreed) | ₹1,062.50 everywhere |
| Retreat price box | "You pay" / "Final price" / "Applied" | "Listed price" / "Best listed", plus "offers listed by the host, not yet confirmed" |

## 7. Evidence of no live financial side effects

- **The engine can't write or call out:** it imports only `hashlib`, `json`, `re`, `decimal`, `typing`, `pricing_rules`, and four pure helpers from `payment_routing` (tested).
- **The API's only database call is one `find_one`** with a 6-field projection (tested). In-process, every Motor write method was blocked and never triggered.
- **Live:** before and after 34 quotes to the running backend, the 23 watched collections had identical documents. This covers orders, payments, registrations, bookings, settlements, ledgers, `inst_pricing_calculations`, allocations, refunds, payouts, webhooks, entitlements and wallet.
- **Clean final run:** no database change at all.
- **No quote record is stored.** Quotes are logged only (`inst_pricing_calculations` is still unused).

## 8. Tests not run, blocked, and one incident

### 8.1 BLOCKED (unsafe or inaccessible)

| Test | Why |
|---|---|
| `test_audit_ledger.py`, `test_audit_new_features.py` | Live; write to the preview's 1:1 payment ledger. Covered instead by `test_p3_audit_earnings.py` on a throwaway database. |
| `test_participant_paid_payment_chain.py`, `test_b23_paid_programmes.py` | Live paid-event chain; create registrations and payment intents. Integration point 10 is checked by source and unit tests only. |
| Live suites (`test_p2a_http_live`, `test_p2b_bff_live`, `test_p2c_hold_live`, …), the full `backend/tests` and the workflow suite | They create preview records, and earlier runs left data behind. Not needed for this change. |
| Main-backend prices | Inaccessible: retreat quotes, 1:1 amounts, `/kyc/pricing`, Fast-Track order amount, batch rates. The engine only labels them REMOTE_REFERENCE. |
| Payment-provider sandbox checks | Forbidden by your instructions. |

### 8.2 Not run (other reasons)

- **`next build`:** it would rebuild over the running dev server. I ran `tsc` and `eslint` instead.
- **UI testing agent:** not used, to avoid uncontrolled clicks and writes. Tell me if you want a supervised frontend-only pass.

### 8.3 Incident (my mistake)

- **What happened:** I put `test_b23_fee_edges.py` in the regression set without checking it first. It is a live test that writes data. It ran **3 times** (03:24–03:26 UTC).
- **What each run did:** created a QA organisation and published one paid QA event (fee ₹270) in **the preview's own database**, then removed them with its built-in exact-id purge.
  - Organisations: `NOSTOPS-ORG-2026-001015/16/17`
  - Events: `NOSTOPS-EVT-2026-002234/35/36`
- **What remains:**
  - **15 activity-log rows** in `inst_event_audit_log` (5 per run; that file keeps them by design).
  - Counters moved on: EVT +3, ORG +3, MBR +3, SEO +9.
- **What did not happen:**
  - No email: the test outbox count is unchanged and no provider was called.
  - No alert.
  - No registration, order, payment, settlement or allocation row.
  - Event and organisation counts are back to where they were.
- **Not cleaned up:** I did not delete the 15 log rows. Removing them needs your separate approval.
- I re-ran the final set without this file (5.2), and that run is clean.

**Not a test effect:** creating a test file triggered the backend's auto-reload (`--reload`). Its startup demo seed refreshed `updated_at` on the 6 demo organisations and the demo teacher rows (03:23:58). That is normal start-up behaviour.

## 9. Unresolved pricing rules (need your decision; the engine keeps today's behaviour)

1. Which organisation discount ladder is current: the rate card by size and commitment, or the legacy 18/29/40 batch ladder.
2. Tax treatment for organisation programmes, event fees, 1:1 sessions, retreats and Fast-Track (₹4,999: included or added?).
3. Whether the main backend charges host-listed early-bird or limited-time retreat offers.
4. Whether each retreat's group quote follows the public 5% / 10% / 15% ladder.
5. An approved retreat-specific rule for the 30% NOSTOPS / 70% teacher split. Until then it is not applied.
6. Which revenue base each institutional contract defines for 70/80/85%, and whether it applies to participant-paid event fees. There is still no 1-month rule.
7. Which InstaKYC source governs: the website's ₹279 (PROVISIONAL) or the main backend's `/kyc/pricing`.
8. Whether US$30 AI onboarding is approved for sale once international checkout exists, and its tax.
9. Event fee maximum: the wizard allows ₹1,00,000, the backend ₹10,00,000.
10. 1:1 rate bounds disagree between the BFF routes and the main backend.
11. **₹5,000 baseline:**
    - whether it and the 18/29/40 ladder are approved;
    - which billing period the ₹5,000 covers;
    - whether that ladder is the one meant to go with it. I paired them because they are the only legacy organisation figures; please confirm.
12. AI onboarding total: kept as the hard-coded whole-rupee ₹2,359 (R4 rounding of ₹2,358.82).

## 10. Remaining limitations

1. **The engine is authoritative only for prices this website owns:** AI onboarding, event fees, the InstaKYC amount check, and estimates. Main-backend prices are compared, not set.
2. **Nothing calls the quote API yet.** No BFF route or page uses it. The website's own copies (labels, ladders, the InstaKYC split) stay, kept in step by the parity tests.
3. **`quote_id` is a content hash, not a signed or expiring token.** It cannot prove a price later, and no quote is stored.
4. **Float amounts still exist outside the engine.** Stored order and ledger amounts are numbers in rupees; the engine converts them on read.
5. **The legacy group reference has no screen.** It exists only in the API.
6. **The main backend's checks are unverified here.** International checkout stays disabled. Payouts, refunds and settlements are untouched and locked.

**Evidence files:** `/app/test_reports/p3/`, which holds:
- the run logs and `tsc` / `eslint` logs;
- the database snapshots and diffs;
- the network log;
- the socket-logging plugin.

**Next step:** your review. Prompt 4 (payments) and any deployment need your separate approval.
