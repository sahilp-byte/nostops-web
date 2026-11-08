# NOSTOPS — B4.8 Policy Finalisation Report: Empanelment Policy V2 (founder-approved)

> **SUPERSEDED IN PART** by `/app/memory/B4_8_FINAL_ALIGNMENT_AND_B4_9_READINESS.md`:
> - every successful session now counts (paid-only is off);
> - approval is two steps (decision, then admin activation), and the admin switch only revokes;
> - "Not approved" before the interaction needs a documented reason;
> - there is a new read-only Compliance report.

**Environment:** preview only (`connect-platform-web.preview.emergentagent.com`). Nothing was published or deployed.
No production data was changed. The main backend (`pro-learn-connect-1`) was only read or logged into. No real
Fast-Track request, Trust Review case or payment was decided or completed during testing.
**Status:** complete in preview and fully tested. **B4.9 has not started** and waits for your approval of this report.
**Policy version stamped on every record:** `EMPANELMENT_POLICY_V2_2026_06`.

---

## 1. The rules as built
### Free / merit path: every item is required
| # | Rule (your decisions applied) | How it is counted |
|---|---|---|
| 1 | **5 successful 1:1 sessions** on NOSTOPS | Only 1:1 sessions that are **paid** (a real payment, amount > ₹0, not a mock card) **and completed** (`session_completed` / `completed`). Free or demo sessions, unpaid, pending, confirmed-but-not-held or cancelled sessions, group sessions, sessions with yourself and duplicate records never count. |
| 2 | **10 genuine NOSTOPS reviews** | At most **one per learner** (their latest, by date). Counts only if the learner has a **completed NOSTOPS session with this teacher**. Never counted: the teacher's own review, unpublished or hidden reviews, a review without a NOSTOPS learner account (external), or a rating outside 1–5★. |
| 3 | **Average ≥ 3.5★** | Average of the counted reviews only. |
| 4 | **Majority positive** | **More than 50%** of counted reviews at **3★ or above**. Exactly half fails. |
| 5 | **Completed Council interaction** | Recorded by a Council guru or admin: date (not in the future, India time), format, internal summary, and "I took part myself" confirmation. |
| 6 | **Explicit final decision** | A Council Yoga Guru or NOSTOPS admin chooses Approve / Not approved, writes a note (the teacher sees it) and confirms. Approval is only possible **after** item 5, and items 1–4 are **re-checked at the moment of approval**. |

### Fast-Track
- ₹4,999 still buys a **priority 30–45 min interview**. That interview **is** the Council interaction.
- Items 1–4 (session / review numbers) **do not apply**.
- Approval needs: the interview was **scheduled and its time has passed**, the reviewer ticks "the interview took place",
  a summary (≥ 15 characters), a decision note (≥ 15 characters) and a confirmation. **Payment alone can never approve**:
  a paid request with no interview is refused.
- "Not approved" can be recorded at any time with a note.

### Never automatic
Nothing in the system approves, empanels, suspends or revokes on its own. KYC, sessions, ratings, payment and the
verification engine can only make someone **eligible**. Every decision row stores the reviewer's id, name, role and time.

### Trust statuses stay separate
Listed, ID Checked (InstaKYC), Empanelled and Verified are unchanged and independent. On the empanelment page the hero
chip "Council Verified" now reads **"Council Reviewed"**, so empanelment is not confused with Verified.

---

## 2. How it works for each person
| Who | Where | What they do |
|---|---|---|
| Teacher | `/app/teacher/empanelment` → **Your free-path progress** | Sees their own live count for each item (e.g. "4 of 5", "9 of 10", "3.4★ of 3.5★", "5 of 10 · more than half needed"), what was **not counted** and why, the Council-interaction and decision status, and the decision note. **"Ask for the Council interaction"** appears only when items 1–4 are all met. Empanelled teachers see "You are Empanelled" instead. |
| Teacher | `/app/teacher/empanelment/fast-track` | New **"How the decision is made"** card (payment buys a priority review only; never guarantees approval or a badge). The free path is described with the V2 numbers. |
| Council guru | Sidebar + Council home → **Empanelment Decisions** (`/app/council/empanelment-decisions`) | Step 1: record the Council interaction. Step 2: final decision (Approve is disabled until Step 1 is done). |
| Admin | Sidebar → **Empanelment Decisions** (`/app/admin/empanelment/decisions`) | Same queue and the same two steps. After a free-path approval, the admin turns **Empanelled** on in Admin → Empanelment. That switch (and the teacher status / bulk-status screens) **refuses to grant** without an approved decision. |
| Council / Admin | Interview Queue (`/app/council/interviews`), Fast-Track pipeline (`/app/admin/empanelment/fast-track`) | New shared Fast-Track decision form. Approve stays locked until the scheduled interview time has passed. Every decision is checked by the policy engine **before** it is sent to the main backend. |

---

## 3. Files affected
**Backend (local engine `/app/backend`)**
- `empanelment_policy.py` (**new**): the single source of truth. It holds the pure evaluator `evaluate_free_path`, the allowed status moves `transition`, and the API below.
- `server.py`: registers the policy router.
- `verification.py`:
  - The engine's all-pass outcome is now `ELIGIBLE`, never `EMPANELLED`. It no longer auto-sets VERIFIED or grants an entitlement or badge.
  - Council `APPROVE` / `RECOGNISE_AS_YOGA_GURU` needs an approved policy decision (409 otherwise).
  - Registered the new audit event (this fixed a 500 error found in testing).
  - Interaction dates now use India time.
- `trust_review.py`: the old B4.8 proposal (4.5★) is marked `SUPERSEDED_BY_POLICY_V2` and points to the approved policy.

**Website (`/app/frontend`)**
- New:
  - `lib/empanelment-policy.ts`: the numbers and text, checked by a test against the backend values.
  - `lib/server/empanelment-policy.ts`: server-side evidence collection and checks.
  - `components/app/teacher/MeritProgress.tsx`, `RequestCouncilInteraction.tsx`.
  - `components/app/empanelment/EmpanelmentDecisionQueue.tsx`, `EmpanelmentDecisionScreen.tsx`, `FastTrackDecisionForm.tsx`.
  - Pages `app/app/admin/empanelment/decisions/page.tsx`, `app/app/council/empanelment-decisions/page.tsx`.
  - BFF routes `app/bff/empanelment/apply/route.ts`, `app/bff/empanelment/cases/[caseId]/[action]/route.ts`.
- Changed:
  - `app/app/teacher/empanelment/page.tsx`: V2 progress and steps; old 4.0★ / "genuine positive feedback" copy removed.
  - `app/app/teacher/empanelment/fast-track/page.tsx`
  - `components/app/council/InterviewQueue.tsx`, `components/app/admin/FastTrackQueue.tsx`: they now use the new form. The old forms sent no confirmation and would be refused.
  - `components/app/teacher/LevelUpGuide.tsx`: the L1→L2 rating tick is now 3.5★.
  - `components/app/council/CouncilHome.tsx`, `components/app/nav-config.ts`
  - BFF `admin/empanelment/[teacherId]`, `admin/empanelment/fast-track/[requestId]/[action]`, `guru/empanelment/[requestId]/[action]`, `admin/teachers/[id]/status`, `admin/teachers/bulk-status`, plus `lib/server/admin-teacher-write.ts`.
- `frontend/yarn.lock`: brought back in line with `package.json` (eslint entries were missing). Versions are unchanged; a frozen install passes.

**Tests / tools:** `backend/tests/workflow/test_wf_b48_policy.py` (**new**), `test_wf_b48_trust_review.py`,
`backend/test_empanelment_flow.py`, `backend/test_council_flow.py`, `scripts/qa_policy_fixture.py` (**new**, UI test case; cleaned up).

## 4. APIs
| API | Who | Purpose |
|---|---|---|
| `GET /api/empanelment-policy/policy` | server only (shared secret) | The approved policy (numbers, roles, Fast-Track terms) |
| `POST /api/empanelment-policy/me/evidence` | teacher | The website server sends the teacher's own main-backend sessions and reviews. Returns the evaluation and the teacher's case. |
| `POST /api/empanelment-policy/me/apply` | teacher | Opens a case only when items 1–4 are met (409 `merit_requirements_not_met` otherwise). Grants nothing. |
| `GET /api/empanelment-policy/cases` | guru / council / admin | The queue, with current evidence and the audit trail |
| `POST /api/empanelment-policy/cases/{id}/interaction` | guru / council / admin | Record the Council interaction |
| `POST /api/empanelment-policy/cases/{id}/decision` | guru / council / admin | Approve (only after the interaction, with merit re-checked) or Not approved |
| `POST /api/empanelment-policy/fast-track/{requestId}/decision` | guru / council / admin | Policy gate before a Fast-Track decision reaches the main backend |
| `POST /api/empanelment-policy/cases/{id}/main-backend-result` | guru / council / admin | Records whether the main record was updated |
| `GET /api/empanelment-policy/approved?teacher_id=` | guru / council / admin | Used by the admin Empanel switch |
| BFF `POST /bff/empanelment/apply`, `POST /bff/empanelment/cases/{caseId}/{interaction\|decision}` | session + CSRF | Website entry points. The role comes from the signed-in session, never from the browser. |

---

## 5. Tests and results (all green)
| Suite | Result |
|---|---|
| `tests/workflow/test_wf_b48_policy.py` (**new**) | **95 / 95 pass** |
| `tests/workflow/test_wf_b48_trust_review.py` (updated for V2) | 20 / 20 pass. The 8 real cases are proven untouched. |
| `test_empanelment_flow.py` (updated: all-pass → ELIGIBLE, no entitlement) | 29 / 29 pass |
| `test_council_flow.py` (updated: APPROVE without a policy decision → 409) | 42 / 42 pass |
| Workflow regression suite (`-m "not ui"`) | **1,009 pass**, 92 expected-fail (known main-backend issues, TVR-01 etc.), 8 skipped. 2 failed: one-off main-backend 502s on a read-only call; **re-run 14 / 14 pass** |
| Browser test, testing agent iteration_174 | 9 / 9 flows pass (Council, Admin, teacher progress, Fast-Track, role gating, regressions) |
| TypeScript / ESLint | 0 errors / 0 issues |

**Exact boundaries proven in `test_wf_b48_policy.py`**
- **Sessions:** 4 fails, 5 and 6 pass. None of these count: unpaid, ₹0 (free/demo), group, confirmed, cancelled, pending-payment, with yourself, a duplicate booking.
- **Reviews:** 9 fails, 10 and 11 pass.
  - A second review from the same learner counts once, and the latest by date is the one used.
  - None of these count: no completed session, session only confirmed, no learner account (external), your own, pending or hidden, rating 0, 6, empty or "true".
- **Average:** 3.49★ and 3.4★ fail; exactly 3.5★ passes.
- **Majority:** exactly 5 of 10 positive fails, 6 of 10 and 6 of 11 pass. 3★ counts as positive, 2.99★ does not. With no reviews, both rating items fail.
- **No automatic approval:**
  - Meeting all four items opens a case only (never approved, `approved = false`).
  - Approve before the interaction → 409. Approve after the interaction but with a review since removed → 409 (merit re-checked).
  - A closed case cannot change again, and an approved teacher cannot re-apply.
  - Nothing in the store was decided by the system.
- **Unauthorised moves:**
  - Teacher, learner, HR and coordinator get 403 on interaction, decision and queue, including the teacher on **their own** case.
  - Learner, HR, coordinator, admin and Council get 403 on teacher-only apply.
  - Unknown events are rejected, and every refused move is covered.
- **Fast-Track:**
  - Paid with no interview → 409. Interview not ticked, no summary, never scheduled, still in the future, or no time → 409. No confirmation → 400. Non-reviewers → 403.
  - Approval works with **zero sessions and reviews** once the interview has happened.
  - A second decision → 409. "Not approved" needs no interview.
- **Verification engine:**
  - All rules passing → ELIGIBLE only: no VERIFIED status and no entitlement.
  - Council APPROVE without a policy decision → 409.
- **Website:**
  - BFF refuses anonymous (401), wrong role (403), bad CSRF (403), bad case id / action (404) and short notes (400).
  - The admin Empanel switch and the status screen refuse to grant without an approval (409 / not saved).
  - Fast-Track decide without a note or confirmation → 400. Decision pages are role-gated.
  - The teacher pages show V2 text and none of the old rules.
  - The website numbers equal the backend numbers.

Full log: `/app/test_reports/b48_policy_workflow_full.log` (run after all changes).

## 6. Problems found during testing (all fixed)
1. **The verification assessment crashed (500)** after the earlier change, because the new audit event `EMPANELMENT_PREREQUISITES_MET` was not registered. Fixed.
2. **The old Fast-Track decide forms** (Council queue and admin pipeline) sent no note or confirmation, so the new gate would have refused every decision. Replaced with the shared policy form.
3. **The teacher empanelment page still showed the main backend's old rule** (5 paid sessions + 4.0★, "genuine positive feedback"). It now shows V2 progress. The Fast-Track page showed the backend's old free-path text and an "immediate badge" line; both are reworded to V2.
4. **The "held on" date used the UTC date** (wrong for India between 00:00 and 05:30). The page and the backend now both use India time.
5. Two TypeScript type errors in the Fast-Track BFF routes. Fixed.
6. The preview disk was full (6.1 GB of dev cache), which caused page errors. The cache was cleared; nothing else was touched.

## 7. Policy conflicts and questions still open (need your or the main-backend team's decision)
1. **The main backend still has its own, different rules:**
   - `/teachers/me/empanelment-progress` and `onboarding-state` use 5 paid sessions + **4.0★**.
   - The Fast-Track offer `alt_path` says "5 successful 1:1 sessions + majority positive reviews".
   - `what_you_get` says "If approved: immediate Empanelled Teacher badge".

   The website no longer shows any of these, but the main backend's own logic was not changed (read-only for us). If it ever empanels from its own `free_track_eligible` flag, that would bypass V2. Its team should align it to V2.
2. **Direct calls to the main backend are not gated.** The V2 gate runs in the website and the local engine before anything is forwarded. Someone calling the main backend's admin or Fast-Track endpoints directly bypasses it. This depends on the open **TVR-01** server-side admin fix.
3. **"Not approved" before the Council interaction.** It is currently allowed on both paths; only *Approve* needs the interaction. Please confirm this is what you want.
4. **Free-path approval is two steps.** After the Council approves, an admin turns Empanelled on. The switch checks the approval, and the main record is never changed automatically. Please confirm, or say whether a Council approval should update the main record directly.
5. **Level 2 → Level 3 (Yoga Guru)** guidance still uses a 4.5★ tick. There is no founder rule for Guru recognition; L1 → L2 now uses 3.5★.
6. **Paid-session detection relies on the main backend's payment fields:** `razorpay_payment_id` / `release_txn_id` on 1:1 bookings, and `payment.status = paid` (not mock) on premium sessions. If Cashfree-paid bookings do not fill these fields, those sessions would **not count** (this fails safe). The main-backend team should confirm.
7. **Session status names:** only `session_completed` / `completed` count as completed. Any other "done" status the main backend uses would need adding.

## 8. Migration risks
- **Existing empanelled teachers are not re-evaluated or revoked.** V2 applies to new grants only, and the 8 Trust Review cases are unchanged and still PENDING. Whether to re-check existing teachers against V2 is your decision.
- The local verification engine now returns **ELIGIBLE** where it used to return EMPANELLED. Screens that read the local status show it as "in progress", and an old local EMPANELLED record stays as it is. No local data was migrated.
- Admin "Empanel" now returns 409 for anyone without an approved V2 decision. Admins need to use **Empanelment Decisions** first.
- Fast-Track decisions on the main backend now need the interview to have happened first. A request decided before its interview time will be refused with a clear message.
- The teacher progress card stores one evidence snapshot per teacher in the local `empanelment_policy_evidence` collection. It holds ids, statuses and ratings only: no names, contacts or documents.

## 9. Test data
- The QA case `epc_4e05658d05fa` (made-up teacher "QA Policy Teacher (test case)") was used for the browser test and **deleted** afterwards. Re-create it with `python /app/scripts/qa_policy_fixture.py`.
- All pytest fixtures (`qa_wf_ep_*` / `qa_wf_ft_*`) are deleted after each test, and a guard proves no other case was changed.
- The international QA teacher's progress card stored one local evidence snapshot (0 sessions / 0 reviews). This is normal page behaviour and harmless.

**Next:** B4.9 waits for your approval of this report and your answers to §7.
