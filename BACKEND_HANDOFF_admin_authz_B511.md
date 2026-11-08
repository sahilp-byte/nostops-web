# HANDOFF — Main backend admin authorization (TVR-01) · B5.1.1

**For:** the team that owns the main NOSTOPS backend `pro-learn-connect-1.emergent.host`
**From:** NOSTOPS web workspace · **Severity:** P0 (teacher PII / business data) · **Date:** 2026-06
**Status: NOT FIXED on the main backend.** Its source code is outside this workspace. Re-probed (GET only, demo
accounts) during B5.1.1: every route below still returns **200 to a signed-in teacher/learner/HR/guru account**.

## 1. Specification
- Existing spec: `/app/BACKEND_SECURITY_FIX_admin_authz.md` (left unchanged).
- It correctly requires authorization **at the main backend itself**: "the backend must still be fixed because it is
  the authoritative authorization layer and other clients call it directly". It recommends one `require_admin` dependency
  at the `/admin` router level, plus `/dashboards/admin-stats`, running before body validation.
- **It is incomplete.** It names 6 routes: admin-stats, kyc/pending, kyc/queue, empanelment/pending, empanelment/teachers
  and broadcast. B5.1 found 8 more admin-only routes that are open (§2, marked ➕). Its acceptance matrix only lists the
  first group. **Proposed amendment below — for review, not yet approved.**

## 2. Affected endpoints (observed 2026-06; GET only)
| Endpoint | Anon | Non-admin | Required |
|---|---|---|---|
| GET /api/dashboards/admin-stats | **200** | **200** | 401 / 403 / admin 200 |
| ➕ GET /api/dashboards/admin-stats-live | 401 | **200** | 401 / 403 / admin 200 |
| GET /api/admin/kyc/pending · /kyc/queue · ➕ /kyc/audit-log | 401 | **200** | 401 / 403 / admin 200 |
| GET /api/admin/empanelment/teachers · /empanelment/pending · ➕ /empanelment/stats | 401 | **200** | 401 / 403 / admin 200 |
| ➕ GET /api/admin/disputes/pending · /refunds/pending · /lineage/pending · /users/recent · /yogayukt/sync-status | 401 | **200** | 401 / 403 / admin 200 |
| POST /api/admin/kyc/{id}/approve·reject · /empanelment/{id} · /empanelment/interviewers/{handle}/assign·revoke · /broadcast | not probed (writes) | **unknown** | 401 / 403 **before** body validation / admin 200 |

**Reference: routes the backend already protects correctly** (e.g. `/admin/people/teachers`, `/admin/payouts/list`,
`/admin/audit-log`) return 401 when anonymous and 403 for non-admins. Required permission is the existing one:
**the user's `role` is `admin`**, as returned by `/api/auth/me`. The 403 wording is inconsistent today
("Admin access required" vs "Admin only").

## 3. Required code-level controls (proposed amendment)
1. Reuse the **same admin dependency the backend already applies to `/admin/people/*`**; no new role system.
2. Attach it at the **`/admin` router level** so every `/admin/*` route is covered, including list, detail, search,
   filter, pagination and export routes. Add it explicitly to **`/dashboards/admin-stats` and `/dashboards/admin-stats-live`**.
3. It must run as a router/route **dependency before body parsing**: a non-admin gets 403 whatever the body (spec §C).
4. Accept both credential forms the backend already accepts (bearer header and `session_token` cookie); return 401 for
   missing/invalid sessions and 403 for valid non-admin sessions.
5. Do not log Aadhaar, PAN, bank details, tokens or cookies on denial.
6. Also register the literal `/admin/beta-feedback/export.csv` route before `/{feedback_id}` (spec, last section).

## 4. Acceptance tests (run from this workspace; GET only, demo accounts)
```
cd /app/backend/tests/workflow
python -m pytest -q test_wf_b511_backend_admin_acceptance.py   # main backend, called directly
python -m pytest -q test_wf_live_backend_readonly.py -k admin_reads
```
- Today's result: **28 passed, 53 xfailed**. The xfails are the open routes.
- They are `xfail(strict=True)`: once the fix ships they turn red (XPASS), and the markers must then be removed.
- **Done = 0 xfails**: every route gives anon 401 · teacher/learner/HR/guru 403 · admin 200.
- Write routes: verify on a staging copy with a non-admin token and both an empty and a valid body → 403, with no record
  created. Not run against production.

## 5. Already in place on the NOSTOPS side (keep it)
- **B5.1 gateway guard** (`backend/admin_gate.py`): `www.nostops.org/api/admin/*` and `/api/dashboards/admin-stats*`
  already return 401 / 403 / admin 200. Tests: `tests/test_b51_admin_gate.py` (114, mocked),
  `tests/workflow/test_wf_b51_admin_gateway.py` (159, live), `tests/test_t1_b51_admin_gateway_live.py` (278, live).
- Web admin pages and `/bff/admin/*` are admin-only (`lib/server/admin-guard.ts`).
- **This is defense-in-depth only.** Anyone calling `pro-learn-connect-1` directly (mobile app, scripts) bypasses it.

## 6. Outstanding risks until the backend ships
- Signed-in non-admins (and, for admin-stats, anyone on the internet) can read applicant PII, the empanelment roster,
  refunds, disputes and platform revenue directly from the main backend.
- Admin write routes are unverified for non-admins.
- No external confirmation yet. The backend team must confirm the deployed fix and re-run §4.
