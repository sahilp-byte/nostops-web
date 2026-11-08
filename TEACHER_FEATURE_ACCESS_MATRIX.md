# PROMPT 13 — Teacher Feature Access Matrix (definitive)

> The authoritative, per-feature access matrix for every teacher-facing feature in the NOSTOPS
> Next.js web app. Built from the codebase audit (`TEACHER_FEATURE_INVENTORY.md`,
> `ACCESS_CONTROL_GAPS.md`, `TEACHER_STATUS_MODEL.md`, `ARCHITECTURE_AUDIT_teacher_ecosystem.md`)
> + live backend reads + current code state (June 2026, after Prompts 9–12).
>
> **No eligibility rule is invented here.** Every requirement below is an EXISTING NOSTOPS product
> rule already encoded in code or backend. Where a rule is unclear or newly contradictory it is
> flagged **`PRODUCT DECISION REQUIRED`** (see §D) and is NOT changed until confirmed.

## Legend — the authoritative attributes & gates
- **Verification (attribute)** — the authoritative, admin-set field `is_verified` / `verification_status`
  on the teacher record (Prompts 9–12). Three states: Verified / Pending / Not Verified.
- **Empanelment (attribute)** — authoritative `is_empanelled`. States: Empanelled / Pending / Not Empanelled.
- **Level (attribute)** — authoritative `tier` → L1 Shikshak / L2 Pracharak / L3 Guru (council_guru = L3).
  No-`tier` currently defaults to **L1** (decision D3, previously confirmed).
- **OPERATE gate** — the current runtime gate for earning features: `canOperate` =
  strict composite `kyc_verified && kyc_paid && is_empanelled` (`isTeacherVerified`, decision D2).
  ⚠️ This gate's "verified" half is the **KYC composite**, NOT the admin `is_verified` attribute — the two
  can now diverge (see **D2-bis**).
- **HOST-eligibility** — backend-authoritative `GET /retreats/host-eligibility` (`eligible` + `host_type`);
  the canonical "can host / own venues" gate (L2+). Level catalogue references it; backend is final.
- **onboarded** — a native teacher record exists (`/teachers/me/native-profile.onboarded`).

Requirement columns use: **—** (not required), **Verified**/**Empanelled** (attribute required),
**OPERATE** (strict composite gate), **Host-elig** (backend), **L1/L2/L3** (min level).

---

## 1. Profile & onboarding — open to any onboarded teacher (NOT gated)
| Feature | Verification | Empanelment | Level | Current implementation | Expected | Gap | Correction |
|---|---|---|---|---|---|---|---|
| Dashboard (`/app`) | — | — | — | logged-in + role routing → `TeacherHome`; server-read status | same | none | none |
| Onboarding wizard (`/app/teacher/onboarding`) | — | — | — | any signed-in user; redirect→/profile if onboarded | same | none | none |
| View profile (`/app/teacher/profile`) | — | — | — | role teacher + onboarded (else /app) | same | none | none |
| Edit profile (`/app/teacher/profile/edit`) | — | — | — | role teacher + onboarded; `PATCH /teachers/me/profile` (whitelist rejects tier/is_verified/is_empanelled/kyc_*) | same | none | none |
| Photo & video (`/app/teacher/profile/media`) | — | — | — | role teacher + onboarded | same | none | none |
| My Mentor (`/app/teacher/mentor`) | — | — | — | role teacher | same | none | none |

## 2. Verification / empanelment funnel — role-teacher only (the PATH to the gates)
| Feature | Verification | Empanelment | Level | Current implementation | Expected | Gap | Correction |
|---|---|---|---|---|---|---|---|
| InstaKYC (`/app/teacher/kyc`) | — | — | — | role teacher; verify forms locked until `kyc_paid` (backend+UI) | same | none | none |
| Empanelment hub (`/app/teacher/empanelment`) | — | — | — | role teacher; shows free/fast track | same | none | none |
| Empanelment fast-track (`/app/teacher/empanelment/fast-track`) | — | — | — | role teacher; ₹4,999 Council interview | same | none | none |
| Redeem referral code (`/bff/teacher-referrals/redeem`) | — | — | — | onboarded teacher attaches their referrer (early, pre-verification) | same (onboarding action) | none | none — intentionally NOT OPERATE-gated (attaching a referrer happens before verification) |
| Locked explainer (`/app/teacher/locked`) | — | — | — | role teacher + onboarded; redirect→/app if already OPERATE | same | none | none |

## 3. Earning / operating features — gated by **OPERATE** (strict verified + empanelled)
| Feature | Verification | Empanelment | Level | Current implementation | Expected | Gap | Correction |
|---|---|---|---|---|---|---|---|
| Offerings — paid 1:1 (`/app/teacher/offerings`) | **OPERATE** | **OPERATE** | rate bounds by tier | page: redirect→/locked if `!verified`; BFF `/bff/teacher/premium-config` `requireVerifiedTeacher` ✓; backend gates enabling on profile + empanelment + tier rate-bounds | UI + route + backend agree | none (guard present) | none |
| Bookings 1:1 (`/app/teacher/bookings`) | **OPERATE** | **OPERATE** | — | page redirect→/locked; BFF `/bff/teacher/booking/[id]/[action]` + `/alternatives` `requireVerifiedTeacher` ✓ | same | none | none |
| Wallet & withdrawals (`/app/teacher/wallet`) | **OPERATE** | **OPERATE** | — | page redirect→/locked; BFF `/bff/teacher/wallet/[action]` `requireVerifiedTeacher` ✓; backend: withdraw needs KYC+bank+PIN+OTP | same | none | none |
| Refer & Earn dashboard (`/app/teacher/refer`) | **OPERATE** | **OPERATE** (rewards) | tier-rank ladder (cosmetic) | page redirect→/locked; dashboard read-only (no earning write on this page besides redeem, see §2) | same | none | none |
| Sessions (`/app/teacher/sessions`) | **OPERATE** | **OPERATE** | — | page redirect→/locked (**now gated** per decision D7) | same | none | none |
| My Widgets (`/app/teacher/widgets`) | **OPERATE** | **OPERATE** | — | page redirect→/locked (**now gated** per decision D7); embed gallery empanelled-gated (backend) | same | none | none |

## 4. Retreat hosting — gated by **HOST-eligibility** (L2/L3), independent of OPERATE
| Feature | Verification | Empanelment | Level | Current implementation | Expected | Gap | Correction |
|---|---|---|---|---|---|---|---|
| My retreats (`/app/teacher/retreats`) | — | — (backend) | **Host-elig (L2+)** | access-required empty state if `!eligible && no retreats` | same | none | none |
| Create retreat (`/app/teacher/retreats/new`) | — | — | **Host-elig (L2/L3)** | page requires `elig.eligible` (else →/retreats); backend: venue ≤100 km of registered loc (L2) | same | none | none |
| Manage retreat (`/app/teacher/retreats/[id]`) | — | — | **Host-elig**; cohort-decide **L3/admin** | ownership by `host_user_id`; decide actions council_guru/admin only | same | none | none |
| Cohort review / Drafts / Group dashboard | — | — | **Host-elig** | `isHostUser` guard | same | none | none |

## 5. Venue ecosystem — gated by **canOwnVenues** (host-eligibility L2+)
| Feature | Verification | Empanelment | Level | Current implementation | Expected | Gap | Correction |
|---|---|---|---|---|---|---|---|
| Venue Studio home (`/app/venue`) | — | — | **Host-elig (nav)** | page requires login; nav item shown only when host-eligible | same | Minor: page itself only requires login (relies on nav visibility + write guards) | Low priority — keep page open, writes are guarded (below) |
| Add venue / New listing (`/app/venue/centers/new`, `/listings/new`) | — | — | **L2+ (host-elig)** | page requires `canOwnVenues` (else →/venue); BFF + ownership + CSRF | same | none | none |
| Edit venue (`/app/venue/centers/[id]/edit`) | — | — | owner | ownership-guarded | same | none | none |

## 6. Community & coordination
| Feature | Verification | Empanelment | Level | Current implementation | Expected | Gap | Correction |
|---|---|---|---|---|---|---|---|
| City Coordinator hub/roster (`/app/coordinator`, `/roster`) | **OPERATE** (teacher path) | **OPERATE** | appointed empanelled teachers (L2+) | redirect→/locked only when `role==='teacher' && !verified`; else needs active coordinator record | key off coordinator record, not just role string | **D8** minor: teacher-with-coordinator-record but active role still `teacher` is sent to the teacher gate | Low priority — key coordinator surfaces off the coordinator record |
| Coordinator agreement (`/app/coordinator/agreement`) | **OPERATE** (teacher path) | **OPERATE** | — | redirect→/locked; BFF `/bff/coordinator/assign-me` `requireVerifiedTeacher` ✓ | same | none | none |

---

## D. PRODUCT DECISIONS — resolved & newly-required

### Resolved earlier (this program of work) — encoded, NOT to be reopened without notice
- **D2 (resolved: strict composite):** earning features gate on `canOperate = kyc_verified && kyc_paid && is_empanelled`.
- **D3 (resolved: default L1):** a no-`tier` onboarded teacher displays as **Level 1**.
- **D7 (resolved: gate Sessions & Widgets):** both now redirect to `/locked` when `!OPERATE`. ✓ done.
- **D4 / D5 (resolved):** Pending empanelment = fast-track request undecided / free-track in progress; Pending verification now carried by the authoritative `verification_status` (Prompts 9–12).
- **D6 (resolved: host-eligibility authoritative):** backend `/retreats/host-eligibility` is the runtime "can host" gate; the level catalogue references it.

### `PRODUCT DECISION REQUIRED` — newly surfaced by Prompts 9–12
- **D2-bis — RESOLVED (owner decision = C, BOTH):** earning features (Offerings/Bookings/Wallet/Refer/
  Sessions/Widgets + Coordinator) unlock only when **BOTH** hold — the strict KYC composite
  (`kyc_verified && kyc_paid` ₹799 `&& is_empanelled`) **AND** the authoritative admin verification
  (`is_verified === true` / `verification_status === 'verified'`). Most restrictive. Encoded as
  `deriveTeacherStatus().canOperate` and enforced through `canAccessFeature()` for pages + BFF.
  (`teacher.demo`: `is_verified=true` but `kyc_paid=false` → correctly LOCKED.)
- **D3-bis — "No Level Assigned" vs Level 1 after Prompts 11–12.**
  Admins can now explicitly set **"No Level Assigned"** (clears `tier`). `getTeacherLevel` still defaults a
  cleared tier to **L1** for display. If product wants "No Level Assigned" to be visibly distinct (and to
  gate nothing beyond what host-eligibility already does), the level model needs a `none` display state.
  *Low stakes — level only gates hosting via backend host-eligibility, which is unaffected.*

## Summary of gaps → corrections (implementation, from §D2-bis aside)
1. **Centralisation (Prompt 14):** gating logic is correct but SCATTERED across page guards + one BFF guard.
   → introduce ONE registry + `canAccessFeature()` and route every check through it.
2. **Authoritative reads (Prompt 15):** already server-side (bearer→native-profile); the *Verification attribute*
   should read the authoritative `verification_status`/`is_verified` (done in the admin projection; extend to the
   teacher's own status for display). OPERATE gate stays strict pending D2-bis.
3. **Locked-feature audit (Prompt 16):** earning-write BFF routes are guarded (premium-config/wallet/bookings/
   coordinator). `redeem` and `one-on-one/bookings` are intentionally NOT OPERATE-gated (onboarding / seeker
   actions). Venue Studio home page relies on nav + write guards (writes are guarded). No dead "hidden button
   without server enforcement" found in the earning set. Minor D8 (coordinator record) left low-priority.
