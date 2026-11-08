# NOSTOPS — Prompt 2G report: test isolation and clean-up safety (preview only)

**Date:** 28 Oct 2026 (container clock).
- **Previous session:** made the code changes and ran the checks, 20:00–21:08 UTC.
- **This session:** ran no tests (your choice: "report only, skip the full re-run"). It only took read-only snapshots and queries at about 21:20 UTC to write this report.

**Not done:**
- Nothing was published or deployed.
- No production setting, `.env` value or payment configuration was changed.
- No live payment-provider call was made.
- Nothing was deleted or restored in this session.
- Prompt 3 was not started. The money lock (`MONEY_OPS_FROZEN`) is still ON.

**Labels used below:**
- **Verified:** checked by running something, with the evidence named.
- **Code-read:** checked by reading the code only.
- **Not re-verified:** changed after the last run that covered it.

**Evidence:** everything is in `/app/test_reports/p2g/`.
- Logs: `p*.log`
- Snapshots: `p*.json` and `s0_start.json`
- Snapshot differences: `diff_*.txt`
- Test-process request logs: `net_*.jsonl`
- Scripts: `snap.py`, `seo_orphans.py`, `undo_p3_leftovers.py`, `run_p2g_verify.sh`, `run_p2g_full_tests.sh`

---

## ⚠ Read first

1. **No real email or alert went out during 2G.** (Verified)
   - The `monitor_alerts` count and the 3 watched Error Monitor rows are unchanged from the start of the session to now.
   - Every test email went to the test outbox: 151 were tagged, and 2 were untagged but went to test addresses.
   - Payment-provider hosts were never contacted over the network. All PayPal and Cashfree requests in the logs were in-process mocks.
2. **The full `backend/tests` run still leaves data behind.** (Verified)
   - The 6 older files changed in 2G clean up exactly. The other files in the folder were outside the 2G scope.
   - The last complete run (21:00–21:08) left 35 events, 14 organisations and related rows (section 4A).
   - Some earlier leftovers from this session are also still present (section 4B).
   - Nothing was removed, because removing it needs your OK.
3. **The last full run was not clean.** It had **19 failures and 1 setup error** (section 4C).
   - 2 of these are in `test_event_seo_og.py`. The page description is now cut short with "…", but the test expects the full sentence. This file was **not changed**: the handoff note said it had been, but `git` shows no change.
   - The `test_b22_recurring_sessions.py` clean-up fix lives in the shared helper `_inst_qa.py`. It was verified at 20:47 (125 passed, no leftovers), and b22/b23 also passed in the final run.

---

## 1. Summary

| # | Prompt 2G item | Status | Basis |
|---|---|---|---|
| 1 | Safe email and alert routing, enforced by the server | **Done** | Verified (phases 1, 2) |
| 2 | In-process monitoring tests don't touch real Error Monitor rows | **Done** | Verified (phases 1, 5 and the full runs) |
| 3 | The 24 SEO rows: investigate, don't delete | **Done.** All 24 are still present, byte for byte | Verified (sha256 before and now) |
| 4 | Older test files remove only the exact ids they created | **Done for the 6 files in scope.** Other files in `backend/tests` still leave data | Verified (phases 3, 3b, 6a) |
| 5 | Keep the 28-row payment-notification backup and its restore script | **Done.** The backup is intact and the table is unchanged | Verified (dry run at the start and now) |
| 6 | Verification | **Done, with failures:** the workflow suite is clean; `backend/tests` has 19 failures and 1 error | Verified |
| 7 | Report, then stop | This document. **I have stopped.** | – |

---

## 2. Evidence for each item

### Item 1: preview emails and alerts never reach a real inbox

**What changed** (Code-read):

**`backend/test_tag.py`**
- New `preview_holds_email(to)`. On a preview, it keeps an email in the test outbox when:
  - the run carries a signed test tag (any address), or
  - the address is a recognised test address, even **without** a tag.
- Recognised test addresses:
  - reserved domains (`example.*`, `.test`, `.invalid`, `.local`)
  - `@resend.dev`
  - `@nostopsqa.com`
  - demo accounts `*.demo@nostops.com`, `qa*@nostops.com`
  - the QA Gmail inbox
- "Preview" is decided by **this server's own environment** (APP_URL is a preview address and the database is local). The request can't change it.
- A deployed site, or a site using a managed remote database, behaves exactly as before.

**`backend/email_util.py`**
- `send_email` calls that check first. The safety gate still runs before it.

**`backend/monitoring.py`**
- On a preview, an Error Monitor alert is **never emailed**, tagged or not.
- The usual cooldown still applies. The alert is written to the test log (`kind: alert`) instead, and the error row is marked `preview_test_log`.
- No row is added to `monitor_alerts`, so the live alert quota of 20 per hour only counts real alerts.
- The admin "send test alert" button on a preview reports the alert as written to the test log.

**Website (`frontend/lib/server/test-tag.ts`)**
- Asks the backend before **every** email it sends.
- If the backend can't be reached, it falls back to "don't send" for tagged requests and test addresses.
- It uses the same address lists, and a test checks that they match the backend.

**Admin (`ErrorMonitorList.tsx`, `monitoring-admin.ts`)**
- Shows the new `preview_test_log` status.

**Checks:**

| Check | Result |
|---|---|
| Phase 1 offline set (2G + 2F + earlier payment and isolation files) | **1,449 passed**, 12 skipped (by design), 0 failed. Database: no change (`diff_1.txt`) |
| The 2F incident case: an untagged "Registration confirmed" email to `@nostopsqa.com` | Now kept in the outbox (reason `preview_project_test_domain`). The provider is never called |
| A real address on a preview; any address on a deployed site | Sent as before (provider stub called) |
| An alert on a preview, untagged | Goes to the test log, 0 `monitor_alerts` rows, cooldown respected |
| Website checks (image uploads, preview isolation, booking holds, checkout routing), `tsc`, `eslint` | All exit 0 |
| Phase 2 live tag suite against the running backend and website | **11 passed**: 9 requests tagged, 5 deliberately untagged or forged |
| Phase 2 effect | Outbox +5: 4 tagged, plus 1 untagged email to a test address that the new rule kept. Test log +2. Real alert rows: none |

### Item 2: the two in-process monitoring tests are isolated

- **New file `backend/tests/_scratch_monitor.py`:**
  - Both `conftest.py` files (`backend/tests` and `backend/tests/workflow`) now point the Error Monitor at an in-memory copy for every in-process test.
  - This covers `test_p0_freeze_gateway.py` and `test_p0_cashfree_diag.py`, the two files 2F left open.
  - The file has no `drop` call.
- **Phase 5:** `test_wf_monitoring.py` was run twice.
  - Isolated: 11 passed.
  - Shared configuration: 10 passed, 1 skipped (by design).
  - Database difference: **none** (`diff_5_*.txt`).
- **Full runs:**
  - The in-memory monitor handled 1,313 tests (workflow suite) and 3,564 tests (`backend/tests`).
  - It kept 8 event groups and 8 alerts off the real monitor.
- **The 3 watched real monitor rows are unchanged from 20:00 to now:**
  - `6a480bd83bb87a1ce3eba2f4` (withdraw RuntimeError)
  - `d038abc47697f48afe25b8e8` (cashfree diag 503)
  - `29ee9239558e4261cf99f158` (the 2F incident)

### Item 3: the 24 SEO rows (investigated, not deleted)

**Status:**
- All 24 are still present. The sha256 of the 24 rows is `331d0b0e…a38b` both at 20:00 and now.
- Their events do not exist (0 of 24).
- None is indexable, nothing else refers to them, and no current event uses their slugs.
- Full evidence: `seo_orphans_start.json`.

**Cause:** these test files removed their events but not the events' SEO rows.
- `test_regression_iter132.py` now removes them too (`drop_exact("inst_event_seo", …)`).
- `test_prompt5_cohort_e2e.py` now tracks them through the shared Tracker.
- After these fixes, neither file left SEO rows (phases 3b and 4a).

| Event id | SEO id | Row `_id` | Created (UTC) | Source file | Event created by |
|---|---|---|---|---|---|
| NOSTOPS-EVT-2026-001940 | NOSTOPS-SEO-2026-003593 | 6add86b512238e5b5d7a217d | 25 Oct 04:33:57 | test_prompt5_cohort_e2e.py | user_iter135_hr_caa8635e |
| NOSTOPS-EVT-2026-001941 | NOSTOPS-SEO-2026-003594 | 6add86b512238e5b5d7a2191 | 25 Oct 04:33:57 | test_prompt5_cohort_e2e.py | user_iter135_hr_caa8635e |
| NOSTOPS-EVT-2026-001942 | NOSTOPS-SEO-2026-003595 | 6add86b512238e5b5d7a21a5 | 25 Oct 04:33:57 | test_prompt5_cohort_e2e.py | user_iter135_hr_caa8635e |
| NOSTOPS-EVT-2026-001977 | NOSTOPS-SEO-2026-003645 | 6add86f512238e5b5d7a3221 | 25 Oct 04:35:01 | test_prompt5_cohort_e2e.py | user_iter135_hr_a27ce6f4 |
| NOSTOPS-EVT-2026-001978 | NOSTOPS-SEO-2026-003646 | 6add86f512238e5b5d7a3235 | 25 Oct 04:35:01 | test_prompt5_cohort_e2e.py | user_iter135_hr_a27ce6f4 |
| NOSTOPS-EVT-2026-001979 | NOSTOPS-SEO-2026-003647 | 6add86f512238e5b5d7a3249 | 25 Oct 04:35:01 | test_prompt5_cohort_e2e.py | user_iter135_hr_a27ce6f4 |
| NOSTOPS-EVT-2026-002000 | NOSTOPS-SEO-2026-003664 | 6add873112238e5b5d7a3f7b | 25 Oct 04:36:01 | test_regression_iter132.py | user_57805db4058c |
| NOSTOPS-EVT-2026-002002 | NOSTOPS-SEO-2026-003665 | 6add873112238e5b5d7a3fca | 25 Oct 04:36:01 | test_regression_iter132.py | user_57805db4058c |
| NOSTOPS-EVT-2026-002032 | NOSTOPS-SEO-2026-004487 | 6ae1878f5d7c6917c7aba074 | 28 Oct 05:26:39 | test_prompt5_cohort_e2e.py | user_iter135_hr_77015a48 |
| NOSTOPS-EVT-2026-002033 | NOSTOPS-SEO-2026-004488 | 6ae1878f5d7c6917c7aba088 | 28 Oct 05:26:39 | test_prompt5_cohort_e2e.py | user_iter135_hr_77015a48 |
| NOSTOPS-EVT-2026-002034 | NOSTOPS-SEO-2026-004489 | 6ae1878f5d7c6917c7aba09c | 28 Oct 05:26:39 | test_prompt5_cohort_e2e.py | user_iter135_hr_77015a48 |
| NOSTOPS-EVT-2026-002037 | NOSTOPS-SEO-2026-004491 | 6ae187955d7c6917c7aba2d2 | 28 Oct 05:26:45 | test_regression_iter132.py | user_57805db4058c |
| NOSTOPS-EVT-2026-002039 | NOSTOPS-SEO-2026-004492 | 6ae187965d7c6917c7aba321 | 28 Oct 05:26:46 | test_regression_iter132.py | user_57805db4058c |
| NOSTOPS-EVT-2026-002048 | NOSTOPS-SEO-2026-004518 | 6ae190e85d7c6917c7abe256 | 28 Oct 06:06:32 | test_prompt5_cohort_e2e.py | user_iter135_hr_dc63f895 |
| NOSTOPS-EVT-2026-002049 | NOSTOPS-SEO-2026-004519 | 6ae190e85d7c6917c7abe26a | 28 Oct 06:06:32 | test_prompt5_cohort_e2e.py | user_iter135_hr_dc63f895 |
| NOSTOPS-EVT-2026-002050 | NOSTOPS-SEO-2026-004520 | 6ae190e85d7c6917c7abe27e | 28 Oct 06:06:32 | test_prompt5_cohort_e2e.py | user_iter135_hr_dc63f895 |
| NOSTOPS-EVT-2026-002053 | NOSTOPS-SEO-2026-004522 | 6ae190ef5d7c6917c7abe47f | 28 Oct 06:06:39 | test_regression_iter132.py | user_57805db4058c |
| NOSTOPS-EVT-2026-002055 | NOSTOPS-SEO-2026-004523 | 6ae190ef5d7c6917c7abe4ce | 28 Oct 06:06:39 | test_regression_iter132.py | user_57805db4058c |
| NOSTOPS-EVT-2026-002063 | NOSTOPS-SEO-2026-004650 | 6ae1bee04ef50910b6c4f7f9 | 28 Oct 09:22:40 | test_regression_iter132.py | user_57805db4058c |
| NOSTOPS-EVT-2026-002065 | NOSTOPS-SEO-2026-004651 | 6ae1bee14ef50910b6c4f854 | 28 Oct 09:22:41 | test_regression_iter132.py | user_57805db4058c |
| NOSTOPS-EVT-2026-002066 | NOSTOPS-SEO-2026-004670 | 6ae1ee59823fdf2b7b084069 | 28 Oct 12:45:13 | test_regression_iter132.py | user_57805db4058c |
| NOSTOPS-EVT-2026-002068 | NOSTOPS-SEO-2026-004671 | 6ae1ee59823fdf2b7b0840cd | 28 Oct 12:45:13 | test_regression_iter132.py | user_57805db4058c |
| NOSTOPS-EVT-2026-002070 | NOSTOPS-SEO-2026-004781 | 6ae20e6e25d1b7a9a5e432e4 | 28 Oct 15:02:06 | test_regression_iter132.py | user_57805db4058c |
| NOSTOPS-EVT-2026-002072 | NOSTOPS-SEO-2026-004782 | 6ae20e6e25d1b7a9a5e43348 | 28 Oct 15:02:06 | test_regression_iter132.py | user_57805db4058c |

**How the source was identified:**
- **Title prefix:** `QA-ITER135-` comes from the cohort test (3 events per run); `QA-ITER132-` from the registration test (2 events per run).
- **Activity log:** each event's kept log shows who created and published it.
- **Count:** 12 rows from each file.

### Item 4: exact-id clean-up in the older test files

**The 6 files changed:**
- The 5 that 2F named: `test_qa18_teacher_lifecycle.py`, `test_prompt5_cohort_e2e.py`, `test_org_enquiries.py`, `test_special_needs_pathway.py`, `test_pathways_b11.py`
- Plus `test_org_enquiries_proposal.py`

**What changed in them:**
- Each file records the ids it creates.
- Every delete is now `delete_many({"_id": {"$in": ids}})`.
- No pattern or regex deletes are left. The only `$regex` left is a read of fixed demo data in `test_pathways_b11.py`.

**The shared Tracker (`_inst_qa.py`):**
- `purge()` **refuses** any id this test process did not create.
- It never records a teacher directory row that already existed.
- It now also removes the sessions and SEO rows of the events it created. This is the `test_b22_recurring_sessions.py` fix.
- It doesn't touch the money tables, and it keeps the activity log.

**Check:** `test_p2g_isolation.py` reads all 6 files and fails if any other kind of delete appears.

**Per-file runs** (each with snapshots before and after):

| File | Result | Left in the database |
|---|---|---|
| test_org_enquiries.py | 26 passed | 1st run: **5 rate-limit seed rows** (the clean-up missed them, then fixed). Re-run (3b): **nothing** |
| test_org_enquiries_proposal.py | 19 passed | nothing |
| test_pathways_b11.py | 12 passed | nothing |
| test_special_needs_pathway.py | 17 passed | nothing |
| test_prompt5_cohort_e2e.py | 1st run: 33 passed, 1 error (see note below). Re-run (3b): 33 passed | 1st run: **1 teacher offer** (NOSTOPS-TAS-2026-001390) and a changed QA event (NOSTOPS-EVT-2026-001916). Re-run: **nothing** |
| test_qa18_teacher_lifecycle.py | 11 passed | nothing |
| test_regression_iter132.py (phase 4a) | 20 passed | nothing (SEO rows now removed) |
| 2E failure-path check (phase 4b, now tagged) | 2 forced failures (on purpose) + 2 passed | 0 participant, registration, session or sign-in-link rows |
| b22/b23 after the Tracker fix (phase 6c) | 125 passed | nothing |

**Note on the 1st cohort run:** the engine offered that run's teacher an older open QA event. The run's clean-up then removed the teacher.

**Effects in every run (by design):** id counters and the activity log grow, and test emails go to the test outbox.

**Hard-delete safety** (Code-read and Verified):
- No test file in `backend/tests` or `workflow` deletes by pattern (grep: 0 files).
- The 6 remaining `drop` calls only remove throwaway databases or collections that the tests create themselves:
  - `nostops_qa_p2a_tmp`, `nostops_qa_p2b_tmp`, `nostops_qa_p2c_tmp`
  - `nostops_p2f_offline_<random>`, `nostops_wf_monitor_<random>`
  - `wf_digest_*` collections

### Item 5: the 28-row payment-notification backup

- **Backup file:** `/app/memory/backups/ai_onboarding_webhook_events_qa_p0_20261028T124227Z.json.gz`
- **Restore script:** `/app/test_reports/p2f/restore_webhook_backup.py`. A plain run is a dry run; only `--apply` inserts rows.
- **Dry run at 20:00 and again now:** "checksum OK; rows 28; content check OK; table rows now: 0; would insert: 28; nothing written".
- The table was not touched during 2G (`webhook_events_rows` unchanged in every snapshot).

---

## 3. Verification runs

| Phase (UTC) | What ran | Passed | Failed | Skipped | Expected failures | Database afterwards |
|---|---|---|---|---|---|---|
| 1 (20:04) | Offline set + website checks + tsc/eslint | 1,449 | 0 | 12 | – | no change |
| 2 (20:06) | Live test-tag suite | 11 | 0 | 0 | – | test sink only |
| 3 / 3b (20:06–20:13) | The 6 changed older files | all | 0 after fixes | – | – | see item 4 |
| 4 (20:13) | iter132 + 2E failure-path check | 20 + 2 | 2 (forced, on purpose) | – | – | counters / activity log only |
| 5 (20:14) | Monitoring, isolated and shared | 11 / 10 | 0 | 0 / 1 | – | no change |
| 6 workflow (20:15–20:24) | `backend/tests/workflow`, all files | **1,232** | **0** | 9 | 91 | activity log, captcha, +2 `verification_identity`, test sink; the protected event NOSTOPS-EVT-2026-000001 changed |
| 6a final (21:00–21:08) | `backend/tests` (4 share-image tests left out, see 4D) | **3,555** | **19 + 1 error** | 20 | – | **left data (4A)** |

Phase 6's first `backend/tests` attempt stopped at collection, so no test ran: two files need the preview URL at import. Two later attempts (20:26 and 20:49) were cut short when the whole environment restarted during the share-image tests, which killed their clean-ups.

**Requests the test process sent in the final run** (`net_6a_tests_full.jsonl`):
- 3,369 requests in total.
- **2,094** used the real network:
  - 1,357 to localhost and 716 to this preview's website: all carried a valid tag.
  - 5 to 127.0.0.1: all tagged.
  - **16 untagged to the live main backend** (`pro-learn-connect-1.emergent.host`): 5 logins and 11 reads. The tag is never forwarded there, by design.
- No write to the live main backend.
- All PayPal (sandbox and live host names) and Cashfree requests were in-process mocks. None reached the network.

---

## 4. Open issues (each needs your OK before I act)

### 4A. Data left by the final `backend/tests` run (files outside the 2G scope)

**Created at 21:02–21:07 UTC and still present:**
- **35 events:** NOSTOPS-EVT-2026-002142 to 002168, 002170 to 002175, 002232, 002233
- **14 organisations:** NOSTOPS-ORG-2026-000975 to 000983, 000985, 000993, 000994, 001013, 001014. Each has its member row (NOSTOPS-MBR-… with the same numbers).
- **22 SEO rows** for those events
- **3 teacher offers:** NOSTOPS-TAS-2026-001431 to 001433
- **3 teacher directory rows:** qa_cf_t_a_6d78ed, qa_cf_t_d1_9f6068, qa_cf_t_d2_cc7972
- **1 participant:** NOSTOPS-PTP-2026-000149 (`delivered+qa-ptp-req-…@resend.dev`), with 1 sign-in link

**Also changed:** the protected fixture event NOSTOPS-EVT-2026-000001 (its fingerprint changed; which fields changed was not recorded).

**Note:** one leftover QA event is **PUBLIC and indexable in this preview**: NOSTOPS-EVT-2026-002171 "Yoga for Focus P5 Trust Signals".

**Source files** (matched by title and organisation name):

| File | Leftovers |
|---|---|
| `test_institutional_prompt3_configure_pytest.py` | QA P3Cfg events and organisation |
| `test_institutional_prompt3_drafts_pytest.py` | QA Draft / Dup / Usage / Admin / Coord / Matrix events, QA P3Drafts organisation |
| `test_institutional_prompt3_pytest.py` | TEST_qa_prompt3_v1_freeze |
| `test_institutional_prompt5_pytest.py` | QA P5 events, P5 Trust Signals, QA P5 Seed Org |
| `test_institutional_prompt5_iter2_pytest.py` | QA P5-R2, "Yoga for Focus TCS Mumbai" |
| `test_teacher_confirm_first.py` | QA CF events, organisations, offers and teachers |
| `test_institutional_12_checklist.py` | T1 organisations |
| `test_phase_a_oea.py` | QA PhaseA organisations |
| `test_event_seo_og.py` | Acme Mind Labs organisation and its 3 events |

**Not confirmed:** which file created the participant.

**Proposed next step (not done):** move these files onto the same exact-id Tracker. Then remove the 4A rows by their exact ids, after a backup.

### 4B. Leftovers from this session's earlier runs (still present)

**Script:** `undo_p3_leftovers.py`. A plain run is a dry run; it was re-run now and matches. Only `--apply` writes, and it backs up first and acts on exact ids. It would:
- Remove the 5 `org_enquiries` rate-limit seed rows (`test-rl-…`).
- Remove the offer NOSTOPS-TAS-2026-001390 and put back 3 fields on NOSTOPS-EVT-2026-001916.
- Remove the **4 SEO rows whose events no longer exist** (NOSTOPS-EVT-2026-002119, 002122, 002123, 002124). All 4 are marked **indexable**. They were left by b22/b23 runs before the Tracker fix.
- Remove the 24 sessions of those 4 events.

**This does NOT touch** the 24 older SEO rows or the 28-row backup.

### 4C. The 19 failures and 1 error in the final `backend/tests` run (not investigated in 2G)

| Group | Count | Failing tests | Cause shown in the log |
|---|---|---|---|
| Preview write lock or money lock answers 423 | 11 | `csrf_bff_test` valid double-submit; `test_iter13_media_roster` upload token; `test_iter9_features` wallet (7 tests); `test_prompt_group3_iter130` governance POST; `test_teacher_onboarding_iter10` AI bio | The 423 comes from the preview lock (2D) and `MONEY_OPS_FROZEN`. The tests still expect 200 or 403 |
| Date-dependent reminders | 3 | `test_prompt6_sec_11_12_16` | Ran after midnight India time, so "tomorrow" moved by a day |
| SEO description text | 2 | `test_event_seo_og` | The page description is cut at about 160 characters with "…". The tests expect the full sentence |
| Teacher state | 2 | `test_prompt_group2_iter129` roster; `test_teacher_confirm_first` confirmed event | The event shows TEACHER_UNAVAILABLE instead of TEACHER_CONFIRMED |
| Venue submit | 1 | `test_public_venue_submit` | The form now requires a photo (400) |
| Setup error | 1 | `test_institutional_prompt6_participant` anti-poaching | Detail not captured |

**Not established:** whether these failures existed before 2G. There is no earlier full run of this folder under the current locks to compare with.

### 4D. Four share-image tests left out

`test_event_seo_og.py`: `test_og_images_resolve`, `test_share_card_png`, `test_share_card_missing_slug_generic` and `test_register_images` were deselected. Each time they ran, the environment restarted (20:26 and 20:49 UTC).

### 4E. Earlier open items, unchanged

- About 91 expected failures (known main-backend defects) are still deferred.
- Prompt 3 (PayPal and payments) is still blocked pending your explicit approval.

---

## 5. Files changed in 2G

- **Backend:** `test_tag.py`, `email_util.py`, `monitoring.py`
- **Tests, changed:** `tests/conftest.py`, `tests/workflow/conftest.py`, `tests/_inst_qa.py`, `tests/_test_tag.py`, `tests/workflow/_wf.py`, `tests/workflow/test_wf_monitoring.py`, `tests/workflow/test_wf_p2f_isolation.py`, `tests/test_p2f_test_isolation.py`, `tests/test_regression_iter132.py`
- **Tests, the 6 older files:** see item 4
- **Tests, new:** `tests/_scratch_monitor.py`, `tests/test_p2g_isolation.py`
- **Website:** `lib/server/test-tag.ts`, `lib/server/monitoring-admin.ts`, `components/app/admin/ErrorMonitorList.tsx`
- **Standalone scripts that now load the signed tag before any request:** 8 `backend/test_*_flow.py` / `test_institutional_*.py` scripts, `scripts/qa_venue_pending_flow.py`, the 2E failure-path check, and 2 `b43_audit` scripts

**I have stopped here for your review.**
