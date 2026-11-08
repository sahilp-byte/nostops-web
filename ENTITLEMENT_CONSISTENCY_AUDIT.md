# Entitlement Consistency & Enforcement Audit (Prompts 13–16)

Read-only sign-off after the Prompts 1–12 dashboard work, confirming the teacher
entitlement system is a single source of truth, enforced end-to-end, bypass-proof,
and admin-synced. **Result: PASS on all four objectives** (independent security
audit + code review). The Prompts 1–12 changes were display-only and added **no**
authorization risk.

## Prompt 13 — Single source of truth ✅
`Teacher Access = Level + Verification + Empanelment + eligibility` is computed in
ONE place: `lib/teacher-access.ts::canAccessFeature` over an `AccessContext` built
server-side by `lib/server/teacher-access.ts::getTeacherAccessContext`
(status via `deriveTeacherStatus`, host-eligibility via the backend). Every
consumer reads this same engine — they cannot disagree:
- **Menu** → `components/app/nav-config.ts::buildTeacherNav` (locks/hides are
  cosmetic ON TOP of `canAccessFeature`; the new KYC/Empanelment/section hiding
  never grants access).
- **Dashboard visuals** → `TeacherAccessCard` (`summarizeFeatureAccess`) and
  `TeacherNextStep` present the same status; they are not independent gates.
- **Page guards** → `enforceTeacherFeature` / `guardTeacherFeature`.
- **API guards** → `requireFeatureAccess` / `requireVerifiedTeacher`.
No divergent verification/empanelment/level condition exists in any teacher page
or route. (Verified: sidebar-unlocked-vs-dashboard-locked-vs-route-vs-API cannot
diverge because all four call the identical function.)

## Prompt 14 — Backend/API enforcement ✅ (hardened)
Every operate feature's BFF route enforces `requireFeatureAccess` /
`requireVerifiedTeacher` server-side; a hidden button is never the only defense.
- **Hardening applied this round:** the three teacher **host-hosting** write routes
  now enforce host-eligibility locally in addition to the backend —
  `app/bff/teacher/retreats/create`, `app/bff/teacher/retreats/[id]` (PATCH),
  `app/bff/teacher/retreats/[id]/venue` now call
  `requireFeatureAccess('retreat_hosting')` (403/401 when not eligible), so the API
  lock matches the "Retreat hosting" UI lock.
- **Profile save** whitelists fields and cannot self-assign
  `is_verified`/`is_empanelled`/`tier`/`level`; **premium-enable** still requires the
  operate gate.
- **Intentionally ungated (confirmed safe):** `bff/teacher/self-editor` (idempotent
  owner-scoped GET), `bff/retreats/[id]/waitlist` (public, validated/capped), and the
  two `venue-photo`/`venue-thumb` public image proxies.
- **`bff/venue/*` writes** remain backend-authoritative by design: those routes are
  shared with the **venue-owner** role (not a teacher host feature), so a
  teacher-feature gate would be wrong there. They are authenticated (bearer) +
  CSRF-guarded + self-scoped; the backend is the ultimate authority (per Prompt 14).

## Prompt 15 — Direct URL / deep-link / API bypass ✅
Restricted features are denied on every path — not just hidden nav:
- **Direct URL / deep link / bookmark / history / refresh** → server page guard
  runs pre-render and `redirect()`s to `/app/teacher/locked?feature=…`.
- **Modified params / raw API** → BFF guard returns 401 (unauth) / 403 (ineligible).
- **Refresh / new session** → context is re-derived per request (no cached grant).
- The `/app/teacher/locked` page states the specific missing prerequisite.
(Confirmed green repeatedly: iterations 67, 70, 71.)

## Prompt 16 — Admin → teacher sync ✅
Admin changes to Level / Verification / Empanelment propagate automatically, with
NO per-teacher frontend edits:
- **No permission is cached** in JWT / session / localStorage. The teacher's
  `AccessContext` is rebuilt every request from `getTeacherSelfProfile`
  (`force-dynamic`, `no-store`) → so an admin change is reflected on the teacher's
  next load (menu, access card, matrix, page guards and API guards all update
  together).
- The admin mutation route `app/bff/admin/teachers/[id]/status/route.ts` is
  admin-only + CSRF/origin-guarded and calls `revalidatePath` for the review page
  and directory. Level/verification/empanelment persist to the backend (the system
  of record); a change (e.g. L1→L2) unlocks exactly the newly-eligible features via
  the same engine.

## Bottom line
One engine, enforced at UI + route + API, unbypassable, and live-synced with admin
changes. Prompts 1–12 (display) introduced no new risk; this round additionally
hardened the teacher retreat-hosting write APIs with a local eligibility gate.
