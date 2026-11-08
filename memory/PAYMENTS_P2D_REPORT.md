# NOSTOPS Payments — Prompt 2D: Isolate Preview, Audit Test Side Effects, Close Booking Defects (deliverable report)

**Status:** done in **preview only**. Nothing was published or deployed, and no production setting was changed.
**Money lock:** ON. `FINANCIAL_ACTIONS_UNLOCKED` is absent, so `financial_lock.locked()` returns `True`. Wallet top-up and payouts are still refused (423).
**Checkout:** still off in preview (503 test mode). PayPal checkout is still off everywhere (503).
**External main backend (`pro-learn-connect-1`):** not modified. No record was created, changed or deleted there by this work.
**Prompt 3:** not started. It needs your review and explicit approval.
**Test registrations 000272 / 000289:** found and reported (section 2). **Not deleted or changed** — that needs your approval.
**Dates:** container clock, 28 Oct 2026 (UTC).

---

## 1. Preview can view, not save (fail-closed preview write guard)

**Rule:** any request that comes in through a preview, local or unknown host and would **write** to the real main backend (POST, PUT, PATCH, DELETE) is refused **before anything is sent**: HTTP **423**, header `X-Nostops-Preview-Read-Only: 1`, body `preview_read_only: true` and *"Preview mode: saving is turned off in this preview, so nothing was sent to the live NOSTOPS system. This works on the live site."*

- **Allowed from preview:** reads (GET / HEAD / OPTIONS) and signing in and out only. These are exact paths, with no look-alikes: `auth/login`, `auth/logout`, `auth/session`, `auth/otp/start`, `auth/otp/verify`, `admin/totp/verify`.
- **Fail closed:** if there's no host, or no request context, the request is treated as preview.
- **Production hosts** (`www.nostops.org`, `*.emergent.host`) are not affected. Requests are never redirected to another backend.
- **Order kept:** the money lock (423), the provider routing and billing-country checks (400/403/410/422) and the preview payment guard (503) still answer first. The preview write guard catches everything they let through.

| Layer | Where | What it covers |
|---|---|---|
| `/api` gateway | `backend/preview_isolation.py`, called in `backend/server.py` `proxy()` | Every upstream write, including the PayPal notification route, which is refused before its handler runs |
| Website server (BFF) | `frontend/lib/server/preview-isolation.ts`, called in `backendFetch()` (`lib/server/session.ts`) and `forward()` (`lib/server/bff.ts`) | Every BFF write to the main backend |
| Direct `fetch` to the main backend | `app/bff/institutional/participant/payment/order/route.ts` | The only direct write `fetch` to `BACKEND_BASE` (the event-fee Cashfree order). The other direct `fetch` is a GET (order status in `lib/server/participant.ts`). |

**What this changes compared with 2C:** the retreat group hold and the group-batch enrolment used to reach the real main backend from preview. They are now refused with 423, and nothing is written upstream.

**Not covered on purpose (not the main backend):** this website's own engine (`/api/institutional/*`, venues, verification, monitoring) writes to **this preview's own database**. That is how the two test registrations in section 2 were created.

**Evidence:**
- **Offline, gateway** (`test_p2d_preview_isolation.py`, mock upstream that records every call): 0 upstream writes from preview. The same write on production is forwarded once, unchanged. Sign-in look-alikes are refused, reads still work, and the money lock and payment guard still answer first.
- **Node, BFF** (`verify_preview_isolation.ts`): **97/97** checks pass. Real route handlers are used, and every network call is intercepted.
- **Live preview** (`test_p2d_preview_live.py`): canary writes return 423 with the header. Each canary is something the main backend would reject anyway (made-up ids, invalid tokens), so even a guard failure couldn't create a record. Sign-in still reaches the main backend, and reads still work.

## 2. The two test-event registrations

Both are in **this preview's own website database** (`nostops_web.inst_registrations`). They are **not** in the main backend.

| Field | `NOSTOPS-REG-2026-000272` | `NOSTOPS-REG-2026-000289` |
|---|---|---|
| Created (UTC) | 28 Oct 2026 05:26:46 | 28 Oct 2026 06:06:39 |
| Event | `NOSTOPS-EVT-2026-000001` (QA audit event) | same |
| Organisation | `NOSTOPS-ORG-2026-000001` | same |
| Participant | "Iter132 QA" (`QA-PTP-96E6354877`) | "Iter132 QA" (`QA-PTP-47EEA31431`) |
| Status | CONFIRMED / CONFIRMED | CONFIRMED / CONFIRMED |
| Pricing / payment | FREE / NOT_REQUIRED | FREE / NOT_REQUIRED |
| Amount / order | none / none | none / none |

- **What created them:** the existing regression test `backend/tests/test_regression_iter132.py` (step D, "participant magic-link register (FREE)"). It runs against this preview's engine and registers a new QA participant each run.
- **Money:** none. No place was held for a payment, no order exists, and no money moved.
- **Since 06:06 UTC:** no new registrations. The latest is still `000289`. The 2D test runs (offline, live refusal and the full workflow suite) created none.
- **Older ones:** the preview database holds **12** "Iter132 QA" registrations in total, from earlier runs, all FREE.
- **Left untouched**, as you asked. These options need your OK:
  - (a) keep them as they are;
  - (b) mark them as test records;
  - (c) delete them;
  - (d) change `test_regression_iter132.py` so it removes its own registration after it runs.

## 3. Booking defects closed

### A. No reservation once a retreat has started (server-side)
- **Where:**
  - Gateway: `backend/retreat_eligibility.py`, run in `server.py` before the preview guard.
  - BFF: `frontend/lib/server/retreat-eligibility.ts`, in `bff/retreats/[id]/reserve` and `bff/retreats/[id]/group-book`.
- **Rule:** the start date is read from the retreat's own record on the server. A date sent by the client is **never** used.
  - The start is judged in the retreat's time zone (`timezone` / `time_zone`). The default is Asia/Kolkata.
  - A date-only start means midnight local time on that day.
  - Once that moment has passed, the request is refused with **409 `retreat_started`**: *"This retreat has already started, so seats can no longer be reserved. Nothing has been reserved."*
- **Fail closed:**
  - Missing or unreadable date or time zone → **409 `retreat_dates_unavailable`**.
  - Retreat not found → **404**.
  - Lookup error or unreachable → **503**.
  - Nothing is held in any of these cases.
- **Live proof:** `rt_e8715c9ed0` started on 13 Sep 2026 and was still listed with seats. A group hold is now refused with 409 `retreat_started` through both the gateway and the BFF. An upcoming retreat can still be reserved; this was checked offline on a production host.
- **Not fixed upstream:** the main backend itself still accepts such holds from direct callers (mobile app, scripts). Remediation item **R11** in section 7.

### B. Waitlist: request checks, rate limits and CSRF (sold-out retreats only)
`frontend/app/bff/retreats/[id]/waitlist/route.ts` now checks the following on the server, before anything is sent:

| Check | Result when it fails |
|---|---|
| Retreat id format | 404 |
| A browser request marked cross-site (`Sec-Fetch-Site: cross-site`) | 403 `cross_site` |
| JSON only | 415 |
| Body at most 2 KB | 413 |
| Name 2–120 characters, no control characters | 400 `invalid_name` |
| Strict email format | 400 `invalid_email` |
| Phone optional, `+` and 5–20 digits | 400 `invalid_phone` |
| Rate limits: 5 per IP per 10 minutes; 2 per email per retreat per day | 429 `rate_limited` |
| Retreat read on the server, and it must have **no seats left** | 409 `seats_available` |
| Retreat can't be read | 503 |

- **CSRF:** the visitor's session is attached **only** with a matching double-submit CSRF token. Without one, the sign-up is sent with no session, so a forged request can't act as someone's account.
- **Preview:** the sign-up itself is then refused by the preview write guard (423).
- **Limitation:** the rate limits are kept per server instance and reset on redeploy. They are a coarse gate, the same as the public photo upload. The main backend should enforce its own limits too (**R12**).

## 4. Monitoring test reliability (`test_wf_monitoring.py`)

- **Before the run:** 3 alerts had been recorded in the last hour. The normal cap is 20 per hour (`MAX_ALERTS_PER_HOUR = 20`), and it was not changed or patched.
- **Result:** the unmodified file passed **3 runs in a row, 9/9 each** (08:34–08:35 UTC). It passed again inside the full workflow run (section 6).
- **Cause of the 2C failure (confirmed):** the cap is **global**. Every test and every real error in the same hour count towards it. `test_identical_errors_group_into_one_row_and_alert_once` expects exactly one alert to be sent, so it fails whenever 20 or more alerts were recorded in the previous hour. That happened in 2C under heavy test traffic.
- **Still possible:** at the end of today's full run, 17 of the 20 slots were used.
- **Not a code defect in `monitoring.py`.** Suggested test-only fix, **for your OK:** that one test should use its own cap or a throwaway alerts collection, as `test_hourly_alert_cap_stops_a_storm` already does. Nothing was changed.

## 5. The 94 "known main-backend defects", classified

**Summary:**
- The 94 are **94 expected-fail test cases**, not 94 defects. They cover **19 distinct issues**:
  - **15** in the main backend: 9 code defects, 5 data or policy items, and 1 missing test account;
  - **4** in this website's own code. These were mislabelled as main-backend defects.
- **37** of the 94 cases are exact duplicates: the same endpoint and caller tested twice. The other **57** cases are distinct checks, and they come down to the 19 issues (section 5a).
- **All 94 reproduced in today's run (28 Oct 2026).** The suite uses strict expected-failure, so a fixed issue would show as an unexpected pass and turn the run red. None did.
- **Severity:**

| Severity | Issues | Test cases |
|---|---|---|
| P0 | 6 | 80 |
| P1 | 3 | 3 |
| P2 | 5 | 6 |
| P3 | 5 | 5 |

| # | ID | Issue | Owner | Affected endpoint(s) | Cases | Duplicates / root cause | Severity | Verifiability |
|---|---|---|---|---|---|---|---|---|
| 1 | TVR-01 | Admin data served to non-admins | Main backend | `/admin/{disputes/pending, empanelment/pending, kyc/queue, lineage/pending, refunds/pending, users/recent}`, `/dashboards/admin-stats-live` (learner, teacher, HR, guru); `/admin/broadcast-history` (guru) = 29 route×role pairs | **66** | 29 unique pairs. `test_wf_b511…` repeats all 29, and `test_wf_live_backend_readonly` repeats 8 (kyc/queue, empanelment/pending). One root cause: no router-level admin check | P0 | Verified (read-only GETs with demo accounts) |
| 2 | — | Parameter check runs before the admin check (non-admin gets 422, not 403) | Main backend | `/admin/people/teachers?limit=1000` | 2 | Same root cause and same fix as #1 | P2 | Verified |
| 3 | — | Admin CSV export shadowed (404 for admins) | Main backend | `/admin/beta-feedback/export.csv` (caught by `/{feedback_id}`) | 1 | — | P3 | Verified |
| 4 | B4.7-C | Public responses carry restricted teacher fields (phone, etc.) | Main backend | `/teachers/directory`, `/teachers/featured`, `/teachers/teacher-of-month`, `/teachers/matching`, `/council/members`, `/venue-partners`, `/teachers/public/{handle}`, `/yoga-teachers/{id}` | 8 | One root cause: no public serializer | P0 | Verified (field scan) |
| 5 | — | Full API schema public | Main backend | `/openapi.json`, `/docs` (`/redoc`) | 1 | — | P2 | Verified |
| 6 | B4.7-IDOR | Another teacher's earnings, wallet and withdrawals readable | Main backend | `/v1/stats/teacher/{id}` | 3 | Same defect: anonymous, teacher, learner | P0 | Verified |
| 7 | B4.7-IDOR | Any account's company and location readable anonymously | Main backend | `/users/{user_id}` | 1 | — | P0 | Verified |
| 8 | FIN-04 | Teacher wallet doesn't match its ledger (₹2,212 gap) | Main backend | teacher wallet and ledger (teacher.demo) | 1 | — | P0 | Verified, read-only |
| 9 | FIN-05 | 15% fee taken at credit and again at withdrawal | Main backend + your decision | wallet / withdrawals | 1 | — | P0 | Verified, read-only |
| 10 | TVR-02 | QA/test retreats still published (hidden on the website only) | Main backend data | `GET /retreats` | 1 | Data clean-up, together with #11 | P1 | Verified |
| 11 | NST-017 | Duplicate Ganesh Baug retreats (same title and dates) | Main backend data | `GET /retreats` | 1 | Same clean-up as #10 | P2 | Verified |
| 12 | TVR-03 | Legacy public retreats have no venue record | Main backend data | `GET /retreats` (`venue_partner_id` null) | 1 | — | P1 | Verified (new retreats need a venue) |
| 13 | TVR-11 | Most public teachers have city "India" or blank | Main backend data | `/teachers/directory` | 1 | — | P2 | Verified |
| 14 | NST-011 / TVR-12 | Demo/test teacher profiles public | Main backend data / your decision | `/teachers/directory` | 1 | — | P2 | Verified |
| 15 | TVR-09 | No Level-1 (non-hosting) teacher test account | Test data | `/retreats/host-eligibility` | 1 | Not a code defect | P1 | **Not verifiable** until an L1 account exists |
| 16 | TVR-20 | Venue capacity has no bounds | **This website** (`venues.py`) | `/api/venues/public-submissions` (+ edits) | 1 | — | P3 | Verified (local) |
| 17 | TVR-22 | Venue dedupe has no unique index | **This website** | `venue_submissions` | 1 | — | P3 | Verified (local) |
| 18 | TVR-21 | Small edits that flip the meaning still auto-publish | **This website** | venue live edits | 1 | — | P3 | Verified (local) |
| 19 | TVR-15 | Upload type trusted from the declared content type | **This website** (BFF) | cover photo upload | 1 | — | P3 | Verified (local) |

### 5a. How 94 cases come down to 19 issues
| Step | Cases |
|---|---|
| Expected-fail cases in today's run | 94 |
| Minus exact duplicates: TVR-01 pairs that `test_wf_b511…` repeats from `test_wf_b47…` | −29 |
| Minus exact duplicates: TVR-01 pairs that `test_wf_live_backend_readonly` repeats | −8 |
| **Distinct checks (endpoint × caller)** | **57** |
| TVR-01: 29 route×role checks, one missing admin check | 29 → 1 issue |
| #2: 2 callers | 2 → 1 |
| B4.7-C: 8 endpoints, one missing public serializer | 8 → 1 |
| IDOR #6: 3 callers | 3 → 1 |
| The 15 other rows: one case each | 15 → 15 |
| **Distinct issues** | **19** (TVR-01 and #2 share one fix; TVR-02 and NST-017 share one clean-up) |

### 5b. What can't be verified here
- **Write-side behaviour of the main backend:** no staging copy exists, and writes from preview are now blocked by design.
- **TVR-24** (two simultaneous venue checkouts can create two orders): not among the 94. It is **skipped**, because it runs only against the Cashfree sandbox and there are no sandbox keys.

## 6. Test results (actual counts, this session's final runs)

| Suite | Passed | Failed | Skipped | xfailed |
|---|---|---|---|---|
| Offline payment, hold and isolation suites (11 files: `test_p2d_preview_isolation`, `test_p2c_booking_holds`, `test_p2b_checkout_routing`, `test_p2a_payment_routing`, `test_p0_freeze_gateway`, `test_p0_inbound_payments`, `test_p0_razorpay_callback`, `test_p0_cashfree_diag`, `test_cashfree_sandbox_guard`, `test_p0_encoded_delimiter_bypass`, `test_participant_paid_payment_chain`) | **1324** | 0 | 13 | – |
| Live preview refusal-only (`test_p2d_preview_live`, `test_p2c_hold_live`, `test_p2b_bff_live`, `test_p2b_gap_checks`, `test_p2a_http_live`) | **273** | 0 | 0 | – |
| Full workflow suite (`tests/workflow`, 27 files, 9 min 51 s) | **1187** | **0** | 9 | 94 |
| Monitoring test alone, normal cap, 3 runs | 27 (9/9 × 3) | 0 | 0 | – |
| **Total** | **2811** | **0** | **22** | **94** |

| Website check | Result |
|---|---|
| `verify_preview_isolation.ts` | **97/97** |
| `verify_booking_holds.ts` | **196/196** |
| `verify_checkout_routing.ts` | **291/291** |
| `tsc --noEmit` | 0 errors |
| ESLint, all changed files | 0 issues |

Skipped (with reason):
- **13 offline:** 12 reviewed `LEFT_OPEN` routes that record no money, plus 1 check that runs only on production or sandbox.
- **9 workflow:** 8 Cashfree sandbox-only order tests, plus the wallet page, which is gated for the unverified demo teacher.

Logs: `/app/test_reports/p2d/*_final.log`, `/app/test_reports/p2d/workflow_full.log` and `monitoring_normal_limit.log`. JUnit: `/app/test_reports/pytest/p2d_workflow_full.xml`.

### 6a. Older tests updated because preview is now view-only
Every "nothing was sent or created" assertion was kept.

- **`test_p2a_payment_routing.py`:**
  - The PayPal notification sent through the **preview** gateway now expects **423** (`preview_read_only`) and 0 upstream calls. On production it still expects 503 `not_configured`.
  - The "missing setting" and "unsigned" checks now also run the webhook handler directly, so they still prove 503 `not_configured` and 400 `unsigned` with 0 PayPal or upstream calls.
- **`test_p2a_http_live.py`:** localhost counts as a local host, so it expects 423. The production 503 is covered offline.
- **`test_p0_freeze_gateway.py`:** the mock upstream now answers the retreat read with a future start date. The seat-hold test expects that read, followed by exactly one forwarded write.
- **`test_p2c_booking_holds.py`:** the same retreat read. The group hold and group-batch enrolment in preview now expect 423 with no upstream write.
- **`test_p2d_preview_live.py`:** each run now uses a fresh canary email, so the per-email limits don't trip on re-runs. A main-backend login lockout (429 "Too many login attempts") is accepted as proof that the sign-in reached the main backend.

## 7. Remaining blockers and decisions for you

**Additions to the main-backend remediation list (R1–R10 are in the 2C report):**

| # | Endpoint(s) | Required behaviour |
|---|---|---|
| **R11** | `POST /retreats/{id}/reserve`, `POST /retreats/{id}/group-book` | Refuse a hold once the retreat has started, using the retreat's own start date and time zone. Direct callers bypass the website. |
| **R12** | `POST /retreats/{id}/waitlist` | Its own validation, a sold-out-only rule and rate limits for direct callers. |

**Main-backend fixes (owner of `pro-learn-connect-1`):**
- TVR-01 together with #2: one router-level admin check.
- B4.7-C public fields.
- The two IDORs.
- FIN-04 / FIN-05. These need your decision on the fee.
- Turn off the public API schema.
- The export route order.
- Data clean-up: TVR-02, NST-017, TVR-03, TVR-11, TVR-12.

**Decisions waiting for you:**
- The 2 test registrations (section 2, options a–d).
- The monitoring test-only fix (section 4).
- Whether to fix the 4 website-side items (TVR-15, TVR-20, TVR-21, TVR-22).
- Still open from 2C:
  - `test:tier2`: 2 stale checks.
  - Group mode on a 390 px phone: the page is 8 px wider than the screen.
  - WhatsApp opens with no recipient (R8).

**Blocked:**
- Prompt 3 (PayPal), waiting for your approval.
- A real Cashfree order: the money lock, the preview guard and no sandbox keys.
- Main-backend write-side behaviour: no staging copy, and preview is view-only.
- Phase 4 Google indexing.
- Guru Nominations.
- B4.9 Payouts and Billing.
- B5.2 Tax/Legal wording.

**Behaviour change to accept:** the preview can no longer save anything to the main backend. Examples:
- creating retreats, editing profiles, bookings, group holds and enrolments, sign-ups and password resets;
- the waitlist.

In preview these show the "Preview mode" message, and they still work on the live site after an approved publish. This follows your "preview can view, not save" decision. Sign-in, sign-out and every page read still work in preview.

## 8. Financial lock and "nothing real happened"
- **Lock and checkout:** the lock is ON, checkout is off in preview, and PayPal checkout is off. No `.env` value, deployment or publish was changed.
- **Main backend:** the only calls were reads, demo sign-ins and refused canaries.
  - The canaries targeted made-up ids, so the main backend would have rejected them even without the guard.
  - The 423 guard answered first.
  - No money moved. No historical financial record was changed.
- **This preview's own database (side effects disclosed).** Since the 08:12 UTC snapshot, existing tests wrote:
  - QA rows in `verification_*`, `captcha_consumed` and `inst_event_audit_log` (workflow suite, local engine);
  - 2 `ai_onboarding_webhook_events` rows, status `ignored` / `unknown_order` (inbound-payment fixtures).
  - These link to no order and no money, and were left in place.
  - In the money tables (`payment_routing_decisions`, `ai_onboarding_orders`, `inst_settlements`, `audit_ledger`, `webhook_events`, `paypal_webhook_events`) **all counts are 0**. No registration is pending payment or has an order.
- **Alert emails:** the error monitor recorded **17 alerts** in the last hour (08:12–08:43 UTC). They came from test traffic: refusals and rate-limited QA emails.
  - Some went to the monitor's own alert inbox, and the rest show as failed.
  - The monitoring test's own alerts were captured by a fake sender and not emailed.
  - **No customer was emailed.**
