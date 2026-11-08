# NOSTOPS — Phase B4.8 Report: Verification, Pricing, Council Review and Teacher Trust

**Environment:** preview only (`connect-platform-web.preview.emergentagent.com`). Nothing was published or deployed, and no
production data was changed. The main backend (`pro-learn-connect-1`) was only read or logged into.
**Owner rules applied:** (1) the 8 exception cases are decided by people only, never automatically; (2) after a Council
decision the teacher sees **the status plus the reviewer's own note**; (3) teachers outside India see "not yet available"
and no price; (4) the free-empanelment rule is summarised only, not enforced.
**Status:** complete in preview. **B4.9 has not started** and waits for your go-ahead.

---

## 1. Council Review Queue (the 8 exception cases)
| Item | What is built |
|---|---|
| Where | **Admin:** sidebar → Operations → **Trust Review** (`/app/admin/trust-review`). **Council:** sidebar + a Council-home tile → **Trust Review** (`/app/council/trust-review`). |
| Who can open it / decide | Admins and Council gurus only. Role comes from the signed-in session. It is checked in three places: the page, the website BFF (`/bff/trust/review/{caseId}/decision`, CSRF-protected) and the local backend (`/api/trust/review/*`). Others get 401 or 403, or are redirected to `/app`. |
| What a reviewer sees | Name, handle and city, plus status flags only: ID check, main-backend empanelment, path / certificate on record, level. **No identity documents, phone numbers, emails, PAN, Aadhaar or bank data.** KPI cards show Waiting / Decided / All. |
| How a decision is made | 1. Pick **Confirm**, **Suspend** or **Revoke**. 2. Write a **reviewer note** (15 to 1,000 characters; the teacher will see it). 3. Tick "I have reviewed this case myself…". 4. Press **Record decision** (disabled until all three are done). |
| What is stored | Append-only history: action, previous → new status, note, time, reviewer id/name/role, plus an audit row. Decisions can be changed later by recording a new one, and the full history stays. |
| Effect on the website | Suspend / Revoke removes "Empanelled" from every public teacher read, and from the teacher's own dashboard display. Confirm keeps it. The main-backend record itself is **not** changed; its team updates it. |
| Automation | **None.** Cases open as "Pending Council review" and stay that way until a person decides. The sync only refreshes the status flags, and now also refreshes a case whose teacher passes the ID check later. |

**The 8 real cases. All are still PENDING, with 0 decisions, waiting for you or the Council:**
Demo User (`demo-user-india`), Dr. Kamini Yadav (`shiviyadav284`), Nancyaws7888036 (`nancyaws7888036`), Arjun Raghavan
(`arjun-raghavan`), Anjali Teacher (`yoga-shikshak-demo`), Mohan Bhandari (`himalayan.mohan`), Rajiv Dabhadkar
(`rajiv-dabhadkar-n`), rajanipradhan (`rajanikdham`).

## 2. Teacher Trust Checklist (teacher dashboard `/app`)
| Row | Status shown | Action button |
|---|---|---|
| Profile | Complete / "N% complete" | View profile / Finish profile |
| Identity check | Passed / Not passed yet / **Not yet available in your country** (outside India) | View details / Start InstaKYC / Learn more |
| Empanelment | Empanelled / Empanelled — under Council review / Suspended after review / Revoked after review / Not empanelled yet | View / Start empanelment / Contact support |
| Council review | No review needed / Pending Council review / Confirmed by review / Empanelment suspended / Empanelment revoked | About the Council / Ask a question / View empanelment / Contact support |
| Level | e.g. "L2 · Yoga Pracharak" | See progression path |

After a decision, the Council-review row shows **"Reviewer's note"**: the note, word for word, signed
"— Council of Yoga Gurus · date" or "— NOSTOPS admin · date". **The reviewer's personal name or id is never sent to the
teacher.** When empanelment is withdrawn, the rest of the dashboard agrees with the checklist: the access card's
empanelment chip shows Locked, the "Empanelled Teacher" badge is hidden and there is no "Apply for empanelment" card.

## 3. International verification: "not yet available"
- Backend: `INTERNATIONAL_VERIFICATION_AVAILABLE = False` (`verification.py`). Starting a Didit session returns **409**
  "not yet available… No payment is taken". The journey response carries `international_available: false` and `price: {}`.
- Teachers outside India see one plain message ("Not yet available in your country", with Ask a question → `/support`) on
  `/app/teacher/get-verified`, `/app/teacher/kyc` and `/app/teacher/locked`. The dashboard roadmap, the progress card, the
  access card, the progression timeline and the trust checklist use the same wording. **No verification price (₹ or US$)
  and no Didit button appears anywhere.**
- Note: the teacher's own earnings figures on the dashboard (per session, take-home, monthly) are still shown in ₹. That is
  how the platform pays out, not a verification price, so it was left unchanged.

## 4. Pricing
- The combined "Verified + Empanelled" offer (₹2,499 + tax / US$99) stays **paused**: no purchase, no button, no price shown.
- India InstaKYC stays at ₹279 including GST (₹236 + ₹43 GST), from one source (`lib/pricing`). Unchanged.

## 5. Free-empanelment rule: conflicts found (summarised, NOT enforced)
| Where | Rule it uses today |
|---|---|
| Main backend `/teachers/me/empanelment-progress` | 5 **paid** sessions + **4.0★** average |
| Main backend `/teachers/me/onboarding-state` | `free_track_min_sessions` 5 + `free_track_min_rating` **4.0** |
| Main backend fast-track offer, alternative path | 5 successful **1:1** sessions + **"majority positive"** reviews |
| Website `/app/teacher/empanelment` steps | 5 **classes or 1:1** sessions with "genuine positive feedback", then a Council interaction |
| Website Level-up guide | Student ratings **≥ 4.5★** |
| Local verification engine (empanelment rules) | **No thresholds set**, treated as PASS |

**Proposed single rule (stored in one config, `trust_review.FREE_EMPANELMENT_POLICY`, status AWAITING_OWNER_APPROVAL,
`enforced: false`):** at least 5 one-to-one sessions, an average of 4.5★ or more and at least 10 genuine reviews, then an
application to the Council of Yoga Gurus. **Decisions needed from you:** (a) paid sessions only, or any 1:1 / class; (b) a
4.0★ or 4.5★ minimum; (c) whether to require a minimum number of reviews, and how many; (d) whether passing is automatic or
a Council application. Nothing changes until you approve.

## 6. Files
**New:** `backend/trust_review.py`, `frontend/app/app/admin/trust-review/page.tsx`, `frontend/app/app/council/trust-review/page.tsx`,
`frontend/app/bff/trust/review/[caseId]/decision/route.ts`, `frontend/components/app/trust/TrustReviewQueue.tsx`,
`frontend/components/app/trust/TrustReviewScreen.tsx`, `frontend/lib/server/trust-review.ts`,
`frontend/components/app/teacher/TrustChecklist.tsx`, `frontend/components/app/teacher/InternationalVerificationNotice.tsx`,
`frontend/lib/country.ts`, `scripts/qa_trust_fixture.py`, `backend/tests/workflow/test_wf_b48_trust_review.py`.
**Changed:** `backend/server.py` (router + public-read withdrawal), `backend/verification.py` (international gate, paused offer),
`frontend/lib/api.ts` (withdrawn handles on public reads), `frontend/lib/server/verification.ts`, `frontend/lib/server/teacher.ts`,
`frontend/lib/teacher-access-view.ts`, `frontend/components/app/teacher/{TeacherHome,TeacherAccessCard,TeacherProgressCards,OnboardingRoadmap}.tsx`,
`frontend/app/app/teacher/{get-verified,kyc,locked}/page.tsx`, `frontend/components/app/nav-config.ts`, `frontend/components/app/council/CouncilHome.tsx`.

## 7. Test results
- **`test_wf_b48_trust_review.py`: 20/20 pass.** Covers: secret required; learner / teacher / HR / coordinator get 403;
  admin and Council see exactly 8 real cases with no contact or ID data; no decision was made by the system; 403 comes before
  body validation; 400 without confirmation; 422 for a short note or an unknown action; 404 for an unknown case; the decision
  and audit are stored; the teacher sees status + note without the reviewer's name; Suspend / Revoke / Confirm update the
  withdrawn list and the history only grows; the policy is not enforced; Didit returns 409; the journey reports
  international unavailable with no price; the BFF returns 401 / 403 (and 403 for a foreign origin) and admin gets 200;
  the pages are role-gated. A guard checks that **the 8 real cases are identical before and after** the run.
- **Workflow regression suite** (`-m "not ui"`): 916 passed, 0 failed (details in section 9).
- Frontend: TypeScript 0 errors; ESLint clean; display matrix (11 states), access matrix (9 × 14) and InstaKYC pricing checks pass.
- UI (testing agent): **iteration 171** passed all 9 flows and found 1 HIGH, 1 MEDIUM and minor issues → fixed.
  **Iteration 172:** all fixes confirmed except the international access-card price → fixed. **Iteration 173:** confirmed
  (no 279 / US$ / InstaKYC wording for the UK teacher; suspended teacher sees no "Apply" card; status updates without a reload;
  India pricing unchanged). The last item ("Apply for empanelment" on the access card while suspended) was fixed and
  re-checked by the main agent.

## 8. Sandbox / QA setup
- **QA fixture (local DB only):** `python /app/scripts/qa_trust_fixture.py` creates one test case labelled "QA test case"
  for the QA teacher `qa.shikshak.l1@nostopsqa.com` (handle `drishti-ladies-yoga-classes-pune`). Use it to practise
  decisions and to see the teacher view. `--cleanup` removes it. **Currently cleaned up.** Never practise on the 8 real cases.
- **Payments:** unchanged from `/app/memory/CASHFREE_SANDBOX_COMPLETION_REPORT.md`. Preview cannot take a payment (checkout
  is off, and the venue upgrade is locked to Cashfree Sandbox). No Sandbox keys are entered yet, so Sandbox checkout has not
  been run in a browser. No refunds are in scope.

## 9. Regression run
Full workflow suite (`backend/tests/workflow`, `-m "not ui"`) after all B4.8 changes: **916 passed, 0 failed**, 92 expected
failures (known main-backend defects, marked so they turn red once fixed), and 8 skipped (Cashfree Sandbox-only order tests,
since no Sandbox keys are entered).

## 10. Still open (outside this workspace)
- Main backend TVR-01 (server-side admin checks / IDOR) and public PII: handed off (`/app/BACKEND_HANDOFF_B47_main_backend.md`).
- The broken "Rate Anjali" teacher reference and the QA / duplicate retreats on live: these need the backend team.
- The main-backend empanelment record for any teacher you suspend or revoke: its team must update it to match.
