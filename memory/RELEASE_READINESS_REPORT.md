# NOSTOPS — Final Production Readiness & Go-Live Verification

- Date: 2026-10-22 (UTC).
- Release candidate (RC): current repo HEAD, running in the preview environment (`connect-platform-web.preview.emergentagent.com`, local backend + local Mongo).
- Production checked read-only: `www.nostops.org` and `pro-learn-connect-1.emergent.host`. GET requests only, no logins, no writes.
- Nothing was deployed, no production data was changed, and no payments were made. All test fixtures were removed (org_enquiries = 0; wf_/qa_wf_ residue = 0).

## Test evidence (executed in this verification)

| Suite | Result |
|---|---|
| Approved E2E workflow suite `backend/tests/workflow -m "not ui"` | **202 passed, 0 failed**, 5 skipped (create real gateway orders; Cashfree-sandbox only), 31 xfailed (= known open defects: TVR-01 ×20, TVR-02/03/09/11/12/15/17/20/21/22, NST-011, NST-017) |
| Workflow UI suite (Playwright, `-m ui`) | **4 passed** |
| Org enquiry suites (`test_org_enquiries.py`, `test_org_enquiries_proposal.py`) | **43 passed, 2 failed**: proposal send → 502, because the email provider returned `429 rate_limited` |
| Legacy local-engine suites (25 files, local backend only) | 312 passed, 24 failed, 16 errors. Triaged as fixture/env drift, not RC regressions: seeded events deleted (owner-approved 2026-06), `PARTICIPANT_MAGIC_DEBUG` intentionally off, label-case changes, stale grep assertion |
| Legacy suites that write through preview → live backend (~20 files) | **Not run.** They would write to production data |
| Frontend verifiers | site 15/15 · access matrix PASS · display matrix PASS · InstaKYC pricing PASS · no-nearby 35/35 · seo 21/25 (4 stale assertions) · tier2 16/18 (2 stale: AI onboarding is now paid) · lyv crashes (stale import) |
| Sitemap crawl, RC (local) | **334/334 → 200** |
| Sitemap crawl, production | 373 URLs: **188 → 200, 175 → 500, 10 → 404** (production runs the old build) |
| Header + footer links, RC | 49 unique links, **all 200** |
| Mobile/a11y scan, 14 key pages at 390 px | no horizontal overflow · 1 `h1` per page · `lang=en` · 0 images without alt · 0 unlabeled fields · 0 unnamed buttons · 0–14 targets < 24 px per page (mostly checkboxes inside ≥ 48 px labels) |
| Email delivery probe (2 probes + 1 live enquiry, 09:5x–10:00 UTC) | **FAILED**: Emergent email service `429 email rate limit exceeded`. The lead was persisted; team and ack deliveries were recorded as `failed` |

## Requirement matrix

| # | Requirement | Status | Evidence / defect |
|---|---|---|---|
| 1a | Public routes (RC) | PASS | sitemap 334/334 200; knowledge pages 200, invalid slug 404, `/cities/pune` 308 |
| 1b | Public routes (production) | **FAIL** | 175 × 500 (knowledge pages) and 10 × 404 in the sitemap. The fix is in the RC but **not deployed** (NST-001/007) |
| 1c | Header/footer navigation | PASS | 11 header + 38 footer links, all 200. `/retreats` discovery is not linked (NST-025, P3) |
| 2 | Cohort pages & programme categories | PASS | 3 cohort pages + 3 legacy pages 200; Mind / Body / Special Needs one-liners present; no "Specific Needs"/"Other" |
| 3a | Enquiry persistence, validation, anti-spam, dedupe, admin pipeline | PASS | 43 tests; a live record was persisted with stage NEW while the email was failing |
| 3b | Enquiry notifications (team + acknowledgement) | **FAIL** | provider 429 rate-limited throughout the session; 2 proposal tests failed. Failure was graceful (lead kept, status `failed`, admin "Resend" available) |
| 3c | Enquiry on production | BLOCKED | the form is not on production (old build) |
| 4a | Teacher registration validation | PASS | BFF register field checks + backend rejection pass-through tests |
| 4b | Sign-up → onboarding → profile completion happy path | BLOCKED | would create a live production user; there is no staging backend (NST-006/NST-024) |
| 5a | Local role permissions (admin-only moderation, AI admin, enquiries) | PASS | 40-case matrix; admin BFF 401 for anonymous users; `/app/admin/*` redirects to `/login` |
| 5b | Remote admin KYC / empanelment reads | **FAIL (P0)** | **TVR-01**: readable by learner, teacher, guru and HR (20 xfail tests) |
| 5c | Admin 2FA | **FAIL** | NST-004 not enforced (owner hold); weak demo credentials documented (production login not attempted) |
| 5d | Verification payment identity | PASS | TVR-14 tests |
| 5e | Single eligibility / empanelment source | **FAIL (P1)** | TVR-09/10 xfail |
| 6a | Venue listing (free), moderation, owner edits, owner scoping | PASS | 64 + 12 workflow tests; TVR-16 tests |
| 6b | Approved pricing | PASS | server: ₹1,999 + 18 % = ₹2,359 / US$30; UI copy matches; InstaKYC ₹279 |
| 6c | Paid AI-onboarding checkout end to end | BLOCKED | preview uses **live** Cashfree; sandbox-only tests skipped |
| 7a | Retreat server-side validation (dates, venue binding, capacity) | PASS | 37 BFF tests, all rejected before reaching the live backend |
| 7b | Create → publish happy path | BLOCKED | would create a live retreat |
| 7c | Venue association | **FAIL (P1)** | TVR-04: only 5 seeded partners can host; free listings are rejected. Legacy retreats have no venue id (TVR-03) |
| 7d | Public retreat directory | **FAIL (P2)** | TVR-28: `/retreats` shows 0 retreats (every live one is QA or a duplicate and is hidden) |
| 8a | Payment integrity (signature, forged PAID, 402/409, outage 502) | PASS | AI-onboarding workflow tests |
| 8b | Live charge + refund end to end | BLOCKED | no sandbox; real charges are prohibited |
| 8c | Refund / cancellation policy | **FAIL (P1)** | NST-010: RC `/refunds` still shows "[to be confirmed]" for entity, address, grievance officer and processing time; production `/refunds` → 404 |
| 8d | Public ₹1 test page | **FAIL on prod** / PASS on RC | NST-005: `/pay` is 200 on production and 404 on the RC |
| 8e | Preview payment isolation | **FAIL (P1)** | NST-006/TVR-26: preview holds live Cashfree keys (owner chose to keep this) |
| 9a | Public counters | PASS | /teachers 86 · 36 · 8 · 6 cities = /yoga-teachers 6 = impact 15 / 86 / 36 / 8 / 5 / 6 |
| 9b | Directory city filter | **FAIL (P2)** | TVR-11: 27 of 39 public teachers have city "India"/blank and are missing from city pages |
| 9c | Duplicate content | **FAIL (P2)** | NST-016: `/for-companies`, `/for-educational-institutions` and `/for-startup-networks` are indexable with self-canonicals and duplicate the cohort pages. Duplicate retreats are hidden (PASS) |
| 10a | Mobile layout | PASS | no overflow on 14 pages at 390 px |
| 10b | Basic a11y | PASS (automated subset) | headings, lang, alt text, labels, button names |
| 10c | Tap-target size / full WCAG 2.2 AA | **FAIL (P3)** / BLOCKED | NST-028: small targets remain. A manual screen-reader audit was not performed |
| 11 | SEO | PASS (RC) / **FAIL (prod)** | robots disallows /api /bff /app /admin and lists the sitemap; self-canonicals; noindex on /login /signup /app /saved /venues/saved. Production sitemap is 50 % broken until deploy. `lastmod` appears on only 27 of 334 URLs (optional, P3) |
| 12a | CSRF, admin guards, privacy of directory HTML | PASS | workflow tests |
| 12b | Security headers | PASS | CSP, nosniff, Referrer-Policy, Permissions-Policy; HSTS on production. CSP allows `unsafe-inline`/`unsafe-eval` (NST-026, P3) |
| 12c | Remote information disclosure | **FAIL (P1)** | NST-012, re-verified today: `/docs` and `/openapi.json` → 200; `/api/payments/cashfree/diag` → 200 exposing env, live mode, client-id last 4 and secret prefix |
| 13a | Error monitoring / alerting | **FAIL (P2)** | no app-level monitoring (no Sentry/APM); platform logs only |
| 13b | Backups / restore | BLOCKED | no documented production DB backup/restore procedure (platform-managed; owner to confirm) |
| 13c | Rollback readiness | PASS | git history + Emergent rollback; per-fix rollback in `LAUNCH_FIX_CHANGELOG.md`; no migrations |
| 13d | Production configuration | **FAIL (P1)** | preview and production share the business backend (NST-006); local DB drift (NST-014); mail from a shared domain, no DMARC on nostops.org (NST-013) |

## Unresolved defects that gate launch

| Sev | ID | Defect | Owner | Action |
|---|---|---|---|---|
| P0 | TVR-01 | Live admin KYC/empanelment data readable by any signed-in user | Backend team | Add admin-role checks to every remote `/admin/*` route. Acceptance: the 20 xfail tests pass |
| P0 | NST-001/005/007 (+003/008/009/011) | Production runs the old build: 175 × 500, live ₹1 `/pay`, no enquiry form | Owner | Publish → Deploy the RC, then re-run the production sitemap crawl (target 100 % 200) and confirm `/pay` → 404 |
| P0 | NST-004 | Weak, documented demo admin credentials; 2FA not enforced | Owner / backend | Rotate or disable demo accounts on production; enforce admin TOTP (currently on hold) |
| P1 | Enquiry email | Notification provider rate-limited (429); team/ack emails not delivered | Owner + Emergent support | Restore email quota; re-probe; then one end-to-end enquiry on production. Consider a domain mailbox (NST-013) |
| P1 | NST-012 | Remote `/docs`, `/openapi.json` and Cashfree `diag` exposed | Backend team | Disable docs in production; put admin auth on `diag` |
| P1 | NST-010 | Refund / legal pages incomplete; production `/refunds` 404 | Owner / legal | Supply entity, address, grievance officer and refund timeline |
| P1 | NST-006 / TVR-26 | Preview holds live Cashfree keys and shares the production backend | Owner | Sandbox keys in preview, or a strict "no payment QA in preview" rule |
| P1 | TVR-04, TVR-09/10 | Free venues can't host retreats; eligibility and empanelment not synced | Owner + backend | Product/backend decision (architecture change needs approval) |
| P2 | TVR-28, TVR-11, NST-016, NST-013, monitoring | Empty retreat directory; city data; legacy duplicates; DMARC; no error monitoring | Owner / web / DNS | Post-fix or launch with a known-issue list |
| P3 | NST-025/026/028, test debt | Footer re-link, CSP hardening, tap targets, stale frontend/legacy tests | Web | Post-launch |

## Release decision

**READY AFTER SPECIFIED FIXES.**

The release candidate is functionally sound. The approved E2E suite has 0 failures, all 334 sitemap URLs return 200, counters are consistent, enquiry persistence works, and payment-integrity checks pass. It is **not READY** because these remain unresolved:
- a critical security defect (TVR-01);
- weak privileged credentials (NST-004);
- information disclosure (NST-012);
- undelivered enquiry notifications;
- production still running the broken old build.

Launch after:
1. TVR-01 and NST-012 are fixed by the backend team.
2. Demo credentials are rotated (and admin 2FA is enforced, or a written risk acceptance is recorded).
3. Email delivery is restored and verified.
4. Legal and refund content is supplied.
5. The RC is deployed and the production release gate passes:
   - sitemap 100 % 200;
   - `/pay` → 404;
   - one enquiry received end to end;
   - one owner-card live payment and refund.
