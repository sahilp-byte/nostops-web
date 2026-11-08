# HANDOFF — Main backend security fixes (B4.7 Critical Backend Security Remediation)

**For:** the team that owns the main NOSTOPS backend `pro-learn-connect-1.emergent.host`
**From:** NOSTOPS web workspace · **Updated:** 2026-06 (B4.7 remediation re-probe)
**Status: OPEN.** The main backend's code is **not in this workspace** and nothing was changed on it from here.
Every observation below comes from GET requests and demo-account logins made **directly** to the main backend.
Evidence: `/app/test_reports/b47_main_backend_probe.json`, `/app/test_reports/b47_idor_probe.json`.

The web gateway (`/app/backend`) and BFF block these issues for traffic through `www.nostops.org`. **That is not a fix**:
the mobile app and anyone calling `pro-learn-connect-1` directly are unaffected by it.

---

## 1. Admin authorization (TVR-01) — P0

### 1a. Current state (50 admin GET routes from the backend's own `/openapi.json`)
Partly fixed since B5.1: `/dashboards/admin-stats` (anon now 401), `/admin/kyc/pending`, `/admin/kyc/audit-log`,
`/admin/empanelment/teachers`, `/admin/empanelment/stats`, `/admin/yogayukt/sync-status` now return 403 to non-admins.

**Still returning 200 to any signed-in learner / teacher / HR / guru:**

| Route | Data exposed |
|---|---|
| `GET /api/admin/kyc/queue` | KYC applicant queue |
| `GET /api/admin/empanelment/pending` | empanelment applicants |
| `GET /api/admin/refunds/pending` | refunds |
| `GET /api/admin/disputes/pending` | disputes |
| `GET /api/admin/lineage/pending` | lineage claims |
| `GET /api/admin/users/recent` | recent sign-ups |
| `GET /api/dashboards/admin-stats-live` | platform revenue / KPIs |
| `GET /api/admin/broadcast-history` | 200 for the **guru** role (403 for learner/teacher/HR) |

Other defects found:
- `GET /api/admin/people/teachers?limit=1000` as a non-admin → **422** (query validation runs **before** the admin check).
- `GET /api/admin/beta-feedback/export.csv` → 404 even for admins (shadowed by `/{feedback_id}`).
- `GET /api/v1/payments/admin/paid-bookings` → 401 for everyone incl. admin sessions (separate admin key — confirm intended).
- Anonymous → 401 on **all** 50 routes ✔. Alternate spellings (trailing slash, `./`, `%2F`, encoded letters) → 401/403/404 ✔.
- Forged role headers / query params (`X-User-Role: admin`, `?role=admin`) do not grant access ✔.

### 1b. Another account's private data by id (IDOR) — P0, new
| Route | Caller | Result |
|---|---|---|
| `GET /api/v1/stats/teacher/{teacher_id}` | **anonymous** / any user | 200 — lifetime & month earnings, wallet balance, withdrawals, reversals, booking counts of **any** teacher |
| `GET /api/users/{user_id}` | **anonymous** / any user | 200 — name, company, location, picture of **any** account (learners and HR included) |
| `GET /api/yoga-teachers/{teacher_id}` | anonymous | 200 — includes `phone`, `premium_session.admin_review_pending`, `admin_seed` |
| `GET /api/v1/teachers/{id}/wallet[/transactions]` | other teacher / anon | 401 ✔ |

Teacher ids and user ids needed for these calls are themselves leaked by the public reads in §2.

### 1c. Required change (patch for the backend team)
Reuse the dependency that already protects `/admin/people/*`, `/admin/payouts/*` and `/admin/audit-log` — no new role system.

```python
# deps.py — the existing session resolver must raise 401 for a missing/invalid bearer token or session cookie.
async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if str(user.get("role") or "").lower() != "admin":      # role from the server-side session only
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_self_or_admin(teacher_id: str, user: dict = Depends(get_current_user)) -> dict:
    if str(user.get("role") or "").lower() == "admin":
        return user
    if teacher_id not in {user.get("teacher_id"), user.get("user_id")}:
        raise HTTPException(status_code=403, detail="Not allowed")
    return user

# main.py — ONE router-level dependency covers every /admin/* route (list, detail, search, export, writes).
admin_router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])
# Router/route dependencies are solved before query/body validation errors are raised,
# so a non-admin gets 403 whatever the parameters or body (fixes the 422 above).
# Move any in-handler `if user.role != "admin"` checks into this dependency.

@router.get("/api/dashboards/admin-stats-live", dependencies=[Depends(require_admin)])
@router.get("/api/v1/stats/teacher/{teacher_id}", dependencies=[Depends(require_self_or_admin)])
@router.get("/api/v1/stats/student/{student_id}")   # same pattern: self or admin
@router.get("/api/v1/stats/org/{organisation_id}")  # same pattern: org member or admin
@router.get("/api/users/{user_id}")                 # authenticated; return public fields only, or self/admin
```
- Register `/admin/beta-feedback/export.csv` **before** `/admin/beta-feedback/{feedback_id}`.
- `broadcast-history`: decide whether gurus may read it; if not, the router dependency fixes it.
- Do not log tokens, cookies, Aadhaar, PAN or bank details on denial.
- Production: disable the public API schema (`FastAPI(openapi_url=None, docs_url=None, redoc_url=None)`), currently
  `/openapi.json`, `/docs` and `/redoc` are public.

## 2. Public API data minimisation — P0 (teacher PII)
Re-probed 2026-06, anonymous GET. Restricted keys still returned:

| Public endpoint | Restricted keys returned |
|---|---|
| `GET /api/teachers/featured`, `/teachers/teacher-of-month`, `/teachers/matching` | `email`, `phone`, `whatsapp`, `user_id`, `payout_account_masked`, `payout_ifsc`, `payout_name_at_bank`, `bank_verified*`, `kyc_*` (incl. `kyc_payment_id`), `pan_verified`, `phone_verified*`, `suspended_*`, `legacy_*`, `admin_*`, `city_coordinator_id`, `is_verified`, `verification_*` |
| `GET /api/teachers/directory` | `kyc_verified`, `pan_verified`, `phone_verified*`, `legacy_*`, `admin_*`, `city_coordinator_id`, `is_test_pollution`, `is_verified`, `verification_*` |
| `GET /api/teachers/public/{handle}`, `/api/yoga-teachers/{id}` | `phone`, `admin_review_pending`, `admin_seed` (+ `kyc_verified`, `is_verified` on some records) |
| `GET /api/council/members` | `user_id` |
| `GET /api/venue-partners` | `venue_cost_per_seat_inr` |
| `GET /api/users/{user_id}` | `user_id`, company, location of any account |

**Required:** an explicit **whitelist** serializer for every public/anonymous read. The fields the website actually renders
(`/app/frontend/lib/teacher.ts` `toPublicTeacher` / `toTeacherProfile`):
`handle, name, city, state, country, bio, parampara, paramparas, parampara_full, experience_years, styles, specializations,
specializations_full, yoga_dimensions, badges, badges_full, badge_primary, tier, is_empanelled, is_featured, rating,
reviews_count, avatar_url, avatar_base64, sample_video_url, languages_spoken, offers_online, offers_in_person,
offers_private_sessions, offers_group_classes, offers_corporate, premium_session{enabled, rate_inr, duration_min,
description}, location{area, lat, lng}, time_zone, created_at, public_profile_visible, is_active` — plus one derived
`nostops_verified` (= `kyc_verified AND is_empanelled`, owner rule) and `id_checked`.
Keep full records on the owner's `/me/*` reads and admin routes. Restricted key list to reuse:
`/app/backend/public_privacy.py` (`RESTRICTED_KEYS`, `RESTRICTED_PREFIXES`).

## 3. One public "Verified" rule — P0 (trust)
Unchanged: public "Verified" = `kyc_verified` AND `is_empanelled`. Stop exposing `is_verified` publicly.
The 8 teachers empanelled without a passed ID check go to the Council review queue (web workspace, B4.8) — no automatic change.

## 4. Payments — P1
Unchanged (see B4.7): preview holds LIVE Cashfree keys; refuse orders whose return/notify URL is not a production host.

## 5. Data clean-up — unchanged (QA/duplicate retreats; broken teacher reference on the "Rate Anjali" booking).

---

## Verification (run by the backend owner in STAGING first, then send the output as evidence)
Point the suite at staging by editing `LIVE` in `/app/backend/tests/workflow/_wf.py` (and `LIVE` in
`/app/backend/tests/scripts/b47_main_backend_probe.py`), then:
```
cd /app/backend/tests/workflow
python -m pytest -q test_wf_b47_main_backend_security.py      # today: 297 passed, 45 xfailed  → done when 0 xfailed
python -m pytest -q test_wf_b511_backend_admin_acceptance.py  # today: 0 failed, xfails = open routes → done when 0 xfailed
python -m pytest -q test_wf_live_backend_readonly.py -k admin
python /app/backend/tests/scripts/b47_main_backend_probe.py   # summary must show no non-admin 200s and no public restricted keys
python /app/backend/tests/scripts/b47_idor_probe.py           # every cross-account row must be 401/403/404
```
Expected after the fix: anonymous 401 · learner/teacher/HR/guru 403 (also with invalid query params) · admin 200 on every
admin route; public reads contain none of the restricted keys; cross-account stats/users reads refused.
xfail markers are strict: each fixed item turns the suite RED (XPASS) — remove the route from
`MAIN_OPEN_ADMIN_ROUTES` / the xfail marker, then rerun.

**Write routes** (`POST /admin/kyc/{id}/approve|reject`, `/admin/empanelment/{id}`, `/admin/teachers/{id}/verification|level`,
`/admin/payouts/approve|reject`, `/v1/payments/admin/refund`, `/admin/broadcast`, `/admin/people/*/suspend|reinstate`,
`DELETE /admin/people/*`, `/admin/maintenance/purge-dummy-teachers` …) were **not** exercised (production only, no staging copy).
Verify on staging with a non-admin token and both an empty and a valid body → 403 with no record created.

Production deployment only after the backend owner shares the staging run above.
