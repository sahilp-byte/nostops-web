# NOSTOPS — Phase 1: Web Application Shell + BFF Authentication
**Status: PASS.** Authenticated web foundation implemented. Public SEO layer preserved. Backend untouched.
Date: 2026-06 · Next.js 16.3.3 App Router · Discovery ref: `MOBILE_TO_WEB_B1_B7_RESOLUTION.md`.

## A. Architecture implemented
A secure, server-rendered authenticated application foundation layered beside the frozen public SEO site:
- Three route groups under one minimal root layout: **`(public)`** (existing SEO, unchanged URLs), **`(auth)`** (login/OTP/reset/role/social callback, noindex), and literal **`/app`** (authenticated shell, noindex).
- **BFF authentication**: the browser only ever holds an **httpOnly, Secure (prod), SameSite=Lax** cookie; the raw FastAPI bearer token lives only in server code and is attached as `Authorization: Bearer` when calling `/api/*`.
- Role/persona-aware, responsive application shell (sidebar + drawer + header + account menu).
- Optimistic edge gate (`proxy.ts`) + authoritative server-side session validation (`/app` layout → `/auth/me`).

## B. Route structure
```
app/
  layout.tsx                 minimal root (html/body + metadataBase + global title)
  not-found.tsx              global 404
  (public)/                  URLs UNCHANGED (route group is invisible in URL)
    layout.tsx               SiteHeader/Footer + indexable SEO metadata
    page.tsx  about/ teachers/[handle]/ paramparas/[slug]/ retreats/[retreat_id]/
    council/[slug]/ gurukul-retreats/ robots.txt/ sitemap.xml/
  (auth)/                    noindex
    layout.tsx  login/ register/ verify-otp/ reset-password/ choose-role/ emergent-callback/
  app/                       -> /app/*  (authenticated, noindex, force-dynamic)
    layout.tsx (shell+gate)  page.tsx (role-aware overview)
    loading.tsx  error.tsx  not-found.tsx
  bff/auth/                  -> /bff/auth/*  (Next Route Handlers; NOT under /api)
    login/ register/ role/ otp-start/ otp-verify/ reset-request/ reset-confirm/ session/ logout/
proxy.ts                     edge gate for /app (Next 16 "proxy" convention)
```
> BFF endpoints live under `/bff/*`, deliberately **not** `/api/*`, because the platform ingress routes `/api/*` straight to FastAPI (a Route Handler there would be shadowed).

## C. Authentication flow (exact backend contracts, from recovered mobile source)
- **Email/password**: form → `POST /bff/auth/login` → backend `POST /api/auth/login {email,password}` → `{user, session_token}` → BFF sets cookie, returns `{user}` only.
- **Phone OTP**: `/bff/auth/otp-start` → `POST /api/auth/otp/start {phone,channel:'sms'}`; then `/bff/auth/otp-verify` → `POST /api/auth/otp/verify {phone,code,purpose:'login',role}` → `{session_token,user,next_route}`. `400 NEW_USER_NEEDS_SIGNUP` → routed to `/choose-role`.
- **Role login/signup**: `/bff/auth/role` → `POST /api/auth/{login,signup}-by-role` → `{user,session_token}` or `{role_mismatch,actual_role}` (409, handled).
- **Google/Apple (Emergent-managed)**: button → `https://auth.emergentagent.com/?redirect=/emergent-callback` → client reads `session_id` from URL fragment → `/bff/auth/session` → `POST /api/auth/session {session_id}` → `{user,session_token}`. `session_id` is never logged/persisted; URL is scrubbed.
- **Password reset**: `/bff/auth/reset-request` → `/api/auth/reset-password/request`; `/bff/auth/reset-confirm` → `/api/auth/reset-password/confirm {token,new_password}`.
- **Logout**: `/bff/auth/logout` → best-effort `POST /api/auth/logout`, then deletes cookie (Max-Age=0).
- **Session validation**: `GET /api/auth/me` via authed `backendFetch`; resolves the user or null (expired/invalid → redirect to `/login`).

## D. Session architecture
- Cookie `nostops_session`: `httpOnly`, `secure` in production, `sameSite=lax`, `path=/`, `maxAge` 30d (backend TTL unknown → conservative; see blockers).
- Token is read **only** server-side (`lib/server/session.ts`, imports `next/headers` → can never be bundled to the client).
- **No client refresh token** (matches backend contract). Expired/invalid backend session → `getSessionUser()` returns null → `/app` layout `redirect('/login')`; a 401 on any authed call resolves to unauthenticated.
- `getSessionUser` is wrapped in React `cache()` to dedupe `/auth/me` across layout + page in one request.

## E. BFF architecture
- `lib/server/session.ts` — server-only: cookie read, `cookieOptions()`, `backendFetch()` (attaches bearer, 10s timeout, no-store), `getSessionUser()`.
- `lib/server/bff.ts` — shared Route Handler helpers: `badOrigin()` (CSRF: Origin-host vs Host header), `forward()` (unauth backend POST), `errorMessage()` (sanitized), `withSession()` (sets cookie).
- 9 minimal auth Route Handlers only — **no generic/unrestricted proxy** is exposed. Reuses the single server-only `BACKEND_BASE` from `lib/api.ts`; no second API client / base URL / SEO util / SITE_URL introduced.

## F. Role / persona model (`lib/roles.ts`)
- Backend role keys → app persona groups: `seeker|employee|itpro|member|user → learner`; `teacher|guru → teacher`; `hr|organisation → corporate`; `coordinator`, `council`, `admin`.
- `personaLabel()` mirrors the mobile `personaLabels.ts` (incl. HR cohort labels). Multi-persona accounts supported by design (shell reads current role; persona switching endpoints exist for a later phase).

## G. Navigation architecture
- Centralized in `components/app/nav-config.ts` (`NAV_BY_ROLE`), not scattered role checks. Available items render as links; not-yet-built items render disabled with a "Soon" badge (no dead links, no placeholder business screens). Navigation visibility is UX only — server-side authorization remains mandatory.

## H. Responsive shell (`components/app/AppShell.tsx`)
- Desktop: fixed left sidebar (brand, persona, nav) + sticky header (menu/notification affordance + account menu) + content.
- Tablet/Mobile: collapses to a top bar with hamburger → accessible slide-in drawer (focus-safe, Escape/overlay close). Touch targets ≥44px.
- `AccountMenu` (click-outside + Escape close) with persona label and working **Sign out**.

## I. Design system / assets recovered
- The mobile app (recovered at git `59f38129`) is **teal-first** (primary `#0F766E/#0D9488/#14B8A6`, teal-50 `#F0FDFA`, amber `#F59E0B`, ink `#0F172A`). The existing SEO `globals.css` brand token (`--color-brand:#0D9488`) already matches → the shell/auth UI reuse the existing tokens (`brand*`, `ink*`, `muted`, `line`, `cream`). No competing visual identity introduced. (High-res logo/OG image still pending — see blockers; the "N" mark is used consistently for now.)

## J. Security decisions
- Bearer token **never** exposed to browser JS (httpOnly cookie; server-only module). Verified: token/`session_token`/`nostops_session`/`Bearer ` absent from rendered HTML.
- CSRF: state-changing BFF POSTs require same-site Origin (host compared to Host header); cross-origin → 403.
- Error sanitization: only backend `detail`/`message` strings surfaced; no stack traces/secrets/internal URLs.
- Backend host no longer leaks anywhere in public HTML (header/footer/home "Open app" links repointed to `/login`) — closes the long-standing B2 leak.
- No new `NEXT_PUBLIC_*` secrets; `BACKEND_URL` stays server-only.

## K. Public SEO / authenticated boundary
- Public routes unchanged & indexable; canonicals remain `https://www.nostops.org/...`.
- `(auth)` + `/app` are `robots: noindex, nofollow` (metadata) **and** `proxy.ts` adds `X-Robots-Tag: noindex` for `/app`.
- Sitemap contains **zero** auth/app/bff URLs; robots.txt unchanged (exposes only the public sitemap).

## L. Tests executed and results
| Check | Result |
|---|---|
| `tsc --noEmit` (via build) | PASS (clean) |
| ESLint (all new dirs) | PASS (0 issues) |
| `next build` (real type-check, prod) | PASS (exit 0, 95 pages, Proxy registered) |
| `test:site` | PASS 15/15 |
| `test:seo` | PASS 25/25 (sitemap 92 locs) |
| Council/Gurukul regression | PASS 63/63 |
| SEO full audit (`seo_final_audit.py`) | PASS 171 / WARN 2 / **FAIL 0** |
| Phase-1 auth+boundary+SSR security (`phase1_auth_boundary_test.py`) | PASS 28/28 |

Auth tests covered: unauthenticated `/app` → 307 `/login?next=/app`; invalid cookie → revalidated → `/login`; auth pages noindex + no token/backend leak; BFF cross-origin → 403; BFF input validation (no SMS sent); invalid login → sanitized error, **no cookie set**; logout clears httpOnly cookie; `/bff/*` served by Next (GET→405). SSR/security: bearer token absent from HTML; backend host absent from public HTML. SEO boundary: no auth/app URLs in sitemap; public indexable; robots intact. (2 WARNINGs are pre-existing backend-data items: 45 orphan retreat sitemap URLs + one teacher public name that is an email string — both backend-owned, unchanged.)

## M. Files created
Route groups/pages: `app/(public)/layout.tsx`, `app/not-found.tsx`, `app/(auth)/layout.tsx`, `app/(auth)/{login,register,verify-otp,reset-password,choose-role,emergent-callback}/page.tsx`, `app/app/{layout,page,loading,error,not-found}.tsx`.
BFF: `app/bff/auth/{login,register,role,otp-start,otp-verify,reset-request,reset-confirm,session,logout}/route.ts`.
Lib: `lib/roles.ts`, `lib/session-cookie.ts`, `lib/auth-client.ts`, `lib/server/session.ts`, `lib/server/bff.ts`.
Components: `components/auth/{ui.tsx,LoginForm,RegisterForm,OtpForm,ResetPasswordForm,ChooseRoleForm,EmergentCallback}.tsx`, `components/app/{nav-config.ts,AppShell.tsx,AccountMenu.tsx}`.
Edge: `proxy.ts`. Tests/docs: `/app/phase1_auth_boundary_test.py`, this file.
Moved (URLs unchanged): all 11 public SEO route files + robots/sitemap → `app/(public)/…` (via `git mv`).

## N. Files modified
`app/layout.tsx` (slimmed to minimal root), `components/SiteHeader.tsx` + `components/SiteFooter.tsx` + `app/(public)/page.tsx` ("Open app" → `/login`/`/register`), `tests/verify_seo_feeds.mjs` (unchanged this phase). SEO libs (`lib/site.ts`, `lib/seo.ts`, `lib/api.ts`), JsonLd, robots/sitemap logic, canonical origin, SEO tests: **not modified**.

## O. Backend files modified
**FastAPI: NOT MODIFIED.**
**MongoDB/data: NOT MODIFIED.**
(No backend, schema, auth-backend, or payment-config changes. The local `/app/backend` proxy is untouched.)

## Blockers / owner inputs still required (do not affect this phase)
1. **Test account(s) per role** — to validate real authenticated flows end-to-end (no `test_credentials.md` present).
2. **Session-token TTL/refresh** — to tune cookie `maxAge` precisely.
3. **Emergent Google/Apple redirect allow-list** — confirm `https://www.nostops.org/emergent-callback` is registered for the web origin.
4. **Payment web keys/return URLs** — deferred to the payments phase (Razorpay `key_id`, PayPal `client-id`, return/webhook for the web origin).
5. **Brand finalisation** — high-res logo + social OG image.

## Next phase (DO NOT START — awaiting approval)
**Phase 2 — Learner Web Application Conversion** (discover → 1:1/premium booking → checkout → my-bookings/sessions → notifications/account), built on this shell + BFF.
