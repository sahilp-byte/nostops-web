# NOSTOPS Phase B1.1 — Three Equal Yoga Pathways: Audit & Plan (READ-ONLY)

Audited: June 2026, preview source + preview DB (read-only queries) + read-only GETs on www.nostops.org.
No code, data or production changes were made. OEA-01, pricing, royalties and payments untouched.

## 1. Current architecture & source of truth

**Institutional source of truth** — `backend/institutional.py` L108-115:
`TAXONOMY = {MIND, BODY, SPECIAL_NEEDS}`, labels `Mind / Body / Special Needs`, slugs `mind / body / special-needs`.
Exposed by `GET /api/institutional/meta` and `GET /api/institutional/programmes` (`by_taxonomy`, ordered MIND→BODY→SPECIAL_NEEDS).
Mirrors (kept in sync by hand): `backend/guru/knowledge.py` (TAXONOMY_LABELS + programme examples), `backend/org_enquiries.py`
(INTERESTS + Literal), `frontend/lib/server/institutional.ts` (`Taxonomy` type), `frontend/lib/org/enquiry.ts`,
`frontend/app/bff/org-enquiry/route.ts`, fallback arrays in `app/(public)/programmes/page.tsx` and `app/app/org/events/new/page.tsx`.

**Second taxonomy (1:1 seeker + teacher profile)** — `frontend/lib/yoga-dimensions.ts`: `mind | body | special_needs`
with sub-requirements; used by `components/app/learner/BookJourney.tsx`, `components/city/CityTeacherDiscovery.tsx`,
`lib/server/discover.ts`, teacher `OnboardingWizard.tsx` / `TeacherProfileEditForm.tsx` (profile `yoga_dimensions`, main API),
legacy batch flow `CreateBookingForm.tsx` → `/bff/org/bookings` → main API `/bookings`, `app/booking-invite/[token]/page.tsx`.
No codified mapping between the two taxonomies.

**Data (preview DB)**
- `inst_council_programmes`: 10 PUBLISHED, SEED_DEVELOPMENT, v1.0 — MIND 4, BODY 3, SPECIAL_NEEDS 3.
- `inst_programme_versions`: 10 APPROVED v1.0.
- `inst_events.programme_snapshot.taxonomy`: frozen per event; all 9 cohort×pathway combinations present.
- `inst_teacher_directory`: `taxonomies[]` (self-declared), `adaptive_practice_verified(_at/_by/_note)` (admin/Council only).
- `org_enquiries.interests[]` (MIND/BODY/SPECIAL_NEEDS, 1-3).

**Flow (identical for all three pathways)**: cohort page → `/app/org/events/new?cohort=` → org → programme (pathway tab
or search) → configure → `POST /events` → `POST /events/{id}/publish` → `_auto_assign_teacher` → teacher accepts.
One wizard, one `create_event`, no taxonomy branching. Only documented difference: Special Needs teacher eligibility
(`_select_teacher` hard gate on `adaptive_practice_verified`, reason `NO_VERIFIED_ADAPTIVE_TEACHER`, legacy-offer
acceptance block, admin/Council verification). This is an eligibility rule, not a separate taxonomy or workflow.

## 2. Verified inconsistencies

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| I-1 | High | B1.0 Special Needs teacher gate is NOT live yet | live `/bff/institutional/admin/teacher-directory/x` → 404; preview → 405 (route exists) |
| I-2 | High | Teacher pathway/language/level never reach institutional matching | `app/app/teacher/institutional/page.tsx` L58 syncs name/handle/city only; `teacher_directory_sync` `$set`s taxonomies/languages/level/specializations/experience/rating to empty on every visit |
| I-3 | Med | Directory `taxonomies` not validated | `str(x).upper()` accepts anything; preview has `["SLEEP"]` |
| I-4 | Med | Showcase has zero Special Needs examples | 6 demo events (preview + live) are all MIND/BODY; demo teachers declare MIND/BODY only, none adaptive-verified |
| I-5 | Med | Search dead-ends for Special Needs terms | wizard search: neck/shoulder/cervical/frozen/pain → 0; back → BODY only; empty state has no next step |
| I-6 | Med | No customisation path inside creation flow | wizard has no "request a customised programme" option (explicit request or nothing fits) |
| I-7 | Med | Parallel legacy "New Batch" flow | `/app/org/bookings/new` (nav "New Batch", OrgHome CTA): multi-select dims, no Council programme, no competence gate |
| I-8 | Med | Diagnostic/treatment-flavoured wording | yoga-dimensions: "condition-aware", chip "Ankylosing spondylitis", keyword heuristic maps prenatal/PCOS/menstrual/yin → special_needs; onboarding "therapeutic" |
| I-9 | Med | 1:1 Special Needs filter not tied to verified competence | teachers appear via self-declared `yoga_dimensions` or keyword heuristics |
| I-10 | Low | AI Guru lacks Special Needs definition/safety framing | no pathway definition, no verified-teacher/fallback note, no "not a substitute for healthcare professionals" |
| I-11 | Low | No ops list of Special Needs events waiting for a verified teacher | only audit log; org label identical for both reasons (fine) |
| I-12 | Low | No participant suitability note on institutional event pages | BookJourney has "not a medical treatment"; event pages/registration do not |
| I-13 | Council | Content boundary questions (no change proposed) | "Calming Practices for Sensory Wellbeing" vs physical-limitation definition; BODY "Posture & Back Care" vs "back pain" |
| I-14 | Low | Preview QA pollution | 4 `qa_sn_selfdecl_*` verified teachers without `qa_fixture` flag (preview only) |

Compliant: all 9 combinations supported; SPECIAL NEEDS alone never forces an enquiry; "Request a proposal" is always
secondary; no separate Special Needs wizard; strict term "Special Needs" everywhere.

## 3. Files / schemas / APIs involved
Backend: `institutional.py` (`teacher_directory_sync`, `TeacherSyncIn`, `_select_teacher`, `/admin/teacher-directory`),
`org_enquiries.py` (`EnquiryIn`), `guru/knowledge.py`, `guru/guardrails.py`, `seed_demo_ecosystem.py` (only if I-4 approved),
`tests/test_special_needs_pathway.py`.
Frontend: `app/app/teacher/institutional/page.tsx`, `lib/server/institutional.ts` (`syncTeacherDirectory`),
`components/app/org/events/EventCreatorWizard.tsx`, `components/org/OrgEnquiryForm.tsx`, `lib/yoga-dimensions.ts`,
`components/app/teacher/OnboardingWizard.tsx`, `components/app/admin/AdaptiveCompetenceControl.tsx`,
`app/(public)/events/[slug]/page.tsx` (+ register), `components/app/nav-config.ts` / `OrgHome.tsx` (only if I-7 approved).
APIs: `POST /api/institutional/teacher/directory/sync`, `GET /api/institutional/programmes`, `POST /api/org-enquiries`,
`GET/PATCH /api/institutional/admin/teacher-directory…`.

## 4. Minimal implementation plan (preview only, after approval)
1. Publish B1.0 (already approved) — user action.
2. I-2/I-3: sync only overwrites fields that are sent; normalise taxonomies to the 3 keys (map `special_needs`);
   teacher page sends profile `yoga_dimensions`, languages, level, specializations. Self-declared SN never grants competence.
3. I-5/I-6: wizard search also covers recommended audience; empty state offers pathway tabs + "Request a customised
   programme"; a small secondary "Need something different?" link under the list. Link opens the cohort enquiry with
   cohort + current pathway prefilled and an optional `customisation_requested` flag. No condition→programme mapping.
4. I-8: replace Special Needs examples with the brief's illustrative list (neck or back pain, cervical spondylosis,
   shoulder pain, frozen shoulder, reduced mobility, other); keep old sub-IDs resolvable; stop keyword auto-labelling of
   special_needs; neutral onboarding copy.
5. I-10: one Guru knowledge section + guardrail line.
6. I-12: one neutral suitability note on ALL event pages/registration (equal treatment).
7. I-11: "N Special Needs events waiting for a verified teacher" in the admin control.
8. I-14: test marks its teachers `qa_fixture` and cleans up; remove 4 preview QA rows.
Decisions needed: I-7 (legacy batch), I-4 (demo data = production records), I-9 (1:1 verified badge, cross-system), I-13 (Council).

## 5. Backward-compatibility & migration risks
- Sync fix: no migration; rows refill on teacher's next visit. MIND/BODY ranking changes for NEW offers (speciality +15,
  language +20 now active); existing PROPOSED/ACCEPTED assignments untouched.
- Taxonomy normalisation drops non-canonical values (QA rows only).
- Events keep frozen `programme_snapshot` — no migration.
- yoga-dimensions: keep `ankylosing` ID resolvable; removing heuristics shrinks the 1:1 Special Needs teacher list.
- Enquiry flag optional → old enquiries unaffected.
- Publishing B1.0: production Special Needs events show "No teacher available yet" until admins verify teachers.
- Guru prompt change → re-run Guru QA.
- I-4 would modify production demo records → separate approval.

## 6. Test plan
- pytest: 9 combinations (existing) + identical response shape across pathways; sync preserves omitted fields;
  taxonomy normalisation; self-declared SN ≠ competence; enquiry with/without customisation flag; SN-alone enquiry not flagged.
- UI (testing agent, preview): 3 cohorts × 3 pathways from each cohort page → wizard → select → configure → publish →
  event page label + teacher state; no enquiry forced; empty search shows customisation link; link prefills cohort + pathway.
- Guru prompts: "yoga for neck pain for our staff?", "is Special Needs a separate programme?", "will yoga cure frozen shoulder?"
  → no diagnosis/claims, self-service path, verified-teacher note.
- Regression: prompt2/prompt5/qa18 suites, tsc, lint. Live read-only checks after an approved publish.
