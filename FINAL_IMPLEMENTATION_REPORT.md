# NOSTOPS Teacher Authorization — Final Implementation Report (Prompt 33)

Scope: the teacher **status → access-control** system on the NOSTOPS Next.js web
app (SEO frontend over a **read-only** FastAPI proxy to the live backend).
Covers Prompts 9–32. Every item is tagged:

- ✅ **IMPLEMENTED & VERIFIED** — built and confirmed by tests/audit
- 🟡 **IMPLEMENTED, NEEDS PRODUCT DECISION** — working, but a rule/limit needs NOSTOPS/backend confirmation
- 🔴 **NOT IMPLEMENTED** — deferred/blocked

---

## 1. Teacher Status System

### 1a. Backend fields consumed (authoritative record)
Read from `/teachers/me/native-profile`, `/teachers/directory`,
`/admin/empanelment/teachers`, `/teachers/public/{handle}`:

| Field | Meaning |
|---|---|
| `kyc_verified` | Identity KYC complete |
| `kyc_paid` | ₹799 InstaKYC payment done (only on native-profile; **not** in bulk directory) |
| `pan_verified`, `phone_verified` | KYC sub-checks |
| `is_verified` / `verification_status` | Admin-authoritative verification (`verified`/`pending`/`not_verified`) |
| `is_empanelled`, `empanelment_path`, `empanelment_cert` | Council empanelment |
| `tier`, `badge_primary`, `badges` | Level tier + public badges |
| `public_profile_visible`, `is_active`, `suspended_at` | Public visibility gates |
| `city_coordinator_id` | Coordinator assignment |

### 1b. Status values (derived — `lib/teacher-status.ts`)
- **Verification:** `verified` / `pending` / `not_verified`
- **Empanelment:** `empanelled` / `pending` / `not_empanelled`
- **Teacher Level:** `none` / `1 Yoga Shikshak` / `2 Yoga Pracharak` / `3 Council Guru`
- **Operate gate (derived, not stored):** `canOperate` = strict KYC composite
  (`kyc_verified && kyc_paid && is_empanelled`) **AND** admin verification
  (`is_verified === true` || `verification_status === 'verified'`).
- **Host gate:** backend host-eligibility (Level 2+).

### 1c. Admin controls — ✅ / 🟡
`POST /bff/admin/teachers/[id]/status` (admin-only, CSRF-guarded) sets any subset of
Verification / Empanelment / Level and reports a per-field persisted/pending result.
- **Empanelment** → `POST /admin/empanelment/{id}` — ✅ persists today.
- **Verification** → dedicated `POST /admin/teachers/{id}/verification` if live, else
  falls back to the real KYC review flow (`/admin/kyc/{id}/approve|reject`) — ✅ where a
  KYC record exists; 🟡 "Verification = Pending" has no backend equivalent yet.
- **Level** → `POST /admin/teachers/{id}/level` — 🟡 persists when the dedicated
  endpoint is live; reports an honest "activates when live" state otherwise.

---

## 2. Access-Control Matrix (single source of truth: `lib/teacher-access.ts`)

14 teacher features. "Operate" ⇒ requires `canOperate`; "Host" ⇒ requires
host-eligibility (Level 2+). Full state grid in `/app/TEACHER_ACCESS_TEST_MATRIX.md`.

| Feature | Verified? | Empanelled? | Level? |
|---|:--:|:--:|:--:|
| Dashboard | — | — | — |
| Profile | onboarded | — | — |
| InstaKYC | onboarded | — | — |
| Empanelment | onboarded | — | — |
| My Mentor | onboarded | — | — |
| Offerings | ✅ (via canOperate) | ✅ | — |
| Bookings | ✅ | ✅ | — |
| Wallet | ✅ | ✅ | — |
| Refer & Earn | ✅ | ✅ | — |
| Sessions | ✅ | ✅ | — |
| My Widgets | ✅ | ✅ | — |
| City Coordinator | ✅ | ✅ | — |
| Retreat hosting | ✅ | ✅ | **L2+** |
| Venue Studio | ✅ | ✅ | **L2+** |

> "Operate" columns require the **full** gate: strict KYC composite (InstaKYC + ₹799
> payment + empanelment) **and** admin verification. The three access surfaces
> (menu, page guard, API guard) all read this one engine.

Status: ✅ IMPLEMENTED & VERIFIED (`node frontend/tests/verify_access_matrix.ts` → 8 states × 14 features PASS).

---

## 3. Security Audit (final — full report in `/app/SECURITY_AUDIT_teacher_access.md`)
Independent read-only audit this round: **PASS on all 16 controls.**

- **Frontend / UI** ✅ — menu locks derive from `canAccessFeature` (`nav-config.ts`); no
  privilege trust in client state or localStorage.
- **Routes** ✅ — server page guards `enforceTeacherFeature`/`guardTeacherFeature` run
  pre-render; deny → redirect to `/app/teacher/locked`.
- **APIs** ✅ — BFF guards `requireVerifiedTeacher`/`requireFeatureAccess`; the
  premium-enable bypass is closed (enable requires the operate gate).
- **Backend** — treated as untrusted upstream (out of app scope); the app-layer
  whitelists/guards are the enforced boundary.
- **Sessions / cache** ✅ — only an httpOnly bearer is stored; **no permission cached**
  in JWT/session/localStorage; `getSessionUser`/`getTeacherSelfProfile` re-derive
  per request (`no-store`). Admin changes take effect on the teacher's next request.

---

## 4. Issues Found (existing access-control problems)
1. **Premium-enable API bypass** (Prompts 17–20) — an ineligible teacher could enable
   paid 1:1 via `PUT /bff/teacher/premium` from the open edit-profile screen.
2. **Public directory listed non-empanelled teachers** (Prompt 30) — `/teachers` filtered
   only on visibility, so cards could link to profile pages that 404, and could imply a
   public standing the teacher didn't have.
3. **Directory "Verified" pill inconsistent with profile** (Prompt 30) — directory used
   `is_verified` only; profile applied Empanelled ⇒ Verified — same teacher, two claims.
4. **Misleading CSRF comment** (Prompt 32, P3) — comment referenced SameSite=Lax while the
   session cookie is SameSite=None (defense correctly rests on the double-submit token).

## 5. Fixes Applied
1. `PUT /bff/teacher/premium` now requires the operate gate when `enabled:true`
   (saving with `enabled:false` stays open). ✅
2. New single-source gate `lib/public-teacher.ts::isPubliclyListable` (active + visible +
   not-suspended AND Verified + Empanelled) used identically by the directory and profile
   pages — cards can no longer link to 404s. ✅
3. Directory `isVerified = is_verified || is_empanelled` (foundational rule) + profile
   header pills now render only from `p.isVerified`/`p.isEmpanelled`. ✅
4. CSRF comment corrected to describe the token-based defense. ✅

---

## 6. Product Decisions Required (ambiguous rules needing NOSTOPS confirmation)
1. 🟡 **Audit-trail persistence (Prompt 29, option C chosen):** the web app is
   display-only and forwards each change (prev→new + admin + time) best-effort to a
   backend endpoint. **Decision/backend work:** ship
   `GET/POST /admin/teachers/{id}/status-history` (spec in
   `/app/BACKEND_REQUEST_status_audit.md`) for durable, authoritative history.
2. 🟡 **Verification "Pending" & Level assignment persistence:** need dedicated backend
   endpoints (`/admin/teachers/{id}/verification`, `/admin/teachers/{id}/level`). Until
   then those admin choices report an honest "activates when live" state.
3. 🟡 **`kyc_paid` not exposed in bulk:** admin directory/detail views proxy
   `kyc_verified ⇒ kyc_paid`. The strict operate gate uses the real `kyc_paid` from
   native-profile. Confirm the admin-display proxy is acceptable, or expose `kyc_paid` in
   `/teachers/directory`.
4. 🟡 **Admin "Access Privileges" host-eligibility:** projected from the Level catalogue
   (L2+) because backend host-eligibility is queryable only for the logged-in teacher.
   Confirm, or expose a per-teacher host-eligibility read for exactness.
5. 🟡 **Public Teacher-Level policy:** public pages intentionally show Empanelled/Verified
   + backend badges (e.g. "Council Guru") and **do not** print the internal L1/L2/L3
   number. Confirm this is the intended public policy.
6. 🟡 **"Empanelled ⇒ Verified" vs stale KYC data:** some empanelled teachers show
   `kyc_verified=false` (identity) in the record — surfaced with a reconcile note on the
   admin page. Needs backend data reconciliation.

---

## 7. Testing Results (per status combination)

Engine matrix (`verify_access_matrix.ts`) — 8 states × 14 features, **all PASS**:

| State | Scenario | Accessible / 14 |
|---|---|:--:|
| A | Signed-in, not onboarded | 1 |
| B | Fresh teacher (L1) | 5 |
| C | KYC pending (L1) | 5 |
| D | Verified, not empanelled (L1) | 5 |
| E | Operate-eligible (L1) | 12 |
| F | Operate-eligible L2 (host) | 14 |
| G | L3 Council Guru | 14 |
| H | Revoked (operate off, host stays) | 7 |

E2E (frontend testing agent, iterations 61–68 — all PASS): admin status controls;
central engine == menu == URL == API; premium-enable block; host-allowed/earning-locked
split; dynamic locked UX; access-denied toast; teacher status card; admin access
privileges (7+7=14); admin audit-trail card (empty state); public directory (every card
Empanelled+Verified, no 404s); public profile (no private data); auth stability; SEO
(JSON-LD + canonical). **Regression pass (Prompt 31): 6/6 flows, zero bugs.**

---

## 8. Remaining Risks
- 🔴 **Audit history not durable until the backend ships the endpoint** — current
  forward is best-effort; no local store (option C). Mitigation: spec delivered.
- 🟡 **Verification-Pending / Level admin choices** don't persist until backend endpoints
  ship (honest UI messaging in place).
- 🟡 **Stale KYC data** for some empanelled teachers (backend reconciliation).
- 🔴 **Cashfree production 401** — blocked on NOSTOPS account activation (Razorpay
  fallback active).
- 🔴 **Public "Suggest a Venue" (unauthenticated)** — blocked on backend
  `/venue-submissions`; CTAs currently route to the authenticated studio.
- Runtime-only controls (dynamic level/verification/empanelment revocation, stale
  sessions) are guaranteed by per-request `no-store` re-derivation, verified structurally
  + via E2E, not by a long-running live revocation soak test.

---

### Status legend recap
✅ IMPLEMENTED & VERIFIED · 🟡 IMPLEMENTED, NEEDS PRODUCT DECISION · 🔴 NOT IMPLEMENTED

**Bottom line:** the teacher status → access-control system is authoritative,
centralized, and consistent across UI, routes, APIs, admin, dashboard and public pages;
all 16 security controls pass. Remaining open items are backend-dependent (durable audit
persistence, verification-pending/level setters, KYC data reconciliation) or externally
blocked (Cashfree, public venue submissions).
