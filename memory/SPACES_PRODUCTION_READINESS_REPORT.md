# NOSTOPS Spaces — Production Readiness Audit (Preview only)
Date: 2026-11-07 · Scope: audit + Preview-only corrections. NOT deployed, NOT published, no live data changed.
Legend: **[V]** verified in this audit · **[A]** assumption · **[U]** untested production dependency.

## 1. Functionality audit
| Area | Status | Evidence |
|---|---|---|
| /spaces landing, model explainer (Commercial / Subsidised / Community) | Complete [V] | iter233 |
| Locality search | Complete for **PIN only** [V]. No locality-name search on public /spaces (scope decision) | iter233 |
| Results + nearby teachers (verified/eligible rules) | Complete [V] | iter233 |
| /spaces/[id] detail (approved only, no owner contact/documents shown) | Complete [V]; 404 for unknown/unlisted [V] | iter233 |
| /spaces/community-partners | Complete [V] | iter233 |
| Owner wizard /app/spaces/new (PIN → official India Post locality → details → 3 models → facilities/photos → 4 private docs → submit) | Complete [V] | iter233 (API + UI) |
| Owner edit / ownership / IDOR protection | Complete [V] (other users get not-found; edit after submit = 409) | iter233 |
| Admin verification queue + checklist + approve/reject/unlist | Complete [V] | iter233 |
| Admin Localities Dashboard (8B.2, accepted) + Locality Intelligence (8B.3) | Complete [V] read-only re-check | iter233 |
| Teacher teaching localities, enquiries, incoming, programmes, registrations | Pages load [V]; full write journeys not re-run this audit | iter233 |
| Community Partner pages | Load [V]; 0 partners in Preview | iter233 |
| Global Venues (/venues*, /retreats/host, /app/venue) | Regression pass [V] | iter233 |
| Unified Venue Owner dashboard | **Partial**: /app/spaces (Spaces) and /app/venue (Global Venues) are separate pages; now cross-linked (fix below). One account, two listing pathways — matches the "distinct pathways" rule [V] | iter234 |
| Duplicate prevention | **Partial**: cap of 5 drafts per owner only; no address/locality duplicate check [V] | gap |
| Draft withdraw/delete | **Missing**: no API to delete a draft [V] | gap |
| Revenue share / payouts in Spaces | None in Spaces; `revenue_share` field rejected (422) [V]. Pre-existing Global Venue partnership models (`revenue_share`) and retreat escrow payouts exist outside Spaces (Phase 0 finding) | gap/decision |

## 2. Defects found and corrected (Preview)
1. SEO: no canonical on /spaces, /spaces/[id], /spaces/community-partners; /spaces/[id] had no description/OG → added canonical (www.nostops.org), description, OpenGraph. noindex kept.
2. My Spaces overflowed at 390px → grid column fix (`grid-cols-1`, `min-w-0`). Verified scrollWidth 390.
3. Mobile menu "Sign up" invisible on Spaces pages (CSS recolouring) → excluded filled buttons from rule. Verified white on teal.
4. Mobile menu missing "Spaces" on Spaces pages (desktop had it) → same rule as desktop.
5. Owner dashboards not connected; /app/venue said "NOSTOPS Spaces — coming soon" → replaced with links between My Spaces and Global Venues.
6. Stray "." after "Browse Global Venues"; wizard step labels overlapping at 390 → fixed (labels hidden <640px, "Step n of 6" chip remains).
Not fixed (reported): non-admin bad body on CP admin routes gets 422 before 403 (nothing written); one unreproducible 502 on first load of /spaces/[id].

## 3. Automated test results
- Backend pytest (Spaces, localities, CP integrity, 8B.2/8B.3, venues ownership/CSRF/submit): **191 pass, 1 fail, 8 skipped**. The failure (`test_public_venue_submit` CSRF cookie) is a test-harness cookie-jar issue: the `nostops_csrf` cookie IS set (verified with curl).
- Testing agent iteration_233: 35 checks, 30 pass, 5 fail (all = missing canonical, fixed). iteration_234 re-test: 6/7 pass; remaining overflow fixed and verified by screenshot.
- TypeScript: 0 source errors (3 errors only in stale generated `.next/types`). ESLint: 0 errors.
- **Production build** (clean copy, no .env, NODE_ENV=production `next build`): **Compiled successfully, exit 0** [V].
- Responsive: 390 / 820 / 1366 no horizontal overflow on public Spaces, wizard, admin Spaces, My Spaces [V].

## 4. Production environment & dependency checklist
| Item | Preview value / state | Production requirement | Status |
|---|---|---|---|
| Website backend (FastAPI sidecar, `PULSE_API_URL`) | localhost:8001 | deployed with the site by Emergent | [U] |
| Database (`MONGO_URL`, `DB_NAME`) | local pod Mongo `nostops_web` | separate production Mongo provided by deployment | [A] separation by platform; production DB not inspected |
| India Post dataset | `backend/data/in_pincodes.csv.gz` (committed), loaded at startup in background (154,746 rows) | first production boot loads it; Spaces search unavailable until loaded (minutes) | [U] |
| Main backend (`BACKEND_URL`) | https://pro-learn-connect-1.emergent.host (LIVE) — health 200 [V] | same | [V] read-only |
| `PULSE_SHARED_SECRET` | set | must be set in production (BFF↔sidecar auth) | [U] |
| Object storage (`EMERGENT_LLM_KEY`, `INTEGRATION_PROXY_URL`) | works (photo upload passed) | key with balance in production | [U] |
| Private Space documents | stored in Mongo `space_docs` (≤4 MB each) | DB size/backup includes them | [V] design |
| Email (`EMERGENT_EMAIL_KEY`, `EMAIL_FROM_NAME`) | set; test outbox held approval emails | real emails will send in production on approve/reject | [U] |
| `WEB_APP_BASE_URL` (backend) | **Preview URL** | **must be https://www.nostops.org** in production (email links) | ⚠ confirm before deploy |
| `NEXT_PUBLIC_SITE_URL` | https://www.nostops.org | same | [V] |
| `TEACHER_CLAIM_API_BASE` | main backend **Preview** API | production value needs separate decision (claim hold in force) | ⚠ hold |
| Payments (`CASHFREE_*`, `PAYPAL_API_BASE` live endpoints, `VENUE_CHECKOUT_ENABLED=true`, `FINANCIAL_UNLOCKED_FLOWS=venue_ai_onboarding`) | pre-existing venue AI-onboarding checkout; **not used by Spaces** | unchanged; no transaction initiated in this audit | [V] not exercised |
| Google Maps keys, Didit KYC, Twilio (main backend) | set / external | unchanged | [U] |
| `PARTICIPANT_MAGIC_DEBUG` | FALSE | FALSE | [V] |
| Current production www.nostops.org | `/spaces` → **404**, `/api/spaces/localities/meta` → 404 (older build); `/venues/all` 200 | deployment needed to ship Spaces | [V] |

## 5. SEO & public URLs
- Canonical origin www.nostops.org on all Spaces pages [V]. Preview hosts send `X-Robots-Tag: noindex` and robots.txt blocks all [V].
- **All Spaces pages are `noindex, follow` and not in sitemap.xml** — intentional "controlled release" in code. Making them indexable + adding to sitemap is a **launch decision for you**.
- /venues pages: canonical + indexable, in sitemap [V].

## 6. Database integrity & security
- Admin-only routes enforced in BFF and backend (401/403) [V]; CSRF double-submit on BFF writes [V]; ownership checks on Space view/edit/submit [V]; public views exclude owner contact/documents [V]; unknown fields rejected [V].
- Coverage source of truth intact: Baroda House & Bengali Market PAUSED v4, 8 audit entries (unchanged, Preview only) [V].
- Preview test records (Preview DB only, cannot reach production because databases are separate [A]): `spc_qa_preview_demo`, `spc_0114c434a25342d6`, `spc_84a03198be774e38` (unlisted), `spc_89099d22915149e0` (draft), all named `TEST_`. QA/TEST spaces are also excluded from coverage counts by rule.
- Startup seeds in production: Knowledge Graph, demo organisation ecosystem, Special Needs examples (pre-existing, idempotent). No Spaces/coverage seeding.

## 7. Backup & rollback plan
1. Before deploy: export production website DB (Emergent support / platform snapshot) — collections incl. `venue_submissions`, `venue_*`, `inst_*`, `users`-related mirrors.
2. Record the current production build (Emergent deployment history) as the rollback target.
3. Deploy; Spaces collections start empty (no migration needed); India Post dataset self-loads.
4. Smoke test: /, /venues, /venues/all, a venue detail, /spaces?pin=110001, /app/spaces (owner), /app/admin/spaces-localities (admin).
5. Rollback: redeploy the previous build from deployment history; Spaces data written after deploy stays in its own collections and does not affect Global Venues.

## 8. Outstanding blockers & recommendations (need your decision/authorization)
1. ⚠ `WEB_APP_BASE_URL` must be set to https://www.nostops.org for production.
2. ⚠ Launch SEO: keep Spaces noindex at launch, or make indexable + add to sitemap.
3. Decide public locality-name search scope (currently PIN only).
4. Duplicate-listing check and draft withdraw/delete are not built.
5. Production approval/rejection emails will really send.
6. Teacher claim production API base remains on hold.
7. Pre-existing non-Spaces items: Global Venue `revenue_share` partnership model and retreat payouts exist (outside Spaces).

## 9. Files modified in this audit
- app/(public)/spaces/page.tsx · app/(public)/spaces/[id]/page.tsx · app/(public)/spaces/community-partners/page.tsx
- app/app/spaces/page.tsx · components/spaces/ui.tsx · app/spaces-theme.css · components/MobileNav.tsx
- components/app/venue/VenueListingDashboard.tsx · components/app/venue/VenueProfileDashboard.tsx
- Created: this report; testing agent added backend/tests/test_spaces_prod_audit_iter233.py.
