# NOSTOPS — Launch-critical fix change log (2026-06 fork, round 3)

Source of truth: `LAUNCH_READINESS_AUDIT.md` (NST-xxx) and `TEACHER_VENUE_RETREAT_AUDIT.md` (TVR-xx).
Owner approval (this round): fix TVR-16, TVR-14, TVR-13, TVR-23. Keep "Swami Guru" (real, NOT hidden). Admin 2FA (NST-004)
stays on hold. No optional P2/P3 items. Cashfree configuration left as is (NST-006 / TVR-26). No deployment.

## Re-verification before editing (current code, local preview)

| ID | Status found | Evidence |
|---|---|---|
| NST-001, 002, 005, 007, 009, 011 | Fixed in code (prior fork), **not yet deployed** | local: `/yoga-parampara/iyengar-yoga` 200, invalid slug 404, `/cities/pune` 308, `/pay` 404, demo handles 404. Production still 500/200 (old build) |
| NST-003, NST-008 | Fixed in code (prior fork), not deployed | see PRD "LAUNCH FIXES … NST-003 … NST-008" |
| NST-011 (rest) | `/council/swami-guru-demo` public | owner: real record, keep — no change |
| TVR-16 | **Open** | `venues.py` `/centers/mine`, `/centers/{id}`, `/my-venue-status` query by the `owner_id` query param, not the authenticated user |
| TVR-14 | **Open** | `verification.py` `confirm_payment`: `teacher_id = body.teacher_id or user_id` |
| TVR-13 | **Open** | BFF create accepts past `start_date`; BFF PATCH forwards dates with no checks; wizard has no `min` date |
| TVR-23 | **Open** | `ai_onboarding.py` `create_order` / `_refresh_status`: `httpx` network errors are unhandled → 500 |
| TVR-01, NST-012, NST-013, NST-014, TVR-02/28, TVR-04, TVR-09/10 | Open — remote backend / owner / DNS / data | not fixable in this repo without backend or architecture changes |

## Planned changes

### TVR-16 — venue owner reads trust a client-supplied owner id (authorization)
- Files: `backend/venues.py` (`my_centers`, `get_center`, `my_submission_statuses`).
- Expected: results are always scoped to the authenticated user (`X-Pulse-User.user_id`, set server-side by the BFF).
  `owner_id` becomes optional for compatibility; if supplied and different from the signed-in user → 403.
- Tests: owner sees own centers / statuses; another user's `owner_id` → 403; omitted `owner_id` → own data; no secret → 401.

### TVR-14 — payment confirmation takes the teacher id from the request body (payment integrity)
- Files: `backend/verification.py` (`confirm_payment`).
- Expected: the payment is always attached to the authenticated teacher. A different `teacher_id` is only accepted from an admin; otherwise 403.
- Tests: own confirm OK; teacher A confirming for teacher B → 403, nothing written; admin may confirm for another teacher.

### TVR-13 — retreat dates not validated server-side
- Files: `frontend/lib/retreat-dates.ts` (new), `frontend/app/bff/teacher/retreats/create/route.ts`,
  `frontend/app/bff/teacher/retreats/[id]/route.ts`, `frontend/components/app/teacher/HostRetreatWizard.tsx`.
- Expected: create rejects a start date before today (Asia/Kolkata); PATCH validates format, start ≥ today when a start date is sent,
  and end ≥ start (reading the stored other date when only one is sent). Wizard date pickers get `min` and an inline error.
- Tests: past start → 400 (no request reaches the backend); bad format → 400; end < start → 400; PATCH past start → 400.

### TVR-23 — gateway network failure → raw 500
- Files: `backend/ai_onboarding.py` (`create_order`, `_refresh_status`).
- Expected: `httpx` transport errors / timeouts → 502 "The payment service is unavailable right now…"; nothing stored.
- Tests: simulated `httpx.ConnectError` on create and status → 502 (existing xfail test flipped to a real test).

## Rollback
Each change is self-contained and data-free (no migration, no schema change, no new env vars): `git revert <commit>` or restore the
listed files from the previous commit, then `sudo supervisorctl restart backend` (frontend hot-reloads).

## Results (executed 2026-06, this fork — local preview only, nothing deployed)

| ID | Root cause | Change |
|---|---|---|
| TVR-16 | Owner reads filtered by a request query param instead of the server-set identity | `venues.py` `_own_id()`: scope to `X-Pulse-User.user_id`; `owner_id` optional, must match (else 403) |
| TVR-14 | `teacher_id = body.teacher_id or user_id` | `verification.py`: always the authenticated teacher; another id only for role `admin`, else 403 (checked before any write) |
| TVR-13 | BFF only checked format and end ≥ start on create; PATCH forwarded dates unchecked | `lib/retreat-dates.ts` (`todayIST`, `retreatDatesError`: real calendar date, start ≥ today IST, end ≥ start); used by BFF create, BFF PATCH (reads the stored other date; an untouched past start is not re-judged) and the wizard (`min` + inline error + step gate) |
| TVR-23 | `httpx` transport errors not caught around the Cashfree calls | `ai_onboarding.py`: `httpx.HTTPError` → 502 "payment service is unavailable… You have not been charged." in `create_order` and `_refresh_status` |

Tests executed (actual results):
- `tests/workflow/test_wf_launch_round3.py` (new, 11) + 2 TVR-23 outage tests → **13 passed**.
- `test_wf_web_bff.py -k retreat` incl. 4 new TVR-13 cases (past start create, impossible dates ×2, PATCH past start, PATCH end < stored start) → **37 passed** (all rejected by the BFF before the live backend).
- Full workflow suite `-m "not ui"` → **202 passed, 5 skipped (Cashfree-sandbox-only order creation), 31 xfailed (known open TVR-01/02/03/09/11/12/15/17/19…/NST-017 — backend/data), 0 failed**.
- `npx tsc --noEmit` → 0 errors; ESLint on changed TS → clean.
- Browser: wizard start date `min` = today; past start shows "The start date must be today or later."

Remaining / not fixed here: TVR-01 (P0, remote admin KYC/empanelment reads), NST-012, NST-013, NST-014, TVR-02/28 live data,
TVR-04 (backend support for local listings as venue partners — architecture change, needs approval), TVR-09/10, NST-004 (on hold),
NST-006/TVR-26 (left as is), NST-010 (awaiting legal content). Earlier fixes (NST-001/002/003/005/007/008/009/011) are in code but
**production still runs the old build** until the owner publishes.
Config/migration: none (no env vars, no schema change, no data migration).
