# NOSTOPS — B4.8 Final Policy Alignment and B4.9 Readiness Report

**Environment:** preview only. Nothing was published or deployed, and no production data was changed.
**Main backend (`pro-learn-connect-1`):** we only logged in and made read-only GET calls. Calls that would change
data were not made (§9.4).
**Payments:** no real Fast-Track request, Trust Review case or payment was decided, made or paid out.
**Status:** B4.8 is complete in preview and tested. **B4.9 has not started.** It waits for your review of this report.
**Policy version:** `EMPANELMENT_POLICY_V2_2026_06`.
**Earlier report:** `B4_8_POLICY_REPORT.md`. Where the two differ, this report wins (§1).
**Main-backend team document:** `/app/BACKEND_HANDOFF_B48_policy_v2.md` (exact change list and test specification).

---

## 1. What changed in this final alignment
| Area | Before (earlier B4.8 report) | Now |
|---|---|---|
| Sessions | Only **paid** completed 1:1 sessions counted | **Every successful (completed) 1:1 session counts, free or paid.** A paid-only rule was never approved, so it stays OFF behind one switch (`REQUIRE_PAID_SESSIONS = False`, marked "awaiting founder decision"). A session with a payment counts only once the **main backend has recorded that payment**. Refunded sessions and mock / test-card payments never count. |
| Approval | One step. The Council approved, then the admin "Empanel" switch granted if an approval existed. | **Two steps.** (1) A Council guru or admin records the decision. (2) **A NOSTOPS admin activates it** after ticking "I checked the recorded approval". Activation never changes the decision. |
| Admin "Empanel" switch | Could grant if an approval existed | **Can no longer grant at all**, only Revoke. A non-empanelled teacher now shows **"Activate via Decisions"**. The teacher status and bulk-status screens also refuse a grant. |
| Fast-Track approval | Sent to the main backend at decision time | **Recorded, then waits for admin activation.** Only the activation sends it to the main backend. A "Not approved" is still sent at once, so the paid request is closed. |
| "Not approved" before the Council interaction | Allowed with a note | Needs a **documented reason** from a fixed list: false or copied evidence · safety or conduct concern · teacher asked to withdraw · duplicate or wrong account. **Incomplete progress is not a reason**: the teacher simply keeps going. After the interaction, "Not approved" is a merit decision. The same rule applies to Fast-Track before the interview. |
| Existing empanelled teachers | Not covered | New **read-only Compliance report** (Admin → Empanelment Compliance). Results in §5. |
| "Held on" date | The form used the UTC date | Uses India time (the testing agent's LOW item, fixed). |

## 2. The rules as built (summary)
1. **5 successful 1:1 sessions** (completed). Free sessions count. Paid sessions need a payment the main backend
   recorded. Refunded, mock-paid, group, self and duplicate sessions never count.
2. **10 genuine reviews**: one per learner (their latest), only from learners who had a completed session with this
   teacher. Never the teacher's own review, an unpublished or hidden review, a review from outside NOSTOPS, or a
   rating outside 1–5★.
3. **Average ≥ 3.5★** over the counted reviews.
4. **More than half** of the counted reviews at **3★ or more**. Exactly half fails.
5. **Council interaction**: recorded by a Council guru or admin, with a date (not in the future, India time), a
   format, a summary and a confirmation.
6. **Explicit decision** by a Council guru or admin, with a note the teacher sees and a confirmation. Approve is only
   possible after item 5, and items 1–4 are **re-checked at that moment**.
7. **Admin activation**: the only step that switches Empanelled on.

**Fast-Track (₹4,999):** buys a priority interview only. The interview is item 5. Items 1–4 do not apply. Approval
needs the interview to be scheduled, its time passed and ticked as held. Then items 6–7 apply. Payment never
approves and never adds a badge.

**Never automatic:** nothing approves, empanels, suspends or revokes by itself.

## 3. Who does what
| Who | Where | What |
|---|---|---|
| Teacher | `/app/teacher/empanelment` | Live progress for items 1–4 and what was not counted (and why). Sees the Council and decision status; an approved teacher sees "Approved · an admin activates it next", then "Approved · Empanelled". The "Ask for the Council interaction" button appears only when items 1–4 are met. |
| Council guru | Empanelment Decisions · Interview Queue | Records the interaction, then the decision. Approve stays locked until the interaction is recorded. "Not approved" before the interaction asks for a reason. |
| Admin | Empanelment Decisions · Fast-Track · Empanelment · **Empanelment Compliance** (new sidebar item) | Decides like a guru. **Activates** approvals (Fast-Track and free path), with a "Try again" if the main backend fails. Can revoke from the roster. Reads the compliance report. |

## 4. Files affected in this final alignment
**Backend (local engine):**
- `backend/empanelment_policy.py`. Added:
  - the successful-session rule and the paid-only switch;
  - payment-verified and refunded checks;
  - the reason list;
  - the `ACTIVATED` state and the admin-only `POST /cases/{id}/activate`;
  - Fast-Track approvals that wait for activation;
  - the read-only `POST /compliance/evaluate` and its classifier.

**Website:**
- New page `app/app/admin/empanelment/compliance/page.tsx`.
- Changed components:
  - `EmpanelmentDecisionQueue.tsx` (reason picker, activation panel, India-time date);
  - `EmpanelmentDecisionScreen.tsx` (5 counters, including "Approved · awaiting activation" and "Activated");
  - `FastTrackDecisionForm.tsx` (reason before the interview);
  - `EmpanelmentRoster.tsx` (Revoke only, plus "Activate via Decisions");
  - `MeritProgress.tsx` (new "not counted" reasons and activation status);
  - `InterviewQueue.tsx` and `FastTrackQueue.tsx` (show "Approved · awaiting activation");
  - `nav-config.ts`.
- Changed pages: the Council interviews and admin Fast-Track pages.
- Changed libraries: `lib/empanelment-policy.ts` and `lib/server/empanelment-policy.ts` (evidence flags, activation,
  compliance data, Fast-Track map), plus `lib/server/admin-teacher-write.ts`.
- Changed BFF routes:
  - `bff/empanelment/cases/[caseId]/[action]` (adds `activate`, admin only);
  - `bff/admin/empanelment/[teacherId]` (grant refused);
  - `bff/admin/empanelment/fast-track/[requestId]/[action]` and `bff/guru/empanelment/[requestId]/[action]`
    (approvals wait for activation);
  - `bff/admin/teachers/[id]/status` and `bff/admin/teachers/bulk-status`.

**Tests / tools:** `backend/tests/workflow/test_wf_b48_policy.py` (rewritten) and `scripts/qa_policy_fixture.py`.

## 5. Compliance report: already-empanelled teachers (read-only)
Live result, admin view, today:

| Category | Count |
|---|---|
| Approved under Policy V2 | 0 |
| Meets the new criteria | 0 |
| **Insufficient evidence** | **19** |
| Needs individual Council review | 0 |

- **Why everyone shows "Insufficient evidence":** the main backend does not show the website per-teacher session
  records, so item 1 cannot be checked for anyone. Reviews can be read, but nobody is close to the threshold:
  - 10 of the 19 have a public review record, and the most any of them has is **1 review** (5.0★);
  - the other 9 have no public review record at all.
- **9 of the 19 look like QA, throwaway or demo accounts:** "QA Teacher 1789437620", "QA Iter91 Throwaway 7086",
  "QA Teacher", "Fix QA", "Checklist Teacher", "New Teacher", "Demo User", and others. They are empanelled in live data.
- **Nothing was changed.** No suspension, revocation, downgrade or re-empanelment. Legacy approvals stay exactly as
  they are. Any follow-up is an individual Council decision (D-3).

## 6. Tests and results (all green)
| Suite | Result |
|---|---|
| `tests/workflow/test_wf_b48_policy.py` (rewritten for the final alignment) | **139 / 139 pass** |
| Workflow regression suite (`-m "not ui"`), run after all changes | **1,055 pass**, 0 fail, 92 expected-fail (known main-backend issues such as TVR-01), 8 skipped (Cashfree sandbox only) |
| Browser smoke (admin) | Compliance page renders 19 rows with the read-only banner and 4 totals. Empanelment Decisions renders 5 counters. No console errors. |
| Browser flows, testing agent iteration_174 | 9 / 9 pass (Council, Admin, teacher progress, Fast-Track forms, role gating) |
| TypeScript / ESLint | 0 errors / 0 issues |

**What `test_wf_b48_policy.py` proves (new in this round):**
- **Sessions:**
  - free completed sessions count while paid-only is off, and the switch would exclude them;
  - an unverified or refunded payment can never reach 5;
  - mock / test-card payments never count.
- **Reasons:**
  - "Not approved" before the interaction without a reason → 422;
  - an unknown reason, including "incomplete progress" → 422;
  - with a listed reason it is recorded and audited;
  - after the interaction it is stored as a merit decision.
- **Two steps:**
  - the full path (interaction → decision → admin activation) works;
  - activation is refused without an approval, without the "checked" confirmation, or by a guru or council member;
  - a second activation → 409;
  - the admin Empanel switch can never grant directly;
  - a Fast-Track approval waits for an admin;
  - nothing in the store was decided or activated by the system.
- **Compliance:**
  - the classifier sorts teachers into the 4 categories;
  - the endpoint is admin-only and stores or changes nothing;
  - the page is read-only and role-gated.
- Everything from the earlier round still passes: review, rating and majority boundaries, role checks, Fast-Track
  interview gates, and "the website numbers equal the backend numbers".

## 7. Unresolved decisions (yours unless marked)
| # | Decision | Today's safe default |
|---|---|---|
| D-1 | **Paid-only sessions?** Should only paid sessions count towards the 5? | OFF: every completed session counts. One switch turns it on. |
| D-2 | **Reason list** for "Not approved" before the interaction. Is the list of four right? | The four reasons in §1 |
| D-3 | **Existing 19 empanelled teachers.** Keep everyone as legacy, re-check them individually, or clean up the 9 QA / demo accounts? | Nothing changed; read-only report only |
| D-4 | **Level 2 → Level 3 (Yoga Guru)** guidance still uses a 4.5★ tick. There is no founder rule for it. | Unchanged |
| D-5 | **Activation and failures:** if the main backend refuses an activation, the case stays "Activated · main record not updated" with a "Try again" button. Is that acceptable? | As built |
| D-6 | **Main-backend team:** host the decision workflow on the main backend (recommended), or keep ours and have the main backend verify it? | Ours, in preview |

## 8. Migration risks
1. **The main backend can still empanel without V2 (P0):**
   - `POST /teachers/me/apply-free-empanelment` lets a teacher self-nominate. It **flips `is_empanelled` straight
     away** under the old rule (5 paid sessions + 4.0★). The website never calls it, but anyone can call it directly.
   - Direct admin calls (`/admin/empanelment/{id}`) and Fast-Track `/decide` calls also skip V2.
   - Fixed by MB-01, MB-03, MB-05 and TVR-01.
2. **Mock payment still live (P0):** `POST /empanelment/fast-track/{id}/pay` marks a request paid using only a
   valid-looking card number. Fixed by MB-06.
3. **The old rules are still in the main backend's progress endpoints.** The website no longer shows them. Fixed by MB-02 and MB-07.
4. **The admin Empanel switch now only revokes.** Admins must use Empanelment Decisions → Activate. Admin training is
   needed.
5. **Fast-Track approvals are no longer sent at decision time.**
   - On the main backend, an approved request stays "interview scheduled" until an admin activates it.
   - The main backend's revenue split for that request therefore also happens at activation, not at the decision (B9-4).
6. **Cashfree-paid sessions may not count** if the main backend does not fill a payment-confirmed field for them.
   This fails safe: the teacher simply sees them under "not counted" (MB-08).
7. **No local data needed migrating.** The local store has 0 cases (all QA fixtures were cleaned up) and 1 harmless
   evidence snapshot.
   - If the main backend takes over (D-6), it starts fresh.
   - If decisions are recorded in preview before then, they must be carried over with their audit rows.
8. **`empanelled_at` is missing on empanelled records** (e.g. teacher.demo). Commission-tier tenure is calculated
   from it, so B4.9 depends on MB-09.

## 9. B4.9 readiness: wallet, ledger and payout discovery (read-only)
### 9.1 What exists on the main backend (45 money routes in its API list)
| Group | Routes |
|---|---|
| Teacher wallet (current, used by the website) | `teacher-wallet/balance`, `/transactions`, `/unified-summary`, `/payout-details` (GET/POST), `/pin-status`, `/setup-pin`, `/change-pin`, `/withdraw` (amount + **PIN** + method), `/withdraw/otp/start`, `/withdraw/otp/verify` |
| Cashfree Payouts "v1" (second wallet, **not used by the website**) | `v1/teachers/me/wallet`, `/transactions`, `/bank-account`, `v1/payouts/withdraw` (**amount only, no PIN or OTP**), `v1/payouts/{transfer_id}`, `v1/payouts/webhook` (signed, idempotent), `v1/teachers/{id}/wallet` |
| Payout requests / statements | `teachers/me/payout-request`, `teachers/me/payouts`, `teachers/me/payouts/report` |
| Admin | `admin/payouts/list`, `admin/payouts/sweep`, `admin/payouts/approve {ledger_id, note}`, `admin/payouts/reject {ledger_id, reason}`, `admin/wallet/reconcile?heal_direction=`, `admin/refunds/pending`, `admin/retreats/payouts`, `v1/payments/admin/refund` |
| Retreat escrow and refunds | `retreats/payouts/mine`, `retreats/{id}/refund-preview`, `…/cancel-with-refund`, `payments/cashfree/orders/{id}/refunds` |
| Other earnings | `teacher-referrals/withdraw` (+ dashboard wallet), `empanelment/fast-track/my-earnings`, `admin/empanelment/interviewers/{handle}/earnings`, `mentor/me/wallet`, `teachers/me/commission-tier`, `bookings/{id}/split-agreement` (propose / confirm / reject / reset) |

### 9.2 What the live data shows (QA accounts; amounts are QA data, not real money)
- **teacher.demo wallet:**
  - balance ₹91,743;
  - held ₹281,457;
  - withdrawable ₹77,981;
  - lifetime earned ₹1,071;
  - lifetime withdrawn ₹4,475;
  - platform fee 15%;
  - PIN set;
  - bank and UPI on file, but **bank not verified and KYC not verified**.
- **teacher.demo ledger (37 rows, Jun–Sep 2026):**
  - 24 holds: ₹2,82,530, of which 15 come from retreat reservations, each stored net of the 15% fee;
  - 4 payout releases: ₹1,071;
  - 7 withdrawals: −₹4,025;
  - **1 manual adjustment: +₹96,909**;
  - 1 hold reversal: −₹2.
- **Payout statements:** none (₹0 paid, ₹0 pending).
- **Retreat escrow view:** ₹0 held and ₹0 settled. The admin retreat payout ledger has 0 batches and ₹0 fees earned.
- **Referral wallet:** ₹2,650 earned and ₹2,650 withdrawn. There are 3 withdrawals marked "Mock UPI/bank transfer",
  still "processing" since May 2026.
- **Commission tier:** batches 70/30 ("pilot"), 1:1 sessions 85/15, next tier at 3 months. Tenure shows 0 months
  because `empanelled_at` is empty.
- **guru.demo Fast-Track reviewer earnings:**
  - reviewer share **30%** = ₹1,499.70 per review;
  - 14 reviews (12 approved, 2 rejected), lifetime ₹20,995.80;
  - **paid for rejections too**.
- **Admin:** 0 refunds pending.

### 9.3 Findings to settle before building B4.9
1. **The numbers don't add up:**
   - withdrawn shows ₹4,475 against ₹4,025 in the ledger (a ₹450 gap);
   - the balance shows ₹91,743 against releases + adjustment − withdrawals = ₹93,955 (a ₹2,212 gap);
   - most of the balance comes from one manual adjustment of ₹96,909.
2. **Possible double platform fee:**
   - holds are already stored **net** of the 15% fee (for example ₹3,000 gross → ₹2,550);
   - yet withdrawable = balance × 85% (₹91,743 → ₹77,981);
   - so the 15% looks like it is charged twice.
3. **Two wallets:**
   - the current `teacher-wallet` uses PIN, OTP for ₹5,000 or more, and the normal sign-in;
   - the `v1` Cashfree Payouts wallet rejects the normal sign-in and withdraws with **amount only, no PIN or OTP**.
   - Only one should be the source of truth.
4. **Retreat escrow is not connected:** the wallet shows ₹2.81 lakh held, much of it from retreat reservations, while
   the retreat escrow and admin payout views show ₹0.
5. **Payout rules:** withdrawal is offered with the bank and KYC not verified.
6. **Fast-Track reviewer share:**
   - the main backend's own description says "85% guru / 15% company";
   - the live data pays 30%, and pays it on rejections too.
7. **A page view changes data:**
   - the existing admin **Payouts page and the admin sidebar badge** call `GET /admin/payouts/list`, which also runs
     the main backend's "cooling → eligible" sweep (the Payouts page also calls `/admin/payouts/sweep`);
   - so simply opening admin pages in preview moves payout states;
   - this was built in an earlier phase and has not been changed now.
8. **Referral withdrawals** are stuck on "Mock … processing".

### 9.4 Not called (each would change data)
- `admin/payouts/list` and `/sweep` (run the sweep);
- `admin/wallet/reconcile` (can "heal" balances);
- every POST: withdraw, approve, reject, refund, payout-request, setup-pin, bank-account.

The reconcile report (`heal_direction=report_only`) should be run by the main-backend team **in staging** to measure
the drift in 9.3-1.

### 9.5 Decisions needed for B4.9 (yours)
| # | Decision |
|---|---|
| B9-1 | Which wallet is the source of truth: the current `teacher-wallet` (PIN + OTP) or `v1` Cashfree Payouts? |
| B9-2 | Is the platform fee charged **once**? At credit (stored net) or at withdrawal? |
| B9-3 | What is needed before a payout: KYC verified, bank verified, empanelled? |
| B9-4 | When is Fast-Track revenue realised: at the Council decision or at admin activation? |
| B9-5 | Fast-Track reviewer share: 30% or 85%? Paid on rejections too? |
| B9-6 | How to treat the ledger drift and the ₹96,909 adjustment once the staging reconcile report is in |
| B9-7 | The cooling period length, and whether a page view may run the sweep (we recommend a side-effect-free count for the badge) |
| B9-8 | What to do with the mock referral withdrawals still "processing" |

**Proposed first B4.9 step (only after your approval, read-only):** an admin Finance overview. It would show wallet,
holds, releases, withdrawals and adjustments per teacher, flag drift and double-fee cases, and stop the badge from
running the sweep. No payout, refund or balance change.

## 10. Test data and clean-up
- All pytest fixtures (`qa_wf_*`) are removed after each test. A guard proves no other case was changed.
- The QA browser case is removed after use. Re-create it with `python /app/scripts/qa_policy_fixture.py`, and remove
  it with `--cleanup`.
- The local policy store holds 0 cases, 0 audit rows and 1 evidence snapshot (the international QA teacher:
  0 sessions / 0 reviews).
- Logs:
  - `/app/test_reports/b48_final_alignment_full.log` (workflow suite);
  - `/app/test_reports/b48_final_tsc.log` (TypeScript).

**Next:** waiting for your review. Please answer D-1…D-6 and B9-1…B9-8, and forward
`/app/BACKEND_HANDOFF_B48_policy_v2.md` to the main-backend team.
