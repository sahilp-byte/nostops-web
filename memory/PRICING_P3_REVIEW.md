# NOSTOPS — Prompt 3 review (read-only)

**Date:** 29 Oct 2026 (container clock). **Scope:** read-only review of `PRICING_P3_REPORT.md`.

**Nothing was changed.** No code, configuration, pricing rule or database record was changed, and nothing was deleted, restored or reset. No test that writes data was run, nothing was deployed or published, and Prompt 4 has not started.

**What I did:**
- Read code and the database.
- Read the running processes' settings.
- Sent two GET requests to a quote route that writes nothing. One went to the preview and one to production (see 3.3).

---

## 1. The 12 unresolved pricing rules

Each question is copied word for word from `PRICING_P3_REPORT.md`, section 9.

**Nothing is selected or implemented.** Each "Recommended" line is only my suggestion for your decision.

**Data checked (read-only):**
- The preview database has 0 paid events, 0 AI onboarding orders and 0 rows in the 1:1 ledger.
- Production data was not inspected.

### Rule 1
> 1. Which organisation discount ladder is current: the rate card by size and commitment, or the legacy 18/29/40 batch ladder.

**Today:**
- **Rate card** (`lib/org/pricing.ts`) drives every new-organisation figure on the website: price pages, the estimator, proposal emails, and the fee the event wizard suggests.
  - Company and startup: ₹300 per person per session. Campus: ₹175, never discounted.
  - Discounts for 15–28 people: 0 / 10 / 12.5 / 15%.
  - Discounts for 29–40 people: 0 / 20 / 25 / 30%.
  - The engine labels it `ESTIMATE`, `UNAPPROVED`.
- **Legacy 18/29/40 ladder:** used only on older corporate batches (`CloseEnrollment.tsx`, as guidance). The main backend locks the final rate.
  - New batches are closed.
- **Engine:** neither is confirmed.

| Choice | Business consequence |
|---|---|
| A. Rate card for all new programmes; the legacy ladder only for batches already sold | Existing customers keep the terms they were shown; new sales get one clear price list. The rate card still needs a tax decision (Rule 2) before quotes can be "confirmed". |
| B. Legacy ladder for everyone | Discounts start at 18 people instead of 15, and they no longer depend on commitment length. Price pages, proposals and FAQs must be rewritten. |
| C. Rate card for everyone, including existing batches | Changes what existing batch customers were promised. The main backend owns those rates, so this can't be done from this workspace. |
| D. Leave both unapproved (today) | No organisation quote can be confirmed; sales stay on estimates. |

**Recommended: A.**

### Rule 2
> 2. Tax treatment for organisation programmes, event fees, 1:1 sessions, retreats and Fast-Track (₹4,999: included or added?).

**Today:**
- Only two products have a tax rule: AI onboarding (₹1,999 + 18%) and InstaKYC (₹279 including 18%).
- Everything else is `NOT_CONFIGURED`: nothing is added and no tax line is shown.
- Retreat pages show "As applicable" or the teacher's own note.
- Tax wording work (B5.2) is blocked.

| Choice (per product) | Business consequence |
|---|---|
| GST included in today's price | What customers pay is unchanged, but NOSTOPS keeps about 15.25% less (price ÷ 1.18). Example: ₹4,999 Fast-Track = ₹4,236.44 + ₹762.56 GST. |
| GST added on top | Customers pay 18% more than shown today (₹4,999 becomes ₹5,898.82). That is a price change and needs new wording and notice. |
| Exempt / not applicable | No tax line, but it needs a documented legal basis. |
| Defer (today) | No change for customers; the open compliance question stays. |

**Recommended:**
- Defer each product to a tax adviser (CA). I can't give tax advice.
- If one must be chosen before that advice, "GST included" is the only option that doesn't change what customers pay.

### Rule 3
> 3. Whether the main backend charges host-listed early-bird or limited-time retreat offers.

**Today:**
- Offers are read from the retreat's description text.
- They are shown as "listed by the host … not yet confirmed".
- The amount payable is whatever the main backend confirms at booking.
- Whether the main backend charges the offer price is unknown; it can't be checked from here.

| Choice | Business consequence |
|---|---|
| A. Confirm with the main backend team; if offers aren't charged, make them proper fields the main backend applies | Accurate, but needs main-backend work outside this workspace. |
| B. Hide offer prices until confirmed | No risk of showing a lower price than is charged; hosts lose a sales tool for now. |
| C. Keep showing them as unconfirmed (today) | Risk: a customer sees the offer price but is charged the list price, leading to complaints or refund disputes. |

**Recommended:** A. Keep C's "not yet confirmed" wording until A is answered. If A shows offers aren't charged, switch to B.

### Rule 4
> 4. Whether each retreat's group quote follows the public 5% / 10% / 15% ladder.

**Today:**
- Public pages show 5+ seats 5%, 10+ 10% and 20+ 15%, labelled "Groups (indicative)".
- The real group price comes from the main backend for each retreat.
- **A small gap:** the group booking form assumes a minimum group of 2 when the quote doesn't give one, while `lib/pricing.ts` assumes 5.

| Choice | Business consequence |
|---|---|
| A. Every retreat must follow 5/10/15 (the main backend applies it) | Consistent everywhere; hosts can't set their own group terms. Needs main-backend work. |
| B. Each retreat keeps its own ladder; public pages show only that retreat's quote | Always accurate; loses one simple marketing line. |
| C. Keep the general ladder as indicative (today) | Possible mismatch with the actual quote. |

**Recommended: B.**

### Rule 5
> 5. An approved retreat-specific rule for the 30% NOSTOPS / 70% teacher split. Until then it is not applied.

**Today:**
- The 30/70 split is marked `UNCONFIRMED` and is not applied.
- The main backend owns the real retreat fee.
- **Fee seen in the test accounts:** an empanelled teacher is shown 15%, a Council Guru 0%.
- **Fallbacks disagree** when the main backend sends no fee:
  - three places in the teacher pages assume 15%;
  - the venue-owner page and the economics helpers assume 0%.

| Choice | Business consequence |
|---|---|
| A. 30% for all retreats | Double the 15% shown to teachers today, which changes their economics. Retreats already published at 15% would change unless this applies only to new retreats. Needs main-backend work. |
| B. 30% for some host types only | Many cases to explain and maintain. |
| C. Keep the fee the main backend already reports for each host (15% / 0%) and retire the 30% figure | Matches what hosts see today; no teacher is surprised. |
| D. Defer (today) | Nothing changes, but the 15% vs 0% fallback mismatch stays. |

**Recommended:**
- C for every retreat already published.
- If you want 30%, approve it only for new retreats, after the main backend applies it.
- Separately, consider showing "fee not available" instead of the 15% / 0% guesses. That would be a code change, so it needs approval.

### Rule 6
> 6. Which revenue base each institutional contract defines for 70/80/85%, and whether it applies to participant-paid event fees. There is still no 1-month rule.

**Today:**
- 70/80/85 appears only in website wording.
- The engine works out a for-review split of whatever base the caller sends.
- Participant-paid event fees get no split.
- No split exists for 1 month.
- **Found during review:** the ROI change request (`BACKEND_REQUEST_roi_calculator.md`) mentions **70 / 80 / 90**. That is a proposal for the main backend, not a rule in force.

| Choice | Business consequence |
|---|---|
| Base A: what the organisation pays, after GST and pass-through costs (venue and similar) | Teachers share real revenue; NOSTOPS isn't paying out on tax or costs. Each contract still needs this wording. |
| Base B: the full amount including GST and costs | Higher teacher payouts; NOSTOPS can end up below its own costs on venue-heavy programmes. |
| Base C: each agreement sets its own | Flexible; harder to explain and check. |
| Participant-paid fees included / excluded | Included: teachers earn on events organisations don't pay for. Excluded: a separate rule is needed later. |
| 1-month: 70% / none / other | 70% matches the public "Keep 70–85%" promise. "None" leaves starter programmes with no defined teacher pay. |

**Recommended:**
- Base A.
- Exclude participant-paid fees until a separate rule exists.
- 70% for 1-month starters, so no teacher is promised less than the public 70% floor.
- Confirm 85% (not 90%) for 12 months.

### Rule 7
> 7. Which InstaKYC source governs: the website's ₹279 (PROVISIONAL) or the main backend's `/kyc/pricing`.

**Today:**
- The website sends ₹279 and refuses any other amount.
- The main backend creates the order and has its own `/kyc/pricing`; what that returns is unknown here.

| Choice | Business consequence |
|---|---|
| A. The main backend's `/kyc/pricing` governs; the website reads it | One source, next to the order. The website must be changed to read it. If it isn't ₹279, the displayed price changes. |
| B. The website's ₹279 governs; the main backend accepts only ₹279 | The website keeps control; main-backend change needed; two copies remain. |
| C. Keep both (today) | Risk of a mismatch: the website refuses, or the order amount differs from what was shown. |

**Recommended:** A, once a read-only check confirms `/kyc/pricing` returns ₹279 including GST.

### Rule 8
> 8. Whether US$30 AI onboarding is approved for sale once international checkout exists, and its tax.

**Today:** marked `RECORDED`. It is shown with "international checkout temporarily unavailable" and has no tax rule. PayPal is not built.

| Choice | Business consequence |
|---|---|
| A. Approve US$30 | Ready for Prompt 4. Tax treatment for international buyers still needs advice. |
| B. Set a different USD price | Wording changes; avoids locking in a figure that was never formally approved. |
| C. Don't sell internationally | Simpler; loses international venue owners. |

**Recommended:** decide this together with Prompt 4 and tax advice. Until then, keep it as it is: visible, not purchasable.

### Rule 9
> 9. Event fee maximum: the wizard allows ₹1,00,000, the backend ₹10,00,000.

**Today:** the wizard caps at ₹1,00,000. The backend and the engine accept up to ₹10,00,000. No event in the preview is above ₹1,00,000; there are 0 paid events at all.

| Choice | Business consequence |
|---|---|
| A. ₹1,00,000 everywhere | One limit, and it catches typos (₹10 lakh). Any production event above ₹1,00,000 would become un-quotable, so check production first. |
| B. ₹10,00,000 everywhere | Allows very large fees from the form; higher typo risk. |
| C. Keep both (today) | Organisers using the form and other callers face different limits. |

**Recommended:** A, after a read-only production check that no event has a fee above ₹1,00,000.

### Rule 10
> 10. 1:1 rate bounds disagree between the BFF routes and the main backend.

**Today:**

| Where | Limit |
|---|---|
| `bff/teacher/premium` | Any whole number above 0. |
| `bff/teacher/premium-config` | ₹100–₹1,00,000, defaulting to ₹1,500. |
| `lib/server/teacher.ts`, when the main backend sends none | ₹750–₹2,000. |
| Code comment | "₹1,500–5,000". |
| Main backend tier rules | Unknown. |

| Choice | Business consequence |
|---|---|
| A. The main backend's tier rules govern; the website reads them and refuses anything outside | One source; teachers see the real limits. |
| B. One fixed website range | Simple, but may disagree with the main backend's tiers. |
| C. Keep as is | Teachers can enter rates the main backend later refuses, or the reverse. |

**Recommended: A.**

### Rule 11
> 11. **₹5,000 baseline:**
>     - whether it and the 18/29/40 ladder are approved;
>     - which billing period the ₹5,000 covers;
>     - whether that ladder is the one meant to go with it. I paired them because they are the only legacy organisation figures; please confirm.

**Today:**
- Shown only as an indicative reference under "UNAPPROVED — NOT A CONFIRMED PRICE — BOOKING UNAVAILABLE." There is no total and no booking.
- ₹5,000 "per member per month" comes from the main backend's older ROI model. The ROI change request calls it the **old** model, replaced by ₹3,667 per member per month.
- Today's rate card works out to about ₹2,400 a month for a company participant (₹300 × 8 sessions).

| Choice | Business consequence |
|---|---|
| A. Retire ₹5,000 and remove the reference | No confusing legacy figure. You asked to keep it, so this would reverse that. |
| B. Approve ₹5,000 + 18/29/40 for some product | About twice the current rate card, so it conflicts with public pages and proposals. |
| C. Keep it as an unapproved reference (today) | Harmless while it is never shown to customers; some risk of internal confusion. |

**Recommended:** C now, since it is what you asked to keep. Move to A once the ROI-calculator change is decided.

### Rule 12
> 12. AI onboarding total: kept as the hard-coded whole-rupee ₹2,359 (R4 rounding of ₹2,358.82).

**Today:** the customer pays ₹2,359. The engine shows ₹1,999 + ₹359.82 GST + ₹0.18 rounding.

| Choice | Business consequence |
|---|---|
| A. Keep ₹2,359 with a rounding line (today) | No price change; invoices must show the rounding, not "GST ₹360". |
| B. Charge exactly ₹2,358.82 | 18 paise less; the wording changes. |
| C. Treat ₹2,359 as GST-included (₹1,999.15 + ₹359.85) | Same customer price; "₹1,999 + 18% GST" becomes slightly inaccurate. |

**Recommended: A.**

---

## 2. The 15 activity-log entries

### 2.1 The entries

- **Collection:** `inst_event_audit_log` in the preview's own database (`nostops_web`).
- **Count:** exactly 15 entries name these 6 records, and no other entry refers to them.
- **Actor ids:**
  - `user_57805db4058c`, the HR demo identity used by the test.
  - `qa_inst_admin`, the QA admin.
  - `system` (the engine).

| # | Mongo `_id` | `audit_id` | `created_at` (UTC) | Record | Event type | Actor |
|---|---|---|---|---|---|---|
| 1 | `6ae2bc85a97dbe6c693ce60c` | `275da9fe08594211a06ce4a70eed212d` | 2026-10-29T03:24:53Z | ORG-2026-001015 | ORGANISATION_CREATED | hr |
| 2 | `6ae2bc85a97dbe6c693ce60d` | `f6c949da1d7e4009a3402f3922f6c530` | 2026-10-29T03:24:53Z | ORG-2026-001015 | ORG_TRUST_SET (VERIFIED, "QA fixture") | admin |
| 3 | `6ae2bc85a97dbe6c693ce613` | `5358cb152aad4d2fa7bf3542af5b128f` | 2026-10-29T03:24:53Z | EVT-2026-002234 | EVENT_DRAFT_CREATED | hr |
| 4 | `6ae2bc85a97dbe6c693ce614` | `d4528bf0dcc347bba38df9b4c4ab3389` | 2026-10-29T03:24:53Z | EVT-2026-002234 | EVENT_PUBLISHED (slug `qa-b23-edge-3c9836-nov-16-2026`) | hr |
| 5 | `6ae2bc85a97dbe6c693ce615` | `efffa6d43b934b91a9a5d72297163e75` | 2026-10-29T03:24:53Z | EVT-2026-002234 | TEACHER_UNAVAILABLE (NO_ELIGIBLE_TEACHER) | engine |
| 6 | `6ae2bca7a97dbe6c693ce618` | `0233454d91274da18a53319cf8066599` | 2026-10-29T03:25:27Z | ORG-2026-001016 | ORGANISATION_CREATED | hr |
| 7 | `6ae2bca7a97dbe6c693ce619` | `3c1e9d72ca9e4a33849af79a27b0e273` | 2026-10-29T03:25:27Z | ORG-2026-001016 | ORG_TRUST_SET (VERIFIED, "QA fixture") | admin |
| 8 | `6ae2bca7a97dbe6c693ce61f` | `c5d1219b440f47d2948e6c5f37a717ce` | 2026-10-29T03:25:27Z | EVT-2026-002235 | EVENT_DRAFT_CREATED | hr |
| 9 | `6ae2bca7a97dbe6c693ce620` | `4edb43d8f5b24385b91a07e38313e4e5` | 2026-10-29T03:25:27Z | EVT-2026-002235 | EVENT_PUBLISHED (slug `qa-b23-edge-dc5010-nov-16-2026`) | hr |
| 10 | `6ae2bca7a97dbe6c693ce621` | `0493d58517be4e58865dfc6ea0231d87` | 2026-10-29T03:25:27Z | EVT-2026-002235 | TEACHER_UNAVAILABLE (NO_ELIGIBLE_TEACHER) | engine |
| 11 | `6ae2bcd1a97dbe6c693ce624` | `657107671e254c0bb61e20a9655678a9` | 2026-10-29T03:26:09Z | ORG-2026-001017 | ORGANISATION_CREATED | hr |
| 12 | `6ae2bcd1a97dbe6c693ce625` | `9b4b406b3f70429182d663b5d7e60b1b` | 2026-10-29T03:26:09Z | ORG-2026-001017 | ORG_TRUST_SET (VERIFIED, "QA fixture") | admin |
| 13 | `6ae2bcd1a97dbe6c693ce62b` | `4a87e90e7b3d4b5c8e2df1dd780c3203` | 2026-10-29T03:26:09Z | EVT-2026-002236 | EVENT_DRAFT_CREATED | hr |
| 14 | `6ae2bcd1a97dbe6c693ce62c` | `3f4cdc33a52e4e598d3917c6d8d431bf` | 2026-10-29T03:26:09Z | EVT-2026-002236 | EVENT_PUBLISHED (slug `qa-b23-edge-0676b6-nov-16-2026`) | hr |
| 15 | `6ae2bcd1a97dbe6c693ce62d` | `461f066f9856448c910736751ded00f4` | 2026-10-29T03:26:09Z | EVT-2026-002236 | TEACHER_UNAVAILABLE (NO_ELIGIBLE_TEACHER) | engine |

All record ids carry the `NOSTOPS-` prefix.

### 2.2 The three test runs

The entries don't carry a run id. They are linked to the runs by timestamp and by the run code inside each slug.

| Run | Pytest run id (test tag) | Ended (UTC) | Result | Evidence | Records it created |
|---|---|---|---|---|---|
| A: regression set | `pytest_e40c11c76bef` | 03:24:53 | 1,328 passed, 12 skipped | `test_reports/p3/run2_regression_offline.log` | ORG-2026-001015, EVT-2026-002234 (`3c9836`) |
| B: first network-logging attempt | `pytest_f5a9d71748f9` | about 03:25:27 | 1,678 passed, 12 skipped | **No log file.** The output exists only in my session, and its network log was empty and later overwritten. | ORG-2026-001016, EVT-2026-002235 (`dc5010`) |
| C: full set | `pytest_33dd065bef3e` | 03:26:09 | 1,678 passed, 12 skipped | `test_reports/p3/run3_full.log` | ORG-2026-001017, EVT-2026-002236 (`0676b6`) |

- **Run C had socket-level network logging**, and the only outside connection was the preview-URL check. So `test_b23_fee_edges.py` reached nothing outside the preview: no main backend, no provider.
- **Run 4, the final clean run**, did not include this file. The database was unchanged (`diff_s2_s3.txt`).

### 2.3 Evidence the QA organisations and paid events were removed

Checked read-only, today.

**By event id or organisation id: 0 rows in each of**
- `inst_events`, `inst_organisations`, `inst_org_members`
- `inst_event_sessions`, `inst_event_seo`, `inst_teacher_assignments`
- `inst_registrations`, `inst_settlements`, `inst_revenue_allocations`
- `inst_pricing_calculations`

**Full scan of every collection** in the preview database for the 6 ids, the 3 slugs and the title "QA B23 Edge":
- The only matches are the 15 log entries.
- Plus one **unrelated older** SEO row: `NOSTOPS-SEO-2026-004941`, event `NOSTOPS-EVT-2026-002122`, slug `qa-b23-edge-77e8cb…`, created 28 Oct 20:25. It is a leftover from the 2G-era full run, not from these three runs. Untouched.

**Snapshots** before and after runs A–C (`diff_s0_s1.txt`): the counts and id sets of `inst_events` and `inst_organisations` did not change. Only the log and the counters moved.

**Test outbox and test log:** 0 entries mention these records. No email or alert was attempted.

**Counters, as they are now (not reset):**

| Counter | Value | Moved during runs A–C |
|---|---|---|
| EVT:2026 | 2236 | +3 |
| ORG:2026 | 1017 | +3 |
| MBR:2026 | 1017 | +3 |
| SEO:2026 | 5154 | +9 |

### 2.4 Are they audit records? Would deleting them damage traceability?

- **Yes, these are audit records.**
  - `inst_event_audit_log` is the institutional engine's EventAuditLog: "append-only / immutable" (`institutional.py:355`).
  - `_audit()` says "Never updated or deleted" (`institutional.py:891–893`).
- **No feature reads these 5 event types.** The code reads only:
  - HUMAN_ESCALATION (admin escalation list);
  - payment-once checks;
  - ADAPTIVE_COMPETENCE_REVOKED.
  So deleting them would not break a feature.
- **Deleting them would damage traceability.**
  - They are now the only record that these 6 ids were issued, by which identities, and why the counters jumped.
  - Without them, the id gaps (ORG 1015–1017, EVT 2234–2236) would be unexplained.
  - Deleting would also break the log's append-only design.
- **Recommendation:** keep them unchanged, and let this review be the explanation. I have not deleted, changed or restored anything, and have not reset any counter.

---

## 3. Safety and integration checklist

### 3.1 The 22 connection points

What each label means:
- **Tested:** an automated test runs the behaviour.
- **Code inspection only:** checked by compiling (`tsc` / `eslint`) or by tests that read the source text; not run end to end.
- **Blocked:** the end-to-end check needs the separate main backend, the payment-provider sandbox, or a test that writes data.

| # | Connection point | Tested | Code inspection only | Blocked (end to end) |
|---|---|---|---|---|
| 1 | `server.py`: the pricing router is registered | ✅ 37 live quotes and rule reads on the running backend; preview URL answers 401 | | – |
| 2 | `ai_onboarding.py`: imports | ✅ module loaded by the tests | | – |
| 3 | `ai_onboarding.py`: `PRICING` comes from the engine | ✅ equal to the old table; `test_p2a` builds an India order at ₹2,359 (`order_amount 2359.0`) with a fake Cashfree and a throwaway database | | Real Cashfree order: **blocked** (provider; the preview also refuses live keys) |
| 4 | `ai_onboarding.py`: `pricing_rule_version` saved on new orders | | ✅ source check (written in the offline order test, but no test asserts it) | Real order: **blocked** (provider) |
| 5 | `audit.py`: imports | ✅ | | – |
| 6 | `audit.py`: `FEE_PCT` comes from the rules | ✅ endpoint returns `fee_pct 15` (throwaway database) | | – |
| 7 | `audit.py`: per-row `teacher_net_inr` | ✅ endpoint rows 850 / 1062.5 / 2125 | | – |
| 8 | `audit.py`: `teacher_earnings` in exact paise | ✅ 3 tests + endpoint totals | | – |
| 9 | `institutional.py`: import | ✅ module loaded | | – |
| 10 | `institutional.py`: the payment intent checks the fee with `event_fee_minor` | The engine function: ✅ (12 cases) | The call site: ✅ source check | Paid-event chain: **blocked**. It writes registrations and intents, and the order is created on the main backend. |
| 11 | Retreat detail page: "offer listed by the host" | | ✅ tsc / eslint | Not rendered with real retreat data (comes from the main backend) |
| 12 | Teacher 1:1 snapshot: `inrExact` import | | ✅ tsc | – |
| 13 | Teacher 1:1 snapshot: totals and monthly rows in exact paise | | ✅ tsc (the backend data shape is tested, see 7–8) | Live render **blocked**: needs a teacher sign-in on the main backend, and the preview ledger has 0 rows |
| 14 | Teacher 1:1 snapshot: row uses the server share | | ✅ source check (no `0.85`, uses `teacher_net_inr`) | as 13 |
| 15 | `GroupBook.tsx`: tip wording | | ✅ tsc / eslint | Live group quote comes from the main backend |
| 16 | `PricingHierarchy.tsx`: "Best listed" | | ✅ tsc / eslint | – |
| 17 | `PricingHierarchy.tsx`: "not yet confirmed" note | | ✅ tsc / eslint | – |
| 18 | `RetreatPriceBreakdown.tsx`: one ladder copy, "Groups (indicative)" | | ✅ source check against the rules | – |
| 19 | `RetreatPriceBreakdown.tsx`: "Listed price" + note | | ✅ source check (no "You pay") | – |
| 20 | `lib/format.ts`: `inrExact` | | ✅ tsc / eslint (no test runs it) | – |
| 21 | `lib/pricing.ts` + `verify_instakyc_pricing.ts`: InstaKYC split | ✅ the check runs the constants and labels (8/8) | | ₹279 order on the main backend: **blocked** |
| 22 | `lib/server/audit.ts`: `TeacherLedgerRow` type (the edit that failed earlier) | | ✅ tsc exit 0, plus a source check | – |

**Totals:**
- **9 tested:** points 1, 2, 3, 5, 6, 7, 8, 9 and 21.
- **13 covered only by code inspection:** points 4, 10 (call site), 11–20 and 22.
- **End-to-end checks blocked: 6 points.**
  - 3, 4 and 21 depend on the provider or the main backend.
  - 10 needs a test that writes data, and the main backend.
  - 13 and 14 need a main-backend sign-in and ledger data.

### 3.2 `FINANCIAL_ACTIONS_UNLOCKED` and checkout

| Check | Evidence (read-only, today) |
|---|---|
| `FINANCIAL_ACTIONS_UNLOCKED` disabled | Absent from `backend/.env` and `frontend/.env`. Absent from the running backend's settings (pid 3511) and the website's (pids 10345 / 10346 / 10360). `financial_lock.locked()` returns `True`. The website rule locks unless the value is exactly `"true"`. |
| Checkout disabled: India | The preview's Cashfree decision is `allowed: false`, reason `preview_live_keys`. The keys are live keys, and a preview always refuses them. |
| Checkout disabled: international | `PAYPAL_CHECKOUT_FLOWS` is empty, and PayPal keys are not set. |
| Pricing engine | `CHECKOUT = {available: false, reason: "checkout_disabled"}` on every quote (tested for all 14 products × 2–3 countries). |
| Nothing was charged in the preview | 0 AI onboarding orders, 0 paid events, 0 rows in the 1:1 ledger. |

### 3.3 No production changes

- **Production does not have the Prompt 3 code.**
  - `GET https://www.nostops.org/api/pricing/rules` answers **404**: the route doesn't exist there.
  - The same request to the preview answers **401**: the route exists and needs the secret.
  - This was one read-only GET. It carried no data.
- **No deploy or publish action** was taken in Prompt 3 or in this review.
- **No configuration changed.** No `.env` file has changed, and the backend start-up settings are unchanged.
- **Code:** nothing changed since the report. The only uncommitted tracked change is `frontend/yarn.lock`, which predates this work and was left alone. The latest commit is the platform's automatic checkpoint, not a deployment.
- **Main backend and providers:** not changed. No Cashfree or PayPal call was made.

---

**Stopping here for your review.** Prompt 4, any pricing-rule change, the log entries, the counters and any deployment all wait for your separate approval.
