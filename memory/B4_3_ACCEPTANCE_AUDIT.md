# NOSTOPS Phase B4.3 — Canonical URL & Navigation Acceptance Audit (preview, read-only + venue-button tidy)

Scope: the B4.1/B4.2 implementation in preview, plus the owner-requested "Venue Pill Tidy" (in the same message).
Nothing was published, and no production record or setting was changed. Evidence folder: /app/test_reports/b43_audit/
(route_evidence.json/.py, auth_evidence.json/.py, b41_check.log, b23_wording.log, pytest_full.xml/.log, tsc.log, eslint.log,
frontend_node_checks.log, next_build.log, snapshot_before/after.json, faq_360.png, faq_390.png).
Earlier browser runs reused as evidence: iteration_164 (B4.1, 1280/390) and iteration_165 (B4.2, 1280/360/390, 8/8).

## Owner request done in this round
- "List your Venue — Free" floating button hidden on /for-organisations and all its sub-pages, at every screen size
  (components/ListVenueStickyCta.tsx). Verified at 390px after scrolling: 0 buttons on the 4 org pages; still shown on /teachers and /programmes.

## 1. PASS / FAIL / BLOCKED matrix
| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1a | Canonical pages load | PASS | 6 org pages 200, 0 redirects (gateway, 3 cohorts, impact, resources) |
| 1b | Canonical tag = intended URL | PASS | each `rel=canonical` = https://www.nostops.org + same path; og:url identical |
| 1c | Not unintentionally noindexed | PASS | meta robots "index, follow" on all 6; robots.txt allows / and disallows only /api /bff /app /admin |
| 1d | Internal navigation uses canonical URLs | PASS | 0 legacy hrefs on the 6 org pages and 10 formerly-linking pages; header/footer/mobile menu link the canonical paths; signed-in app pages have 0 legacy links |
| 2a | Redirect status + destination | PASS | /for-companies, /for-educational-institutions, /for-startup-networks → 308 → exact canonical (GET and HEAD) |
| 2b | Query handling | PASS | utm_source/medium/campaign and ref kept; #fragment stays in the browser (iteration_165) |
| 2c | No loops / unnecessary chains | PASS (note) | 1 hop for plain, query and upper-case variants; trailing-slash variants take 2 hops (Next's built-in slash strip, then the redirect). No loops |
| 2d | Legacy routes to keep | — | The 3 redirect rules must stay permanently (external links, search index, the app's `/bring-yoga-to-*` suggestions now map to canonical). The old OG-image URLs (/for-*/opengraph-image…) now 404 |
| 3a | "Create a Programme" is the clear primary action | PASS | org menu order Overview → Create a Programme → Programme Dashboard → Programme Events → Analytics (Soon) → Billing (Soon); /app has 3 wizard links, /app/org/dashboard 2, /app/org/events 2 |
| 3b | No duplicate booking flows | PASS | 0 links to /app/org/bookings/new or /app/org/roi in any signed-in org page; New Batch only reachable by direct URL, which shows the notice → wizard |
| 3c | 3 organisation cohorts accessible | PASS | gateway + header/footer/mobile menu + wizard cohort step (iteration_165) |
| 3d | Mind / Body / Special Needs accessible | PASS | /programmes #mind #body #special-needs; wizard tabs; cohort pages |
| 3e | ROI Calculator works if retained | PASS (hidden by design) | Hidden from menus by the B2.2 owner decision; /app/org/roi streams a redirect to /app; its data endpoint /bff/org/roi still answers 200 with full figures, so it can be switched back on |
| 3f | Existing batches and event pages accessible | PASS | hr.demo: 8 batch rows on Overview (49 batches total), /app/org/bookings/{id} 200, /booking-invite/{token} 200 (noindex), /app/org/events/{id}/participants 200 |
| 3g | Hiding New Batch doesn't delete or break history | PASS | legacy code kept; batch detail, invite and close routes unchanged; records untouched |
| 4a | Sitemap contents | PASS | 328 URLs, all unique, all www; 6 org URLs present; 0 legacy; 0 demo events |
| 4b | Canonical orgs indexable | PASS | as 1b/1c |
| 4c | Demo events excluded from indexing | PASS | 6 demo event pages 200 + "noindex, nofollow", none in the sitemap |
| 4d | Phase A date-free URLs + old-link redirects | PASS | all 6 old demo slugs → 308 → their date-free slugs (1 hop) |
| 4e | No valid public event page blocked | PASS | events page, robots route, proxy, institutional.py and the demo seed are unchanged since B4.1 (git diff empty); a public verified-org event (…acme-mumbai-nov-18-2026) is 200 "index, follow", self-canonical and in the sitemap |
| 5a | Tests, compile, lint, build | PASS (failures listed) | see §2 |
| 5b | No production records or settings changed | PASS | live www.nostops.org/for-companies still 200 and the live sitemap still lists it (B4 not published); no production DB access; bare host untouched |

## 2. Engineering results
- TypeScript: 0 errors. ESLint (whole frontend): 0 problems.
- `next build` (isolated copy synced to the repo): exit 0, compiled; 279 static pages (the retired pages and their OG routes are gone).
- Backend pytest, full suite incl. workflow (992): **947 passed, 2 failed, 12 skipped, 31 xfailed**.
  - FAILED test_teacher_onboarding_iter10::TestBffTeacherGuards::test_ai_bio_ok_with_csrf and ::test_handle_check_ok_with_session —
    HTTP 500 during the bulk run. The whole class (10 tests) passes when re-run alone. This intermittent pattern also appeared in the B2.3 audits.
  - Skipped (12, same as the B2.3 round 2 audit): 5 Cashfree-sandbox-only; 1 live-gateway own order; 2 "teacher has no assignments"; 1 retreat create;
    1 retreat itinerary; 1 org dashboard 404; 1 Pune fixture (removed in the B2.3 cleanup).
  - xfailed (31): documented workflow-suite gaps.
- B4 checks: b41_org_urls_check 85/85; b23_wording_check 0 fails.
- Frontend node checks: verify_site 15/0, verify_no_nearby 35/0, verify_phase_a, verify_access_matrix, verify_teacher_access_display,
  verify_instakyc_pricing PASS. Pre-existing failures in files B4 didn't touch (unchanged since B2.3): verify_seo_feeds 21/4,
  verify_venue_binding 82/2, verify_tier2_preview 16/2, verify_lyv_landing crashes (stale export).
- NOT executed: test_org_enquiries*.py (send real email); legacy root scripts; a new browser run (iteration_165 covered B4.2 at 1280/360/390;
  the only change since is the venue button, checked here with Playwright at 360 and 390).
- Preview data: the regression run added preview-only QA records (+35 events, +14 orgs, +7 teacher assignments, +1 registration). They are not cleaned.
  Programme, version, IP, payment, attendance, feedback and participant records are hash-identical before and after; demo content matches the seed.

## 3. Changed files (B4.1 implementation → B4.3)
Updated: frontend/next.config.mjs, app/(public)/sitemap.xml/route.ts, app/(public)/for-organisations/{page,impact/page,resources/page}.tsx,
app/(public)/programmes/page.tsx, app/(public)/venues/page.tsx, app/(public)/yoga-teachers/[city]/page.tsx,
app/(public)/become-a-teacher/[city]/page.tsx, app/app/teacher/widgets/page.tsx, components/app/nav-config.ts,
components/app/learner/WellnessJourney.tsx, components/auth/SignupRoleChooser.tsx, components/city/CityCoordinatorSpotlight.tsx,
components/guru/AskGuru.tsx, components/guru/context.ts, components/org/CohortShowcase.tsx, components/org/CohortPricing.tsx (comment),
components/ListVenueStickyCta.tsx, lib/guides.ts, lib/org/cohort-copy.ts, lib/org/pricing.ts (comment), lib/server/learner.ts.
Deleted: app/(public)/for-companies|for-educational-institutions|for-startup-networks/{page,opengraph-image,twitter-image}.tsx,
components/public/OrgLanding.tsx, lib/server/org-og.tsx. Tests: backend/tests/b41_org_urls_check.py (new), b23_wording_check.py (updated).

## 4. Preview URLs
https://nostops-spaces--0fieag2d.preview.emergentagent.com/for-organisations (+ /companies, /educational-institutions, /startup-networking-groups, /impact, /resources)
…/for-companies · …/for-educational-institutions · …/for-startup-networks (redirect) · …/sitemap.xml · …/robots.txt
…/events/yoga-for-focus-attention-arclight-technologies (demo, noindex) · …/events/yoga-for-focus-nervous-system-resilience (old slug → 308)
…/app/org/events/new (hr.demo@nostops.com / <demo-password>)

## 5. Unresolved issues (none blocking)
1. Event page titles still double the brand ("… · NOSTOPS · NOSTOPS") on demo and real event pages. Outside the B4 scope.
2. A logged-out "Create a Programme" loses ?cohort through login (proxy keeps the path only), so the visitor has to pick the cohort again.
3. Trailing-slash legacy variants take 2 hops (Next.js built-in behaviour). Not linked anywhere.
4. Old social-share images for the 3 retired pages now 404. Platforms will re-scrape the canonical page images.
5. Pre-existing: the sitemap filters QA events by slug only, while the event page also hides titles or org names matching "QA".
   Preview test data shows one listed QA event that 404s. In production this only matters if a real title or org name contains the word "QA".
6. One transient 520 from the live site on the companies page; 3 re-checks were all 200.
7. Preview test records from this run, plus the missing Pune fixture, are awaiting your approval to clean up.

## 6. Recommendation
Ready for product-owner approval. Every B4 criterion passes. Items 1–2 are small follow-ups for a later phase, and none affect SEO, Phase A rules or records.
B5 not started; waiting for approval.
