# NOSTOPS Phase B2.3 — Programme Content Acceptance & Regression Audit (preview only)

Date: 2026-10-24 (server clock). Scope: all B2 changes = commits cd154a8b..HEAD (B2.2 + B2.3; B2.1 changed no code).
Nothing was published. No production data touched. No code changed by this audit. Preview test data created by the
regression run is listed in §6 and was NOT cleaned up (awaiting approval).

## 1. PASS / FAIL / BLOCKED matrix

| # | Criterion | Result | Evidence / note |
|---|-----------|--------|-----------------|
| A1 | Exactly 10 programmes | PASS | `inst_council_programmes` = 10, all PUBLISHED; seed catalogue unchanged in B2 diff |
| A2 | Pathway, id, attribution, version history intact | PASS | PGM-2026-000001…010 unchanged; each has 1 ProgrammeVersion v1.0 APPROVED (PGV-…001-010), snapshot == record (field-by-field), 1 IP-metadata row each; record vs `_SEED_PROGRAMMES` = 0 mismatches; updated_at 2026-10-06 (pre-B2) |
| A3 | Exactly three equal pathways | PASS | MIND 4 · BODY 3 · SPECIAL_NEEDS 3; Guru KB "MIND · BODY · SPECIAL NEEDS" |
| A4 | All 9 cohort × pathway combinations work | PASS | `test_nine_cohort_pathway_combinations` 9/9; wizard shows Mind/Body/Special Needs tabs for a COMPANY org (screenshot) |
| B1 | Objectives supported by verified programme info | BLOCKED (Council) | Every surface reproduces the record faithfully, but the record itself is `content_status=SEED_DEVELOPMENT`, `approved_claims=[]`, disclaimer "Development seed content — not final Council-approved programme content." Needs Council sign-off |
| B2 | Audience descriptions appropriate & consistent | PASS (with note) | Cards, wizard, event pages and Guru all use the record's audience. Note: demo-event titles/subtitles reframe audiences/outcomes (e.g. "Exam Readiness", "Founder Resilience & Clear Decision Making", "High-Performance Habits") |
| B3 | No unsupported health claims / guarantees / invented credentials / unverified Council approvals | FAIL (pre-existing, not added by B2) | B2 diff adds none (scan of all added lines). But present today: (a) Live Guru answers say the programme "has been reviewed and approved by the Council of Gurus" (test_reports/b23_audit_guru_responses.json) while records are seed content; (b) wizard says "Approved, versioned, teacher-led content" and preview "v1.0 · approved"; (c) public /programmes and event pages show no seed disclaimer; (d) demo org descriptions on the cohort pages carry outcome claims ("The goal is practical and measurable", "learns better", "make better decisions", "relieving stiffness", "academic performance and lifelong health") |
| B4 | Special Needs language respectful, not medical treatment | PASS | Records, cohort/SN copy and KB avoid treatment language; Guru (autism question): "NOSTOPS programmes are not treatments…" |
| B5 | No condition name triggers a programme recommendation | PASS | Live Guru: "frozen shoulder / cervical spondylosis" and "autism" → no programme named; health-safety tests 30/30; teacher keyword test and enquiry SN self-service tests pass |
| C1 | Single-date events not presented as delivered multi-session programmes | FAIL (pre-existing demo content) | B2 surfaces are correct (single event shows one date; frequency chip labelled "Recommended:"). But all 6 single-date demo showcase events/orgs read as ongoing programmes: "Sessions are open to students… timed around the academic calendar", "giving founders a regular, grounding practice", subtitles "A … programme helping …" |
| C2 | Frequency / duration only advertised when deliverable | PASS (with note) | Engine now delivers 1 or 2 sessions/week up to 366 days, so 1/3/6/12-month plans can be scheduled. Note: rate-card plans assume 2 sessions/week (8/month) while 8 of 10 programmes recommend "Weekly" |
| C3 | Group-size claims match pricing constraints | FAIL | Pricing covers 15–40 ("other sizes → custom plan"), programmes recommend 6–30. The wizard's suggested fee applies the rate card to any capacity (e.g. 8 for Special Needs, 60), contradicting "custom plan". Demo events have capacity 60 / 50 / 45 / 40 vs recommended 15–30 / 12–25 |
| C4 | Multi-month proposals distinguished from confirmed schedules | PASS (with note) | Estimator: "Indicative estimate… Your proposal confirms the exact figure"; proposal template: "confirmed once we agree the batch plan, dates and venue". Note: since B2.3 the wizard lets the organiser set the fee with no proposal, but the cohort pages and Guru still say "the proposal confirms the exact figure" |
| C5 | No pricing, royalty, payment or teacher-payout logic changed | FAIL (owner-approved changes) | Royalty, teacher share (70/80/85), settlements, revenue allocation and rate-card figures: unchanged. Payment and pricing logic DID change on purpose: per-session registration and payment (B2.2); wizard always PAID with an organiser-set fee, rate-card suggestion helper `commitmentMonths`, and fee locked after publish (409 `pricing_locked_after_publish`) (B2.3, owner decision "Each participant pays to register") |
| D1 | 9 combinations accessible | PASS | as A4; 3 cohort pages each list Mind/Body/Special Needs |
| D2 | Approved programmes still self-service | PASS | Wizard lists all 10 with Select/Preview; `test_self_service_*`, B22/B23 create→publish tests pass |
| D3 | Special Needs alone ≠ forced enquiry | PASS | `test_enquiry_special_needs_alone_is_self_service` ×3; live Guru answer; wizard SN tab has Select + Continue |
| D4 | Customisation / no-fit still offers enquiry | PASS | wizard `prog-customise-link` → `/for-organisations/companies?customise=1&interest=SPECIAL_NEEDS&cohort=COMPANY#enquire`; `prog-no-results-customise`; `test_customisation_flag_is_explicit_only` |
| D5 | Existing programmes, registrations, payments, teacher assignments preserved | PASS (with note) | Programme/version/IP rows untouched. 12 pre-existing registrations present, none modified (unique index migrated to event+participant+session, which existing rows satisfy). verification_payments 6, settlements 0 unchanged. Demo teacher assignments (6 CONFIRMED) unchanged. B2 code has no data migration; its only delete is session rows for the draft being edited |
| E | Engineering verification | PASS (with failures listed) | see §2 |

## 2. Engineering results
- TypeScript `tsc --noEmit`: PASS (0 errors).
- ESLint `eslint .` (whole frontend): PASS (exit 0, 0 errors, 0 warnings).
- Backend pytest, full suite `/app/backend/tests` (992 collected): **949 passed, 1 failed, 11 skipped, 31 xfailed** (JUnit: test_reports/pytest/b23_audit_full.xml)
  - FAILED `test_iter6_org.py::TestRoiCalculatorBff::test_roi_100_x_6` — HTTP 502 during the bulk run. Passed on an isolated re-run (2/2). This is an intermittent proxy 502, not suppressed. The ROI page itself is hidden (B2.2); the BFF is still live.
  - Skipped (11): 5 Cashfree-sandbox-only checkout tests; 1 anti-poaching (live gateway); 2 teacher-roster PII (no assignments); 1 retreat create (needs listed venue); 1 retreat itinerary (no data); 1 org dashboard 404 price audit.
  - xfailed (31): known documented gaps (TVR-xx markers, e.g. venue dedupe index, image magic bytes).
- Frontend node checks: verify_site 15/0 · verify_no_nearby 35/0 · verify_phase_a PASS · verify_access_matrix PASS · verify_teacher_access_display PASS · verify_instakyc_pricing PASS.
  FAIL (all in files B2 did not touch — pre-existing): verify_seo_feeds 21/4 (sitemap /gurukul-retreats, lastmod count); verify_venue_binding 82/2 (venue BFF helper imports); verify_tier2_preview 16/2 (List-your-Venue landing copy, /venues banner flag); verify_lyv_landing crashes (stale export `lyvLandingEnabled`).
- Live Guru check: 15 prompts (10 programmes + condition, Special Needs enquiry, single-date, who-pays) → test_reports/b23_audit_guru_responses.json. Facts (frequency, length, group size) correct for all 10.
- NOT executed: `test_org_enquiries.py`, `test_org_enquiries_proposal.py` (each sends real email to nostops.org@gmail.com); legacy root scripts `/app/backend/test_*.py`; `next build` (would contend with the running dev server; tsc + eslint cover compile/lint); browser E2E re-run (last full UI pass: iteration_161/162, green).

## 3. Files changed in B2 (B2.2 + B2.3) — 60 files
Backend: institutional.py (recurring sessions, per-session registration/attendance/reminders, PAID fee lock, India-date jobs), guru/knowledge.py, guru/router.py; tests test_b22_recurring_sessions.py, test_b22_sanity_public.py, test_b23_paid_programmes.py, test_b23_fee_edges.py, b23_wording_check.py.
Frontend: events/[slug] page + register page, faq, programmes, for-organisations (+impact, resources), for-companies / for-educational-institutions / for-startup-networks (+OG/twitter images), booking-invite, participant page, org events pages, org roi page, teacher institutional event page, participant request BFF; components EventCreatorWizard + new ParticipantFee, ProgrammePreview, ReviewStep, ScheduleBlock, wizard-ui; AttendanceMarker, BatchShare, OrgHome, nav-config, CohortPricing, OrgLanding, ParticipantAuthForm, ParticipantRegisterForm; lib guides.ts, org/cohort-copy.ts, org/pricing.ts, new org/roi.ts, new org/schedule.ts, server/institutional.ts, server/participant.ts.
Records: no programme/version/IP records changed. Schema: `inst_event_sessions` (new), registrations unique index → (event_id, participant_id, session_id).

## 4. Preview evidence
Screenshots taken in preview: /programmes Special Needs section (10 cards from the record); WIAS single-date demo event page (capacity 60, 07:00–20:30, "Recommended: Weekly"); wizard programme step, Special Needs tab, with Select and the customise link.

## 5. Unresolved Council / business decisions
1. Council: approve (or replace) the 10 seed programmes' content. Until then, should surfaces say "Council-curated (development content)", and should the Guru stop saying "approved"?
2. Demo showcase content: rewrite the 6 demo orgs/events (outcome claims, multi-session wording on single-date events, capacities 40–60 above recommended sizes).
3. Pricing vs payment model: participants pay an organiser-set per-session fee, but the cohort pages and Guru still say "the proposal confirms the exact figure". Also, should the rate-card suggestion apply outside 15–40 and below the Special Needs group sizes?
4. Rate card assumes 2 sessions/week, while 8 of 10 programmes recommend weekly. Which cadence should the plans and commitment discount use?
5. Branding lines left in place: "Healthy Nervous System Intelligence" (H1) and "Calmer minds… Stronger organisations".

## 6. Limitations / side effects of this audit
- The full regression run added preview-only QA records (not cleaned): +35 events (22 published, 10 PUBLIC), +14 orgs, +6 teacher assignments, +1 registration (on QA event NOSTOPS-EVT-2026-000001). The engine's time-based sweeps also updated 24 pre-existing QA-event assignments (status DECLINED/expired) and lifecycle/updated_at on 253 pre-existing events; demo assignments were untouched.
- Pre-existing preview clutter: 4 PUBLIC recurring test events with non-QA titles ("Iter157 Rec …", "Posture Programme Preview b64809"), and hr.demo sees 56 QA company orgs in the wizard.
- No pre-B2 data snapshot exists, so "preserved" is shown by code diff + record checks + timestamps, not by a before/after dump.

## 7. Follow-up — owner's 4 audit actions (done in preview, NOT published)
1. Honest labels (fixes B1/B3a-c): "Council-curated" kept + "In development — pending Council review" chip on /programmes,
   event + register pages, wizard cards/preview/review, /trust. Wizard no longer says "approved". AI Guru KB + guardrails
   forbid "Council-approved"; live probe answers "Council-curated, yes. Council-approved, not yet."
2. One pricing story (fixes C3/C4): sizes outside 15–40 use the nearest band (<15 → 15–28, >40 → 29–40) in the wizard,
   estimator (now 5–100), plan table, proposal template, FAQs and Guru. "Custom plan" / "proposal confirms" removed; all
   surfaces say the organiser sets the per-session participant fee (wizard suggests the rate card) and participants pay online.
3. Preview cleanup (fixes §6): scripts/cleanup_preview_test_data.py --apply removed ~470 QA events, ~245 orgs and their
   sessions, sign-ups, teacher offers, SEO rows and memberships. Left: 6 demo orgs + 9 demo events, fixtures
   ORG-000001/000002 and EVT-000001/000002/TEST-PAST1. Backups in memory/backups/preview_cleanup_*.json.gz.
4. Demo rewrite (fixes B3d/C1/C3): one single-date session per demo event, titles "<Programme> — <Org>", capacities 25–30,
   session lengths match the programme, copy states only the programme aims. Old slugs 308-redirect.
Testing: tsc/eslint clean, wording SSR check 0 fails, backend suite green (load timeouts pass on re-run), testing_agent
iteration_163 all 9 frontend checks pass.
