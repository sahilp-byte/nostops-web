# NOSTOPS Phase B2.3 — Programme Content Acceptance & Regression Audit (round 2, preview only)

Scope: all B2 changes = commits cd154a8b..HEAD (B2.2 + B2.3 + the four owner-requested audit fixes).
This audit changed no application code, published nothing and touched no production data. Preview test data created by
this audit's regression run is listed in §6 and has NOT been cleaned up (awaiting approval). The "Demo fee display" request
was paused because this brief says "do not introduce new features".
Evidence folder: /app/test_reports/b23_audit2/ (snapshot_before/after.json, A_programme_integrity.json,
B_content_accuracy.json, pytest_full.xml/.log, tsc.log, eslint.log, frontend_node_checks.log, guru_*.log,
wording_check.log, next_build.log, screenshots ev_*.png). Earlier UI run: test_reports/iteration_163.json.

## 1. PASS / FAIL / BLOCKED matrix

| # | Criterion | Result | Evidence / note |
|---|-----------|--------|-----------------|
| A1 | Exactly 10 programmes | PASS | inst_council_programmes = 10, all PUBLISHED, content_status SEED_DEVELOPMENT |
| A2 | Pathway, id, attribution, version history intact | PASS | PGM-2026-000001…010; record vs `_SEED_PROGRAMMES` 0 mismatches; 1 version each (PGV-…001-010, v1.0), snapshot == record on all compared fields; 1 IP row each; attribution "Curated by the NOSTOPS Council of Yoga Gurus"; updated_at 2026-10-06 (pre-B2). Programme, version and IP rows hash-identical before and after the full regression run |
| A3 | Exactly three equal pathways | PASS | MIND 4 · BODY 3 · SPECIAL_NEEDS 3; labels Mind / Body / Special Needs; API by_taxonomy 4/3/3 |
| A4 | All 9 cohort × pathway combinations work | PASS | test_nine_cohort_pathway_combinations 9/9 |
| B1 | Objectives supported by verified programme info | BLOCKED (Council) | Every surface reproduces the record faithfully: API (the wizard's source) = record on 11 fields × 10 programmes; /programmes cards show name, essence, group size, frequency and duration for all 10; 6 demo event pages show essence + all objectives, with snapshot = record. But the records are SEED_DEVELOPMENT with approved_claims [] — they are now labelled "In development — pending Council review". Council sign-off is still needed |
| B2 | Audience descriptions appropriate & consistent | PASS | Demo titles now name the programme ("Yoga for Focus & Attention — WIAS Campus"). The earlier reframes ("Exam Readiness", "Founder Resilience & Clear Decision Making", "High-Performance Habits") are gone. Guru answers use the record's audiences |
| B3 | No unsupported health claims / guarantees / invented credentials / unverified Council approvals | PASS (with notes) | Banned-phrase scan (Council-approved, guarantee, cure, heal, clinically, proven, measurable, relieve, treatment for) finds 0 hits on /programmes, the 9 org/trust/faq pages, the 6 demo event pages and the 6 demo org descriptions. B2 added lines contain these words only inside the Guru's prohibitions. Live Guru: 0 affirmative approval or cure claims in 18 prompts; "Are your programmes approved?" → "Council-curated, yes. Council-approved, not yet." Notes: (a) the version rows still carry status "APPROVED" (set by the seed; not displayed anywhere); (b) the wizard preview shows the record's disclaimer "Development seed content — not final Council-approved programme content" (accurate); (c) pre-existing wording "Council-vetted teacher" / "Council-empanelled" refers to teacher empanelment, not programmes |
| B4 | Special Needs language respectful, not medical treatment | PASS | verify_phase_a ("description avoids medical wording"); COND-autism → "NOSTOPS programmes are not treatments…"; guru_b11_safety 5/5 |
| B5 | No condition name triggers a programme recommendation | PASS | guru_condition_probe 12/12 safe; COND-frozen-shoulder / COND-autism name no programme; health-safety pytest pass |
| C1 | Single-date events not presented as multi-session programmes | PASS | All 6 demo events are single-date; subtitles read "A single 60-minute … session"; org copy says "a single on-site / on-campus / shared session". Multi-session phrases ("regular, grounding practice", "timed around the academic calendar", "A … programme helping") are absent from the cohort pages. WIAS 07:00–20:30 replaced by 07:30–08:30. The frequency chip stays labelled "Recommended: …" |
| C2 | Frequency / duration only advertised when deliverable | PASS (with note) | Engine schedules 1 or 2 sessions a week up to 366 days, so 1/3/6/12-month plans can be delivered. Note: the rate card and the cohort-page phases assume 2 sessions a week (8 a month), while 8 of 10 programmes recommend "Weekly" (open decision) |
| C3 | Group-size claims match pricing constraints | PASS | Any group size is now priced from the nearest band (<15 → 15–28 rates, >40 → 29–40) in the wizard, estimator (5–100), plan table, proposal template, FAQs and Guru (PRICE-10 / PRICE-60 answers correct). "Custom plan" appears nowhere. Demo capacities 25–30, all inside each programme's recommended size. FAQ size ranges (12–30, Special Needs 6–20) match the records |
| C4 | Multi-month proposals distinguished from confirmed schedules | PASS (with note) | Estimator is titled "Estimate your programme" / "Estimated total". The proposal email has an "Indicative investment" section and "we will then finalise dates, the venue and your teacher". Guru: "a single-date event is just that: one session". Note: the final round removed "Indicative estimate… your proposal confirms the exact figure" (it contradicted the organiser-set fee), so the estimator now relies on its "Estimate" labels alone |
| C5 | No pricing, royalty, payment or teacher-payout logic changed | FAIL (owner-approved changes) | Unchanged: royalty, teacher share 70/80/85, settlements (0), revenue allocations (0), rate-card figures, `estimate()` and `tierFor()` maths. Changed on purpose in B2.2/B2.3 (owner decision "each participant pays"): per-session registration and payment, every wizard event PAID with an organiser-set fee, rate-card suggestion, fee locked after publish. The final round changed presentation only (shared text constants; estimator display range 15–40 → 5–100); no computation changed |
| D1 | 9 combinations accessible | PASS | As A4; each cohort page lists Mind / Body / Special Needs; wizard shows all three tabs (iteration_163) |
| D2 | Approved programmes still self-service | PASS | test_self_service_mumbai / _pune pass; wizard lists all 10 with Select / Preview (iteration_163); B22/B23 create→publish tests pass |
| D3 | Special Needs alone ≠ forced enquiry | PASS | test_enquiry_special_needs_alone_is_self_service ×3; Guru SN-enquiry answer "No, you don't need to send a custom enquiry" |
| D4 | Customisation / no-fit still offers enquiry | PASS | Wizard prog-customise-link + prog-no-results-customise present; test_customisation_flag_is_explicit_only pass |
| D5 | Programme records, registrations, payments, teacher assignments preserved | PASS (with notes) | Programmes / versions / IP untouched (A2). verification_payments 6, settlements 0, attendance 3, feedback 2, participants 73: unchanged. 6 demo teacher assignments CONFIRMED (unchanged). Before vs after this run: 10/10 registrations and 8/8 assignments hash-identical. Notes: (1) the owner-approved cleanup deleted QA test records — 15 QA registrations, including 1 mock "PAID" QA order (order_qa_chain_…, not a real payment), and about 316 QA teacher offers, all backed up in memory/backups/preview_cleanup_*.json.gz; (2) it also deleted fixture NOSTOPS-EVT-TEST-PUNE1, so test_teacher_confirm_first::test_offered_event_hides_teacher_name now SKIPS ("Pune test event not present") — a coverage loss my cleanup fixture list missed |
| E | Engineering verification | PASS (failures listed) | See §2 |

## 2. Engineering results
- TypeScript `tsc --noEmit`: PASS, 0 errors.
- ESLint `eslint .` (whole frontend): PASS, exit 0.
- Production build `next build` (isolated copy in /tmp, so the dev server was not touched): PASS, exit 0, compiled; 298 static pages.
  Notices: /yoga-teachers/[city] and /yoga-teachers/[city]/[segment] fall back to dynamic rendering (no-store fetch). Not an error.
- Backend pytest, full suite incl. workflow (992 collected): **948 passed, 1 failed, 12 skipped, 31 xfailed**.
  - FAILED test_teacher_onboarding_iter10::TestBffTeacherGuards::test_ai_bio_ok_with_csrf — HTTP 500 during the bulk run (the AI bio call); passed on isolated re-run (1/1). Intermittent, not suppressed.
  - Skipped (12): 5 Cashfree-sandbox-only (wf_ai_onboarding); 1 paid-chain own-order (live gateway); 2 "teacher has no assignments" (iter125, prompt6); 1 retreat create (needs listed venue); 1 retreat itinerary (no data); 1 org dashboard 404 price audit; **1 NEW: teacher_confirm_first Pune fixture removed by the cleanup**.
  - xfailed (31): documented gaps in workflow suites (wf_ai_onboarding, wf_live_backend_readonly, wf_venue_listing, wf_venue_live_edits, wf_web_bff).
- Frontend node checks: verify_site 15/0 · verify_no_nearby 35/0 · verify_phase_a PASS · verify_access_matrix PASS · verify_teacher_access_display PASS · verify_instakyc_pricing PASS.
  FAIL, all pre-existing and in files B2 did not touch (same as round 1): verify_seo_feeds 21/4 (sitemap lastmod count, /gurukul-retreats); verify_venue_binding 82/2 (venue BFF helper imports); verify_tier2_preview 16/2 (free-landing copy, /venues banner flag); verify_lyv_landing crashes (stale export `lyvLandingEnabled`).
- SSR wording check (b23_wording_check.py, 17 pages + 2 OG images): 0 fails.
- Live AI Guru: 18 prompts (10 programmes + condition ×2, Special Needs enquiry, single-date, who pays, approval, price for 10 and 60). Frequency, length and group size correct for all 10; no approval, cure or "custom plan" claims. guru_b11_safety 5/5; guru_condition_probe 12/12.
- NOT executed: test_org_enquiries.py and test_org_enquiries_proposal.py (each sends real email to nostops.org@gmail.com); legacy root scripts /app/backend/test_*.py; a new browser E2E run (the last full UI pass, iteration_163, was green with 9/9 after the four fixes — evidence reused).

## 3. Files and records changed in B2 (B2.2 + B2.3 + audit fixes)
Code (65 paths): backend institutional.py, guru/knowledge.py, guru/guardrails.py, guru/router.py, seed_demo_ecosystem.py,
scripts/cleanup_preview_test_data.py; tests b23_wording_check.py, test_b22_recurring_sessions.py, test_b22_sanity_public.py,
test_b23_paid_programmes.py, test_b23_fee_edges.py. Frontend: events/[slug] (+register), faq, programmes, trust,
for-organisations (+impact, resources), for-companies / for-educational-institutions / for-startup-networks (+OG/twitter),
booking-invite, participant, org events (+participants), org roi, teacher institutional event, participant request BFF;
components EventCreatorWizard, ParticipantFee, ProgrammePreview, ReviewStep, ScheduleBlock, wizard-ui, ProgrammeDevNote,
AttendanceMarker, BatchShare, OrgHome, nav-config, CohortPricing, PricingEstimator, OrgLanding, ParticipantAuthForm,
ParticipantRegisterForm; lib guides, org/cohort-copy, org/pricing, org/programme-status, org/proposal-templates,
org/roi, org/schedule, server/institutional, server/participant. Plus memory docs, test_result.md and 2 cleanup backups.
Records: programme / version / IP rows unchanged. Schema: inst_event_sessions (new); registration unique index
(event, participant, session). Demo (seed v2): 6 events re-titled, subtitles, capacities 25–30, venues, times, durations,
slugs (old slugs kept as 308 aliases), event_seo rows; 6 org descriptions. Cleanup (owner-approved, preview only): about
470 events, 245 orgs, 245 memberships, 523 sessions, 15 registrations, 316 teacher offers, 400 SEO rows removed (backed up).

## 4. Preview evidence
Screenshots: test_reports/b23_audit2/ev_programmes_special_needs.png (3 Special Needs cards with Council-Curated + development
chip), ev_wias_event.png (single 07:30–08:30 session, 60 min, 30 participants, development chip). Plus iteration_163: wizard
programme step / preview modal / fee nearest-band note, estimator at 10 and 60 participants, showcase titles, 308 redirects.

## 5. Unresolved Council / business decisions
1. Council approval of the 10 programmes' content (B1). When approved, should the version rows' status ("APPROVED" today,
   while content_status is SEED_DEVELOPMENT) become the switch that removes the development note?
2. Rate-card cadence: plans and discounts assume 2 sessions a week; 8 of 10 programmes recommend weekly (C2).
3. Estimator wording: re-add a short line saying the figures are an estimate, not a confirmed schedule? (C4)
4. Demo events are FREE (shown with a "Free" chip) while the story says participants pay — the paused "Demo fee display" request.
5. Restore fixture NOSTOPS-EVT-TEST-PUNE1 from the cleanup backup and add it to the script's fixture list (D5 note 2).
6. Approve clean-up of this audit's preview test records (§6) with scripts/cleanup_preview_test_data.py --apply.
7. Publish B2.3 to the live site (pending your approval).

## 6. Limitations / side effects of this audit
- The regression run added preview-only QA records (not cleaned): +35 events, +14 organisations, +12 teacher assignments,
  +1 registration. test_institutional_12_checklist restarts the backend, which re-runs the demo seed: demo events and orgs
  got a fresh updated_at with identical content. Fixture NOSTOPS-EVT-2026-000001 was touched by the tests (updated_at).
- The Guru checks are live LLM calls; one run is evidence, not a guarantee of every future answer.
- Pre-existing UI notes from iteration_163: on mobile the AI Guru popup opens by itself over the event details.
- No production database was read or changed.
