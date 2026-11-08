# PROMPT 2 — Existing Teacher Feature Inventory (current state, NO rule changes)

> Read-only audit of every teacher-facing feature in the NOSTOPS Next.js web app, captured BEFORE the
> new authoritative access-control system. Source: live code (`app/app/**`, `app/bff/**`, `lib/server/**`)
> + live backend `/teachers/me/native-profile`. Backend is read-only. Companion to
> `/app/ARCHITECTURE_AUDIT_teacher_ecosystem.md` and `BUSINESS_LOGIC.md`.

---

## 0. How access is decided today (the 3 signals every feature reads)

| Signal | Source | Meaning |
|---|---|---|
| **role === 'teacher'** | `normalizeRole(user.role)` (`/auth/me`) | User's persona is Teacher |
| **onboarded** | `getTeacherSelfProfile()` → `/teachers/me/native-profile` `.onboarded` | A native teacher record exists |
| **verified** (strict) | `getTeacherGate()` → `isTeacherVerified(self)` = `kycVerified && kycPaid && isEmpanelled` | Completed InstaKYC + ₹799 payment + empanelment |
| **host-eligible** | `getHostEligibility()` → `/retreats/host-eligibility` `.eligible` (+ `.host_type`) | Backend-authoritative hosting right (L2 Pracharak / L3 Guru / Council Guru — never L1) |
| **canOwnVenues** | `venue-owner.getVenueOwnerState()` = `elig.eligible \|\| host_type==='council_guru' \|\| has existing centers/listings/partnerships` | May create/manage venues |
| **level (L1/2/3)** | `getTeacherLevel({tier,badgePrimary})` (`lib/teacher-levels.ts`) from backend `tier` (`shikshak/pracharak/guru/council_guru`) | Display + privilege catalogue (hosting is L2+) |

- **Authorization layers** (see `BUSINESS_LOGIC.md §1`): (1) `proxy.ts` unauth `/app/*`→`/login` + CSRF cookie; (2) `app/app/layout.tsx` session revalidation; (3) per-page `redirect()` guards below; (4) BFF writes require double-submit CSRF (`badOrigin`) and the backend is the FINAL authority (bearer token; ownership/tier/empanelment/withdrawal all enforced server-side).
- **Verified redirect target:** gated pages send unverified teachers to `/app/teacher/locked?feature=<name>` (a "get verified" explainer). Nav marks the same items 🔒 (`TEACHER_LOCKED_UNTIL_VERIFIED`).

**`TEACHER_LOCKED_UNTIL_VERIFIED` (nav 🔒 + page redirect):** Offerings · Bookings · Wallet · Refer & Earn · City Coordinator · Coordinator Agreement.

---

## 1. Profile & onboarding (open once onboarded — NOT verification-gated)

| Feature | Route | Backend endpoint(s) | Page access guard | UI lock (nav) | Backend authz | All teachers or restricted | Level logic | Verification/empanelment logic |
|---|---|---|---|---|---|---|---|---|
| Dashboard | `/app` (`TeacherHome`) | `/teachers/dashboard`, `/teachers/me/onboarding-state`, `/teachers/me/empanelment-progress`, `/teachers/me/native-profile` (journey) | logged-in; role routing → TeacherHome; shows "Become a teacher" if no record | none | bearer | **All** teachers | Shows L1–L3 progression, level badge, level-up guide, timeline | Shows verification checklist + empanelment path when unverified |
| Onboarding wizard | `/app/teacher/onboarding` | `POST /teachers/native-register`, `/teachers/ai-bio-suggest`, handle-check | logged-in; **redirect→/profile if already onboarded** | hidden once onboarded | bearer + CSRF | **Any signed-in user** (creates record, flips role→teacher) | assigns none directly | Entry point to the whole verification funnel |
| View profile | `/app/teacher/profile` | `/teachers/me/native-profile`, `/codex` | role teacher **+ onboarded** (else /app) | always | bearer | **All** onboarded teachers | shows badge/tier | read-only |
| Edit profile | `/app/teacher/profile/edit` | `PATCH /teachers/me/profile`, `PUT` social, `PUT` premium, availability, location | role teacher + onboarded | always | bearer + CSRF | **All** onboarded teachers | — | — |
| Photo & video | `/app/teacher/profile/media` | `POST/DELETE /teachers/me/avatar`; `/teachers/me/video-intro/*` (Cloudinary) | role teacher + onboarded | always | bearer + CSRF | **All** onboarded teachers | — | Video is step 2 of onboarding protocol (optional) |
| My Widgets | `/app/teacher/widgets` | `/teachers/me/journey`, `/teachers/me/embeds`, `/dashboards/teacher-stats`, referrals | role teacher; redirect→/onboarding if no widget state | always | bearer | **All** onboarded teachers | — | website-embed gallery is **empanelled-gated** (backend) |

## 2. Verification funnel (role-teacher only; the path to `verified`)

| Feature | Route | Backend endpoint(s) | Page access guard | UI lock | Backend authz | All/restricted | Level logic | Verification/empanelment logic |
|---|---|---|---|---|---|---|---|---|
| InstaKYC | `/app/teacher/kyc` | `/kyc/sandbox/status`; create/verify-payment; Aadhaar-OKYC/PAN/Bank verify | role teacher | always | bearer + CSRF | **All** teachers | — | THE identity + ₹799 payment step; verify forms **locked until `kycPaid`** (backend + UI) |
| Empanelment hub | `/app/teacher/empanelment` | `/teachers/me/empanelment-progress` | role teacher | always | bearer | **All** teachers | — | Free-track (≥5 paid sessions + ≥4★ + reviews + Council interview) vs Fast-track |
| Empanelment fast-track | `/app/teacher/empanelment/fast-track` | `/empanelment/fast-track/offer`, `/my-status`; initiate + pay (₹4,999) | role teacher | always | bearer + CSRF | **All** teachers | — | Paid Council interview → empanelment |
| Locked explainer | `/app/teacher/locked?feature=` | `getTeacherGate()` | role teacher + onboarded; **redirect→/app if already verified** | — | bearer | Only unverified onboarded teachers | — | Renders the 3-step VerificationChecklist + per-feature teasers |

## 3. Earning / operating features (role + onboarded + **VERIFIED** — the gated set)

| Feature | Route | Backend endpoint(s) | Page access guard | UI lock | Backend authz | All/restricted | Level logic | Verification/empanelment logic |
|---|---|---|---|---|---|---|---|---|
| Offerings (paid 1:1) | `/app/teacher/offerings` | `PUT /teachers/me/premium-session-config` (returns tier_rules) | role + onboarded + **verified** (else /locked) | 🔒 until verified | bearer + CSRF; backend gates **enabling** on profile completeness + **empanelment**; **tier-based rate bounds** | **RESTRICTED** (verified only) | **rate min/max by `tier`** (backend tier_rules) | requires empanelment to enable |
| Bookings (1:1) | `/app/teacher/bookings` | `/one-on-one/my-bookings`; accept/decline/complete/reassign | role + onboarded + **verified** (else /locked) | 🔒 until verified | bearer + CSRF | **RESTRICTED** (verified only) | — | exist only once offerings live |
| Sessions | `/app/teacher/sessions` | `/premium-sessions/my` | role + onboarded (**NOT** verified-gated) | always | bearer | **All** onboarded teachers | — | list only |
| Wallet & withdrawals | `/app/teacher/wallet` | `/teacher-wallet/unified-summary`, `/payout-details`, `/balance`; setup-pin/otp/withdraw; wallet top-up | role + onboarded + **verified** (else /locked) | 🔒 until verified | bearer + CSRF; **withdrawal needs KYC + bank + PIN + OTP** | **RESTRICTED** (verified only) | 15% platform fee | referral wallet rewards require empanelment |
| Refer & Earn | `/app/teacher/refer` | `/teacher-referrals/dashboard` | role + onboarded + **verified** (else /locked) | 🔒 until verified | bearer | **RESTRICTED** (verified only) | tier-rank ladder (Bronze→Ambassador) | rewards require **empanelment** |

## 4. Retreat hosting (gated by **host-eligibility**, NOT by the KYC/verified gate)

| Feature | Route | Backend endpoint(s) | Page access guard | UI lock | Backend authz | All/restricted | Level logic | Verification/empanelment logic |
|---|---|---|---|---|---|---|---|---|
| My retreats | `/app/teacher/retreats` | `/retreats/my-hosted` | logged-in; access-required empty state if `!eligible && no retreats` | — | bearer | **RESTRICTED** to host-eligible | **L2/L3 only** (backend host-eligibility) | independent of verified flag (an eligible L2/L3 can host even if `verified` is false) |
| Create retreat | `/app/teacher/retreats/new` | `POST /retreats/create`; rate-context; host base location | logged-in; **`elig.eligible` required** (else →/retreats) | — | bearer + CSRF; venue within 100 km of registered loc (L2) | **RESTRICTED** host-eligible | **L2 Pracharak / L3 Guru** | — |
| Manage retreat | `/app/teacher/retreats/[id]` | `/retreats/{id}`, `/edit-lock`, `/reservations`, invites, cohort | logged-in; teacher role **or** host-eligible; **ownership by `host_user_id`**; decide actions only `council_guru`/`admin` | — | bearer + CSRF + ownership guard | **RESTRICTED** owner/host | cohort-decide = **Council Guru (L3) / admin** | — |
| Cohort review | `/app/teacher/retreats/[id]/cohort/[cohort]` | cohort endpoints | logged-in; `isHostUser` | — | bearer | **RESTRICTED** host | — | — |
| Drafts | `/app/teacher/retreats/drafts` | `/retreats/my-hosted` (draft) | logged-in; `isHostUser` | — | bearer | **RESTRICTED** host | — | — |
| Group/Retreat dashboard | `/app/teacher/dashboard` | host/retreat aggregates | logged-in; `isHostUser` (else →/retreats) | — | bearer | **RESTRICTED** host | — | — |

## 5. Venue ecosystem (gated by **canOwnVenues** / host-eligibility)

| Feature | Route | Backend endpoint(s) | Page access guard | UI lock | Backend authz | All/restricted | Level logic | Verification/empanelment logic |
|---|---|---|---|---|---|---|---|---|
| Venue Studio home | `/app/venue` | `/retreats/centers/mine`, listings, partnerships | logged-in | nav item shown only when **host-eligible** | bearer | **RESTRICTED** (nav) to host-eligible; page itself only requires login | **L2+** (via host-eligibility) | — |
| Add venue (center) | `/app/venue/centers/new` | `POST /retreats/centers` (via `/bff/venue/centers`) | logged-in + **`canOwnVenues`** (else →/venue) | — | bearer + CSRF | **RESTRICTED** | L2+ (host-eligibility) | — |
| Edit venue | `/app/venue/centers/[id]/edit` | `/retreats/centers/{id}` + google connect | logged-in | — | bearer + CSRF + ownership | **RESTRICTED** owner | — | — |
| New listing | `/app/venue/listings/new` | listings endpoint | logged-in + **`canOwnVenues`** (else →/venue) | — | bearer + CSRF | **RESTRICTED** | L2+ | — |

## 6. Community & coordination

| Feature | Route | Backend endpoint(s) | Page access guard | UI lock | Backend authz | All/restricted | Level logic | Verification/empanelment logic |
|---|---|---|---|---|---|---|---|---|
| My Mentor | `/app/teacher/mentor` | `/teachers/me/mentor-view` | role teacher | always | bearer | **All** teachers | — | shows assigned Council Guru |
| City Coordinator hub | `/app/coordinator` | `/coordinators/me`, `/coordinators/me/dashboard` | logged-in; **if role teacher & !verified → /locked**; else needs active coordinator record | 🔒 until verified (for teachers) | bearer | **RESTRICTED**: verified teachers appointed as coordinators | coordinators are **empanelled teachers** (L2+) appointed to the role | requires **verified** (teacher path) + active coordinator record |
| Coordinator roster | `/app/coordinator/roster` | `/coordinators/me/dashboard` | same as hub | 🔒 until verified | bearer | **RESTRICTED** | — | requires verified + coordinator record |
| Coordinator agreement | `/app/coordinator/agreement` | `POST /bff/coordinator/assign-me` | same as hub | 🔒 until verified | bearer + CSRF | **RESTRICTED** | — | requires verified (teacher path) |

---

## 7. Existing Level (L1/L2/L3) logic — summary
- **Source:** backend `tier` (`shikshak`→L1, `pracharak`→L2, `guru`/`council_guru`→L3); fallback = primary badge. Consolidated in `lib/teacher-levels.ts` (single map: labels, colours, unlocks, privileges, headline perk).
- **Where level actually gates access today:** ONLY **retreat/venue hosting** — via the backend `/retreats/host-eligibility` (L2 Pracharak / L3 Guru / Council Guru; never L1). `canOwnVenues` derives from the same eligibility.
- **Where level gates within a feature:** Offerings **rate bounds** come from backend `tier_rules`; retreat **cohort-decide** is Council Guru (L3)/admin only.
- **Where level is only cosmetic:** dashboard progression ladder, header level badge, level-up guide, timeline, next-level teaser (all display; no gating).

## 8. Existing verification / empanelment logic — summary
- **`verified` (strict)** = `kycVerified && kycPaid && isEmpanelled` (`isTeacherVerified`). Gates the "earning/operating" set (§3) + coordinator surfaces (§6) via page redirect to `/app/teacher/locked` and nav 🔒.
- **KYC:** `/kyc/sandbox/status` (Aadhaar OKYC + PAN + Bank) + one-time ₹799 payment (`kycPaid`). Verify forms locked until paid.
- **Empanelment:** free-track (merit: ≥5 paid sessions, ≥4★, ≥10 reviews, Council interview) or fast-track (₹4,999 paid Council interview). Progress via `/teachers/me/empanelment-progress`; fast-track via `/empanelment/fast-track/*`.
- **Backend-only sub-gates (not re-implemented on web):** enabling Offerings (profile+empanelment), wallet withdrawal (KYC+bank+PIN+OTP), referral rewards (empanelment), website-embed gallery (empanelment).

## 9. Restricted vs open — quick verdict
- **Open to all onboarded teachers:** Dashboard, Profile (view/edit/media), Sessions, My Widgets, My Mentor, InstaKYC, Empanelment (+fast-track).
- **Restricted to VERIFIED teachers:** Offerings, Bookings, Wallet, Refer & Earn, City Coordinator (+roster/agreement).
- **Restricted to HOST-ELIGIBLE (L2/L3):** Retreats (all host pages), Venue Studio (+centers/listings).
- **Council Guru (L3)/admin only within hosting:** retreat cohort decisions.

> Rules unchanged. This inventory is the baseline for the forthcoming authoritative access-control system.
