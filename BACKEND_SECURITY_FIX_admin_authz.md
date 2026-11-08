# BACKEND SECURITY FIX — Admin authorization gaps (P0)

**Owner:** NOSTOPS backend team · **Reporter:** web Admin Console port · **Severity:** P0
**Scope:** authorization only — no schema/behavior change for authorized admins.

These gaps are **pre-existing** (the mobile app already calls these endpoints) and are **not
caused by the web Admin Console**. The web adds its own defense-in-depth (admin-only
`/app/admin/*` + `requireAdmin` on every `/bff/admin/*`), but the backend must still be fixed
because it is the authoritative authorization layer and other clients call it directly.

**Expected general behavior for every admin endpoint:**
| Caller | Expected |
|---|---|
| Unauthenticated (no/invalid token) | **401** |
| Authenticated non-admin | **403** |
| Authorized admin | normal **200** response (unchanged) |

Probed live on 2026 with `admin.demo` (admin), `employee.demo` (non-admin seeker), and no token.

---

## A. `GET /api/dashboards/admin-stats` — 🔴 HIGH (world-readable revenue/ops)
- **Method:** GET
- **Current observed:** **200 with NO token** and **200 for non-admin**. Full payload.
- **Expected:** 401 unauth · 403 non-admin · 200 admin.
- **Data currently exposed:** `platform` (total users/teachers/bookings), `financials` (revenue/GMV/commission), `growth`, `engagement`, and `operations` (pending KYC count, empanelment/people queue counts, KYC approval rate, avg processing time).
- **Security impact:** anyone on the internet can read platform revenue and operational load. Business-confidential leak.
- **Recommended change:** require an admin dependency/guard on the route (same dependency used by `/admin/people/*`). If a non-admin "home stats" surface is needed, serve it from the already-public `/home/landing-stats` instead — do not widen `admin-stats`.
- **Regression test:** unauth → 401; seeker token → 403; admin token → 200 containing `operations` + `financials`.

## B. `GET /api/admin/kyc/pending` — 🔴 HIGH (teacher PII to any logged-in user)
- **Method:** GET  ·  **Also affected (same gap):** `GET /api/admin/kyc/queue`, `GET /api/admin/empanelment/pending`, `GET /api/admin/empanelment/teachers`.
- **Current observed:** **200 for non-admin** authenticated user (401 only when fully unauthenticated).
- **Expected:** 401 unauth · 403 non-admin · 200 admin.
- **Data currently exposed:** `/admin/kyc/pending` returns teacher **PII** — name, title, badge/level, bio, certifications, and contact details of applicants; the empanelment endpoints return the full teacher roster (names, cities, ratings); `/admin/kyc/queue` returns queue counts.
- **Security impact:** any authenticated account (e.g. a seeker) can enumerate applicant PII and the review pipeline. Privacy/PII breach.
- **Recommended change:** apply the admin dependency to the entire `/admin/*` router (a router-level `Depends(require_admin)`) so no admin route can be reached by a non-admin. Verify these four specifically.
- **Regression test:** seeker token → 403 on all four; admin → 200; unauth → 401.

## C. `POST /api/admin/broadcast` — 🔴 HIGH (auth order — possible unauthorized broadcast)
- **Method:** POST
- **Current observed:** non-admin caller receives **422** (request-body validation) rather than **403** — i.e. the role check appears to run **after** body validation, so a non-admin submitting a valid body may pass the authorization boundary. (Not executed against production to avoid sending a real broadcast.)
- **Expected:** 401 unauth · **403 non-admin (BEFORE body validation)** · 200 admin.
- **Data/impact:** a non-admin could potentially send an in-app push/announcement to any role — reputational + abuse risk.
- **Recommended change:** make the admin dependency a **route-level dependency** that executes before request-body parsing/validation, so non-admins get 403 regardless of body. Re-verify with an empty body and a valid body as a non-admin.
- **Regression test:** seeker token + empty body → 403; seeker token + valid body → 403 (and **no** broadcast created); admin + valid body → 200.

---

## Recommended one-shot remediation
Attach a single `require_admin` dependency at the **`/admin` router level** (covering every
`/admin/*` route) and add the same dependency to `/dashboards/admin-stats`. Ensure it runs as a
router/route dependency (before body validation). Then run the regression matrix above across
all listed endpoints (unauth 401 · non-admin 403 · admin 200).

**Web note:** until this ships, the web never exposes these endpoints to non-admins — every
`/app/admin/*` page is gated by `requireAdminUser()` and every `/bff/admin/*` proxy by
`requireAdmin(req)` (`lib/server/admin-guard.ts`). The web is not an open relay.

---

## Web authorization matrix — VERIFIED (2026-06, fork)

Non-destructive verification run against the live preview for EVERY admin write BFF route.
Each 401/403 is returned by `requireAdmin` BEFORE any backend call (guard order: CSRF double-submit → session(401) → role(403)), so testing is side-effect free.

Result — identical across ALL 21 state-changing routes:
`nonAdmin=403  unauthenticated=401  missingCSRF=403`
Routes covered: kyc/{id}/approve|reject, empanelment/{id}, empanelment/fast-track/{id}/decide,
people/{teachers|council}/{id}/suspend|reinstate, payouts/approve|reject, bookings/{id}/force-close,
nominations/{id}/advance-to-guru + DELETE, council-roster/{handle} DELETE + reactivate,
interviewers/{handle}/assign, broadcast, beta-feedback/{id}/resolve, venue-monitor/{id}/resync + worker,
totp/setup|verify|disable.
GET reads (csrf:false): beta-feedback/export(now removed), totp/status → nonAdmin=403, unauth=401.
Admin-authorized leg confirmed non-destructively: GET /bff/admin/totp/status as admin → 200; venue re-sync as admin → 200.
=> The web is NOT an open relay regardless of the backend's own 403-gaps.

## NEW backend bug found (web-mitigated, not ours to fix)
GET /api/admin/beta-feedback/export.csv returns 404 {"detail":"Feedback not found"} — it is shadowed by the
parameterised GET /api/admin/beta-feedback/{feedback_id} route (FastAPI matches "export.csv" as a feedback_id).
Backend fix = register the literal `/export.csv` route BEFORE the `/{feedback_id}` route.
Web mitigation shipped: Beta Feedback CSV is generated client-side from the already-fetched admin data
(no backend dependency, no logic duplication); the dead BFF export proxy was removed.
