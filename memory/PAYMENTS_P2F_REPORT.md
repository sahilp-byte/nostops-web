# NOSTOPS — Prompt 2F report: test safety, clean-up and the remaining review gaps (preview only)

**Date:** 28 Oct 2026. The code work was done in the previous session. This session ran the checks from 14:45 to 15:08 UTC (container clock).
**Scope:** the 7 items of Prompt 2F. Checks ran in this preview only.
**Not done:**
- Nothing was published or deployed.
- No production setting, `.env` value or payment configuration was changed.
- No live payment-provider call was made.
- No further clean-up was done.
- Prompt 3 was not started.

**How to read this report:**
- **Verified**: checked in this session by running something, with the evidence named.
- **Code-read**: checked by reading the code only.
- **Reported**: stated by the previous session or an earlier report, and not re-checked.
- **Skipped**: a test that skipped itself, by design.
- **Blocked**: a check that can't be done without breaking a rule of this prompt.

Evidence: `/app/test_reports/p2f/`, containing logs `v*.log`, snapshots `v*.json`, request logs `net_*.jsonl` and the scripts.

---

## ⚠ Read first: one real alert email was sent during this verification

- **What happened:** at 15:02:08 UTC the Error Monitor sent **1 real alert email** to its alert address. It was about "Registration confirmed — NOSTOPS" emails that had failed.
  - The backend tried **3** of those confirmation emails for real. The email provider **refused all 3** (422 "undeliverable recipient"; the recipients were made-up `iter132.participant…@nostopsqa.com` test addresses). So no participant received anything.
- **Cause:** I re-ran the 2E failure-path check `/app/test_reports/p2e/failure_cleanup_check.py`.
  - That file lives **outside** `backend/tests`, so pytest did not load `backend/tests/conftest.py`, which is what adds the signed test tag.
  - Its 10 requests went out **untagged**, as the request log shows (`net_6_writers.jsonl`: 3 sign-in checks, 5 registrations and 2 reads without a tag). The backend therefore treated them as real traffic.
- **Database effect:**
  - +1 row in `monitor_alerts` (status "sent").
  - The existing monitor row for that email failure went from 186 to 189.
  - I removed neither.
- **What it shows:** the test-tag protection depends on where the test file sits. A test outside `backend/tests` is not protected, and nothing stops it from running untagged. This is open issue 1 in section 5, and fixing it needs your OK.
- **This was my mistake.** I should have checked that this script loads the tag before running it. No other check in this session ran untagged against the live services, as the request logs show.

---

## 1. Summary

| # | Prompt 2F item | Status | Basis |
|---|---|---|---|
| 1 | Shared-test clean-up removes only by id | **Done for the 10 test files changed in 2F.** 5 older test files still remove by pattern (not run, not changed) | Verified: snapshots before and after every phase; shared-monitor run; offline refusal tests |
| 2 | 28 payment-notification rows: stay deleted, backup kept | **Done.** The table has 0 rows. The backup checks out byte for byte, and the restore procedure is tested in dry-run mode | Verified |
| 3 | No test side effects: no real-order writes from monitoring tests, no real alert emails from tests | **Works for tests that carry the tag. Not yet complete:** (a) tests outside `backend/tests` run untagged (the incident above); (b) 2 in-process offline tests still add counts to real monitor rows | Verified |
| 4 | Venue-edit gaps ("dont", Non-smoking/Smoking, Free/Paid, number changes) | **Done** | Verified: offline and through the real edit endpoint |
| 5 | Prompt 2E fixes still hold | **Yes** (TVR-20, TVR-21, TVR-15, registration clean-up, monitoring isolation) | Verified |
| 6 | Safety controls (money lock ON, checkout off, no live calls) | **Yes** | Verified |
| 7 | Report, then stop | This document. I have stopped | – |

---

## 2. Evidence for each item

### Item 1: test clean-up removes only what the run created

**What changed in 2F** (Code-read):

| File | Before | Now |
|---|---|---|
| `backend/tests/workflow/_wf.py` + `conftest.py` | End-of-session sweep removed every venue whose id began with `wf_` or whose email began with `delivered+wf` | `CREATED_VENUES` records each listing id the session creates. `purge()` refuses any other id; the sweep removes exactly that set |
| `backend/tests/workflow/test_wf_venue_listing.py` | – | Listings created through the API are recorded by the id the server returns. A de-duplicated answer is not recorded twice |
| `backend/tests/_inst_qa.py` (used by about 15 institutional test files) | `purge()` removed every `inst_*` row matching the given events, organisations or participant emails | Removes only ids this process created, each row by its own `_id`. Anything else is refused with an error. Money tables are never cleaned: a row there fails the run so it can be reviewed |
| `backend/tests/test_regression_iter132.py` | Suite-wide sweep before and after by `QA-ITER132-` title, `iter132_` id and `iter132` email patterns. It also deleted `inst_settlements` rows | Removes exactly the organisations, events and directory rows the run recorded, by id. It no longer deletes settlement rows; it fails if any exist |
| `backend/tests/workflow/test_wf_monitoring.py` (shared mode) | Removed every monitor event on `/api/ai-onboarding/status` or a `wf_` source, plus their alerts (2E found it deleting a row it didn't create, and leaving an orphan alert) | Records the id of every event group and alert row the test itself creates, and removes exactly those |
| `backend/tests/workflow/test_wf_b47_integrity.py` | Removed directory, event, assignment and log rows by `b47_fx` / `B47-FX` patterns | Each run's fixture ids carry its own suffix, and only those ids are removed |
| `backend/tests/test_p0_inbound_payments.py`, `test_wf_ai_onboarding.py` | `delete_many` by order id | The exact notification keys sent, plus the ids stored for the test's own order |

**Proof that nothing else was removed and nothing was left** (Verified):
- **How it was measured:** a read-only snapshot before and after every phase, using `snap.py`. It records:
  - the count of all 101 collections;
  - the exact id set of 24 collections (registrations, participants, sessions, events, organisations, members, directory, assignments, venues, revisions, centres, enquiries, policy and trust cases, verification payments, monitor events, alerts, and all order, entitlement, notification and money tables);
  - content fingerprints of fixed records.
- **Result:** in every phase that seeds and removes data (2, 4, 5, 5b, 6a, 6b, 6c and 6d), the id sets afterwards are **identical** to those before. The only exception is the alert row from the incident.
  - Identical id sets means no pre-existing record was removed and nothing the test made was left behind.
- **Shared monitor** (`WF_MONITOR_SHARED=1`, the configuration that misbehaved in 2E): 10 passed, 1 skipped by design.
  - Real monitor before and after: the fingerprint of event ids and counts is identical (`e747729e…` = `e747729e…`), as are the alert-id set and the alert count.
  - No row was deleted that the test didn't create, and no orphan alert was left.
- **Refusal tests** (offline, in `test_p2f_test_isolation.py`):
  - `_inst_qa.purge()` refuses the protected fixtures `NOSTOPS-EVT-2026-000001` and `NOSTOPS-ORG-2026-000001`, and the counts are unchanged afterwards.
  - `_wf.purge()` refuses the real partner venue `vp_dharamkot_himachal`.
- **No pattern-based deletes remain in the 10 files changed in 2F** (Code-read: every `delete_many` / `delete_one` in them is by `_id` or by an id the run created).

**Not changed in 2F (Code-read, not run this session):** 5 older test files still delete by pattern:

| File | Deletes by |
|---|---|
| `test_qa18_teacher_lifecycle.py` | directory and assignment rows starting `qa18_`; participants whose email contains `qa18` |
| `test_prompt5_cohort_e2e.py` | participants whose email contains `qa135.part.` |
| `test_org_enquiries.py` | enquiries whose organisation name starts with `TEST ` |
| `test_special_needs_pathway.py`, `test_pathways_b11.py` | a pattern that ends in the run's own random suffix, so in practice limited to the run |

### Item 2: the 28 payment-notification rows (Verified)

- **Table `ai_onboarding_webhook_events`:** **0 rows** at the start and end of this session and after every phase. None of the 28 backed-up ids is present.
- **Backup** `/app/memory/backups/ai_onboarding_webhook_events_qa_p0_20261028T124227Z.json.gz`, written 28 Oct 12:42 UTC, 1,142 bytes:
  - SHA-256 `d2b96be204f92c0d845ba5237a528d316f64deba58e3622f86af092ac795bb23`. It is recorded in the restore script, which checks it on every run.
  - **28 rows, 28 different ids**, every id starting `qa_p0_`.
  - Every row has status "ignored" and note "unknown_order".
  - Order id: "order_from_main_backend" in 14 rows, empty in 14.
  - Received from 26 Oct 05:47 to 28 Oct 09:22 UTC.
- **Restore procedure** (not run; written and tested in dry-run mode only):
  - Dry run: `python3 /app/test_reports/p2f/restore_webhook_backup.py`. It is read-only: it checks the checksum, parses the file, checks each row is one of the expected test rows, and reports which ids are already in the table.
  - This session's dry run: *checksum OK; rows 28; content check OK; table rows now 0; already present 0; would insert 28; nothing written* (`v8_restore_dry_run.log`).
  - To restore (only if you ask): add `--apply`. It inserts only rows whose id is absent, and never overwrites or deletes.
- **The test that created them is now clean:** `test_p0_inbound_payments.py` passed **27 of 27**. The table stayed at 0 rows, and order, entitlement and notification ids were identical before and after.

### Item 3: no test side effects

**How it works** (Code-read; behaviour Verified below):
- A test run signs a tag, `X-Nostops-Test-Tag: v1.<run id>.<expiry>.<HMAC>`, with a key derived from `PULSE_SHARED_SECRET`. A tag lives at most 24 hours.
- **Website (BFF)** (`lib/server/test-tag.ts`): checks the signature and expiry. It passes the tag on only if every `Host` / `X-Forwarded-Host` of the request is a preview or local host.
  - It adds the tag to the 40 local-backend calls (in 34 files) that carry the shared secret, to its two own email routes (`teacher/welcome-email`, `retreats/[id]/reserve`) and to the error reporters (`monitor.ts`, `instrumentation.ts`).
- **Backend** (`backend/test_tag.py`): checks the tag again. It honours it only if **its own environment** is a preview: `APP_URL` on a preview host **and** `MONGO_URL` pointing at the pod's local database.
  - While a request is tagged, emails go to `nostops_web_test_sink.email_outbox` and Error Monitor events to `nostops_web_test_sink.monitor_log`. That is a separate database, not `monitor_events` as the handoff summary said.
  - A tagged event never creates a real monitor row or alert, and never uses the real hourly quota.
  - The email safety checks still run first.
- **Never leaves the preview:** the tag is on the gateway's strip list (`HOP_BY_HOP`), so it is never forwarded to the main backend.
- **Monitoring tests:** the payment-5xx test's probe order now lives in the test file's throwaway database, never in the real `ai_onboarding_orders`.

**Verified in this session:**

| Check | Result |
|---|---|
| Offline tag tests (`test_p2f_test_isolation.py`, 30 tests) | **30/30**. Tampered, forged, expired, too-long and other-secret tags are refused. Deployed-site and managed-database environments ignore the tag. Tagged email → outbox, provider never called. Tagged error → test log, no real row, no alert |
| Live tag check through the running backend and website (`test_wf_p2f_isolation.py`, 10 tests) | **10/10**. Run `pytest_0a3e71bd63a7`: 4 outbox rows (2 direct, 1 venue-edit email, 1 BFF welcome email to `teacher.demo@nostops.com`); 2 test-log rows (a real 503 "payments off", and a browser error relayed by the website). Missing, forged or tampered tags → 404, nothing stored. **Real monitor unchanged** |
| The 2 sources of 2E's real alert emails (PayPal and ai-onboarding create-order 503s from the live refusal suites) | Now in the **test log only** (run `pytest_87378261e907`). Real monitor unchanged, **0 alerts** |
| Monitoring tests, real orders | Order ids identical before and after both monitoring runs. The test also asserts the real orders table is untouched |
| Emails kept in the outbox instead of sent, in this session | **45**. 32 "We received your venue updates", 2 "Your venue updates are now live", 1 "Your NOSTOPS venue is now live", 1 "About your recent venue updates", 4 "Registration confirmed", 1 "Payment receipt", 2 outbox probes, 1 venue-edit probe, 1 teacher welcome |
| Errors kept in the test log instead of the real monitor | **11** (503s on create-order, status and PayPal create-order, and 1 forged-webhook signature) |
| Tag on every request from the test process to this preview (request log) | Phases 2–5 and 6a/6b/6d: every request to this preview carried a valid tag. The only exceptions are the 3 deliberately forged/missing-tag checks and phase 6c (the incident) |

**Still open in item 3 (Verified):**
1. **Untagged tests outside `backend/tests`:** the incident at the top.
2. **In-process offline tests still write to the real Error Monitor.** They call the app inside the test process (FastAPI `TestClient`) without a tag:
   - `test_p0_freeze_gateway.py::test_an_internal_error_in_the_rule_check_forwards_nothing` adds 1 to the real row "/api/teacher-wallet/withdraw · Unhandled RuntimeError" (now 37);
   - a test in `test_p0_cashfree_diag.py` sometimes adds 1 to "/api/payments/cashfree/diag · HTTP 503" (now 6).
   - No alert came from either in this session, and neither row has ever sent one. But nothing prevents an alert, because the alert is started in the background and depends on timing.
   - In phase 1b I left out the first test; the second still added 1.
3. **Limit of the evidence:** the backend and website don't log their outgoing requests. "No real email was sent by a tagged request" therefore rests on four facts, not on a network log:
   - every tagged request's email reached the outbox;
   - the real monitor recorded no email failure;
   - no alert row was added apart from the incident;
   - the backend log shows provider responses only for the incident's 3 emails.
4. **Sign-ins to the live main backend** (allowed by the suite's safety contract; listed for completeness):
   - the website's sign-in of `teacher.demo` for the welcome-email check;
   - 1 direct `POST /api/auth/login` (demo account) plus 2 GETs from `test_wf_b47_integrity.py`.
   - No other request from the test process reached the main backend over the network. The 185 "main backend" and 80 PayPal requests in the offline log never left the process: they were answered by test mocks.

### Item 4: venue edits that change the meaning

**Change** (`backend/venues.py`, Code-read):
- For a live venue, a small edit now also goes to admin review when it adds, removes or reorders any of these:
  - a negation written without its apostrophe (dont, cant, isnt, wont…);
  - a "non" prefix (Non-smoking, non smoking, Nonsmoking, Non-veg);
  - one of about 50 words whose opposite flips the meaning (free/paid, included/extra, allowed/banned, optional/mandatory, before/after, only, over/under…);
  - a number written as a word (nine/ten, single/double, once/twice, lakh…), or a change between digits and words.
- Whole words only: "freedom", "openness", "someone" don't count.
- The 2E rules (negations with an apostrophe, digits) are unchanged.

**Verified:**
- **Offline** `test_p2f_venue_meaning.py`: **29/29**.
  - 21 meaning changes go to review: "dont" added and removed, "isnt", "cant", "Non-smoking" → "Smoking", "Smoking" → "Non smoking", "Nonsmoking", "Non-veg" → "Veg", "Free" → "Paid", "included" → "extra", "complimentary" → "chargeable", "Free parking, paid meals" → "Paid parking, free meals", "allowed" → "banned", "permitted" → "prohibited", "optional" → "mandatory", "before" → "after", "only" removed, "nine" → "ten", "Single" → "Double", "twice" → "once", "9" → "nine".
  - 6 typo fixes that keep these words still go live.
  - The whole-word check holds, and the 2E rules are unchanged.
- **Through the real edit endpoint** (in `test_wf_venue_live_edits.py`): **7/7**.
  - These go to `pending` and the live text stays the same: "dont" added, "Non-smoking" → "Smoking", "Free" → "Paid", "allowed" → "banned", "nine" → "ten".
  - These are still applied straight away (`minor_applied`): "Free parkng" → "Free parking" and "Non-smokng" → "Non-smoking".

**Remaining limits** (Code-read):
- A meaning change using words outside the lists still goes live without review if it is small, for example "quiet" → "noisy" or "vegan" → "vegetarian".
- The lists are English only.
- Larger edits are handled by the existing size rule.
- Some genuine small edits will now wait for review, for example rewording that moves "only" or "more".

### Item 5: the Prompt 2E fixes still hold (Verified)

| 2E fix | Evidence this session |
|---|---|
| TVR-20 capacity 1–5,000 | `test_p2e_website_fixes.py` 32/32 (also covers TVR-21), plus 10 capacity tests through the endpoints in `test_wf_venue_listing.py` and `test_wf_venue_live_edits.py`, all passed |
| TVR-21 meaning-changing edits go to review | The 2E offline tests above, plus the 2E endpoint tests in `test_wf_venue_live_edits.py` (33 in the file, all passed) |
| TVR-15 photos checked from their bytes | `verify_image_uploads.ts` **100/100**; live upload refusals in `test_wf_web_bff.py` **12/12** |
| Test registrations: clean-up removes only the run's own records and keeps the activity log | `test_regression_iter132.py` **20/20**. The failure-path check: **2 forced failures (on purpose) + 2 passed**. Both failed runs left 0 participants, registrations, sessions and sign-in links, and the activity-log entry was kept. Registration `NOSTOPS-REG-2026-000322` was created and removed |
| Monitoring tests isolated, production alerting unchanged | Isolated **11/11**, database unchanged, throwaway database dropped. `MAX_ALERTS_PER_HOUR = 20` (test asserts it). Shared mode as in item 1 |

### Item 6: safety controls (Verified)

- **Money lock ON:** `FINANCIAL_ACTIONS_UNLOCKED` is absent from both `.env` files and the supervisor config. It is not set in the environment of the running backend (`uvicorn server:app`) or website (`next-server`) processes, and both lock unless it is exactly `true`.
  - A wallet top-up order through the preview got **423** "Money actions are paused…".
- **Checkout off:**
  - `PAYPAL_CHECKOUT_FLOWS` is empty, and PayPal create-order through the preview got **503** "International checkout temporarily unavailable…".
  - A Cashfree order without a billing country got **400** "This payment is not available. No payment has been taken."
  - A seat hold without a billing country got **400** "…Nothing has been reserved."
  - The 8 workflow tests that would create a real Cashfree order skipped themselves, because the configured Cashfree is live, not sandbox.
- **Preview write isolation:**
  - A profile change, a delete and a PayPal notification through the preview each got **423** with `X-Nostops-Preview-Read-Only: 1`. A read got 200 (`v7_spot_check.log`).
  - Live refusal suites (5 files): **273/273**.
  - `verify_preview_isolation.ts`: **97/97**.
  - `verify_checkout_routing.ts`: **290/290**.
  - `verify_booking_holds.ts`: **195/195**.
  - Offline payment, hold and isolation suites: see section 3.
- **No live external calls from tests:**
  - **Payment providers:** none.
  - **Main backend:** only the demo sign-ins and GETs listed in item 3.
  - **Email provider:** only the incident's 3 refused emails and 1 alert.
  - The offline Cashfree and PayPal calls were answered by test mocks (16 Cashfree, 80 PayPal).
- **Money tables:** `payment_routing_decisions`, `ai_onboarding_orders`, `ai_onboarding_entitlements`, `ai_onboarding_webhook_events`, `inst_settlements`, `audit_ledger`, `webhook_events` and `paypal_webhook_events` all have **0** rows, start and end. `inst_revenue_allocations` and `verification_payments` id sets are unchanged.
- **Files changed since the 2D commit:**
  - The money-lock, payment-guard and preview-isolation files, `package.json` and both `.env` files are **unchanged**.
  - Two payment-adjacent files did change in 2F:
    - `frontend/lib/server/payment-routing.ts`: one line, which adds the test tag to its call to the local routing policy;
    - `backend/server.py`: the error middleware now sets the tag for each request, and the tag header is stripped before forwarding.
  - Neither changes a payment decision.
- **Type check and lint:** `tsc --noEmit` clean; ESLint clean on all 38 changed or new website files.

---

## 3. Test results (this session)

| Phase | Suite | Passed | Failed | Skipped | Expected failures | Effect on the database |
|---|---|---|---|---|---|---|
| 1 | Offline, 12 files (the 10 from 2E + `test_p2f_test_isolation.py` + `test_p2f_venue_meaning.py`) | **1,378** | 0 | 12 (reviewed routes that record no money) | – | 1 real monitor row +1 (item 3, open 2) |
| 1 | Website checks: image uploads, preview isolation, booking holds, checkout routing | 100 / 97 / 195 / 290 | 0 | – | – | none (all calls intercepted) |
| 1 | `tsc`; ESLint on 38 website files | clean | 0 | – | – | – |
| 1b | Offline re-run with the transport-aware request log, minus the test above | 1,377 | 0 | 12 + 1 left out | – | 1 real monitor row +1 (diag) |
| 2 | `test_wf_p2f_isolation.py` (live tag) | **10** | 0 | 0 | – | Test sink only |
| 3 | Live refusal suites (5 files) | **273** | 0 | 0 | – | Test log +2 only |
| 3 | TVR-15 live upload refusals | **12** | 0 | 68 not selected | – | none |
| 4 | 5 seeding workflow files changed in 2F (`venue_live_edits` 33, `venue_listing` 68, `b47_integrity` 12, `ai_onboarding` 41, `web_ui` 4) | **149** | 0 | 8 (real Cashfree order, sandbox only) | 1 (TVR-22, deferred) | Id sets unchanged. See section 4 |
| 5 | `test_wf_monitoring.py`, isolated | **11** | 0 | 0 | – | none |
| 5b | `test_wf_monitoring.py`, shared mode | **10** | 0 | 1 (isolation-only check) | – | none |
| 6a | `test_p0_inbound_payments.py` | **27** | 0 | 0 | – | none |
| 6b | `test_regression_iter132.py` | **20** | 0 | 0 | – | Id sets unchanged. +2 SEO rows left (section 5) |
| 6c | 2E failure-path check | 2 | **2 (forced on purpose)** | 0 | – | Clean-up complete. **Untagged: the incident** |
| 6d | `test_participant_paid_payment_chain.py` | **10** | 0 | 1 (production or sandbox only) | – | Id sets unchanged |
| 7 | Spot check through the preview (7 requests + 1) | all as expected | 0 | – | – | Test log +1 only |

**Not run this session**, because they are not among the 2E/2F checks or the files changed in 2F:
- the other 16 workflow files, including the 8 read-only ones with the **90 expected failures** for the 15 main-backend issues. Their status is as reported in 2E: none fixed;
- `test_wf_web_bff.py` apart from the upload tests;
- the older institutional files that use `_inst_qa.purge()`. Only the paid-chain file exercised the new `purge()` live.

Also: I ran `verify_financial_lock.ts` without its input file by mistake (exit 1, usage error). It is a helper for a pytest check, not a standalone check, and is not counted.

---

## 4. Database: this session's start and end, and earlier reports

**Start of this session (14:46) compared with the previous session's 2F start snapshot (13:31, `snap_0_start.json`):** every field identical:
- registrations 15, participants 73, sessions 47, events 49, organisations 30, venues 10, activity log 96,302, monitor events 47, alerts 260;
- all money tables 0;
- `000272`, `000289`, `NOSTOPS-EVT-2026-000001` and `NOSTOPS-ORG-2026-000001` fingerprints identical; newest registration `000289`.

They also match the end state in the 2E verification report (15 / 73 / 47 / newest `000289` / fixtures unchanged / money tables 0). The last real alert before this session was at 12:49:44, so no alert row exists from the previous session's 2F work.

**End (15:05) compared with start (14:49)** (Verified, `snap_diff.py v1_before.json v7_final.json`):
- **Unchanged:**
  - the exact id sets of all 24 tracked collections, except `monitor_alerts`;
  - all record counts in those collections;
  - the fixture fingerprints, the newest registration and the venue fingerprint;
  - all money tables at 0.
- **Changed. I did not reverse any of these** (no extra clean-up):
  - **Activity log `inst_event_audit_log`: +285, kept on purpose.**
    - 257 are `TEACHER_UNAVAILABLE` system entries: 18 open events × each teacher-matching pass that the tests trigger (directory syncs and the teacher.demo institutional page).
    - This probably explains the "18 entries of unknown source" in the 2E verification. The same bursts appear at 05:23, 05:37, 08:35, 09:20 and 12:42 today.
    - The other 28 are participant, organisation and event entries from 6b–6d.
  - **`monitor_alerts` +1**: the incident alert (15:02:08, "sent").
  - **3 existing monitor rows:**
    - "Registration confirmed" email failures +3 (incident);
    - teacher-wallet/withdraw +1 (phase 1);
    - cashfree/diag +1 (phase 1b).
  - **`inst_event_seo` +2:** the SEO rows of 2 of iter132's own events, whose events were removed (section 5, issue 3).
  - **`captcha_consumed` +18:** spent anti-replay tokens from the venue-submission tests. They have a 10-minute expiry index. Still there at 15:07; at 15:09 the count was back to **0**, removed by MongoDB's expiry, not by me.
  - **Counters (numbers used, never reused):** registrations 319 → 326, organisations and memberships 936 → 940, events 2,069 → 2,073, SEO 4,780 → 4,783.
  - **Directory content, 2 rows refreshed:**
    - `teacher.demo` (`user_1f18960aeaba`), re-synced from the main backend when its page was loaded;
    - `user_iter132_teacher`, an older leftover the registration test updates each run but no longer deletes, because this run didn't create it.
  - **Test sink:** outbox 12 → 57, test log 4 → 15. This is kept as evidence; the earlier 16 rows came from the previous session's runs.

---

## 5. Open issues, risks and dependencies (nothing below was changed; each fix needs your OK)

1. **🔴 Tests can still run untagged (caused the incident).**
   - The tag is added only for test files under `backend/tests`.
   - Suggested fix: make untagged test traffic impossible rather than easy to forget. For example, the backend could refuse to send emails for requests coming from the test helpers unless tagged, or the helper scripts could load the tag themselves.
   - The simplest step is to move or adapt `/app/test_reports/p2e/failure_cleanup_check.py`.
2. **🔴 2 in-process offline tests still write to the real Error Monitor**, with a possible real alert (item 3, open 2).
   - Suggested fix: have in-process test clients send the tag, or point those two tests at a throwaway monitor.
3. **🟠 `test_regression_iter132.py` leaves its events' SEO rows.**
   - 2 per run; 24 orphan SEO rows exist in total from earlier runs.
   - The old pattern clean-up didn't remove them either.
   - Suggested fix: add `inst_event_seo` (by the run's event ids) to its clean-up. Removing the 24 existing orphans is a separate clean-up decision.
4. **🟠 5 older test files still delete by pattern** (listed in item 1). They were not run this session.
5. **🟡 Pre-existing directory row `user_iter132_teacher`** is left alone by the new clean-up because this run didn't create it, but the test updates it each run.
6. **🟡 Activity-log noise:** each workflow run adds about 234 `TEACHER_UNAVAILABLE` entries about real (demo and fixture) events. They are kept on purpose, because the log is never cleaned by tests.
7. **🟡 The orphan alert left by the 2E shared run** (12:49:39) is still there. I did not remove it.
8. **🟡 The test sink database has no automatic expiry.** It now has 57 outbox and 15 test-log rows.
9. **🟡 Production behaviour of the tag is Code-read only.** The checks are offline tests of the environment rule and the host rule. It can't be checked on production without deploying (**Blocked**).
   - The website's `instrumentation.ts` path (unhandled page errors) is also Code-read only. The live check covered the browser-error relay.
10. **🟡 Outgoing requests of the backend and website aren't logged**, so "no real email" is inferred (item 3, open 3).
11. **Unchanged from 2E:**
    - TVR-22 is deferred, as you decided.
    - The 15 main-backend issues (90 expected failures) are not fixed.
    - The uncommitted `frontend/yarn.lock` change, dated 25 Oct, predates 2E.
12. **Corrections to the handoff summary** (Reported claims vs what I found):
    - Test emails and errors go to a separate database, `nostops_web_test_sink`, not to `monitor_events`.
    - `monitoring.py` *was* changed in 2F, at the two tagged branches.
13. **Prompt 3** (PayPal and payment work) remains **blocked** and was not started.

## 6. Files

**Changed or added in 2F** (previous session; read in full for this report):
- **Backend:**
  - added `test_tag.py`;
  - changed `email_util.py`, `monitoring.py`, `server.py` and `venues.py`.
- **Website:**
  - added `lib/server/test-tag.ts`;
  - the tag is now passed on in 34 files and 40 call sites (applied by `/app/test_reports/p2f/add_test_tag_forwarding.py`);
  - email diversion in `app/bff/teacher/welcome-email/route.ts` and `app/bff/retreats/[id]/reserve/route.ts`;
  - `instrumentation.ts` and `lib/server/monitor.ts`.
- **Tests:**
  - added `backend/tests/_test_tag.py`, `backend/tests/conftest.py`, `test_p2f_test_isolation.py`, `test_p2f_venue_meaning.py` and `workflow/test_wf_p2f_isolation.py`;
  - changed `_inst_qa.py`, `test_p0_inbound_payments.py`, `test_regression_iter132.py`, and in `workflow/`: `_wf.py`, `conftest.py`, `test_wf_ai_onboarding.py`, `test_wf_b47_integrity.py`, `test_wf_monitoring.py`, `test_wf_venue_listing.py`, `test_wf_venue_live_edits.py` and `test_wf_web_ui.py`.

**Added in this session (evidence only, under `/app/test_reports/p2f/`):**
- scripts: `run_p2f_verify.sh`, `p2f_netlog.py` (records the test process's requests without changing them), `netlog_summary.py`, `snap_diff.py`, `spot_check.py` and `restore_webhook_backup.py` (dry-run by default);
- `snap.py` was extended (still read-only);
- the logs, snapshots and request logs of every phase.

No application code was changed in this session.

**I have stopped here and am waiting for your review and explicit approval.**
