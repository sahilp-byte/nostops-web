# NOSTOPS — Prompt 2E verification (checks only, preview)

**Date:** 28 Oct 2026, 12:17–12:50 UTC (container clock).
**What I did:** I checked the claims in `PAYMENTS_P2E_REPORT.md` against the current code, the preview database (read-only) and new test runs.
**What I did not do:**
- I changed no code, configuration, `.env` value or production setting. Nothing was published or deployed, and Prompt 3 was not started.
- I created no business records. Every request I sent was either refused or a read.
- I ran no test that seeds preview data. Those tests are listed in section 4.

**Files I added:** evidence scripts and logs in `/app/test_reports/p2e_verify/`, and this report.

## 1. Summary

| Claim in the 2E report | What I found | How it was checked |
|---|---|---|
| TVR-20: venue capacity 1–5,000 enforced by the server | **Confirmed** | Independently, without saving anything |
| TVR-21: edits that change the meaning go to admin review | **Confirmed**, with **3 more gaps** (section 3) | Rule logic checked independently; the endpoint itself not run |
| TVR-15: photos checked from their bytes on the 4 routes | **Confirmed** | Independently, refusals checked live |
| Test registrations: cleanup removes only the run's own records and keeps the activity log | **Confirmed** from the code and the database | Not re-run, because a run creates a registration |
| Monitoring tests are isolated and production alerting is not weakened | **Confirmed**, with **2 caveats** (section 3) | Independently |
| Preview writes are blocked, checkout is off, the money lock is ON | **Confirmed** | Independently |
| The test counts in the report | Mostly confirmed. **3 inaccuracies** (section 3) | Independently |

## 2. Evidence for each item

### TVR-20 — capacity range (`backend/venues.py`)
- **Code:**
  - `PublicSubmissionIn.capacity` and `PublicEditIn.capacity` are `Field(ge=1, le=5000)`.
  - The website form already limits capacity to the same range.
- **Direct refusals** (sent to the local API, refused before the handler runs):
  - Public submission with −5, 0, 5,001, 10⁹ or "abc": each got **422**, with the error pointing at `capacity`.
  - Owner edit with −5, 0 or 5,001: **422**.
  - Owner edit with a valid capacity and a fake link: **400** ("link invalid"). So the capacity check runs before the link check.
  - The database fingerprint was identical before and after.
- **Model checks:** 22 of 22 as expected.
  - Accepted: 1, 4,999, 5,000, "250" (converted to a number) and empty.
  - Refused: −1, 0, 5,001, 2⁶³, "abc" and 12.5.
- **Not checked:** saving an accepted value through the endpoint, because that would create a venue.
- **Other capacity inputs:**
  - Admin inputs (mirror, admin add, admin edit, backfill) have no capacity limit, as the report says.
  - Signed-in owners' own centres keep their earlier limit of 1–1,000.

### TVR-21 — edits that change the meaning
- **Code:** for a live venue, `_is_minor_edit` is the only route to going live straight away (`minor_applied`).
  - An edit that adds or removes a negation word, or changes any number, now returns "not minor", so it becomes `pending`.
  - AI-imported fields always go to review.
- **Offline tests:** the 32 checks in `test_p2e_website_fixes.py` pass.
- **My extra probes:** 8 of 8 as expected.
  - Sent to review: "can’t" removed (curly apostrophe), "isn't" removed, "not" added, two numbers swapped, a street number changed, one of two "no"s removed.
  - Still applied straight away: two genuine typo fixes.
- **Not checked:** the endpoint itself (pending or applied), because it needs a live venue and an edit link, which means writing records.

### TVR-15 — photo uploads checked from their bytes
- **Code:**
  - The 4 routes that store a file all call `verifiedImageType`: retreat cover, venue photo, public venue photo and organisation logo.
  - These are the only 4 calls to `putObject` on the website.
  - Each file is stored under the type and extension found in its bytes.
- **Website check `verify_image_uploads.ts`:** **100 of 100** (storage is intercepted).
- **My extra probes:** 28 of 28 as expected.
  - **Refused:**
    - GIF, SVG with a script, PDF, BMP, HEIC, and a WAV audio file labelled WebP.
    - HTML placed in front of a real JPEG.
    - JPEGs with only start and end markers, with no frame header, or cut short.
    - PNGs whose first chunk isn't IHDR, with a bad checksum, or with no end chunk.
    - A WebP cut short, an empty file, and declared/real type mismatches.
  - **Accepted:** real JPG, PNG and WebP files, including `image/jpg` and odd capitalisation.
- **Live preview, refusals only:** **12 of 12**.
  - HTML labelled jpeg, png or webp was refused with 400 on the cover upload.
  - It was also refused on venue photo, organisation logo and public venue photo.
  - The existing bad-file and non-host checks still pass.
- **Remaining limit (the report mentions it):** a valid image with extra data is still accepted. Examples: HTML after the end marker, or a script inside EXIF data.
  - The media proxy sends `X-Content-Type-Options: nosniff`, so a browser won't run it as a page.

### Test-registration cleanup (`test_regression_iter132.py`)
- **Code:** the new `run_records` cleanup runs even when the test fails.
  - **What it deletes:** only this run's participant (by id), its registrations (by id and participant), and its sign-in sessions and sign-in links.
  - **What it never deletes:** the activity log.
  - **Guard:** the registrations `000272` and `000289` are protected.
- **Database (read-only):**
  - The fingerprints of `000272`, `000289`, event `NOSTOPS-EVT-2026-000001` and org `NOSTOPS-ORG-2026-000001` match the report exactly.
  - Counts: 15 registrations (13 on the QA event), 73 participants, 47 sessions, 0 sign-in links. The newest registration is still `000289`.
  - No `iter132` participant is left.
  - The activity-log entries of removed test participants are still there. Today alone: 60 `PARTICIPANT_REGISTERED` and 71 `PARTICIPANT_AUTHENTICATED`.
- **Not re-run:** each run creates a participant and a registration, uses up a registration number and sends a QA email.

### Monitoring isolation (`test_wf_monitoring.py`)
- **Unchanged since 2D:**
  - `backend/monitoring.py` is not modified.
  - The hourly limit is `MAX_ALERTS_PER_HOUR = 20`.
  - The running code writes alerts to `nostops_web.monitor_alerts`.
- **Isolated mode, 3 runs:** 10 passed each time.
  - I left out 1 test, which writes to the real orders table (section 3).
  - No throwaway database and no `wf_` rows were left behind.
- **Production alerting is not weakened:** the isolation only changes where this test file writes. The real monitor, its limit and its alert sending are untouched.

### Preview isolation, checkout and money lock
- **Money lock:**
  - `FINANCIAL_ACTIONS_UNLOCKED` is in neither `.env` file, nor in the supervisor config.
  - It is not set in the environment of the running backend or website processes. Both are therefore locked by default.
- **No change since the 2D commit** to the money-lock, preview-guard, payment-guard and payment-routing files, the `.env` files or `package.json`.
- **PayPal:** `PAYPAL_CHECKOUT_FLOWS` is empty, so no PayPal checkout can start.
- **Live refusal suites (5 files):** **273 of 273** on the first run.
- **Website checks:** preview isolation **97 of 97**, checkout routing **290 of 290**, booking holds **195 of 195**.
- **Spot check through the preview** (made-up ids, not signed in):
  - A profile change, a delete and a PayPal notification: **423** with the preview read-only header.
  - A wallet top-up order: **423** from the money lock.
  - A seat reservation: **400** from the billing-country rule. It was refused locally ("Nothing has been reserved") and not forwarded.
  - A read: 200.
- **Money tables:**
  - `payment_routing_decisions`, `ai_onboarding_orders`, `ai_onboarding_entitlements`, `inst_settlements`, `audit_ledger`, `webhook_events` and `paypal_webhook_events` all have **0** rows.
  - No registration is waiting for payment or has an order.
  - One more table has 28 test rows (section 3).

## 3. Differences from the 2E report, and open issues

1. **Payment-notification table not empty (missing from the report's list).**
   - `ai_onboarding_webhook_events` holds **28 test rows**, all `qa_p0_…` with status "ignored". They were written from 26 Oct 05:47 to 28 Oct 09:22 UTC.
   - They come from the offline test `test_p0_inbound_payments.py`. Its cleanup doesn't match their order ids, so each run leaves 2 rows. The 2E run at 09:22 added the latest pair.
   - They are test notifications, not real ones.
2. **"Offline" tests that do write.** Two of the 12 "offline" files write to this preview's database or call its engine:
   - `test_p0_inbound_payments.py` writes temporary orders, registrations and notifications;
   - `test_participant_paid_payment_chain.py` makes sign-up and payment calls to the local engine.
   - I didn't run them. The other 10 files use throwaway databases or none.
3. **The monitoring file is not fully isolated.** `test_payment_5xx_is_recorded_by_the_middleware` still puts a temporary probe order in the real preview `ai_onboarding_orders` table, then removes it.
4. **Test traffic still uses the shared alert limit.** The live refusal suites (not the monitoring tests) make the preview answer 503 "payments off". The real monitor records those as errors.
   - My run sent **2 real alert emails** at 12:24:45 UTC (ai-onboarding create-order and PayPal create-order). That used 2 of the 20 alerts allowed per hour. It also updated 2 existing monitor rows.
   - This doesn't weaken alerting, but tests still create alert noise.
5. **Report inaccuracies:**
   - It says the full workflow suite has **27 files**. Its own results file shows **21**.
   - The handoff summary named `/bff/teacher/avatar` and `/bff/venue/public-submissions` among the 4 upload routes. The code and the report agree on the correct 4: cover, venue photo, public venue photo and organisation logo. The avatar upload goes to the main backend and is not checked from its bytes.
   - The handoff summary also said `monitoring.py` was changed; it wasn't.
6. **More TVR-21 gaps** (these small edits still go live without review):
   - "dont" written without an apostrophe;
   - a "non-" prefix removed ("Non-smoking" → "Smoking");
   - "Free" → "Paid".
   - Number words and opposite words are already listed in the report.
7. **Activity log grew by 18 after the report's last snapshot.** These are system `TEACHER_UNAVAILABLE` entries written at 09:22:41–52 UTC. They are not from the new cleanup, and I couldn't confirm their source. Nothing has been written since.
8. **Pre-existing test clean-up (not changed by 2E).** `test_regression_iter132.py` still has its suite-wide clean-up that deletes by pattern. It also deletes `inst_settlements` rows for its own `QA-ITER132-` events. Narrowing it needs your OK.
9. **Uncommitted `frontend/yarn.lock` change.** It adds ESLint packages already listed in `package.json`. It is dated 25 Oct, so it predates 2E, and the report doesn't mention it.
10. **Gateway interruption, as in the 2E report.** The preview website was stopped and restarted at 12:32:23 UTC by something outside my run. Two money-lock checks got a 502 page at sign-in. Re-running that test group passed **32 of 32**.
11. **Still open:** TVR-22 (deferred, as you decided) and the 15 main-backend issues (90 expected failures, reproduced below).

## 4. Test results (this run)

| Suite | Passed | Failed | Skipped | Expected failures (open issues) | Not run |
|---|---|---|---|---|---|
| Offline, no shared-database writes (10 files, including `test_p2e_website_fixes.py`) | 1319 | 0 | 12 (reviewed routes that record no money) | – | 2 files that write (section 3) |
| Website checks: image uploads / preview isolation / booking holds / checkout routing | 100 / 97 / 195 / 290 | 0 | – | – | – |
| Type check (`tsc`); ESLint on the 6 changed website files | clean | 0 | – | – | – |
| My probes: image bytes / venue rules | 28 / 30 | 0 | – | – | – |
| TVR-20 direct refusals (database unchanged) | 9 | 0 | – | – | – |
| Monitoring, isolated, 3 runs | 30 | 0 | – | – | 1 test (×3) |
| Live preview refusal suites (5 files) | 273 | 0 | 0 | – | – |
| TVR-15 live upload refusals (`test_wf_web_bff.py`, upload tests only) | 12 | 0 | – | – | 68 other tests |
| Read-only workflow files (8 of the 21) | 740 (+2 on re-run) | 2 → 0 on re-run (gateway 502) | 1 (unverified demo teacher's wallet page) | **90** | – |
| Workflow files that seed preview data (11 of the 21)* | – | – | – | – | **not run** |
| `test_regression_iter132.py` and the cleanup-on-failure check | – | – | – | – | **not run** (creates a registration) |
| Monitoring in shared mode | – | – | – | – | **not run** (writes to the shared monitor) |

\* `ai_onboarding`, `b47_integrity`, `b47_privacy_payments`, `b48_policy`, `b48_trust_review`, `digest`, `launch_round3`, `org_enquiry_delete`, `venue_listing` (includes TVR-20 saves and the TVR-22 expected failure), `venue_live_edits` (TVR-21 endpoint tests), `web_ui`.

**The 90 expected failures match the report's table exactly:**

| Issue | Expected failures |
|---|---|
| TVR-01 | 66 |
| B4.7-C | 8 |
| B4.7-IDOR | 4 |
| Parameter check before admin check | 2 |
| API schema public | 1 |
| Export route | 1 |
| TVR-02, NST-017, TVR-03, TVR-11, NST-011/TVR-12, TVR-09 | 1 each |
| FIN-04, FIN-05 | 1 each |

The 91st (TVR-22) is in a file I didn't run. None of these issues is fixed.

**What I changed in the database during this check:**
- Only the 2 alert rows above and their 2 monitor rows.
- Throwaway test databases, all dropped.

Sign-in sessions on the main backend came from demo and canary logins only.


## 5. Follow-up you approved (28 Oct 2026, 12:42–12:46 UTC)

### A. Test leftovers removed and their cleanup fixed
- **Removed:** the 28 leftover test rows in `ai_onboarding_webhook_events`. Only rows matching all of these were deleted, and there were exactly 28:
  - a `qa_p0_` key,
  - status "ignored",
  - order id "order_from_main_backend" or empty.
- **Backup:** `/app/memory/backups/ai_onboarding_webhook_events_qa_p0_20261028T124227Z.json.gz`. The table now has 0 rows.
- **Cause:** the test cleanup deleted notifications by order id. Notifications for an unknown order have a different order id, so they were never deleted.
- **Fix (test file only, `backend/tests/test_p0_inbound_payments.py`):** each test now remembers the notification keys it sent. Afterwards it deletes exactly those, plus anything stored for its own test order.
- **Proof:** I ran the file 3 times: 27 passed each time, and the database was unchanged afterwards (0 notification, order or entitlement rows).

### B. The remaining tests that add their own data
| Suite | Passed | Failed | Skipped | Expected failures |
|---|---|---|---|---|
| The 11 workflow files that seed data | **381** | 0 | 8 (create a real Cashfree order, sandbox only) | 1 (TVR-22) |
| `test_regression_iter132.py` (full file) | **20** | 0 | 0 | – |

**Clean-up afterwards:**
- 0 test venues, 0 `iter132` participants and 0 `QA-ITER132-` events left.
- No `wf_` collections and no throwaway databases left.
- Registrations, participants, sessions, venues and every money table have the same counts as before.
- `000272` and `000289` are unchanged. The newest registration is still `000289`.

**Side effects you should know about:**
- **Activity log:** +284 entries, kept on purpose.
- **Registration number:** the registration test used up one, as each run does.
- **Shared alert monitor:** +12 alerts.
  - 7 alert emails were sent. Five came from refused payment requests answering 503 "payments off", one from a forged-signature test, and one from a QA email the email provider rate-limited (429).
  - 4 more QA emails were rate-limited, and their alert emails failed to send for the same reason.
  - That makes 14 alerts in the last hour, under the limit of 20.

### C. Combined workflow result (21 files)
- **Passed:** 1,145 different tests = 742 read-only + 381 seeding + 10 monitoring + 12 upload checks.
  - With the 69 tests not yet run (below), that is the 2E report's 1,214.
- **Failed:** 0, after the re-run of the 2 sign-in 502s caused by the external website restart.
- **Skipped:** 9.
- **Expected failures:** **91**, matching the 2E report: 90 main-backend issues and TVR-22.
- **Still not run:**
  - the other 68 tests in `test_wf_web_bff.py`, which also seed data;
  - 1 monitoring test, which puts a temporary order in the real orders table;
  - the monitoring tests in shared mode;
  - `test_participant_paid_payment_chain.py`.

## 6. Every remaining test re-run (28 Oct 2026, 12:47–12:55 UTC)

| Suite | Passed | Failed | Skipped | Database afterwards |
|---|---|---|---|---|
| `test_wf_web_bff.py`, whole file (the 68 not run before + the 12 upload checks) | **80** | 0 | 0 | No difference |
| `test_wf_monitoring.py`, isolated, all 11 (including the payment 5xx test) | **11** | 0 | 0 | No difference: the test order was removed and the throwaway database dropped |
| `test_wf_monitoring.py`, normal shared configuration (`WF_MONITOR_SHARED=1`; 14 of 20 alerts used beforehand) | **10** | 0 | 1 (isolation-only check, by design) | **2 problems, see below** |
| `test_participant_paid_payment_chain.py` | **10** | 0 | 1 (runs on production or sandbox only) | No test event, org or participant left. 0 registrations waiting for payment. +13 activity-log entries. 1 alert (receipt email refused by the provider, 429) |
| Failure-path cleanup check | **2** | **2 (forced on purpose)** | 0 | Both forced runs cleaned up fully; registration `000318` was created and removed. +6 activity-log entries |

**Every test has now been re-run. The totals match the 2E report exactly:**
- **Workflow suite (21 files):** **1,214** passed, **0** failed, **9** skipped, **91** expected failures.
  - The 91 are the 90 main-backend issues plus TVR-22. None is fixed.
- **Offline files (12):** **1,356** passed, **0** failed, **13** skipped.

`000272` and `000289` are unchanged, and the newest registration is still `000289`.

### Problems found in the normal shared-monitor setup (old clean-up code, not changed in 2E)
1. **It deletes monitor records it didn't create.** In shared mode the clean-up deletes every monitor event on the real path `/api/ai-onboarding/status`, and that event's alert.
   - This run it deleted one such event (and its alert) that an earlier test run had created at 12:42:56.
   - A real production error on that path would be deleted the same way.
2. **It leaves an alert behind.** The email-failure test removes its own event but not that event's alert. This run left 1 orphan alert from 12:49:39.

The isolated setup, now the default, has neither problem. Fixing the shared setup needs your OK; I changed nothing.
