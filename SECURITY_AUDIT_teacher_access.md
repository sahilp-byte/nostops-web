# SECURITY AUDIT — Teacher restricted-feature access (Prompts 17–20)

> Scope: every restricted teacher feature, its API endpoints, direct-URL protection, and client-side
> permission storage. Architecture: browser → **Next.js BFF (server I control)** → **FastAPI (final
> authority, remote/read-only)**. The BFF holds the FastAPI bearer in an **httpOnly cookie** and never
> returns it to the browser; the FastAPI independently enforces identity + ownership + eligibility.
> No parallel security system was introduced — this reuses the existing NOSTOPS auth (`getSessionUser`
> via `/auth/me`) + the central eligibility engine from Prompts 14–16 (`lib/teacher-access.ts`).

## PROMPT 20 — Where teacher permissions live (client-side audit) → SAFE
| Store | Holds authorization? | Finding |
|---|---|---|
| **React state** | UX only | Nav 🔒 / disabled buttons come from a SERVER-rendered `verified/hostEligible` (layout is a server component reading the authoritative record). Client state mirrors it for UX; it is never the boundary. |
| **localStorage** | **No** | Only UX/device data: wishlist (`saved`), home-city filter, per-device practice notes, retreat drafts, local reservations cache, cohort notes, unlock-celebration dismissal. No role/level/verification/empanelment stored. Manipulating any of it changes nothing server-side. |
| **sessionStorage** | No | Not used for permissions. |
| **JWT claims** | N/A | The app does not decode a JWT on the client. The FastAPI bearer is opaque to the browser (httpOnly cookie) — role/status are resolved server-side via `/auth/me` and `/teachers/me/native-profile`, never from a client-decoded token. |
| **Cookies** | Session only | `SESSION_COOKIE` is **httpOnly + Secure + SameSite=None + Partitioned** → unreadable/unwritable by JS. A separate double-submit CSRF token cookie is the only JS-readable cookie and grants no privilege. |
| **Cached API responses** | UX only | Public ISR pages are anonymous data. Authoritative teacher status is fetched `no-store` server-side per request; a stale client cache cannot elevate access because every guard re-reads the record server-side. |

**Conclusion (Prompt 20):** client state is UX-only and can become stale or be tampered with WITHOUT
affecting authorization. Server-side authorization is authoritative. No fix required.

## PROMPT 17 & 18 — Endpoint / feature enforcement matrix
Legend: **AUTHED** = server attaches the httpOnly bearer (identity from `/auth/me`, not client) ·
**CSRF** = `badOrigin` double-submit check · **OPERATE** = `requireVerifiedTeacher` (strict KYC composite
AND admin `is_verified` AND empanelled — decision D2-bis=C) · **BACKEND** = FastAPI independently enforces
(ownership / host-eligibility / tier / KYC) · **ADMIN** = BFF requires `role==='admin'`.

### Trust check — does any endpoint trust client-supplied status/level?  → NO (for a teacher's own privileges)
- `PATCH /bff/teacher/profile` **whitelists** `name,bio,city,phone,parampara,root_guru_name,root_guru_location,
  lineage_declaration,styles,specializations,languages_spoken,yoga_dimensions,experience_years,is_available`.
  It **silently drops** `tier`, `level`, `is_verified`, `verification_status`, `is_empanelled`, `badges`, `kyc_*`.
  → a teacher **cannot self-promote** by editing their profile. ✅
- `POST /bff/admin/teachers/[id]/status` DOES accept `verification/empanelment/level` — but it is **ADMIN-only**
  and acts on ANOTHER teacher's id (the authoritative admin path from Prompts 9–12), never a self-serve lever. ✅
- `role` in `auth/otp-verify` / `auth/*` is a login persona HINT; the FastAPI authenticates the real account and
  returns the authoritative `role`, which the BFF re-checks (`normalizeRole(user.role)`). Sending `role:'admin'`
  cannot mint an admin session. ✅

### Earning features (OPERATE-gated)
| Endpoint | Who | Server checks authoritative record? | Trusts client status? | Direct-invoke bypass? | Correction |
|---|---|---|---|---|---|
| `PUT /bff/teacher/premium-config` | teacher | OPERATE + AUTHED + CSRF; backend tier/empanelment | No | No | none |
| `PUT /bff/teacher/premium` (edit-profile path) | teacher | **NOW** OPERATE when `enabled:true` + AUTHED + CSRF; backend tier | No | **FIXED** | **Added OPERATE guard on enable** — was the one real bypass (open Edit-profile could enable paid sessions for an empanelled-but-no-KYC teacher). |
| `POST /bff/teacher/booking/[id]/[action]` | teacher | OPERATE + AUTHED + CSRF; backend ownership | No | No | none |
| `POST /bff/teacher/booking/[id]/alternatives` | teacher | OPERATE + AUTHED + CSRF | No | No | none |
| `POST /bff/teacher/wallet/[action]` | teacher | OPERATE + AUTHED + CSRF; backend KYC+bank+PIN+OTP on withdraw | No | No | none |
| `POST /bff/coordinator/assign-me` | teacher | OPERATE + AUTHED + CSRF; backend coordinator record | No | No | none |
| Sessions / Widgets / Refer dashboards | teacher | read-only (no earning write); pages OPERATE-gated | No | No | none |
| `POST /bff/teacher-referrals/redeem` | onboarded teacher | AUTHED + CSRF; backend attaches referrer | No | No | intentionally NOT OPERATE-gated (attaching a referrer is a pre-verification onboarding action) |

### Hosting / venue features (host-eligibility L2+)
| Endpoint | Who | Server checks authoritative record? | Trusts client status? | Bypass? | Correction |
|---|---|---|---|---|---|
| `POST /bff/teacher/retreats/create` | host-eligible | AUTHED + CSRF; **backend host-eligibility** (venue ≤100 km, L2) | No | No | none — backend independently enforces host-eligibility |
| `PATCH /bff/teacher/retreats/[id]`, `/venue`, retreat-cover | owner | AUTHED + CSRF; **backend ownership** (`host_user_id`) | No | No | none — ownership is the correct gate, enforced server-side |
| `POST /bff/venue/centers`, `/listings` | host-eligible | AUTHED + CSRF; **backend** `canOwnVenues` + ownership | No | No | none |
| `PATCH/DELETE /bff/venue/centers/[id]`, `/partnerships/*` | owner | AUTHED + CSRF; backend ownership | No | No | none |

### Council-guru / admin features
| Endpoint | Who | Enforcement | Correction |
|---|---|---|---|
| `POST /bff/guru/empanelment/[id]/[action]`, `guru/vouch/*`, `guru/editorial/*` | council_guru/admin | AUTHED + CSRF; **backend requires council_guru/admin** | none — a plain teacher is rejected by the FastAPI `/guru/*` authorization |
| `POST /bff/admin/**` (teacher status, venue-submissions) | admin | ADMIN (BFF `role==='admin'`) + AUTHED + CSRF | none |

### Non-teacher-privilege state-changing POSTs (out of teacher-restriction scope)
- `POST /bff/beta/feedback` and `POST /bff/retreats/[id]/waitlist` are AUTHED but lack the `badOrigin`
  CSRF check and are unthrottled. Not a teacher-eligibility bypass, but noted as a **hardening backlog item**
  (rate-limit + CSRF the anonymous forms) — tracked separately.

## PROMPT 19 — Direct-URL protection across teacher states
Every restricted teacher PAGE is a server component that calls `enforceTeacherFeature(feature)` /
`guardTeacherFeature('coordinator')` (Prompts 14–16) BEFORE rendering — so typing the URL directly triggers a
real server-side `redirect()`, not a client hide. Expected outcomes by state (feature → result):

| State (authoritative record) | Earning (offerings/bookings/wallet/refer/sessions/widgets, coordinator) | Hosting (retreats/venue) |
|---|---|---|
| **Unverified** (no KYC) | 🔒 → `/app/teacher/locked` | per host-eligibility |
| **Verified (KYC) but NOT empanelled** | 🔒 → `/app/teacher/locked` (empanelment missing → `canOperate=false`) | per host-eligibility |
| **Level 1 (shikshak), operate-eligible** | ✅ allowed | host-eligibility usually false → 🔒 → `/app/teacher/retreats` |
| **Level 2 (pracharak), operate-eligible + host-eligible** | ✅ allowed | ✅ allowed |
| **Level 3 (guru/council), operate-eligible + host-eligible** | ✅ allowed | ✅ allowed |

- Live account `teacher.demo` (empanelled, `is_verified=true`, but `kyc_paid=false` → NOT operate-eligible;
  host_type `teacher_pracharak` → **host-eligible L2**) demonstrates the split: earning URLs redirect to
  `/app/teacher/locked`, while `/app/teacher/retreats` and `/app/venue` are allowed. E2E-verified.
- The pure `canAccessFeature` decision for all five states is proven by unit tests (`teacher-status` +
  `teacher-access`), since no single demo account spans every state.

## Corrections applied in this pass
1. **`PUT /bff/teacher/premium`** now enforces the OPERATE gate when `enabled:true` (closes the only real
   client-reachable bypass of the earning gate; saving a rate while disabled stays open so profile edits by
   ineligible teachers still succeed).
2. Documented (no code change needed): profile PATCH whitelist already blocks self-promotion; host/venue/guru
   endpoints are independently enforced by the FastAPI (ownership / host-eligibility / role); session is
   httpOnly; client state is UX-only.

## Residual / backlog (non-blocking, outside teacher-restriction scope)
- CSRF + rate-limit the anonymous `beta/feedback` and `retreats/[id]/waitlist` POSTs (already on the P1 backlog).
