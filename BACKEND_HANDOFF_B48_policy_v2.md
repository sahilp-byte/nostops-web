# HANDOFF — Main backend: Empanelment Policy V2 alignment (B4.8 final)

**For:** the main-backend team (`pro-learn-connect-1`). **From:** NOSTOPS web workspace, 2026-06.
**Why:** the website now enforces Empanelment Policy V2 (`EMPANELMENT_POLICY_V2_2026_06`) in its own server
(BFF + local engine). The main backend still runs its **own, older rules** and accepts **direct writes** that skip
V2. Until the items below ship, anyone calling the main backend directly can empanel a teacher without V2.
**Nothing in this list was changed by us.** We only logged in and made read-only GET calls.

**Reference implementation you can port as-is:**
- `/app/backend/empanelment_policy.py`: pure evaluator `evaluate_free_path`, state machine `transition`, reason rules
  `decline_reason`, activation check `approval_on_record`, legacy classifier `classify_existing`.
- `/app/backend/tests/workflow/test_wf_b48_policy.py`: 139 tests. The pure-function tests run with no database.

**Prerequisite:** TVR-01 (admin authorisation on every `/admin/*` route) from `BACKEND_HANDOFF_B47_main_backend.md`.
Every admin-only item below assumes TVR-01 is live.

---

## 0. The rules to enforce (founder-approved)
| # | Rule | Exact counting |
|---|---|---|
| R1 | 5 successful 1:1 sessions | A 1:1 session counts when its status is `session_completed` or `completed`. **Free completed sessions count** (paid-only is NOT approved: keep a `REQUIRE_PAID_SESSIONS=false` switch). A session with an amount > ₹0 counts only if **the backend recorded the captured payment**. Never counted: refunded sessions, mock/test-card payments, group sessions, sessions with yourself, duplicate records. |
| R2 | 10 genuine reviews | At most **one per learner** (their latest by `created_at`). The learner must have a **completed session with this teacher** (R1 sense). Never counted: the teacher's own review, unpublished/hidden reviews, reviews with no NOSTOPS learner account, ratings outside 1–5 (also booleans/strings). |
| R3 | Average ≥ 3.5★ | Over R2's counted reviews only. 0 reviews = not met. |
| R4 | Majority positive | **More than half** of R2's counted reviews at **≥ 3★**. Exactly half fails. 0 reviews = not met. |
| R5 | Council interaction | Recorded by a person with role guru / council / admin: `held_on` (date, not after today in **India time**), `format` ∈ {`video_call`,`phone`,`in_person`}, `summary` 15–1000 chars, `confirm=true`. |
| R6 | Explicit decision | Guru / council / admin. `outcome` APPROVE / DECLINE, `note` 15–1000 chars (the teacher sees it), `confirm=true`. APPROVE needs R5 and **re-checks R1–R4 at decision time**. |
| R7 | Admin activation | A **separate** step by an **admin** who confirms they checked the recorded approval. Only this step sets `is_empanelled=true`. |
| R8 | "Not approved" before R5 | Needs a reason from this fixed list: `FALSE_EVIDENCE`, `SAFETY_CONDUCT`, `TEACHER_WITHDREW`, `DUPLICATE_ACCOUNT`. Incomplete progress is **not** a reason. After R5, a decline is a merit decision (`MERIT_DECISION`). |
| FT | Fast-Track (₹4,999) | Buys a **priority 30–45 min interview only**; that interview is R5. R1–R4 do not apply. Approval needs the interview to be scheduled **and its time passed**, `interview_completed=true`, a summary ≥ 15 chars, a note ≥ 15 chars and `confirm=true`. Payment alone never approves and never grants a badge. Then R7 applies. |

**Never automatic:** KYC, session completion, payment, ratings, sweeps and crons may make a teacher *eligible*; they
must never set `is_empanelled`.

---

## 1. Change list (exact)

### MB-01 · P0 · Stop self-nominated instant empanelment
**Today:** `POST /api/teachers/me/apply-free-empanelment` checks "5+ paid sessions with a 4.0+ average" and **flips
`teachers_native.is_empanelled = true` immediately**. This is a direct bypass of V2. (The website never calls it.)
**Change:** this endpoint must never set `is_empanelled`. Either:
- (a) return `410 {"detail":"use_policy_v2"}`, or
- (b) run the V2 evaluator. If R1–R4 are not all met, return `409 merit_requirements_not_met`. If they are met, open
  a case in `AWAITING_COUNCIL_INTERACTION` (same as MB-04 apply).

### MB-02 · P0 · V2 numbers in progress endpoints
**Today:** `GET /api/teachers/me/empanelment-progress` and `GET /api/teachers/me/onboarding-state` use 5 paid
sessions + 4.0★, and expose `free_track_eligible`.
**Change:** compute R1–R4 exactly as in §0. Return:
`{policy_version, requirements:[{key,label,value,target,met,(of)}], merit_met, excluded:{reason:count}}`
with keys `successful_sessions`, `genuine_reviews`, `avg_rating`, `majority_positive`. If `free_track_eligible` is
kept, it must equal `merit_met` and must never be used to grant anything.

### MB-03 · P0 · Gate the admin grant
**Today:** `POST /api/admin/empanelment/{teacher_id}` `{is_empanelled:true, reason?}` grants directly.
**Change:**
- `is_empanelled:true` needs `policy_case_id` that points to a case in `APPROVED` with these on record:
  an interaction, a last decision `APPROVE` by a guru/council/admin with a `reviewer_id`, and an admin caller.
  Otherwise return `409 approval_required`.
- The grant stamps `empanelled_at` (UTC now), `empanelment_policy_version`, `empanelment_case_id` and `activated_by`.
  It moves the case to `ACTIVATED`.
- `is_empanelled:false` (revoke) stays admin-only and now needs `reason` ≥ 15 chars. Write an audit row.
- A second activation returns `409 already_activated`.

### MB-04 · P0 · Host the decision workflow (recommended), or verify ours
Today the V2 cases live in the website's local store (`empanelment_policy_cases`, `empanelment_policy_audit`).
Pick one (open decision D-6 in the report):
- **(A, recommended)** Port the workflow into the main backend so it is the single authority:

| Endpoint | Who | Rules / errors |
|---|---|---|
| `POST /api/empanelment/cases` (apply) | teacher (own record) | 409 `merit_requirements_not_met` · returns the open case if one exists (idempotent) · 409 `already_approved` |
| `POST /api/empanelment/cases/{id}/interaction` | guru/council/admin | R5 · 400 `explicit_confirmation_required` · 422 `interaction_date_in_future` · 409 `interaction_already_recorded` · 409 `case_closed` |
| `POST /api/empanelment/cases/{id}/decision` | guru/council/admin | R6 + R8 · 409 `council_interaction_required` · 409 `merit_requirements_not_met` · 422 `documented_reason_required` / `unknown_reason` · 409 `case_closed` |
| `POST /api/empanelment/cases/{id}/activate` | **admin only** | R7 · `confirm_checked_approval=true` · 409 `approval_required` / `already_activated` |
| `GET /api/empanelment/cases` | guru/council/admin | queue with evidence and audit |
| `GET /api/teachers/me/empanelment-case` | teacher | status, interaction date, outcome, the **note only**. Never reviewer ids/names, reasons or internal summaries. |

  State machine: `AWAITING_COUNCIL_INTERACTION → AWAITING_DECISION → APPROVED → ACTIVATED`. `NOT_APPROVED` is
  reachable from either open state. Every other move returns 409. Every event writes an immutable audit row:
  `{case_id, event, at, actor_id, actor_role, policy_version, detail}`.
- **(B)** Keep our store. The main backend then verifies `policy_case_id` server-to-server (shared secret) via our
  `GET /api/empanelment-policy/approved?teacher_id=` before MB-03 grants.

### MB-05 · P0 · Fast-Track decision gate
**Today:** `POST /api/empanelment/fast-track/{request_id}/decide` `{outcome, notes}` lets the claimer or an admin
approve at any time. On approval it empanels, and it "triggers revenue split realisation".
**Change:**
- **approve** needs all of these:
  - `request.status == "interview_scheduled"` and `interview_scheduled_at <= now (UTC)`;
  - body `interview_completed=true`, `interaction_summary` ≥ 15, `notes` ≥ 15 and `confirm=true`.

  Errors: 409 `council_interaction_required` / `interview_not_scheduled` / `interview_not_held_yet`, and 400
  `explicit_confirmation_required`. On success the request goes to `approved_pending_activation`. It must **not**
  set `is_empanelled`.
- **rejected** before the interview needs `reason` from the R8 list. After the interview it is a merit decision.
- A second decision returns `409 already_decided`. "Paid" status on its own never approves.
- New `POST /api/empanelment/fast-track/{request_id}/activate` (admin only, `confirm_checked_approval=true`). It sets
  `is_empanelled` and the stamps from MB-03.
- Revenue split timing (at decision or at activation) is open decision B9-4.
  **Today the website sends the approval to `/decide` only when an admin activates**, so the split happens at activation.

### MB-06 · P0 · Remove the mock payment from production
`POST /api/empanelment/fast-track/{request_id}/pay` accepts a **mock card**: it checks only the Luhn digit and expiry,
then marks the request paid and notifies the Council. It must return 404 outside the sandbox environment. Please also
confirm whether `razorpay-create` / `razorpay-verify` are still needed now that Cashfree is the provider.

### MB-07 · P1 · Offer text
`GET /api/empanelment/fast-track/offer`:
- `alt_path` → "5 successful 1:1 sessions, 10 genuine reviews (3.5★+, more than half 3★+), a Council interaction,
  a Council decision and admin activation".
- `what_you_get` "If approved: immediate Empanelled Teacher badge" → "If approved on merit and activated by an
  admin: Empanelled Teacher status". The website already hides the old text.

### MB-08 · P1 · Evidence a compliance check can read (read-only, admin)
New `GET /api/admin/empanelment/teachers/{teacher_id}/evidence` →
`{sessions:[{ref, kind, status, amount_inr, payment_verified, refunded, learner_user_id}], reviews:[{review_id,
reviewer_user_id, rating, status, created_at}]}`. Ids only: no names, contacts or documents.
- **Today all 19 empanelled teachers show "Insufficient evidence"** on our compliance page, because per-teacher
  sessions are not exposed.
- **Payment flag:** we detect a verified payment from `razorpay_payment_id + paid_at` or `release_txn_id` on 1:1
  bookings, and from `payment.status=="paid"` (not mock/test) on premium sessions. **Cashfree-paid bookings must set an
  equivalent** (`payment_verified=true`, `cf_payment_id`, `paid_at`). Otherwise they will not count (this fails safe).
- **Statuses:** please confirm the full list of "completed" session statuses. We count `session_completed` and `completed`.

### MB-09 · P1 · Data
- Stamp `empanelled_at` on every grant. teacher.demo is empanelled with `empanelled_at = null`, so
  `/teachers/me/commission-tier` shows 0 months of tenure. That affects the 70/30 → 80/20 progression (B4.9).
- A backfill of `empanelled_at` for the 19 legacy teachers from `empanelment_updated_at` needs founder approval (D-3).
- 9 of the 19 empanelled records are QA / throwaway / demo accounts ("QA Teacher 1789437620",
  "QA Iter91 Throwaway 7086", "QA Teacher", "Fix QA", "Checklist Teacher", "New Teacher", "Demo User", …).
  Clean up with founder approval.
- Fix the broken teacher reference on the "Rate Anjali" booking (carried over from B4.7).

### MB-10 · P1 · Sweeps never decide
`POST /api/empanelment/claims/sweep-fallback` auto-assigns claims older than 48h to any empanelled guru. That is fine
as **assignment only**. It must never change a request to approved or rejected.

---

## 2. Test specification (please run in STAGING and send the output)
Each line is a test: **setup → call → expected**. ✅ = must pass. No test may touch production data.

### R1 Sessions (evaluator / progress endpoint)
| ID | Setup | Expected |
|---|---|---|
| S-01 | 4 completed 1:1 sessions (paid, verified) | `successful_sessions.met=false` |
| S-02 | 5 completed, 5 different learners | `met=true` |
| S-03 | 5 completed **free** (₹0) sessions | `met=true` while `REQUIRE_PAID_SESSIONS=false` · `met=false` when it is switched on |
| S-04 | 5 completed, one has amount > 0 but no captured payment | `met=false`, `excluded.payment_not_verified=1` |
| S-05 | 5 completed, one paid by mock/test card | `met=false` |
| S-06 | 5 completed, one refunded | `met=false`, `excluded.refunded_sessions=1` |
| S-07 | statuses `confirmed`, `pending_payment`, `cancelled` | none counts (`sessions_not_completed`) |
| S-08 | a group session; a session where learner = teacher; the same booking twice | none counts |

### R2–R4 Reviews
| ID | Setup | Expected |
|---|---|---|
| V-01 | 9 genuine reviews | `genuine_reviews.met=false` · 10 → true · 11 → true |
| V-02 | the same learner reviews twice (older 1★, newer 5★) | counts once, **5★ used** (latest by date, not list order) |
| V-03 | review from a learner with no completed session / only `confirmed` | not counted |
| V-04 | the teacher's own review; unpublished; hidden; no reviewer account | not counted |
| V-05 | rating 0, 6, null, `true`, `"5"` | not counted |
| A-01 | average 3.49 / 3.4 | `avg_rating.met=false` · exactly 3.5 → true |
| M-01 | 5 of 10 at ≥3★ | `majority_positive.met=false` · 6 of 10 → true · 6 of 11 → true |
| M-02 | a 3★ review | positive · 2.99 → not positive |
| M-03 | 0 reviews | both R3 and R4 `met=false` |

### Workflow
| ID | Call | Expected |
|---|---|---|
| W-01 | teacher applies with R1–R4 not all met | 409 `merit_requirements_not_met`, no case |
| W-02 | teacher applies with all met | case `AWAITING_COUNCIL_INTERACTION`, `is_empanelled` unchanged (false) |
| W-03 | APPROVE before the interaction | 409 `council_interaction_required` |
| W-04 | interaction dated tomorrow (IST) | 422 · today (IST) → accepted, case → `AWAITING_DECISION` |
| W-05 | interaction summary < 15 / `confirm=false` | 422 / 400 |
| W-06 | APPROVE after the interaction, but a counted review was removed since | 409 `merit_requirements_not_met` |
| W-07 | APPROVE valid | case `APPROVED`, **`is_empanelled` still false** |
| W-08 | DECLINE before the interaction without a reason / with `INCOMPLETE_PROGRESS` | 422 `documented_reason_required` / `unknown_reason` |
| W-09 | DECLINE before the interaction with `SAFETY_CONDUCT` | `NOT_APPROVED`, reason stored, audit row |
| W-10 | DECLINE after the interaction with no reason | `NOT_APPROVED`, reason `MERIT_DECISION` |
| W-11 | any move on a closed case | 409 `case_closed` |
| W-12 | activate by guru / council / teacher | 403 · by admin without `confirm_checked_approval` → 400 |
| W-13 | activate a case that is not approved | 409 `approval_required` |
| W-14 | activate valid | `is_empanelled=true`, `empanelled_at` + `empanelment_case_id` + `activated_by` set, case `ACTIVATED` · again → 409 `already_activated` |
| W-15 | teacher / learner / HR / coordinator calls interaction, decision or list (incl. a teacher on their **own** case) | 403 |
| W-16 | teacher reads own case | no `reviewer_id`, `reviewer_name`, `reason` or `summary` in the body |
| W-17 | after W-01…W-16 | every event has one audit row with actor id, role and policy version · no row has a system actor |

### Direct-write bypasses
| ID | Call | Expected |
|---|---|---|
| B-01 | `POST /teachers/me/apply-free-empanelment` by a teacher meeting the OLD rule (5 paid, 4.0★) | `is_empanelled` stays false (410 or 409) |
| B-02 | `POST /admin/empanelment/{id}` `{is_empanelled:true}` without `policy_case_id` | 409 `approval_required` |
| B-03 | same with the `policy_case_id` of a `NOT_APPROVED` / `AWAITING_DECISION` case | 409 |
| B-04 | same by a non-admin | 403 (TVR-01) |
| B-05 | revoke without a reason | 422 · with a reason → `is_empanelled=false` + audit |
| B-06 | run `claims/sweep-fallback`, payout sweeps, KYC verification, session completion | no request or teacher changes its empanelment |

### Fast-Track
| ID | Setup / call | Expected |
|---|---|---|
| F-01 | paid request, no interview scheduled → approve | 409 `interview_not_scheduled` |
| F-02 | interview scheduled in the future → approve | 409 `interview_not_held_yet` |
| F-03 | interview time passed, `interview_completed=false` or summary < 15 | 409 `council_interaction_required` |
| F-04 | `confirm=false` / notes < 15 | 400 |
| F-05 | valid approve, teacher with **0 sessions and 0 reviews** | `approved_pending_activation`, `is_empanelled` false |
| F-06 | activate by admin | `is_empanelled=true` + stamps · by a guru → 403 |
| F-07 | second decide | 409 `already_decided` |
| F-08 | reject before the interview without a reason | 422 · with a reason → rejected |
| F-09 | non-claimer guru / teacher decides | 403 |
| F-10 | `POST /fast-track/{id}/pay` in the production config | 404, request unpaid |
| F-11 | `GET /fast-track/offer` | no "immediate", no "4.0", no "badge" promise |

---
**Acceptance:** every test above passes in staging, the output is shared, and the website team re-runs
`test_wf_b48_policy.py` and the workflow suite against staging.
