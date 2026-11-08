# PROMPT 1 — Architecture Audit: Teacher Verification, Empanelment, Level & Access Privilege

> Read-only audit (no functionality changed). Source: live code + `BUSINESS_LOGIC.md` + backend `/openapi.json`.
> Scope: the Next.js web app (`/app/frontend`). FastAPI backend is read-only and is the ultimate authority.
> Purpose: map exactly how Verification / Empanelment / Level / Access-Privilege work TODAY so new
> prompts extend the existing system instead of duplicating it.

---

## 1. Roles & personas (single source of truth: `lib/roles.ts`)

- `AppRole` = `learner | teacher | corporate | coordinator | council | admin`.
- `ROLE_MAP` maps backend role keys → app persona:
  - `seeker/employee/itpro/member/user → learner`
  - `teacher → teacher`
  - `guru/council → council`
  - `hr/organisation → corporate`
  - `coordinator → coordinator`
  - `admin → admin`
- `normalizeRole()` (unknown → `learner`), `personaLabel()` (friendly label, HR label varies by `cohort_type`),
  `displayName()`.
- The dashboard router `app/app/page.tsx` renders a home component per role.

## 2. Session & auth model (`lib/server/session.ts`)

- httpOnly `nostops_session` cookie holds the backend **bearer token**; it is NEVER returned to the browser.
- `backendFetch(path)` attaches the bearer and calls FastAPI; `getSessionUser()` (React `cache`d) resolves the
  current user via `/auth/me` and returns `null` on 401/expiry (caller redirects to `/login`).
- Cookies are `SameSite=None; Secure; Partitioned` (CHIPS) so the session survives the embedded webview / iframe.

## 3. Four-layer access control (authorization boundary)

| Layer | File | Responsibility |
|---|---|---|
| 1. Proxy (optimistic, NOT security) | `frontend/proxy.ts` | Redirect unauth `/app/*` → `/login?next=…`; `noindex`; issue `nostops_csrf` cookie |
| 2. Session revalidation | `app/app/layout.tsx` | `getSessionUser()` on every request; builds role-aware shell + nav |
| 3. Per-page guards | each `app/app/**/page.tsx` | `redirect('/login')` if no session; role checks; teacher pages gate on `onboarded` + verification |
| 4. BFF write guard + backend | `lib/server/bff.ts` (`badOrigin`), `app/bff/**` | double-submit CSRF (`x-csrf-token` === `nostops_csrf`) → 403; backend enforces final authz |

**Navigation visibility (`nav-config.ts`) is UX only — never the security boundary.**

## 4. Teacher data models (the core of this audit)

### 4.1 `TeacherSelf` (`lib/server/teacher.ts` → `projectTeacher()`)
Key state flags read from `/teachers/me/native-profile` / `/teachers/dashboard`:

| Flag | Backend field | Meaning |
|---|---|---|
| `onboarded` | `onboarded` | A native teacher record exists for this user |
| `kycVerified` | `kyc_verified` | InstaKYC identity done (Aadhaar OKYC + PAN + Bank) |
| `kycPaid` | `kyc_paid` | One-time InstaKYC **₹799** payment made |
| `isEmpanelled` | `is_empanelled` | Accepted into the Empanelled Teacher Network |
| `isVerified` | `is_verified` | Backend "verified" badge / directory-listing flag |
| `badgePrimary` | `badges[0]` / `badge_primary` | Primary badge |
| `empanelmentPath` / `empanelledVia` | `empanelment_path` / `empanelled_via` | Free vs Fast-track provenance |
| `tier` | `tier` | Rate tier + **level** signal (see §6) |
| `premium.enabled` | `premium_session.enabled` | Paid 1:1 offering live (backend gates enabling on profile + empanelment) |
| `publicVisible` | `public_profile_visible && !suspended` | Public route reachable |

### 4.2 `OnboardingState` (`getOnboardingState()` → `/teachers/me/onboarding-state`)
Drives the 4-step protocol: `currentStep ∈ profile | video | kyc | empanelment | complete`, plus
`profileComplete`, `videoSubmitted`, `kycVerified/panVerified/bankVerified`, `isEmpanelled`,
`sessionsDone`, `avgRating`, `freeTrackEligible`, `freeTrackMinSessions (5)`, `freeTrackMinRating (4)`, `allComplete`.

### 4.3 KYC (`getKycStatus()` → `/kyc/sandbox/status`)
`{ kycPaid, kycVerified, aadhaarVerified, panVerified, bankVerified, maskedAadhaar }`. Provider = Sandbox.co.in.

### 4.4 Empanelment (`getEmpanelmentProgress()` → `/teachers/me/empanelment-progress`)
`{ isEmpanelled, path, minSessions (5), minRating (4), paidSessions, sessionsRemaining, avgRating,
reviewCount, progressPct, nextStep }`.
- **Fast-track:** `getFastTrackOffer()` (`/empanelment/fast-track/offer`, ₹4,999) + `getFastTrackStatus()`
  (`/empanelment/fast-track/my-status`) → `{ active, history }` requests with payment + decision + interview.
- **Council side (guru):** `lib/server/guru.ts` claim/schedule/decide queue (`/empanelment/fast-track/*`).

## 5. Verification gate (the current unlock model — `BUSINESS_LOGIC.md §5.4`)

- **Definition (strict):** `isTeacherVerified(self) = kycVerified && kycPaid && isEmpanelled`.
- **Combined gate read:** `getTeacherGate()` → `{ onboarded, self, verified }`.
- **Enforced in two places:**
  - Menu: `app/app/layout.tsx` → `buildTeacherNav()` flags `TEACHER_LOCKED_UNTIL_VERIFIED`
    (`Offerings, Bookings, Wallet, Refer & Earn, City Coordinator, Coordinator Agreement`) as `lock:true`/disabled.
  - Pages: those routes server-redirect unverified teachers → `/app/teacher/locked?feature=…` (a "get verified" screen).
- **Always open (path to get verified):** Overview, My Profile (+edit/media), InstaKYC, Empanelment (+Fast-Track),
  Onboarding, Notifications, Settings.

## 6. Level & Access-Privilege model (partial today)

- **Levels referenced in code/PRD:** Level 1 **Shikshak**, Level 2 **Pracharak**, Level 3 **Guru** (progression
  path shown on `TeacherHome`). The signal today is the backend `tier` field on `TeacherSelf`.
- **The one concrete privilege gate that keys off level:** **Venue/Retreat hosting**. `buildTeacherNav()` shows
  **Venue Studio** and hosting only to **host-eligible** teachers (L2 Pracharak / L3 Guru; never L1), via
  `getHostEligibility()` (`lib/server/retreat-host.ts`). This is a **separate gate** from the KYC/empanelment
  verification gate (an eligible L2/L3 can host even while the strict `verified` flag is off, e.g. `teacher.demo`).
- **Gap:** there is no single web-side "level" abstraction. Level is inferred ad hoc from `tier` + host-eligibility.
  New "Level & Access Privilege" work should introduce ONE derivation (e.g. `getTeacherLevel(self)`) and a
  privilege matrix, then have both nav + page guards consume it — rather than scattering `tier`/eligibility checks.

## 7. Where new functionality should integrate (no duplication)

| New concern | Extend here (do NOT create parallel systems) |
|---|---|
| Level derivation | New `getTeacherLevel(self)` in `lib/server/teacher.ts` (reads existing `tier` + empanelment) |
| Privilege matrix | Central map next to `TEACHER_LOCKED_UNTIL_VERIFIED` in `nav-config.ts`; consumed by `buildTeacherNav` |
| Page-level access | Reuse the `getTeacherGate()` pattern (add level to it) + existing `/app/teacher/locked` explainer |
| Verification steps UI | Existing `/app/teacher/{kyc,empanelment,empanelment/fast-track}` pages + `OnboardingState` |
| Council decisioning | Existing `lib/server/guru.ts` + `/app/council/interviews` queue |
| Docs | Update `BUSINESS_LOGIC.md §5–§6` whenever rules change |

## 8. Known open items surfaced during the audit
- **SEC-001 (open redirect, `components/auth/LoginForm.tsx`):** the `next` param only checks `startsWith('/')`;
  `//evil.com` / `/\evil.com` would redirect off-site. Needs a strict same-site path check. (P0 quick fix.)
- **SEC-002:** no global security headers (CSP / Referrer-Policy / X-Content-Type-Options) — add via `next.config`/proxy
  without breaking Google OAuth or Places images.
- **Admin persona:** `admin.demo` has only a `teacher` persona in the backend (read-only data gap) — cannot be fixed from web.
