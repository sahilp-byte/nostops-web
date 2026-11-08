# NOSTOPS — Prompt 2E: Remaining Website Issues and Test Hygiene (deliverable report)

**Status:** done in **preview only**. Nothing was published or deployed, and no production setting or `.env` value was changed.
**Money lock:** ON. `FINANCIAL_ACTIONS_UNLOCKED` appears in neither `backend/.env` nor `frontend/.env`.
**Checkout:** still off in preview (503 test mode) and PayPal checkout is off everywhere.
**Preview isolation:** unchanged and still in effect (423 for every write to the live system from preview). The live suites and the isolation harness pass (section 5).
**External main backend (`pro-learn-connect-1`):** not modified. **Prompt 3:** not started.
**Date:** 28 Oct 2026 (container clock, UTC).

---

## 1. Test registrations (`test_regression_iter132.py`)

**`NOSTOPS-REG-2026-000272` and `-000289` are unchanged.** Their record fingerprints were the same before and after every run:

| Record | Fingerprint |
|---|---|
| `000272` | `7e3aea87828a1683` |
| `000289` | `326445ba22161d7b` |
| Shared QA event `NOSTOPS-EVT-2026-000001` | `dd3a5cdb619549ee` |
| Organisation `NOSTOPS-ORG-2026-000001` | `0e71f541a610a465` |

**What changed:** the participant test now uses a new fixture, `run_records`. The cleanup runs in the fixture's teardown, so it also runs when the test fails.

**What it removes**, and only for the participant this run created:
- That participant's registration(s), by exact registration id and participant id.
- Their sign-in sessions and sign-in links.
- The participant record itself.

**How it stays exact:**
- The participant's email is unique to each run (process id plus a random suffix).
- The test asserts that the email didn't exist before the run, so the participant is the run's own.
- The registration id comes from the response. If the test failed before it could read the response, the registration is found by that participant's id.
- Nothing is matched by pattern.
- The shared event and organisation are never changed.
- A guard refuses to touch `000272` or `000289`.

**Kept, as you decided:** the activity-log entries, so the audit trail stays complete. Each run writes **two** entries, and both are kept:
- `PARTICIPANT_AUTHENTICATED` (the sign-in);
- `PARTICIPANT_REGISTERED` (the registration).

You mentioned only the second one. Tell me if the sign-in entry should be handled differently.

**Evidence** (snapshots in `/app/test_reports/p2e/snap_*.json`):

| Run | Result | Registrations (total / on the QA event) | Participants | Sessions |
|---|---|---|---|---|
| Before | – | 15 / 13 | 73 | 47 |
| Participant test passes | 1 passed | 15 / 13 | 73 | 47 |
| Two **forced failures** (after the whole flow, and right after the server created the registration) | 2 failed as intended. Cleanup check passed: 0 participant, registration, session or sign-in-link rows left for either run, and the activity-log entry is still present | 15 / 13 | 73 | 47 |
| Full `test_regression_iter132.py` | **20 passed** | 15 / 13 | 73 | 47 |

The latest registration is still `000289`.

**Side effects that remain (disclosed):**
- Each run uses up one registration number, e.g. `000307` and `000308` in the failure check. Numbers are never reused.
- Each run still tries to send a registration-confirmation email to its own QA address (`@nostopsqa.com`). This is existing behaviour.
- **Pre-existing and not changed:** the file's suite-wide cleanup still deletes by pattern, using the `QA-ITER132-` title prefix and participants whose email contains `iter132`. The new cleanup doesn't rely on it. Narrowing it needs your OK.

## 2. Monitoring test reliability (`tests/workflow/test_wf_monitoring.py`)

**Change (test-only; `backend/monitoring.py` is not modified):**
- By default the file uses its own **isolated test monitor**: a throwaway database (`nostops_wf_monitor_<random>`) for events and alerts.
- It starts empty for every test and is dropped at the end of the file.
- Unrelated tests and real preview traffic can no longer use up the hourly quota these tests check.
- These tests no longer write rows into the shared monitor, or use up its quota.

**No genuine alert is suppressed:**
- The production limit is unchanged, `MAX_ALERTS_PER_HOUR = 20`.
- Real errors still go to the shared monitor, with its normal limit.
- Alert emails in this file still go to a fake sender, as before.

**New checks:**
- `test_production_alert_limit_is_unchanged`: the module value is 20, the source line is `MAX_ALERTS_PER_HOUR = 20`, and the real monitor still uses the shared `monitor_alerts` collection.
- `test_this_files_alerts_never_reach_the_shared_monitor`: a probe alert lands in the test monitor and leaves no row in the shared one.

**Normal production configuration:** `WF_MONITOR_SHARED=1` runs the same tests against the shared monitor.

| Configuration | Runs | Result |
|---|---|---|
| Isolated test monitor (default) | 3 in a row | **11 passed** each time |
| Isolated test monitor (default) | Inside the full workflow suite | Passed |
| Normal production configuration (shared monitor, cap 20; 17 of 20 alerts used in the hour before) | 3 in a row | **10 passed, 1 skipped** each time. The skipped test is the isolation-only check, by design. |

- **Production limit read after the runs:** 20.
- **Clean-up:** no throwaway database was left behind, and no `wf_` rows remain in the shared monitor.
- **Honest note:** the shared-configuration runs passed because the shared quota had room at the time (17 of 20). Under that configuration the test can still fail when 20 or more alerts were sent in the previous hour. The isolated configuration doesn't depend on that.

## 3. The four website defects

| ID | Problem | Severity | Your decision | Status |
|---|---|---|---|---|
| TVR-20 | Venue capacity had no limits on the server | P3 | Fix now | **Fixed** |
| TVR-21 | Small edits that flip the meaning went live without review | P3 | Fix now | **Fixed** |
| TVR-15 | Photo uploads trusted the declared type | P3 (security check) | Fix all four routes | **Fixed** |
| TVR-22 | Two simultaneous submissions can create duplicate venues | P3 | Defer | **Not fixed** (still open) |

### TVR-20 — capacity 1–5,000 enforced on the server
- **File:** `backend/venues.py`. `PublicSubmissionIn.capacity` and `PublicEditIn.capacity` are now `Field(ge=1, le=5000)`, defined once as `PUBLIC_CAPACITY_MIN` / `PUBLIC_CAPACITY_MAX`.
- **Endpoints:** `POST /api/venues/public-submissions` and `POST /api/venues/public-submissions/edit`.
- **Behaviour:** an invalid value is refused with **422 before anything is saved**. Empty capacity is still allowed.
- **Same range as the website form:** the BFF already applied `capRaw >= 1 && capRaw <= 5000`, so normal users see no change. The preview's 10 venues are all within range.
- **Not changed:** the admin and internal inputs (admin edit, admin add, mirror and backfill).
- **Tests:**
  - Offline: −5, 0, 5,001 and 10⁹ are refused; 1, 5,000 and empty are accepted, for both forms.
  - Workflow, through the endpoints:
    - Submission: −5, 0 and 5,001 return 422 and nothing is stored. 1 and 5,000 are saved.
    - Owner edit: −5, 0 and 5,001 return 422 and the record is unchanged. 1 and 5,000 are saved.

### TVR-21 — edits that flip the meaning go to admin review
- **File:** `backend/venues.py`, in `_is_minor_edit`, with the new `_meaning_markers`.
- **Endpoint:** `POST /api/venues/public-submissions/edit`, for live venues.
- **Rule:** an edit is still "minor" (goes live straight away) only when it:
  - is small (same size limits as before), and
  - keeps the same negation words and the same numbers.
- **Negation words:** no, not, never, none, nothing, nobody, nowhere, neither, nor, without, cannot, and "n't". Only whole words count.
- **Otherwise** the edit becomes pending changes, and the live listing is untouched until an admin approves.
- **Tests:**
  - Offline: 10 edits that flip the meaning are not minor ("No" removed, "not", "never", "cannot" or "without" added, "can't" → "can", 9pm → 11pm, 40 → 400 seats, 12:00 → 14:00, 2,500 → 3,500). 5 genuine typo fixes are still minor, including fixes inside sentences that contain "No", "can't" or a number.
  - Workflow, through the endpoint: 6 edits that flip the meaning become `pending`, and the live description is unchanged. 3 typo fixes become `minor_applied`. The existing typo test still passes.
- **Remaining limits:**
  - Numbers written as words ("nine" → "ten") are not detected.
  - Opposite words ("allowed" → "forbidden") are not detected.
  - Both are only small edits within the existing size limit; larger edits already go to review.

### TVR-15 — upload type checked from the file's bytes
- **New file:** `frontend/lib/server/image-upload.ts`. It checks the file's structure, not just its first bytes:
  - **JPEG:** start-of-image, valid segments, a frame header, a scan, then end-of-image.
  - **PNG:** signature, IHDR first, every chunk complete with a valid checksum, then IEND.
  - **WebP:** a complete RIFF/WEBP container with a VP8, VP8L or VP8X chunk.
- **Rule:** the detected type must equal the declared type (`image/jpg` counts as `image/jpeg`). Mismatches, malformed files and HTML or script with an image label are refused with **400 "Please use a JPG, PNG or WebP image."**, and nothing is stored.
- **Storage:** the object is stored with the **detected** content type and extension.
- **Routes changed** (all four):
  - `app/bff/teacher/retreat-cover/route.ts`
  - `app/bff/venue/photo/route.ts`
  - `app/bff/venue/public-photo/route.ts` (no sign-in needed)
  - `app/bff/institutional/organisations/[id]/logo/route.ts`
- **Not changed:** the teacher profile photo (`/bff/teacher/avatar`), which goes to the main backend.
- **Website uploads are unaffected:** all four upload screens re-encode through a canvas (JPEG, or PNG for PNG logos) and declare that same type.
- **Tests:**
  - **Node harness** `tests/verify_image_uploads.ts`: **100/100** checks. It runs the real handlers of all 4 routes; storage, session and engine calls are intercepted, so nothing is stored. For each route:
    - Accepted: 5 real images (JPG declared `jpeg` and `jpg`, PNG, WebP, bare-base64 PNG). Each is stored once, with the matching type and extension.
    - Refused, with nothing stored or saved: 16 bad files. These are HTML labelled jpeg, png or webp; SVG with a script; a JPG, PNG or WebP header followed by HTML; 3 type mismatches; a truncated JPG, a PNG with no end chunk, a PNG with a bad checksum and a truncated WebP; a `text/html` declaration; and bare HTML.
  - **Live preview, refusals only:**
    - Retreat cover: HTML labelled jpeg, png or webp → 400.
    - Venue photo and organisation logo (signed in): HTML labelled jpeg → 400.
    - Public venue photo (no sign-in): HTML labelled png → 400.
- **Remaining limit:** a file that is a structurally valid image and also carries hidden extra data can still be stored. It is stored and served as an image, and the media proxy sends `X-Content-Type-Options: nosniff`, so a browser won't run it as a page.

### TVR-22 — deferred (not fixed)
- No uniqueness rule was added, as you decided.
- It stays documented by its expected-failure test, `test_dedupe_key_is_enforced_by_a_unique_index`.
- **Why it waits:** we can't yet check the live data for duplicates, and some existing processes can briefly keep two records for the same venue. Those are the mirror, backfill and retreat-sourced venue rows.

## 4. Test results — honest classification

| Suite | Passed | Failed | Skipped | Expected failures (open defects) |
|---|---|---|---|---|
| Offline suites (12 files: the 11 from 2D + `test_p2e_website_fixes.py`) | **1356** | 0 | 13 | – |
| `test_p2e_website_fixes.py` alone (part of the row above) | 32 | 0 | 0 | – |
| Full workflow suite (`tests/workflow`, 27 files, 8 min 41 s) | **1214** | **0** | 9 | **91** |
| Targeted: venue listing and live edits | 93 | 0 | 0 | 1 (TVR-22) |
| Targeted: upload tests in `test_wf_web_bff.py` | 15 | 0 | 0 | – |
| `test_regression_iter132.py` (full) | 20 | 0 | 0 | – |
| Failure-path cleanup check | 2 | **2 forced, intended** | 0 | – |
| Monitoring, isolated, 3 runs | 33 | 0 | 0 | – |
| Monitoring, shared (production configuration), 3 runs | 30 | 0 | 3 (by design) | – |
| Live preview refusal suites, **first run** | 266 | **7** | 0 | – |
| Live preview refusal suites, **re-run** | **273** | 0 | 0 | – |

**About the 7 live failures in the first run:**
- All 7 were in `test_p2b_gap_checks.py`, in consecutive cases.
- Each one got an HTML **502 from the preview gateway**, not an answer from the website.
- The supervisor log shows the preview frontend was **stopped and restarted at 09:29:57 UTC**, during that run. I didn't trigger that restart; my own restart was at 09:19.
- The tests don't touch any code changed in 2E.
- On re-run: `test_p2b_gap_checks.py` passed **82/82**, and all five live files passed **273/273**.

| Website check | Result |
|---|---|
| `verify_image_uploads.ts` (new) | **100/100** |
| `verify_preview_isolation.ts` | **97/97** |
| `verify_booking_holds.ts` | **195/195** |
| `verify_checkout_routing.ts` | **290/290** |
| `tsc --noEmit` | 0 errors |
| ESLint, changed files | 0 issues |

**Correction:** the 2C and 2D reports gave 196 and 291 for the last two checks. Those figures counted the final "PASSED" summary line. The real number of checks is 195 and 290, and all of them pass.

**Skipped (with reason):**
- **13 offline:** 12 reviewed routes that record no money, plus 1 check that runs only on production or the Cashfree sandbox.
- **9 workflow:** 8 Cashfree sandbox-only order tests, plus a wallet page that is gated for the unverified demo teacher.
- **3 monitoring (shared mode):** the isolation-only check, by design.

**Expected failures are not fixes.** The **91** expected failures are **known, unresolved defects**. They are marked so the suite stays green while they remain open, and none of them is fixed:

| Issue | Expected-failure cases | Severity |
|---|---|---|
| TVR-01 (admin data served to non-admins) | 66 | P0 |
| B4.7-C (public responses carry restricted teacher fields) | 8 | P0 |
| B4.7-IDOR (another account's data readable) | 3 + 1 | P0 |
| FIN-04 (wallet doesn't match its ledger) | 1 | P0 |
| FIN-05 (fee taken twice) | 1 | P0 |
| Parameter check before admin check | 2 | P2 |
| API schema public | 1 | P2 |
| Export route shadowed | 1 | P3 |
| TVR-02 (QA retreats published) | 1 | P1 |
| NST-017 (duplicate retreats) | 1 | P2 |
| TVR-03 (retreats with no venue record) | 1 | P1 |
| TVR-11 (city "India" or blank) | 1 | P2 |
| NST-011 / TVR-12 (demo and test profiles public) | 1 | P2 |
| TVR-09 (no Level-1 test account) | 1 | P1 |
| TVR-22 (duplicate venues; website) | 1 | P3 |

- The first 15 rows (90 cases) are in the main backend or its data; TVR-22 is in this website.
- Down from 94 in 2D, because the three expected-failure tests for TVR-20, TVR-21 and TVR-15 were replaced by real passing tests.
- The 15 main-backend issues are outside this workspace and remain open.

## 5. Changed files

| Area | File | Change |
|---|---|---|
| Backend | `backend/venues.py` | TVR-20 capacity range on the 2 public input models; TVR-21 negation and number rule in `_is_minor_edit` |
| Website | `frontend/lib/server/image-upload.ts` (new) | Byte-level image check |
| Website | `frontend/app/bff/teacher/retreat-cover/route.ts`, `app/bff/venue/photo/route.ts`, `app/bff/venue/public-photo/route.ts`, `app/bff/institutional/organisations/[id]/logo/route.ts` | TVR-15: check the bytes; store under the detected type and extension |
| Tests | `backend/tests/test_regression_iter132.py` | Exact cleanup on success and on failure (`run_records`); guard for `000272` and `000289` |
| Tests | `backend/tests/workflow/test_wf_monitoring.py` | Isolated test monitor (default), `WF_MONITOR_SHARED=1` switch, 2 new checks |
| Tests | `backend/tests/workflow/test_wf_venue_listing.py` | TVR-20 tests replace the expected failure |
| Tests | `backend/tests/workflow/test_wf_venue_live_edits.py` | TVR-21 and TVR-20 tests replace the expected failure |
| Tests | `backend/tests/workflow/test_wf_web_bff.py` | TVR-15 live refusals on all 4 routes replace the expected failure |
| Tests | `backend/tests/test_p2e_website_fixes.py` (new) | 32 offline tests for TVR-20 and TVR-21 |
| Tests | `frontend/tests/verify_image_uploads.ts` (new) | Route-level harness for TVR-15 |

**Evidence files** (`/app/test_reports/p2e/`):
- `snapshot.py`, `snap_*.json`
- `failure_cleanup_check.py`, `iter132_*.log`
- `monitoring.log`
- `workflow_full.log` (JUnit: `/app/test_reports/pytest/p2e_workflow_full.xml`)
- `offline_suites.log`
- `live_refusal_suites.log` (first run), `live_refusal_suites_rerun.log`, `live_gap_checks_rerun.log`
- `verify_*.log`, `tsc.log`, `eslint.log`

## 6. Confirmations
- **Preview isolation:** still in effect. The 423 preview-write guard is unchanged, `verify_preview_isolation.ts` passes 97/97, and the live preview refusal suites pass 273/273 on re-run.
- **Financial lock:** ON.
  - `FINANCIAL_ACTIONS_UNLOCKED` is absent.
  - Wallet top-up and payouts are still refused (423).
  - The money tables (`payment_routing_decisions`, `ai_onboarding_orders`, `inst_settlements`, `audit_ledger`, `webhook_events`, `paypal_webhook_events`) all have **0** rows.
  - No registration is pending payment or has an order.
- **Checkout:** disabled. **Main backend:** not modified. **Deploy or publish:** none. **Prompt 3:** not started.
- **Data written during testing (this preview's own database only):**
  - Venue rows for the workflow tests, removed by the suite's existing clean-up. 10 venue submissions remain, the same as before.
  - Activity-log entries, kept on purpose.
  - Throwaway monitor databases, dropped.

## 7. Waiting for your review
- **TVR-22:** deferred until the live data and the copying workflows can be audited.
- **Two optional decisions:**
  - narrowing the pre-existing pattern-based suite clean-up in `test_regression_iter132.py`;
  - whether the run's sign-in activity-log entry should also be kept (it is now).
- **15 main-backend issues**, unchanged:
  - TVR-01 (with the parameter-check issue), B4.7-C, the two IDORs, FIN-04 and FIN-05;
  - the public API schema and the export route order;
  - data: TVR-02, NST-017, TVR-03, TVR-11, TVR-12;
  - TVR-09, the missing test account.
- **Remediation items still open with the main-backend owner:** R1–R12.
- **Still blocked:**
  - Prompt 3 (PayPal);
  - Phase 4 Google indexing;
  - Guru Nominations;
  - B4.9 Payouts and Billing;
  - B5.2 Tax/Legal wording.
