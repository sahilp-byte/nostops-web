# Teacher Access Architecture Audit (Prompt 1)

Purpose: document the EXISTING NOSTOPS teacher access implementation as the single
source of truth **before** building the "Your NOSTOPS Access" visual, so no
duplicate status fields, permissions or entitlement logic are introduced.

**Conclusion up front:** a complete, centralized access system already exists. The
new visual (Prompts 2-4) is presentation-only and reuses these modules verbatim —
`lib/teacher-levels.ts`, `lib/teacher-status.ts`, `lib/teacher-access.ts`
(`summarizeFeatureAccess`) and `lib/server/teacher-access.ts`. **No new entitlement
logic or status fields were created.**

## 1. Teacher levels — L1 / L2 / L3
`lib/teacher-levels.ts` — `TEACHER_LEVELS` is the ONE level ladder:
- **L1 Yoga Shikshak** (tier `shikshak`) — Foundation: verified profile, discoverable, group + 1:1.
- **L2 Yoga Pracharak** (tier `pracharak`) — Growth: corporate leads, **retreat + venue hosting**.
- **L3 Yoga Guru** (tiers `guru`, `council_guru` → display "Council Guru") — premium pricing, platform courses.
- Derivation: `getTeacherLevel({tier, badgePrimary})` → `tierToLevel` (preferred) → `badgeToLevel` (fallback) → default **L1**.

## 2. Verification / KYC status
`lib/teacher-status.ts::deriveTeacherStatus` → `verification: 'verified' | 'pending' | 'not_verified'`,
resolved authoritatively from backend `is_verified` / `verification_status` (Empanelled ⇒ Verified).
KYC sub-fields: `kyc_verified`, `kyc_paid`, `pan_verified`, `phone_verified`.

## 3. InstaKYC status & workflow
InstaKYC = `kyc_verified && kyc_paid` (₹799 payment). Screen: `/app/teacher/kyc`
(feature `kyc`). It is a prerequisite of the **operate** gate (§5), not gated itself.

## 4. Empanelment status
`deriveTeacherStatus` → `empanelment: 'empanelled' | 'pending' | 'not_empanelled'` from
backend `is_empanelled` (+ `empanelment_path`, `empanelment_cert`). Admin control:
`POST /admin/empanelment/{id}` via `/bff/admin/teachers/[id]/status`.

## 5. Existing teacher permissions
Two derived gates (no new flags needed):
- **Operate gate** — `deriveTeacherStatus(...).canOperate` = strict KYC composite
  (`kyc_verified && kyc_paid && is_empanelled`) **AND** admin verification
  (`is_verified === true || verification_status === 'verified'`).
- **Level privileges** — `TEACHER_LEVELS[level].privileges` catalogue (e.g. `retreatHosting`,
  `venueStudio` at L2+). Runtime host gate stays backend-authoritative
  (`GET /retreats/host-eligibility`).

## 6. Feature-access / permission guards
`lib/teacher-access.ts` — `FEATURE_RULES` (the ONE registry of 14 teacher features) +
`canAccessFeature(ctx, feature)` (pure decision) + `summarizeFeatureAccess(ctx)`.
Requirements per feature: `requiresOnboarded` / `requiresOperate` / `requiresHostEligible`.
Server context: `lib/server/teacher-access.ts::getTeacherAccessContext` builds the
`AccessContext` from the authenticated record (never client input).

## 7. Sidebar navigation rules
`components/app/nav-config.ts::buildTeacherNav` maps each nav item to a `TeacherFeature`
and calls `canAccessFeature` → locked items render 🔒/LOCKED. `AppShell` shows an inline
"Access denied" toast on a locked tap (no surprise redirect).

## 8. Teacher routes & protected routes
`app/app/teacher/*` pages call `enforceTeacherFeature(feature)` (→ redirect on deny).
Host pages (`/app/teacher/retreats`, `/app/venue`) additionally require backend
host-eligibility. Locked landing: `/app/teacher/locked?feature=…`.

## 9. Backend / API authorization
BFF routes under `app/bff/*` call `requireFeatureAccess` / `requireVerifiedTeacher`
(same engine). Admin mutation routes are admin-only + CSRF/origin-guarded (`badOrigin`).
The premium-enable endpoint requires the operate gate (bypass previously closed).

## 10. Database fields & business logic controlling access
Consumed from the backend record (read-only): `tier`, `badge_primary`, `badges`,
`is_verified`, `verification_status`, `is_empanelled`, `empanelment_path`,
`empanelment_cert`, `kyc_verified`, `kyc_paid`, `pan_verified`, `phone_verified`,
`public_profile_visible`, `is_active`, `suspended_at`, `city_coordinator_id`.

## Inconsistencies (frontend visibility ↔ route ↔ API) — already reconciled
1. **Premium-enable API bypass** — FIXED (enable requires operate gate).
2. **Public directory listed non-empanelled teachers** (cards → 404) — FIXED via
   `lib/public-teacher.ts::isPubliclyListable` used by both directory + profile.
3. **Directory "Verified" pill inconsistent with profile** — FIXED (Empanelled ⇒ Verified).
Standing notes (documented, not defects): `kyc_paid` isn't in the bulk directory, so
admin views proxy `kyc_verified ⇒ paid`; host-eligibility is queryable only for the
logged-in teacher (admin summary projects L2+ from the catalogue). See
`SECURITY_AUDIT_teacher_access.md`, `DYNAMIC_PERMISSIONS_AUDIT.md`,
`PUBLIC_PROFILE_AUDIT.md`, `FINAL_IMPLEMENTATION_REPORT.md`.

**No duplication introduced:** the "Your NOSTOPS Access" visual derives level from
`teacher-levels.ts`, status from `teacher-status.ts`, and per-feature state from
`teacher-access.ts::summarizeFeatureAccess` — the identical sources used by the admin
dashboard, nav, page guards and API guards.
