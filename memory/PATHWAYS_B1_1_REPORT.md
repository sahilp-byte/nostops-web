# Phase B1.1 — Three Equal Pathways — Final Report (PREVIEW ONLY, not deployed)

## Changed files
Backend: institutional.py (canonical MIND/BODY/SPECIAL_NEEDS persistence, reviewed-record adaptive verification,
admin Special Needs awaiting list, public adaptive-verified handles, illustrative-only publish refusal),
org_enquiries.py (explicit customisation_requested flag), guru/knowledge.py + guru/guardrails.py (neutral Special Needs,
health-safety rule), seed_special_needs_examples.py (NEW, preview-only seeder).
Frontend: bookings/new page + bff/org/bookings (legacy New Batch retired → wizard, 410), nav-config, OrgHome,
EventCreatorWizard (customise link + empty-results link), OrgEnquiryForm (+bff/org-enquiry, lib/server/org-enquiries,
admin enquiry page), CohortShowcase + lib/server/institutional (illustrative examples), events/[slug] page (suitability
note), CityTeacherDiscovery, yoga-city, discover page + lib/server/discover, TeacherCard, lib/teacher, lib/yoga-dimensions
(verified-record badge only), teacher/institutional page + OnboardingWizard (declared pathways / rejected values),
AdaptiveCompetenceControl + admin/institutional page (awaiting list), org/events page (illustrative label).
Tests: NEW test_pathways_b11.py, tests/scripts/guru_b11_safety.py; updated test_special_needs_pathway.py (run-scoped
cleanup + reviewed records), test_iter6_org.py, test_phase_a_oea.py.

## B1.1 regressions found and fixed (5)
- test_iter6_org: old "invalid capacity → 400" on the retired New Batch POST. It now asserts the retirement contract
  (CSRF still enforced → 403; CSRF-valid → 410 + next=/app/org/events/new, nothing created).
- test_phase_a_oea (4): the 3 illustrative examples are demo-seeded with no public page. The six public demo events keep
  every original assertion (count 6, noindex, ORGANISATION_ONLY, date-free slugs). A new test makes sure every other
  demo-seeded event is an illustrative example (no slug, PRIVATE, CLOSED, DRAFT, no teacher, not in the public feed).

## Test results
- Full backend suite: 630 passed, 11 skipped, 82 failed/errors. All 82 were re-run against the pre-B1.1 code
  (git stash) and fail there too, so they are pre-existing. Another 6 failed only under load (502/timeout) and pass on rerun.
- Workflow suite: 218 passed, 31 expected-fail, 5 skipped. B1.1 + Special Needs suites: 28/28. tsc clean.
- Guru safety: 4/5 cases on the first run, then 14/14 condition questions on re-runs. One reply named a programme in
  answer to a neck-pain question (no cure claim). The rule is prompt-only, so this can occasionally recur.
- Frontend (testing agent, iteration_158): all B1.1 flows pass at desktop + 390px. No product bugs.

## Pre-existing failures (not B1.1) — root causes
A 28 · participant sign-in tests need PARTICIPANT_MAGIC_DEBUG=TRUE (preview is FALSE).
B 28 · hard-coded fixture IDs from an older database (events, retreats, articles, rosters, knowledge-graph rules).
C 17 · live backend now gates teacher.demo behind InstaKYC + ₹279 payment (403).
D 8 · expected wording/layout from earlier releases (e.g. "Teacher confirmed" → "Teacher Confirmed").
E 1 · venue submit anti-spam timer (429).

## Data notes
- 4 removed qa_sn_selfdecl teachers are backed up in memory/backups/b11_removed_qa_teachers.json.
- Older Special Needs test runs (before cleanup existed) left behind 15 qa_sn_* teachers, 15 QA orgs, 52 QA events and
  62 assignments in preview. All 76 "Special Needs awaiting" admin entries are these QA events.
- No real teacher holds a reviewed adaptive-practice record. Only self-declared Special Needs teacher: Anjali Teacher
  (user_1f18960aeaba, Navi Mumbai) needs a manual review.

## Follow-up (approved by user)
- AI Guru strict health-safety check (guru/health_safety.py, router.py). If the user's recent messages name a health
  condition and the reply names a programme, the Guru rewrites the reply once. If the rewrite still names one, it sends
  a fixed safe reply. Tests: tests/test_guru_health_safety.py 29/29 (no LLM); live probe
  tests/scripts/guru_condition_probe.py 12/12; guru_b11_safety.py 5/5 twice. The knowledge base now says the adaptive
  review is "distinct from standard empanelment". The probe's empanelment check was rewritten: it flags an invented
  process ("during/as part of empanelment", exams/tests/interviews), not the true statement that the review is separate.
- Preview QA cleanup: cleanup_qa_sn_fixtures.py backed up memory/backups/b11_qa_sn_cleanup_20261023T205132Z.json, then
  deleted 15 qa_sn teachers, 15 QA orgs, 52 QA events, 52 SEO rows and 62 assignments. Dry-run now finds 0.
- Correction: of the 76 admin "Special Needs awaiting" entries, 25 were these Special Needs fixtures. The other 51 are
  QA events from other suites (P3 drafts / P5 seed) that use Accessible Chair Yoga, most created by today's regression
  runs. They are preview-only and not deleted (not in the approved scope).

## Final pre-publish verification (requested by user, preview only)
- Targeted B1 + B1.1 suites (test_pathways_b11 [+ new keyword test], test_special_needs_pathway, test_guru_health_safety,
  test_phase_a_oea, test_iter6_org): 83 passed, 0 failed, 0 skipped (b11_final_targeted.xml). One earlier run had 3 HR/
  teacher login failures from Cloudflare 502 errors. The 4 runs since then all passed (kept as b11_final_targeted_run1_transient502.xml).
- tsc exit 0 (test_reports/b11_tsc.log). The project's ESLint can't run (there's no ESLint config in the repo; this predates
  B1). The platform linter checked all 33 changed frontend files: 0 code issues. 4 files show only a missing-rule-definition
  notice (@next/next/no-img-element), which is a linter config gap.
- HR check: there's no "New Batch" in the nav; 8 existing batch links show on org home and 3 opened fine (200);
  /app/org/bookings/new shows the moved notice and no form.
- Correction: Anjali Teacher (user_1f18960aeaba) is the teacher.demo demo persona, not a real teacher. The preview has
  no real teacher records, only 6 demo teachers and QA fixtures. 0 rows have a reviewed adaptive record, 0 have a bare flag
  and 0 have invalid stored pathways.
- Demo events: the content of the 6 Phase A demo events is unchanged (ORGANISATION_ONLY, same slugs and lifecycle). Their
  updated_at changes whenever the preview backend starts, because the existing Phase A startup seed re-saves them. That
  seed is not a B1 change. Demo and illustrative events have 0 registrations.
- Production (www.nostops.org), read-only check: none of the B1.1 markers are present, so nothing has been published.
- Disclosure: the legacy regression suite logs into the shared live account service as the demo personas. A few passing
  tests write small things to teacher.demo (notifications marked read, a video-intro upload token, an AI bio draft). All
  other writes were rejected (403/400/410). The enquiry tests tried to send notification emails, and the error log shows
  533 email sends refused with 429 (rate limit) over its whole history.
