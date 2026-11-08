# NOSTOPS — Business Logic & Access Rules (Source of Truth)

> Master reference for **who can do what, and the conditions that unlock each feature**.
> Scope: the **Next.js web app** (`/app/frontend`). The FastAPI backend is treated as read-only
> and is the ultimate authority; the web app mirrors its rules. Keep this file updated whenever
> access rules, roles, or gating change.
>
> Last mapped: 2026-06 (from live code + live backend `/openapi.json`).


---

## 0. FOUNDATIONAL RULES (invariant — highest authority)

**R1 — Verification precedes Empanelment.** A teacher must be **Verified** *before* they can be
**Empanelled**. Therefore **Empanelled ⇒ Verified**. The state `Verification = No/Pending` **AND**
`Empanelment = Empanelled` is **INVALID** and must never be presented anywhere in the product.
- Enforcement (web, backend is read-only): the single authoritative model `lib/teacher-status.ts`
  (`deriveTeacherStatus`) resolves any such record by treating an empanelled teacher as **Verified**.
  `isTeacherVerified` / `getTeacherGate` / nav / admin directory all inherit this via that one model.
- `hasVerificationConflict()` flags raw records that violate R1 (empanelled but KYC not verified) so
  admins see it as **stale backend data to reconcile** — the displayed status is already corrected.
- Valid: **Verified + Not Empanelled** (normal in-progress). Invalid: **Not Verified + Empanelled**.
- Verification, Empanelment and Level remain **three separate attributes** (R1 only couples the first two
  by ordering; it does not merge them).

---

## 1. Architecture of Access Control

Authorization is enforced in **four layers**. Navigation visibility is UX only — it is never the security boundary.

| Layer | File | Responsibility |
|---|---|---|
| 1. Proxy (optimistic gate) | `frontend/proxy.ts` | Redirects unauthenticated visitors away from `/app/*` to `/login?next=…`; marks `/app/*` `noindex`; issues the non-httpOnly **CSRF** cookie (`nostops_csrf`) on app + auth surfaces. NOT a security boundary. |
| 2. App layout (session revalidation) | `app/app/layout.tsx` | Server-validates the session via `getSessionUser()` (`/auth/me`) on every request; renders the role-aware shell + nav. |
| 3. Per-page guards | each `app/app/**/page.tsx` | `redirect('/login')` if no session; **role checks** (`normalizeRole(user.role) !== 'x' → redirect('/app')`); teacher pages also gate on **`onboarded`**. |
| 4. BFF write guard + backend | `lib/server/bff.ts` (`badOrigin`), `app/bff/**` | Every state-changing `/bff/*` route requires **double-submit CSRF** (`x-csrf-token` header === `nostops_csrf` cookie) → 403 otherwise. All authorization/ownership is finally enforced by the backend (bearer from the httpOnly `nostops_session` cookie). |

**Session / auth model:** httpOnly `nostops_session` cookie holds the backend bearer token; login is via BFF (`/bff/auth/*`). All private pages are `robots: noindex`.

---

## 2. Roles & Personas

Backend role keys are mapped to app-side persona groups (`lib/roles.ts`). Unknown → `learner`.

| App role (`AppRole`) | Backend role key(s) | Persona label | Home component |
|---|---|---|---|
| `learner` | `seeker`, `employee`, `itpro`, `member`, `user` | Yoga Seeker | `LearnerHome` |
| `teacher` | `teacher` | Yoga Teacher | `TeacherHome` |
| `corporate` | `hr`, `organisation` | Workplace/Student Wellness/Startup Lead (by `cohort_type`) | `OrgHome` |
| `coordinator` | `coordinator` | City Coordinator | `CoordinatorHome` |
| `council` | `guru`, `council` | Yoga Guru / Council Guru | `CouncilHome` |
| `admin` | `admin` | Administrator | placeholder overview |

The dashboard router (`app/app/page.tsx`) renders the home by role. `admin` gets a "workspace being set up" placeholder.

---

## 3. Public (unauthenticated) surface

Route group `(public)` — cacheable, indexable, **no CSRF cookie**, no login required:

- `/` landing, `/about`, `/council` (+ `/council/[slug]`), `/paramparas` (+ `/[slug]`),
  `/retreats` (+ `/[retreat_id]`), `/gurukul-retreats`
- `/teachers` directory + `/teachers/[handle]` — public profiles of **empanelled, lineage-verified** teachers only
- `/become-a-teacher` — recruitment landing (CTA → register/login → onboarding)
- `/booking-invite/[token]` — org batch invite (semi-public; token-scoped; CSRF cookie issued)

Auth group `(auth)`: `/login`, `/register`, `/reset-password`, `/verify-otp`, `/choose-role`, `/emergent-callback`.

---

## 4. Access rules by role

Menu is defined in `components/app/nav-config.ts`. Items with `available:false` render disabled ("Soon"). Every role has **Overview** (`/app`).

### 4.1 Learner (Yoga Seeker)
- **Menu (live):** Overview, Discover Teachers (`/app/discover`), Saved (`/app/saved`), My Bookings (`/app/bookings`), Notifications (`/app/notifications`).
- **Menu (Soon):** Sessions, Wellness, Referrals.
- **Features:** browse/SmartMatch teachers, save teachers, view/track programme streak & sessions, view a teacher profile (`/app/teachers/[handle]`) and **book a 1:1** (`/app/teachers/[handle]/book`) — booking page requires the teacher to have a **premium offering** (`if (!p.premium) redirect`).
- **Unlock conditions:** none beyond being logged in. Booking requires the target teacher to be empanelled + have premium enabled.

### 4.2 Teacher (Yoga Teacher) — see §5 for the full lifecycle
- **Menu (all live today):** Overview, My Profile, Offerings, Bookings, Wallet, Refer & Earn, Notifications, Empanelment, City Coordinator.
- **Page guards today:** all require `role==='teacher'`; `profile*` & `offerings` also require `onboarded`. **No front-end verified/empanelled gate currently exists** — see §5.4 (proposed).

### 4.3 Corporate (Organisation / Workplace Lead)
- **Menu (live):** Overview, New Batch (`/app/org/bookings/new`), ROI Calculator (`/app/org/roi`).
- **Menu (Soon):** Analytics, Billing.
- **Guards:** all org pages require `role==='corporate'`.
- **Features:** create a group batch (course, capacity, venue, dates), generate a **WhatsApp invite link** (`/booking-invite/[token]`), manage participants, **close enrolment** & trigger **batch payment** (`/app/org/bookings/[id]`), ROI calculator, KPI overview.
- **Unlock conditions:** none beyond being a corporate account.

### 4.4 Coordinator (City Coordinator)
- **Menu (live):** Overview, Teachers → **Roster** (`/app/coordinator/roster`), Role & Rewards (`/app/coordinator/agreement`).
- **Menu (Soon):** Milestones.
- **Features:** dashboard (assigned teachers, milestones, revenue share), **searchable teacher roster** (search + Empanelled/Onboarding filter + sort), accept the coordinator agreement (`AcceptCoordinator`).
- **Unlock conditions:** the Coordinator Hub & roster require an active coordinator record (`getCoordinatorDashboard()` null → "Coordinator access required" empty state). Coordinators are **empanelled teachers** appointed to the role (backend auto-attaches empanelled teachers within 25 km of a coordinator's pin).

### 4.5 Council (Yoga Guru)
- **Menu (live):** Overview, Interview Queue (`/app/council/interviews`), Vouch Lineage (`/app/council/vouch`), My Contribution (`/app/council/contribution`), Editorial Picks (`/app/council/editorial`).
- **Menu (Soon):** Mentees, Retreats.
- **Guards:** all council pages require `role==='council'`.
- **Features:** claim/schedule/decide empanelment interviews (first-come-first-served claim), vouch a teacher's parampara (2 vouches → gold ribbon), view lifetime review earnings (₹1,500 per completed 30-min interview, only for designated interviewers), pick Teacher of the Month / Featured Teacher.

### 4.6 Admin
- **Menu (all Soon):** Bookings, KYC, Payouts, Empanelment, People. Placeholder overview only (web conversion pending).

### 4.7 Cross-cutting (all authenticated roles)
- **Notifications** (`/app/notifications`) — list + mark read (BFF `/bff/notifications/[action]`), unread count in the shell.
- **Settings** (`/app/settings`) — account/profile/export (`/bff/settings`, `/bff/account/export`, `/bff/profile`).
- **Global header** (`AppShell`): NOSTOPS logo + tagline "A Teachers-First Yoga Cooperative.", **Universal Search** (🔍 → `/bff/search` → `/api/search`; searches teachers, council gurus + quick links to the user's in-app pages), **Language switcher** (🌐 → 6 UI locales en/hi/mr/bn/ta/te, cookie `nostops_locale`; core-UI i18n via `lib/i18n/messages.ts`, English fallback, deeper content phased), notifications bell, and an account menu whose **avatar is the user's live photo** (`/auth/me` `avatar_url`).

---

## 5. Teacher lifecycle & unlock conditions (the core gating model)

Teacher state is derived from two backend reads:
- `getTeacherSelfProfile()` → `/teachers/me/native-profile` → `{ onboarded, self: TeacherSelf }`
- `getOnboardingState()` → `/teachers/me/onboarding-state` → the 4-step protocol

### 5.1 Key teacher flags (`TeacherSelf`)
| Flag | Backend field | Meaning |
|---|---|---|
| `onboarded` | `onboarded` | A teacher record exists for this user. |
| `kycVerified` | `kyc_verified` | InstaKYC identity done (Aadhaar OKYC + PAN + Bank). |
| `kycPaid` | `kyc_paid` | The one-time **InstaKYC ₹799 payment** is made. |
| `isEmpanelled` | `is_empanelled` | Accepted into the Empanelled Teacher Network. |
| `isVerified` | `is_verified` | Backend "verified" badge / directory-listing flag (set around KYC). |
| `premium.enabled` | `premium_session.enabled` | Paid 1:1 offering is live. Backend gates **enabling** on profile completeness + empanelment. |

### 5.2 The 4-step onboarding protocol (`OnboardingState.currentStep`)
1. **Profile** — complete essential profile fields (`profileComplete`). *(Required, links to `/app/teacher/profile/edit`.)*
2. **Video intro** — 90-sec Cloudinary intro (`videoSubmitted`). **Optional** (boosts directory clicks).
3. **InstaKYC** — `kycVerified` (Aadhaar + PAN + Bank). ₹799 one-time (`kycPaid`). *Priority; required for directory listing & payouts.*
4. **Empanelment** — `isEmpanelled`, via:
   - **Free-track (merit, no fee):** ≥5 paid sessions + ≥4.5★ avg + ≥10 verified reviews + Council interview.
   - **Fast-track (₹4,999):** paid Council interview (`/app/teacher/empanelment/fast-track`).

`allComplete` = all four done.

### 5.3 What each teacher feature needs (as enforced today, mostly by the backend)
| Feature | Page | Effective requirement |
|---|---|---|
| Onboarding wizard | `/app/teacher/onboarding` | Logged-in teacher **without** a record (`onboarded===false`; else → profile). |
| View/Edit profile, Photo & Video | `/app/teacher/profile`, `/edit`, `/media` | `onboarded` (needed to progress; not gated on verification). |
| InstaKYC | `/app/teacher/kyc` | Teacher role. This is the payment + identity step. |
| Empanelment (free/fast-track) | `/app/teacher/empanelment`, `/fast-track` | Teacher role. This is the path to unlock. |
| **Offerings** (paid 1:1 setup) | `/app/teacher/offerings` | `onboarded`; backend gates **enabling** on profile + **empanelment**. |
| **Bookings** (1:1) | `/app/teacher/bookings` | Teacher role; bookings exist only once offerings are live. |
| **Wallet / Withdrawals** | `/app/teacher/wallet` | Teacher role; **withdrawal** needs KYC + bank + PIN + OTP. |
| **Refer & Earn** | `/app/teacher/refer` | Teacher role; referral **rewards** require empanelment. |
| **City Coordinator** | `/app/coordinator` | Active coordinator record (empanelled teachers appointed as coordinators). |

### 5.4 "Verified teacher" gate — IMPLEMENTED (item 3)

**Definition of "verified" (strict, chosen by owner):**
```
verified = kycVerified && kycPaid && isEmpanelled
```
(completed InstaKYC + made the ₹799 payment + empanelled). For real teachers this equals
"empanelled" since empanelment follows KYC; the seed `teacher.demo` (empanelled without KYC)
is therefore **locked** by design until KYC is completed on it.

**Behaviour for a logged-in teacher who is NOT verified:** browse / read-only only.
Core (earning/operating) features are **disabled with a 🔒 in the menu** and **blocked on direct URL**
(server redirect → `/app/teacher/locked?feature=…`, a "Get verified to unlock" screen showing the
3-step checklist + CTAs to InstaKYC / Empanelment).

**Where it's enforced:**
- Menu: `app/app/layout.tsx` computes `verified` for teachers via `getTeacherGate()`; if not verified it
  calls `lockTeacherNav()` (`components/app/nav-config.ts`) which flags the gated labels; `AppShell` renders
  them disabled with a 🔒 "Locked" pill that routes to the explainer.
- Pages (server redirect when teacher && !verified): `/app/teacher/offerings`, `/app/teacher/bookings`,
  `/app/teacher/wallet`, `/app/teacher/refer`, and the coordinator surfaces `/app/coordinator`,
  `/app/coordinator/roster`, `/app/coordinator/agreement` (only when the accessing user's role is `teacher`;
  genuine `coordinator`-role users are unaffected).
- Helpers: `isTeacherVerified(self)` and `getTeacherGate()` in `lib/server/teacher.ts`.

**LOCKED until `verified`:** Offerings · Bookings · Wallet · Refer & Earn · City Coordinator.

**ALWAYS available** (browse/read-only + the path to get verified): Overview · My Profile (view/edit/photo+video) ·
InstaKYC · Empanelment (+Fast-Track) · Onboarding · Notifications · Settings.

### 5.5 Teacher LEVEL ladder & privileges — canonical map (`lib/teacher-levels.ts`)

Level is a SEPARATE axis from the verification gate (§5.4). A teacher's level comes from the backend
`tier` field (fallback: primary badge). `lib/teacher-levels.ts` is the **single source of truth** — the
dashboard progression card, retreat/venue host tooling and profile badges all derive level, label, colour
and "what you unlock" copy from it (no more scattered definitions).

| Level | Backend `tier` | Badge | Unlocks (catalogue) |
|---|---|---|---|
| **L1** Yoga Shikshak (Foundation) | `shikshak` | Yoga Shikshak | Verified profile · Discoverability · Group sessions · Paid 1:1 |
| **L2** Yoga Pracharak (Growth) | `pracharak` | Yoga Pracharak | + Corporate leads · **Retreat & Venue hosting** · Reviews |
| **L3** Yoga Guru (Leadership) | `guru`, `council_guru` | Yoga Guru | + Premium pricing · Platform-backed courses · Thought leadership |

- Helpers: `getTeacherLevel({tier,badgePrimary})`, `tierToLevel()`, `tierLabel()` (`council_guru` → "Council Guru"),
  `badgeColor()`, `privilegesForLevel()`, `levelHasPrivilege()`.
- **Retreat / Venue hosting** is L2+ in the catalogue, but the RUNTIME gate stays **backend-authoritative**
  via `GET /retreats/host-eligibility` (`getHostEligibility()`); the nav shows Venue Studio only to host-eligible
  teachers. The map documents the intended privilege; the backend decides eligibility today. Verified-teacher
  gate (§5.4) and level gate are independent (e.g. an L2/L3 can be host-eligible while the strict `verified` flag is off).

---

## 6. Third-party integrations (behind the backend)
- **Razorpay** (domestic payments) / **PayPal** (international) — InstaKYC ₹799, fast-track ₹4,999, batch payments.
- **Sandbox.co.in** — InstaKYC (Aadhaar OKYC / PAN / bank penny-drop).
- **Cloudinary** — teacher intro-video signed uploads (`/teachers/me/video-intro/*`).
- Teacher **avatar** is stored by the backend as base64 (`/teachers/me/avatar`).

---

## 7. Change log
- 2026-06 — Initial mapping. Added Coordinator Roster, Teacher Profile Media (photo cropper + filters, in-browser recorder with countdown & retake timer), Profile Strength meter.
- 2026-06 — Implemented §5.4 verified-teacher gate (strict definition): menu 🔒-lock + server-side redirects to `/app/teacher/locked` for Offerings/Bookings/Wallet/Refer/Coordinator.
- 2026-06 — Global header: logo tagline, 6-language UI switcher (i18n core UI), Universal Search (`/bff/search`), live avatar. Teacher home: one-time unlock celebration (verified) + 3-step verification progress card (unverified). Locked screen: per-feature "what you'll unlock" teasers.
- 2026-06 — Auto-language: on first authenticated visit (no `nostops_locale` cookie) the layout reads `Accept-Language` and, if a supported non-English locale matches, shows a dismissible offer toast (accept switches + persists; UI stays English until accepted).
- 2026-06 — Header LEVEL badge: AppShell shows a teacher's L1/L2/L3 pill (from lib/teacher-levels) in the header + "Signed in as" block (teachers only). Dashboard gained a Level-Up Guide (L1/L2) — next-level unlocks + honest merit signals (verification/sessions/rating/reviews), merit-reviewed disclaimer. Verification nudge enriched with concrete empanelment progress for non-empanelled teachers.
- 2026-06 — SEC-002: site-wide security headers via next.config.mjs headers() on /:path* — Content-Security-Policy (allows GA + Cloudflare Insights + https: media/img/frame + data:/blob: + unsafe-inline/eval), X-Content-Type-Options=nosniff, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control. frame-ancestors/X-Frame-Options intentionally OMITTED to stay embeddable; Google login is a top-level navigation (not CSP-gated). Verified: 0 CSP violations across teacher/learner/org/council + public pages (testing_agent iter58). SEC-001 open-redirect fixed earlier in this fork.
- 2026-06 — Authoritative teacher STATUS MODEL (lib/teacher-status.ts): three SEPARATE attributes — VerificationStatus (verified/pending/not_verified), EmpanelmentStatus (empanelled/pending/not_empanelled), LevelStatus (none/1/2/3) — plus a derived `canOperate`. Owner rules: verified = STRICT composite kyc_verified && kyc_paid && is_empanelled; verification pending = any KYC step started; empanelment pending = fast-track active OR free-track in-progress; no-tier teacher defaults to Level 1. isTeacherVerified() now delegates to deriveTeacherStatus().canOperate. No self-assign (derived from read-only fields; profile PATCH whitelist blocks tier/is_verified/is_empanelled/kyc_*). No teacher-record duplication.
- 2026-06 — Access-control hardening: Sessions + Widgets are now verification-gated like Offerings/Bookings (page redirect to /app/teacher/locked + nav 🔒). NEW server guard requireVerifiedTeacher() (lib/server/teacher-guard.ts) enforces the operate gate on gated BFF WRITE routes (premium-config, wallet/[action], booking/[bookingId]/[action] + alternatives, coordinator/assign-me) — closes the "locked in UI but API open" gap; non-teacher roles pass through. CSP connect-src extended with www.google.com (GA4 Signals beacon). Tested iter59 GREEN (7 gated pages redirect, 5 open pages accessible, multi-role no-regression, 0 CSP errors). Docs: ACCESS_CONTROL_GAPS.md (Prompt3), TEACHER_STATUS_MODEL.md (Prompt4 design), BACKEND_REQUEST_teacher_status_model.md (optional stored-enum upgrade).
- 2026-06 — ADMIN TEACHER DIRECTORY (Prompts 5-8) at /app/admin/teachers (admin-only; nav 'Teachers'). Reuses EXISTING authoritative records: joins /admin/empanelment/teachers (full roster) + /teachers/directory (admin-only rich fields: kyc_verified/pan_verified/is_verified/tier/avatar/dates/all onboarding forms) by teacher_id — NO second store. Columns: Photo, Name/@handle, City, Teacher ID, Profile completion (heuristic %), Verification (derived via lib/teacher-status; kyc_paid not in bulk so kyc_verified⇒Verified, PAN-started⇒Pending), Empanelment, Level, Registered, Updated, Review action. Client-side name search (case-insensitive full/partial/first/last + handle/id/city) and 9 composable filters (all/awaiting_verification/verified/awaiting_empanelment/empanelled/level_1-3/profile_incomplete). Per-teacher review page /app/admin/teachers/[id] separates TEACHER-SUBMITTED INFORMATION (Forms 1-5: Profile/Teaching/Lineage/Media/Social) from NOSTOPS ADMINISTRATIVE STATUS (derived status + raw KYC flags + tier/path/cert/dates; surfaces the backend is_verified vs derived-status divergence). Read-only — no onboarding data overwritten. Files: lib/admin-teacher-shared.ts, lib/server/admin-teachers.ts, components/app/admin/TeacherDirectoryTable.tsx. Tested iter60 all PASS; admin-only access enforced (non-admin redirected).
