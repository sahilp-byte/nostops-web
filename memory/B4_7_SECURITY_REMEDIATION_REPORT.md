# NOSTOPS — B4.7 Critical Backend Security Remediation · Report

**Date:** 2026-06 · **Environment:** development/preview workspace only · **Production:** untouched (no deploy, no publish,
no production data changed, no write requests sent to the main backend).

**Security finding status: OPEN** — the main backend itself has **not** passed verification.

## 0. Who owns what
| Service | Where | Owner | Access from here |
|---|---|---|---|
| Main backend `pro-learn-connect-1.emergent.host` (FastAPI, 646 routes per its public `/openapi.json`) | separate service, separate deployment | main-backend team (no named contact in this workspace) | **No code access.** HTTP only. |
| NOSTOPS gateway `/app/backend` (proxy + local modules) | this workspace | NOSTOPS web | full |
| Website / BFF `/app/frontend` (Next.js) | this workspace | NOSTOPS web | full |

So, per Task D, **no fix was made to the main backend**. A patch, test suite and checklist were prepared for its owner.

## 1. Root cause and affected endpoints
- **Admin authorization is checked per route, inside handlers, instead of once at the `/admin` router.** Routes that miss
  the check serve admin data to anyone signed in. Where the check sits inside the handler, query validation runs first (422
  for non-admins).
- **Public reads serialize the whole teacher document** instead of using a whitelist.
- **Per-account reads by id have no ownership check.**

Current state (re-probed directly against the main backend, 2026-06):
- Partly fixed since B5.1: `/dashboards/admin-stats` (anon now 401), `/admin/kyc/pending`, `/admin/kyc/audit-log`,
  `/admin/empanelment/teachers`, `/admin/empanelment/stats`, `/admin/yogayukt/sync-status` now 403 for non-admins.
- **Still 200 to any signed-in learner/teacher/HR/guru:** `/admin/kyc/queue`, `/admin/empanelment/pending`,
  `/admin/refunds/pending`, `/admin/disputes/pending`, `/admin/lineage/pending`, `/admin/users/recent`,
  `/dashboards/admin-stats-live`. `/admin/broadcast-history` is 200 for gurus.
- **New P0 (IDOR):** `/v1/stats/teacher/{id}` gives **anyone, even anonymous callers**, another teacher's earnings, wallet
  balance and withdrawals. `/users/{id}` gives anyone any account's company and location. `/yoga-teachers/{id}` publishes phone numbers.
- **Public PII:** `/teachers/featured`, `/teacher-of-month`, `/matching` return email, phone, WhatsApp, payout IFSC/
  masked account/name at bank, KYC payment id and flags, suspension and admin markers. `/teachers/directory`,
  `/teachers/public/{handle}`, `/council/members` and `/venue-partners` also leak fields (full table in the handoff, §2).
- Also: the 422-before-403 on `/admin/people/teachers?limit=1000`; `/admin/beta-feedback/export.csv` gives 404 even to
  admins; the API schema (`/openapi.json`, `/docs`, `/redoc`) is public.

## 2. Files and services changed (this workspace only)
| File | Change |
|---|---|
| `backend/tests/workflow/test_wf_b47_main_backend_security.py` | **new**: Task C suite, run directly against the main backend |
| `backend/tests/scripts/b47_main_backend_probe.py`, `b47_idor_probe.py` | **new**: read-only evidence probes (status codes and key **names** only) |
| `backend/tests/workflow/_wf.py` | shared list of still-open main-backend routes |
| `backend/tests/workflow/test_wf_b511_backend_admin_acceptance.py`, `test_wf_live_backend_readonly.py` | xfail markers updated to the re-probed state (fixed routes are now hard assertions) |
| `backend/admin_gate.py` | gateway defense-in-depth: `/api/v1/stats/{teacher,student,org}/*` now admin-only at the gateway (the website never reads them) |
| `backend/public_privacy.py` | gateway minimises `/api/yoga-teachers/{id}` and `/api/users/{id}` (removes phone and user ids) |
| `backend/tests/test_b51_admin_gate.py` | unit tests for both gateway additions |
| `backend/tests/workflow/test_wf_b47_privacy_payments.py` | production-host regression test now sends a valid B4.8 offer type |
| `BACKEND_HANDOFF_B47_main_backend.md` | rewritten: current evidence, code-level patch, staging verification checklist |

The gateway changes are **not** the fix. They only cover traffic through `www.nostops.org`.

## 3. Actual test results (2026-06)
| Suite | Target | Result |
|---|---|---|
| `test_wf_b47_main_backend_security.py` | **main backend, direct** | **297 passed, 45 xfailed, 0 failed** (xfail = open findings) |
| `test_wf_b511_backend_admin_acceptance.py` + `test_wf_live_backend_readonly.py` | main backend, direct | 94 passed, 43 xfailed, 0 failed |
| `test_b51_admin_gate.py` | gateway (mocked upstream) | 124 passed |
| `test_wf_b51_admin_gateway.py` + `test_t1_b51_admin_gateway_live.py` + `test_b47_local_admin_authz.py` | gateway + local admin routes | 916 passed |
| `test_wf_b47_privacy_payments.py` | gateway / website privacy and payment isolation | 62 passed (1 failure fixed: test payload outdated by the B4.8 amount check) |

The xfails are strict: each one turns RED as soon as the main backend fixes it.

## 4. Not tested
- **All main-backend write routes** (KYC approve/reject, empanelment decisions, verification/level, payouts, refunds,
  broadcast, suspend/reinstate/delete, maintenance purge). Only production exists, and writes are forbidden. These must be
  verified on staging by the owner.
- Admin routes with a real record id (detail pages): only probed with a non-existent id (non-admin 403 ✔, admin 404).
- `/bookings/admin/{token}` (token-based, 404 for a fake token); `/v1/payments/admin/paid-bookings` (separate admin key;
  denies everyone with a session).
- The mobile app was not tested; it calls the main backend directly, so the same findings apply to it.

## 5. Evidence that direct requests are denied to non-admins (where fixed)
`/app/test_reports/b47_main_backend_probe.json`, 50 admin GET routes × 6 roles, called directly:
- anonymous → **401 on all 50**;
- 34 routes: learner/teacher/HR/guru **403**, admin 200;
- 7 routes (+1 for guru): non-admin **200**. Still open, listed in §1;
- spoofed role headers/params → 403; garbage token → 401; alternate spellings → 401/403/404.

## 6. Evidence for public API responses
- Main backend, direct: **7 of 10 public reads still carry restricted fields** (key names are in the probe file, no values).
  Clean: `/council/wall-of-authority`, `/council/hero-stats`, `/retreats`.
- Through the NOSTOPS gateway/website: 0 restricted fields (`test_wf_b47_privacy_payments.py`, 62 passed), now including
  `/api/yoga-teachers/{id}` and `/api/users/{id}`.

## 7. Backend owner and deployment status
- Owner: main-backend team (`pro-learn-connect-1`). Handoff: `/app/BACKEND_HANDOFF_B47_main_backend.md`.
- Deployment status: **not fixed and not deployed.** Some admin routes were fixed upstream since B5.1, but this workspace
  has no confirmation, changelog or staging evidence for that.
- Required before production: the owner runs the checklist in handoff §"Verification" **on staging** (0 xfails, probes
  clean, write routes 403 for non-admins with no record created) and shares the output.

## 8. Remaining blockers and rollback
**Blockers:** main-backend code access or owner action (admin dependency, whitelist serializers, IDOR checks, schema
exposure); a staging copy for write-route tests.

**Rollback (this workspace only):**
- Gateway: revert the `is_admin_path` addition in `backend/admin_gate.py` and the `yoga-teachers|users` line in
  `backend/public_privacy.py`, then run `sudo supervisorctl restart backend`.
- Tests and docs: test-only and documentation changes; reverting them has no runtime effect.
