# NOSTOPS — Phase B4.7 Report: Teacher-First Integrity, Security and Payment Isolation

**Environment:** development / preview only (`connect-platform-web.preview.emergentagent.com`). Nothing was published or deployed.
**Owner decisions applied:** (1) checkout is turned OFF in preview; (2) the public "✓ Verified" badge needs BOTH a passed ID check AND empanelment.
**Status:** complete in preview. B4.8 not started; it waits for your go-ahead.

---

## 1. Before → after, by workstream

### A. Admin authorization
| | Before | After |
|---|---|---|
| Our gateway `/api/admin/*`, `/api/dashboards/admin-stats*` | Locked since B5.1 | Unchanged: anon 401 · non-admin 403 · admin 200 |
| Our local admin routes (institutional settings / org trust / adaptive competence, monitoring event update, venue admin-add) | Role checked **inside** the handler, after the request body was validated, so a non-admin with a bad body got **422** (this revealed the payload shape) | Role check runs **first** as a dependency, so a non-admin always gets **403**. All ≥80 local admin routes were checked automatically: anon 401 and learner/teacher/hr/org_admin 403 (empty body included); admin reads still work |
| Main backend `pro-learn-connect-1` (called directly) | Open (TVR-01) | **Still open.** Its code is outside this workspace. Handoffs: `/app/BACKEND_HANDOFF_admin_authz_B511.md`, `/app/BACKEND_HANDOFF_B47_main_backend.md` |

### B. Empanelment integrity and public trust badges
| | Before | After |
|---|---|---|
| Opening the teacher "Institutional Events" page | Stored the teacher as **empanelled = true** with no check (`institutional.py` directory sync) | Grants **nothing**. It records only the main backend's own status (empanelled + ID check), which the server reads from the teacher's own record, never from the browser |
| Who can be offered institutional work | Any active row marked empanelled (i.e. anyone who had opened the page) | Only teachers the main backend confirms as **ID-checked AND empanelled**; demo and legacy rows never |
| Existing auto-empanelled rows (preview DB) | 51 rows wrongly marked empanelled | **Flagged, not deleted** (`status_review.flag = LEGACY_UNCONFIRMED_STATUS`, old value kept). They can't be matched until the teacher's real status is synced |
| Public event page | "✓ Verified Teacher" as soon as a teacher **accepted** | "✓ Verified Teacher" only if ID check + empanelled. Otherwise "🧘 Teacher confirmed", or "Teacher being matched" |
| Directory / profile / city cards / OG image / home voices / widgets | "Verified" from `is_verified` or `is_empanelled`. Live: 12 teachers flagged `is_verified`, **10 of them with no passed ID check**; 8 of 10 empanelled had no ID check | One rule everywhere (`publicTrust()`): **✓ Verified only when ID check + empanelled.** Other statuses show on their own (★ Empanelled / ID checked / Listed). Today: Verified 2 · Empanelled 6 · ID checked 1 · Listed 25 |
| /trust page wording | "Verified" = KYC + empanelled (but not enforced) | Says "both, not just one" and explains "Teacher confirmed" |

### C. Public API data minimisation
| | Before | After |
|---|---|---|
| Public reads through our `/api` gateway (teachers directory / featured / public profile / reviews, council, retreats, venue-partners, seo) | Main-backend JSON passed through unchanged. e.g. `/teachers/featured` carried email, phone, WhatsApp, user_id, payout IFSC / bank name, KYC payment id, suspension and legacy ids | `backend/public_privacy.py` strips contact, KYC/PAN/Aadhaar/bank/payout, internal/legacy ids, admin/test/suspension markers and venue economics. It adds only `id_checked` and `nostops_verified`. Own `/me/*` reads, admin routes and all writes are never changed |
| Retreat "Ask the teacher" | The host's WhatsApp/phone was embedded in the page data | The number never reaches the page. A server redirect (`/bff/retreats/[id]/ask-whatsapp`) looks it up only when a visitor sends a question |
| Page source | Raw `kyc_verified` etc. could reach the browser | Checked: no phone digits and no raw KYC/contact keys on the directory and profile pages |
| Main backend called directly | Leaks the fields above | **Still leaks.** Exact list in `/app/BACKEND_HANDOFF_B47_main_backend.md` §2 |

### D. Preview payment isolation
| | Before | After |
|---|---|---|
| Preview Cashfree keys | **LIVE** (`api.cashfree.com`), no sandbox keys, so a preview checkout could create a real order | Checkout is **OFF in preview**, in 4 layers: |
| 1. Website server (BFF) | — | 8 checkout routes return 503 "Test mode" before anything is sent: Cashfree orders, 1:1 booking, retreat reserve/pay, booking-invite pay, Fast-Track pay, participant order, venue AI-onboarding checkout |
| 2. Our `/api` gateway | — | Payment-type writes on a preview/unknown host → 503 |
| 3. Local AI-onboarding module | — | Refuses order creation for a preview/unknown origin. A Cashfree webhook reaching preview is acknowledged and ignored |
| 4. Screen | — | Pay buttons are disabled with a test-mode note. A thin amber strip at the top of every page says payments are off |
| Production hosts (`www.nostops.org`, `*.emergent.host`) | — | Not affected (tested: a production host passes on to the normal sign-in check) |

---

## 2. Files changed
**New**
- `backend/payment_guard.py`: preview payment block (gateway + local module)
- `backend/public_privacy.py`: public payload minimisation
- `frontend/lib/payment-mode.ts`, `frontend/lib/server/payment-guard.ts`, `frontend/components/payments/PreviewPaymentBanner.tsx`
- `frontend/app/bff/retreats/[id]/ask-whatsapp/route.ts`
- `BACKEND_HANDOFF_B47_main_backend.md`
- Tests: `backend/tests/test_b47_local_admin_authz.py`, `backend/tests/workflow/test_wf_b47_integrity.py`, `backend/tests/workflow/test_wf_b47_privacy_payments.py`, `backend/tests/test_b47_frontend_public_checks.py` (added by the testing agent)

**Modified, backend:** `server.py`, `institutional.py`, `ai_onboarding.py`, `monitoring.py`, `venues.py`

**Modified, website:** `app/layout.tsx`; public pages `(public)/page.tsx`, `teachers/page.tsx`, `teachers/[handle]/page.tsx`, `events/[slug]/page.tsx`, `retreats/in/[city]/[retreat]/page.tsx`, `trust/page.tsx`; in-app `app/teachers/[handle]/page.tsx`, `app/teacher/institutional/page.tsx`; BFF checkout routes (8 listed above); components `CashfreePayButton`, `TeacherDirectoryGrid`, `TrustStrip`, `CityTeacherDiscovery`, `AskTeacher`; libs `public-teacher.ts`, `teacher.ts`, `server/institutional.ts`, `server/teacher-og.tsx`, `server/venue-onboarding.ts`, `server/widgets.ts`

**Older tests updated to the new rules (test-only, no app logic):** `test_wf_ai_onboarding.py`, `test_wf_web_bff.py`, `test_special_needs_pathway.py`, `test_teacher_confirm_first.py`, `test_qa18_teacher_lifecycle.py`, `test_prompt5_cohort_e2e.py`, `test_pathways_b11.py`, `test_prompt_group2_iter129.py`, `test_prompt_group3_iter130.py`, `test_participant_paid_payment_chain.py`.
These fixtures had created teachers by simply marking them empanelled, or expected checkout validation in preview. Both are now correctly refused.

(`frontend/yarn.lock` differs from git but pre-dates this phase; it was not touched.)

---

## 3. Test results (re-run in this session; logs in `/app/test_reports/b47/`)
| Suite | Result |
|---|---|
| B4.7 suites (local admin matrix + integrity + privacy/payments) | **553 passed** |
| B4.7 public page checks (testing agent) | **9 / 9 passed** |
| Workflow regression (15 files) | **480 passed · 84 expected-xfail · 5 skipped · 0 failed** |
| Institutional / payments / SEO / gateway / sign-in / other backend suites | **all green** (≈1,300 tests) |
| Frontend type check / lint | **0 errors / clean** |
| Frontend node checks | access, display, InstaKYC price, rating, phase A, site 15/15, no-nearby 35/35 **pass**. Pre-existing failures, identical to the B4.3 baseline: seo_feeds 4, venue_binding 2, tier2 2, lyv import |
| Browser test, desktop + mobile (testing agent iteration_170) | All functional checks pass. One **HIGH** issue found and **fixed**: on mobile the test-mode bar covered "Book a session". It is now a normal strip at the top and the button is fully visible (verified) |

Expected xfails: 53 = main-backend admin routes still open (TVR-01), 26 = main-backend data issues (QA/duplicate retreats etc.), 5 = known items. They flip automatically once the backend team ships.

**Before this session's re-run**, 29 older tests were failing because of B4.7's stricter rules: 24 institutional matching tests plus 5 checkout tests. They were reported as passing earlier because they had not been run. All are now updated and green.

---

## 4. Unresolved blockers / decisions for you
1. 🔴 **Main backend admin access (TVR-01).** Still open when called directly. Owner: backend team.
2. 🔴 **Main backend public data.** Still returns phone/email/payout/KYC fields when called directly (handoff §2).
3. 🟠 **8 teachers are empanelled without a passed ID check** on the main backend. They now show "★ Empanelled", not "✓ Verified". What should happen to them is your / Council's decision.
4. 🟠 **Institutional matching in preview now has 0 eligible teachers** (none synced as ID-checked + empanelled yet). New programmes show "teacher being matched" until such a teacher opens their Institutional page.
5. 🟠 **On the next publish,** the same one-time flagging will run on the production database. It flags, never deletes.
6. 🟡 **Payments can't be tested end-to-end in preview** until Cashfree **sandbox** keys exist.
7. 🟡 **Retreat "Reserve" and the "Ask the teacher" popup could not be browser-tested.** All preview retreats are hidden QA/duplicate records. Also, the directory feed carries no host numbers today, so "Ask" always opens plain WhatsApp.
8. 🟡 **Earlier items still open:** QA/duplicate retreats on the live backend; the "Rate Anjali" booking points at a missing teacher reference.
9. ⚪ Minor, pre-existing, not fixed: duplicate React key in `TeacherYogaTradition.tsx` (dev console only).

---

## 5. Rollback
1. **Code:** use the platform's Rollback to the checkpoint before B4.7 (last commit: "Phase B4.6 Teacher-First Platform Readiness Audit"). Per file: `git checkout dc9a6560 -- <file>` and delete the new files listed in §2.
2. **Preview data** (only needed with the code rollback; nothing was deleted):
   ```
   db.inst_teacher_directory.updateMany({"status_review.flag":"LEGACY_UNCONFIRMED_STATUS"}, {$unset:{status_review:""}})
   db.inst_teacher_directory.updateMany({status_source:"main_backend"}, {$unset:{status_source:"", id_verified:"", status_synced_at:""}})
   db.inst_events.updateMany({"assigned_teacher.teacher_id":{$exists:true}}, {$unset:{"assigned_teacher.verified":""}})
   ```
   The old code then falls back to its previous behaviour.
3. **Do not re-enable preview checkout** while preview holds LIVE Cashfree keys.

---

## 6. Production safety
- No publish, no deploy, no production configuration change.
- Main backend: **GET requests and demo logins only**. No writes, no reviews, no bookings.
- **No payment was started.** Every checkout attempt in the tests was refused with 503 before anything left the server; the local order count stayed at 0.
- Preview database only: legacy rows flagged (kept), 7 event badges recomputed, test fixtures created and removed.
