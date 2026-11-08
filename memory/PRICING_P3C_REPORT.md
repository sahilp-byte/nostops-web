# Prompt 3C: pricing rules configuration and verification (report)

**Status:** done and tested in the preview. **Not deployed. Payment integration is not done. Prompt 4 has not been started.**
Money lock: ON (`FINANCIAL_ACTIONS_UNLOCKED` is not set). Checkout: off. No Cashfree or PayPal calls. No booking or money writes.

## 1. What changed

### A. Organisation pricing (founder option A)
- The 15–28 and 29–40 participant discounts are **suspended everywhere**. ₹300 (companies, startup and networking groups) and ₹175 (educational institutions) are **list rates only**, for any group size and any programme length.
- The two bands appear only with the exact label **"UNAPPROVED — NOT A CONFIRMED PRICE — BOOKING UNAVAILABLE."** (`components/org/UnapprovedBands.tsx`). No percentage, discounted price or saving is shown.
- Where this applies:
  - the cohort pages' estimator and plan table
  - the FAQ "How does group pricing work?"
  - the admin proposal email drafts
  - the event wizard's suggested fee (now always the list rate)
  - the participant fee box
  - the AI Guru's knowledge and rules
- Backend rule (`pricing_rules.py`, now version `NOSTOPS-PRICING-2026-10-28.3`): `RATE_CARD["discounts_suspended"] = True`. The quote engine applies the list rate and lists the two bands as `unapproved_bands` with the label and `applied: false`. The old percentages are kept in the rules file for the record only.

### B. Retreat offers (founder option B)
- Only the **authoritative listed price** (the main backend's per-seat price) is shown on the retreat page, the reserve page, the group page, the price breakdown, the FAQ and the mobile bar.
- Early-bird, limited-time and teacher-cohort offers are **removed**:
  - The Host-a-Retreat wizard no longer asks for them. It shows a short note: "offers are paused".
  - A retreat description that already contains such a line is still read, but the line is dropped: it is not shown and no saving is calculated. The text itself stays in the main backend; nothing was deleted.
- The pricing summary now shows only "Listed price" and the group rate.

### C. Teacher shares
- 70%, 80% and 85% are now stated **only for eligible 3-, 6- and 12-month institutional programmes**. The tables read "3-month institutional programme", "6-month institutional programme" and "12-month institutional programme", and the scope is written next to each table.
- Updated in these places:
  - the cohort pages, /become-a-teacher and the city pages (including the page descriptions and the share preview title)
  - /faq and the city FAQs
  - the referral share text and the teacher sign-up subtitle
  - the coordinator and Council footers
  - the AI Guru
- "Keep 70–85% of every rupee" is gone everywhere.
- Backend rule: `CONTRACT_REVENUE_SHARE["scope"]` is set. Any other length (for example 1, 2, 4, 9 or 24 months) gets no split, as tested.

### D. Restart safety (done earlier in this prompt)
- `seed_demo_ecosystem.py`: on start-up it only creates demo records that are missing. It never rewrites existing ones (`updated_at`, dates, slugs and counters are untouched). The refresh is a manual `--refresh` run.
- `seed_special_needs_examples.py`: it writes a record only if a safety field has drifted.
- **Verified:** the backend reloaded 5 times during this work (each file save). The demo snapshot before and after is **identical** (`test_reports/p3c/s2…s3`).

## 2. Tests

| Check | Result |
|---|---|
| `tsc --noEmit` | exit 0 |
| `eslint` on the 28 changed frontend files | 0 errors, 0 warnings |
| `verify_phase_a`, `verify_instakyc_pricing` (8/8), `verify_checkout_routing`, `verify_booking_holds`, `verify_preview_isolation` (97) | all passed |
| New `backend/tests/test_p3c_pricing_rules.py` | **156 passed** |
| Final offline regression (P3 + P3C + 2A–2G + P0 gateway + sandbox guard) | **1,832 passed, 0 failed, 12 skipped** (skipped by design) |
| Database | demo snapshot before and after the run is **identical** (`s4` vs `s5`) |
| Network | 1 outside connection only: the preview's own 401 check (`net_external.jsonl`) |
| Page render | /for-organisations/companies, /educational-institutions, /become-a-teacher and /faq all return 200. The estimator at 390 px shows list-rate totals and the two UNAPPROVED lines. |

Tests updated because the rules changed on purpose:
- The P3 rate-card tests now expect the list rate.
- The parity test now expects band edges without percentages.
- Two frontend checks now expect an early-bird offer to be **ignored**.
- The live wording-check scripts now expect the UNAPPROVED label instead of "nearest band".

## 3. Not done or left open (your decision)
1. **Legacy 18/29/40 batch ladder** (the older corporate booking-invite pages): this belongs to the main backend and is not changed. It stays an UNAPPROVED reference.
2. **Public retreat group ladder** (5% / 10% / 15%, labelled "indicative"): kept, because it is not one of the three offers to remove. Each group quote comes from the main backend.
3. **General wording** "the larger share of every rupee" (no percentage) is still on a few pages. Tell me if it should be scoped or removed too.
4. **No public retreat is listed** in the preview right now, so the retreat page could only be checked through source tests, not live.
5. **UI testing agent:** not used, to avoid uncontrolled clicks and writes. A supervised, read-only pass is available if you want it.
6. **`frontend/yarn.lock`:** it shows changes from an earlier session, not made in Prompt 3C. Left as is.
7. **The 15 test-related activity-log entries** from Prompt 3: kept, as you instructed.

**Evidence:** `/app/test_reports/p3c/` (snapshots, regression log, network log, tsc and eslint logs, frontend check logs).

---

# Prompt 3C, round 2: retreat group tiers, teacher-share wording and read-only browser check

**Status:** done in the preview. **Not deployed. Prompt 4 has not been started.** Money lock: ON. Checkout: off. No Cashfree or PayPal calls. No booking or money writes. No emails were sent.

## 1. Read-only browser check (390 px phone size, no form submitted, no button pressed)

**Before the changes:**
- All 7 pages returned 200, with 0 console errors.
- "of every rupee" was still on the 3 cohort pages ("Who teaches?" FAQ) and on /become-a-teacher (hero).
- "The larger share is always yours" was still on /become-a-teacher and the city page.
- "3-month pilot" appears only as a programme-length label (an enquiry option and a cohort FAQ). It is not a share claim, so it was left.

**After the changes:**

| Page | Status | UNAPPROVED label | Approved sentence | Forbidden phrases | Console errors |
|---|---|---|---|---|---|
| /for-organisations | 200 | — | — | none | 0 |
| /for-organisations/companies | 200 | 5 | 1 | none | 0 |
| /for-organisations/startup-networking-groups | 200 | 5 | 1 | none | 0 |
| /for-organisations/educational-institutions | 200 | — (flat rate) | 1 | none | 0 |
| /become-a-teacher | 200 | — | 3 | none | 0 |
| /become-a-teacher/bangalore | 200 | — | 2 | none | 0 |
| /faq | 200 | — | 1 | none | 0 |

- The organisation pages only read local demo data.
- The teacher pages and /faq made read-only requests to the main backend (teacher directory, founding count), as agreed. Nothing was written.

## 2. Files changed (all display and copy only)

**Retreat group tiers (5+ → 5%, 10+ → 10%, 20+ → 15%).** These are now UNAPPROVED reference tiers, always shown with the exact label. No discounted total, saving or payable price is shown.
- `components/retreats/GroupTiersReference.tsx` (new): the tiers, each with the label.
- `lib/pricing.ts`: the group price is no longer worked out from the tiers. A group rate is used only if a verified rule for that retreat is supplied (`verifiedGroupPerSeatInr`). None exists, so the listed price always applies.
- `components/retreats/GroupBook.tsx`:
  - Removed: the discount line, the "add N more to unlock" hint, the "Group total" line, the amount on the button, and the "Group total" line on the confirmation.
  - The form now shows only seats × listed price as the listed total, plus the reference tiers.
  - The website no longer saves the main backend's discounted amount with the reservation.
- `components/retreats/RetreatPriceBreakdown.tsx` and `components/retreats/PricingHierarchy.tsx`: "indicative" and "Best listed" are gone; the tiers appear as reference only.
- `app/(public)/retreats/[retreat_id]/group/page.tsx`:
  - Removed: the "5% off per seat" cards, the "pays about ₹X instead of ~~₹Y~~" example, and "Discounts apply automatically".
  - Now shows "Group pricing: each seat at the listed price" with the reference tiers.
- `components/app/teacher/HostRetreatWizard.tsx`: one sentence, now carrying the label.
- Backend `pricing_rules.py` (version `.4`): the group ladder is `UNAPPROVED`, `reference_only`, with the banner. `pricing_engine.py` returns the label and no longer reports "the tier for this size".

**Teacher-share wording.** Your exact sentence is now one shared constant (`TEACHER_SHARE_SENTENCE` in `lib/org/pricing.ts`). Where retreats or one-to-one sessions could be confused, it is followed by: "Retreats, one-to-one sessions and other work have their own terms."
- /become-a-teacher and the city pages:
  - the hero
  - the benefit card (now "Keep 70–85% on institutional programmes")
  - the heading, now "Teacher shares on eligible institutional programmes"
  - the table note, now "Longest commitment"
  - the retreat line, now "your share … under that retreat's own terms"
- /faq, the city FAQs (`lib/server/cities.ts`) and the cohort "Who teaches?" FAQ (`lib/org/cohort-copy.ts`).
- The sign-up role card, the teacher widgets page and the welcome-email template (copy only; nothing was sent).
- No payout amount is promised anywhere. The financial calculations and contract terms are unchanged.

**Tests updated:**
- `verify_checkout_routing.ts` and `verify_booking_holds.ts`: the tiers are now ignored; only a verified rate is used.
- `test_p3_pricing_engine.py` and `test_p3_pricing_parity.py`: the ladder is now UNAPPROVED and reference only.
- `test_p3c_pricing_rules.py`: 18 new checks.

## 3. Tests

| Check | Result |
|---|---|
| `tsc --noEmit` | exit 0 |
| `eslint` on the 17 changed frontend files | 0 errors, 0 warnings |
| The 5 frontend checks (phase A, InstaKYC, checkout routing, booking holds, preview isolation) | all passed |
| `test_p3c_pricing_rules.py` | 174 passed |
| Full offline regression | **1,850 passed, 0 failed, 12 skipped** (skipped by design) |
| Network during tests | 1 outside connection only: the preview's own 401 check |

## 4. Persistent data and timestamps
- **No change.** Demo snapshots were **identical** at three points:
  - across the backend reloads caused by the rule edits (`s6` → `s7`)
  - across each regression run (`s8` → `s9`, `s10` → `s11`)
- No organisation, teacher, event or audit-log record was written. The 15 earlier audit-log entries are untouched.

## 5. Unresolved
1. **The main backend still works out its own group discount.** Its group quote and group hold use the 5/10/15% tiers. The website no longer shows that amount, but the amount the main backend records for a group hold may still include the discount. This has to be fixed in the main backend.
2. **The older 18/29/40 corporate ladder** (main backend) is unchanged, as in round 1.
3. **An old live test, `test_iter9_features.py`,** still expects "Group discount" text. It was not run (it targets the live preview) and would now fail.
4. **The AI Guru** still says "Teachers keep the larger share of what they earn; exact terms depend on the particular programme". It quotes no percentage and was not on the approved list, so it was left.
5. **Not checked on screen:**
   - the group page: no public retreat is listed
   - the group form: needs sign-in and a retreat
   - the welcome email: never sent
   
   These are covered by source tests only.
6. **`frontend/yarn.lock`** has changes from an earlier session. Left as is.

**Evidence:** `/app/test_reports/p3c/` (`r2_*` logs and snapshots `s6`–`s11`).

---

# Prompt 3C, round 3: three follow-ups (29 Oct)

1. **AI Guru wording:** the Guru now uses your exact teacher-share sentence, plus "Retreats, one-to-one sessions and other work have their own terms."
   - Single source: `backend/pricing_rules.py` `TEACHER_SHARE_SENTENCE`.
   - It is used twice in `guru/knowledge.py` and once in `guru/guardrails.py`.
   - "Teachers keep the larger share" is gone.
   - A test checks that the backend and website sentences are identical.
2. **Old live test (`test_iter9_features.py`):** my earlier flag was wrong.
   - Its "Group discount" check is for the corporate batch page (`CloseEnrollment`, main-backend ladder), which still shows that text.
   - All 14 strings it checks still exist in the website source, except one URL built at runtime, which is unrelated.
   - No change was needed. It was not run, because it signs in to the main backend.
3. **Group hold note:** the group form and the group confirmation now both say: "The host confirms the final group amount before any payment is requested."

**Tests:**
- tsc: exit 0. eslint: 0 problems.
- 3 frontend checks: passed.
- Offline regression: **1,851 passed, 0 failed, 12 skipped** (by design).
- The only outside connection was the preview's own 401 check.
- Demo snapshots before and after are identical (`s12`/`s13`/`s14`).
