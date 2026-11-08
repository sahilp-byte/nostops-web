# DYNAMIC PERMISSIONS & CONSISTENCY AUDIT (Prompts 21–24)

Architecture recap: browser → **Next.js BFF (server)** → **FastAPI (final authority)**. Permissions are
NEVER stored as grants — they are re-derived from the authoritative teacher record on every server render
and every state-changing request, via the single engine `lib/teacher-access.canAccessFeature` fed by
`lib/teacher-status.deriveTeacherStatus`.

## PROMPT 21 — Permissions are DYNAMIC (reflect current status) → CONFIRMED
- Every guarded page runs `enforceTeacherFeature()` / `guardTeacherFeature()` at request time; every guarded
  BFF write runs `requireVerifiedTeacher` / `requireFeatureAccess`. Both build the context from
  `getTeacherAccessContext()` which reads `/teachers/me/native-profile` **`no-store`** — so the CURRENT
  `is_verified` / `verification_status` / `is_empanelled` / `tier` are used every time. No grant is cached.
- Therefore, when an admin changes a teacher:
  - **Level 2 → Level 1**: host-eligibility (backend) recomputes → Venue Studio hides & hosting pages gate on
    the next request; Level-2-only surfaces disappear.
  - **Empanelled → Not Empanelled**: `canOperate` becomes false → all earning features re-lock on the next
    request (page redirect + nav lock + API 403).
  - **Verification revoked**: `is_verified/verification_status` flips → `canOperate` false → earning re-locks.
- Access is never "permanently granted": there is no place that remembers a past-eligible state.

## PROMPT 22 — Session / cache invalidation → NO STALE PERMISSIONS
| Mechanism | Holds permissions? | Stale risk | Handling |
|---|---|---|---|
| **Login session** (httpOnly cookie) | Identity only (opaque bearer), NOT permissions | None | Status is fetched fresh per request; no re-login needed after an admin change |
| **JWT claims** | Not decoded on client; bearer opaque | None | Role via `/auth/me`, status via native-profile — server-side each request |
| **Browser state / localStorage** | UX only | Cosmetic only | Never the authority; every guard re-checks server-side |
| **API cache (Next Data Cache)** | — | None | `backendFetch` uses `cache: 'no-store'` for all `/teachers/me/*` + `/auth/me` reads |
| **Server cache (Full Route Cache)** | — | None | `/app/**` is `dynamic = 'force-dynamic'` and reads cookies → always dynamic, never statically cached |
| **Client Router Cache** | Renders only | ≤ one navigation | Next 16 dynamic routes have `staleTime 0` → each navigation re-hits the server guard; and any WRITE re-checks at the BFF regardless |
| **Redis / equivalent** | Not used for permissions | None | No permission store exists |
| **React application state** | UX only | Cosmetic | Server authorization is authoritative |
- **Per-request dedupe added:** `getSessionUser` and `getTeacherSelfProfile` are wrapped in React `cache()`
  so the layout + guard + level badge share ONE `no-store` backend read per request (perf only — still
  fresh every request; never cached across requests, so admin changes always take effect next request).
- **Admin-side invalidation:** the admin status route (`/bff/admin/teachers/[id]/status`) calls
  `revalidatePath` for the admin directory + review pages after a change. The affected TEACHER needs no
  explicit purge because their own pages read `no-store` and re-derive on the next request.

**Bottom line:** an admin change to Verification / Empanelment / Level takes effect on the teacher's very next
server request; obsolete permissions cannot be used indefinitely, and any privileged ACTION is re-authorized
server-side even within a stale client render window.

## PROMPT 23 — Locked-feature UX → clear, requirement-aware, no internal details
- Earning features denied → `/app/teacher/locked?feature=<name>` shows: a 🔒 requirement pill naming the ONE
  next requirement (**"Verification required"** / **"Empanelment required"** / **"Verification approval pending"**),
  a plain-language subtitle explaining how to satisfy it, a per-feature "what you'll unlock" teaser, and the
  3-step `VerificationChecklist` (InstaKYC · ₹799 payment · Empanelment) with CTAs. No flags/security internals.
- Hosting features denied → the Retreats page shows an in-page state: **"Hosting opens up for Level 2 (Yoga
  Pracharak) and Level 3 (Yoga Guru) teachers"** + "see your path to hosting"; Venue Studio is hidden from nav
  for non-host-eligible teachers. Messaging follows the existing NOSTOPS design language.

## PROMPT 24 — UI ↔ backend consistency → ONE authoritative system
- The teacher menu is now built by `buildTeacherNav(sections, ctx)` where `ctx` is the SAME `AccessContext`
  the page + API guards use, and each gated item's lock/hide is decided by `canAccessFeature(ctx, feature)`.
  The old hand-maintained `TEACHER_LOCKED_UNTIL_VERIFIED` set was removed → no duplicated per-label rules.
  Result: menu lock ≡ page redirect ≡ API allow/deny, all from `FEATURE_RULES`.
- This eliminates the four failure modes:
  - *Backend permits but UI locked* — nav uses the same decision as the route.
  - *UI unlocked but backend denies* — nav uses the same decision as the route.
  - *Became Level 2 but still sees Level 1 limits* — host-eligibility recomputes each request; Venue Studio
    appears and hosting unlocks immediately.
  - *Lost eligibility but still sees active feature* — `canOperate`/host-eligibility recompute each request;
    the item re-locks/hides and the route redirects.
- Verified: engine unit tests (10/10 access + 10/10 five-state), and live E2E across earning-locked /
  host-allowed for `teacher.demo`.
