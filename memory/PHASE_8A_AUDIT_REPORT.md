# NOSTOPS Spaces — Phase 8A Admin Architecture Audit & Implementation Blueprint
Preview only · read-only audit · no code, data, permission or payment changes were made.
Data counts below were read (not written) from the Preview MongoDB `nostops_web`.

---
## 1. Existing architecture & functionality inventory (EXISTING)

### Backend (FastAPI, `/app/backend`) — Spaces-related modules
| Module | Prefix | Purpose |
|---|---|---|
| `spaces_localities.py` | `/api/spaces/localities` | India Post PIN dataset loader + `lookup_pin`, `validate_india_location` (single server-side location gate). Routes: `GET /meta`, `GET /pin/{pin}`, `GET /id/{lid}`, `POST /validate` (shared secret only) |
| `spaces.py` | `/api/spaces` | Owner: `POST/GET /mine`, `GET/PATCH /mine/{sid}`, `POST /mine/{sid}/documents`, `POST /mine/{sid}/submit`. Admin: `GET /admin?status=`, `GET /admin/doc/{did}` (audited), `GET /admin/{sid}`, `PUT /admin/{sid}/site-visit`, `POST /admin/{sid}/{approve|reject|request_changes|unlist|relist}`. Public: `GET /public/search?pin=`, `GET /public/{sid}` |
| `space_enquiries.py` | `/api/spaces/enquiries` | Teacher ↔ owner enquiries, messages, documents, venue terms |
| `space_programmes.py` | `/api/spaces/programmes` | Space programmes stored in `inst_events` (`host_kind="SPACE"`), owner/admin approval, publish |
| `space_registrations.py` | `/api/spaces/registrations` | Participant registrations; `GET /admin/overview` (admin) |
| `community_partners.py` | `/api/spaces/partners` | Phase 7 CP application, admin decisions, locality assignment, activate/suspend/deactivate, referrals, partner dashboard/discovery |
| `teacher_service_localities.py` | `/api/spaces/teacher-localities` | Teacher primary + ≤4 additional service PINs (`GET/PUT /me`) |
| `venues.py`, `venue_ownership.py`, `venue_growth*.py` | `/api/venues…` | Global Venues (`venue_submissions`) — NOT touched by Spaces |
| `institutional.py` | `/api/institutional` | Event engine (`inst_events`), teacher directory mirror (`inst_teacher_directory`), append-only `inst_event_audit_log` |
| `admin_gate.py` | gateway | Admin guard for proxied `/api/admin/*` to the main NOSTOPS backend |

Auth to local FastAPI: BFF sends `X-Pulse-Secret` + `X-Pulse-User` (base64 JSON: user_id, name, email, role) built server-side from the httpOnly session (`lib/server/spaces.ts::userHeaders`, fails closed without a real user_id). Admin check: `venues._require_admin` → `role == "admin"`.

### MongoDB collections (Spaces scope) and Preview counts
| Collection | Docs | Key relations |
|---|---|---|
| `in_pincodes` | 154,746 localities / 19,097 PINs / 36 states (v `india-post-2026.06-v2`) | `_id = <pin>-<slug>`; indexes pin+version, state+district |
| `in_pincodes_meta` | 1 | dataset version/source |
| `spaces` | 1 (status `unlisted`, QA record) | `owner_id` → user; `location.{pin,locality_id,district,state}`; embedded `history[]`, `documents[]` meta |
| `space_docs` | 0 | private files (binary in Mongo) → `space_id` |
| `space_audit` | 1 | `space_id`, actor, action, at |
| `space_enquiries` / `space_enquiry_docs` | 2 / – | `space_id`, teacher |
| `inst_events` (host_kind SPACE) | 0 Space programmes (206 other events) | `space_id`, `space_enquiry_id`, `teacher_id`, `lifecycle` |
| `space_registrations` | 0 | `event_id`, `participant_id`, `status` |
| `community_partners` / `cp_docs` / `cp_referrals` / `cp_audit` | 0 / 0 / 0 / 0 | `assigned_localities[]`, `partner_status` |
| `teacher_service_localities` | 0 | `_id = user_id`, `pins[]` |
| `inst_teacher_directory` | 66 (63 empanelled, **6 id_verified**) | `teacher_id`, free-text `city` |
| `venue_submissions` | 14 | Global Venues (separate, no PIN linkage) |

### Frontend (Next.js App Router, `/app/frontend`)
- Admin gate: `app/app/admin/layout.tsx` → `requireAdminUser()`; every `/bff/admin/*` → `requireAdmin(req)` (session role + CSRF origin check). `lib/server/admin-guard.ts`.
- Admin nav: `components/app/nav-config.ts` (Admin section, lines ~169–238).
- Spaces visual system: `app/spaces-theme.css`, `components/spaces/ui.tsx` (SpacesPageHeader, SpStat, SpSection, SpEmpty, SpNote, SpStepper…), activated by `.sp-page`.

### Existing automated tests (relevant)
`backend/tests/`: `test_spaces_localities_phase2*.py`, `test_spaces_phase1b.py` (financial-terms guard), `test_spaces_phase3*.py`, `test_spaces_unlist.py`, `test_space_enquiries_*` (8 files), `test_space_programmes_phase5b*.py`, `test_space_registrations_phase6*.py`, `test_community_partners_phase7.py`, `test_teacher_service_localities_phase7.py`, `test_admin_bff_security.py`, `test_b51_admin_gate.py`, `test_venue_partner_overview.py`; fixture `_space_fixture.py`. Browser reports up to `test_reports/iteration_229.json`.

## 2. Existing admin screens & routes (EXISTING)
| Route | What it does today |
|---|---|
| `/app/admin/spaces-localities` | Dataset stats (PINs, localities, states), source/version, PIN lookup tester. **No coverage, no CP/Space/teacher roll-up.** |
| `/app/admin/spaces` | Status tabs (submitted, changes_requested, approved, unlisted, rejected, draft, all) with counts; table (name, locality, model, owner, status, submitted). **No search, no locality/model filter, no pagination (cap 300).** |
| `/app/admin/spaces/[id]` | Full detail, private docs (view audited), site-visit checklist, approve/reject/request changes, unlist/relist, history |
| `/app/admin/space-registrations` | Registration overview |
| `/app/admin/community-partners` (+ `[id]`, `/referrals`) | CP queue, decisions, locality assignment, activate/suspend/deactivate, referrals status |
| `/app/admin/venue-partners`, `venue-review`, `venue-claims`, `venue-widgets`, `venue-monitor` | Global Venues admin (out of scope, must not change) |
| `/app/admin/teachers`, `empanelment`, `kyc` | Teacher admin (main backend) |
| `/app/admin/reports` | "Platform Reports" — **financial** (revenue, pipeline value) platform-wide; NOT Spaces/CP. Must not be reused for impact reporting. |
| `/app/admin/audit-log` | 1:1 sessions `audit_ledger` only — does not show `space_audit` or `cp_audit` |

BFF: `/bff/admin/spaces/[id]/[action]`, `/bff/admin/spaces/doc/[id]`, `/bff/spaces/partners/[...path]` (strict allow-list), `/bff/spaces/pin/[pin]`, `/bff/spaces/teacher-localities`.

## 3. Gap analysis

### 3A. Localities & PIN codes
| Capability | Status |
|---|---|
| India Post reference data + validation | EXISTS (`spaces_localities.py`) |
| Locality → taluk/district/state mapping | EXISTS (derived from dataset; "city" is not a dataset field — district is used) |
| Locality activation / coverage status | MISSING (no collection or field) |
| CP locality assignments | EXISTS per partner; MISSING admin roll-up "which partner covers locality X" |
| Spaces per locality | Data EXISTS (`spaces.location.locality_id`), no admin view; no index on `location.*` |
| Teachers per locality | Data EXISTS only in `teacher_service_localities` (0 records); legacy directory has free-text city only; no admin read endpoint |
| Duplicate PIN/locality detection | Reference: `_id` is unique per pin+slug (duplicates impossible inside dataset). Operational: no duplicate-Space detection (same name + PIN) — MISSING |
| Geographic consistency | Writes always revalidated; MISSING periodic check that stored Space/CP/teacher locations still exist in the current dataset version |
| Admin corrections + audit | MISSING. Dataset is read-only by design (versioned reload); no override layer |

### 3B. Spaces management
| Capability | Status |
|---|---|
| Applications/submissions, statuses draft→submitted→changes_requested/approved/rejected, unlisted | EXISTS |
| Owner authorization | EXISTS (`_own` = owner_id match) |
| Private documents + audited viewing | EXISTS (stored as binary in Mongo, not object storage) |
| Site-visit verification checklist | EXISTS |
| Three models (Commercial/Subsidised/Community), enforced enum, `extra="forbid"` | EXISTS |
| Public visibility control (unlist/relist) | EXISTS |
| Search / filter by locality, district, state, model, owner, date | MISSING (status tabs only) |
| Pagination / export | MISSING |
| Ownership history / transfer | MISSING (`owner_id` fixed at creation; no transfer endpoint) |
| Admin corrections to Space details (e.g. typo, wrong locality) | MISSING (only owner can edit, and only in editable statuses) |
| Admin view of linked enquiries/programmes/registrations per Space | MISSING (data exists across collections) |
| `space_audit` timeline in admin UI | PARTIAL (embedded `history[]` shown; `space_audit` incl. document views not shown) |
| Test/incorrectly public listings | Preview: 0 approved Spaces; only QA record `spc_qa_preview_demo` is already `unlisted`. Nothing incorrectly public. |
| Global Venues separation | CONFIRMED — spaces.py never reads/writes `venue_submissions`; `/venues`, retreats, venue ownership untouched |

### 3C. Community impact reporting — data source audit
| Metric | Authoritative source | Counting / dedupe rule | History | By locality/district/state | By date range | Limitations |
|---|---|---|---|---|---|---|
| Approved Spaces by locality | `spaces` (`status="approved"`) | 1 per `_id`; exclude `unlisted`, TEST_/QA ids | `history[]` + `space_audit` give approval & unlist dates | Yes (`location.*`) | Yes, via `decided_at` / history; point-in-time "as of date" requires replaying history | Preview has 0 approved; no "city" field (district used) |
| Spaces by model | `spaces.model` | enum of 3 only | as above | Yes | Yes | — |
| Verified yoga teachers | `inst_teacher_directory` (`empanelled AND id_verified AND active`) | 1 per `teacher_id`; exclude `user_TEST_/sp_/spn_` | No verification date field in the mirror (only created_at/updated_at) | Only via `teacher_service_localities` PINs (0 records) or free-text city | No (no verified_at) | Mirror of main backend; directory city is unstructured |
| Empanelled teachers | `inst_teacher_directory.empanelled` | as above | No empanelled_at | as above | No | as above |
| Published / completed Space programmes | `inst_events` (`host_kind="SPACE"`, `lifecycle` / `inst._effective_lifecycle`) | 1 per `event_id`; PUBLIC vs PRIVATE visibility | `published_at`, `inst_event_audit_log` (append-only) | Yes via `space_id → spaces.location` | Yes (`published_at`, `event_date`, `last_session_date`) | "Completed" is partly derived from dates |
| Confirmed participants | `space_registrations` (`status="CONFIRMED"`) | 1 per registration; registrations are per participant per event; group size field must be checked before counting heads | `confirmed_at`, `history[]` | Yes via event → space | Yes | Preview has 0; cancellations after confirmation must be excluded |
| CP coverage | `community_partners` (`status="approved"`, `partner_status="active"`, `assigned_localities`) | distinct `locality_id` | `history[]`, `cp_audit` | Yes | Yes (activation date) | Preview has 0 |
| CP referrals & onboarding | `cp_referrals` (`status` submitted→contacted→onboarding→onboarded→closed) | 1 per referral; no cross-partner dedupe of the same person (name/contact) | `history[]` | Yes (`locality_id`) | Yes (`created_at`) | "Onboarded" is set manually by admin; not linked to the actual Space/teacher record created |

No ratings, testimonials, outcomes or growth % exist in these sources and none should be shown.

## 4. Reusable components & services (EXISTING)
- Backend: `validate_india_location`, `lookup_pin`, `_require_admin`, `current_user`, `spaces._public/_admin_view`, `community_partners._public_teachers` (matching logic), `inst._effective_lifecycle`, `space_registrations` status constants, `_audit` helpers.
- BFF: `spacesCall`, `spacesError`, `requireAdmin`, `requireAdminUser`, `badOrigin`.
- UI: `components/spaces/ui.tsx` (SpStat, SpSection, SpEmpty, SpNote, SpacesPageHeader), `PinLookupTester`, `lib/spaces.ts` (SPACE_MODELS, SPACE_STATUS), CP admin locality picker, existing table/tab patterns in `/app/admin/spaces`.

## 5. Proposed implementation sequence (PROPOSED)

### Phase 8B — Admin Localities
- Reuse: dataset + validation, PIN tester, CP assignment data, Spaces location data, teacher service localities.
- New: consolidated `/app/admin/spaces-localities` → tabs: Dataset · Coverage (localities with any Space/CP/teacher) · Locality detail (Spaces, active CPs, matched teachers, programmes) · Consistency check (stored locations not in current dataset; duplicate Space name+PIN).
- Coverage status: new overlay collection `spaces_locality_coverage` (`_id=locality_id`, status `not_started|onboarding|active|paused`, note, history) — reference dataset never edited.
- API (new, admin-only, read-mostly): `GET /api/spaces/admin/localities/coverage?state=&district=&pin=`, `GET /api/spaces/admin/localities/{lid}`, `PUT /api/spaces/admin/localities/{lid}/coverage` (reason required, audited), `GET /api/spaces/admin/localities/consistency`.
- Files: `backend/spaces_localities.py` or new `backend/spaces_admin_localities.py`; `server.py` router include; `app/app/admin/spaces-localities/page.tsx`; new `app/bff/admin/spaces-localities/...`; `lib/server/spaces-localities.ts`.
- Security: admin-only; teacher PINs aggregated as counts + locality names, never listed per teacher with PIN to non-admins.
- Tests: pytest for coverage CRUD/audit/authz (401/403), consistency check; browser test of tabs.
- Dependencies: none.

### Phase 8C — Admin Spaces Management
- Reuse: all existing admin decision/unlist/site-visit/doc endpoints and detail page.
- New: search + filters (q, status, model, state, district, PIN, date range) + pagination on `GET /api/spaces/admin`; per-Space linked activity panel (enquiries, programmes, registrations counts); `space_audit` timeline incl. document views; optional admin correction endpoint (`PATCH /admin/{sid}` limited fields, reason required, revalidated location, audited); optional ownership transfer (`POST /admin/{sid}/transfer`, reason, `ownership_history[]`).
- DB: indexes on `spaces` (`status`, `location.locality_id`, `location.district`, `model`, `updated_at`) and `space_audit.space_id` — additive only.
- Files: `backend/spaces.py`, `app/app/admin/spaces/page.tsx`, `app/app/admin/spaces/[id]/page.tsx`, `lib/server/spaces.ts`, new BFF routes.
- Security: keep `extra="forbid"`; corrections cannot change model to anything outside the 3; no owner contact data exposed outside admin.
- Tests: filters/pagination, correction & transfer audit, Global Venues untouched regression, financial-terms test.
- Dependencies: 8B locality filters share the same location fields.

### Phase 8D — Community Impact Reporting
- Reuse: CP dashboard aggregation logic (generalised platform-wide), sources in §3C.
- New: `/app/admin/spaces-impact` (separate from financial `/app/admin/reports`): platform-wide + filter by state/district/locality + date range; metrics strictly from §3C; CSV export of aggregates (no personal data).
- API: `GET /api/spaces/admin/impact?state=&district=&locality_id=&from=&to=`, `GET …/impact.csv`.
- DB: none required (computed live); optional cache later.
- Security: aggregates only; financial-term guard test extended to new files; no revenue/earnings fields.
- Tests: counting/dedupe unit tests with TEST_ fixtures, date-range boundaries, CSV columns, money-term scan.
- Dependencies: 8B (locality model), 8C (filters/indexes).

## 6. Data model & API changes (PROPOSED, all additive)
- New: `spaces_locality_coverage` (8B). Optional `spaces.ownership_history[]` (8C, only if transfer approved).
- New indexes on `spaces`, `space_audit`, `cp_referrals.locality_id`, `teacher_service_localities.pins`.
- New admin endpoints listed in §5. No changes to Phase 2–7 endpoints' contracts (only optional query params added to `GET /api/spaces/admin`).

## 7. Security & privacy findings
1. OK — Admin enforced in three layers (layout redirect, BFF `requireAdmin` + CSRF, backend `_require_admin`). Identity from session only.
2. OK — CPs cannot reach admin endpoints (BFF allow-list + backend role check); partner access re-checked per request.
3. OK — Public Space projection excludes owner identity, contacts, documents, history.
4. OK — Private document views are audit-logged (`space_audit`, `cp_audit`).
5. Finding — Private documents are stored as binary inside MongoDB (`space_docs`, `cp_docs`), not object storage. Acceptable for Preview; recommend review before production.
6. Finding — `space_audit` / `cp_audit` are not protected from modification at DB level and have no indexes; admins can't see them in the UI. Recommend append-only discipline + indexes + UI timeline.
7. Finding — Single global `admin` role: no locality-scoped admin. Fine for now; any regional admin role would be a new decision.
8. Finding — CP referral `contact` (personal data supplied by the partner) is shown to admins in full; recommend excluding it from any export.
9. Finding — Admin list endpoints return up to 300/500 rows with owner emails in one payload (no pagination).

## 8. Phase 7 integration — issues for separate approval (NOT changed)
- **D-7.1 (defect):** CP dashboard "verified teachers" and discovery use `empanelled=True` only, not `id_verified=True`. Preview directory: 63 empanelled vs 6 ID-verified, so the label over-counts. Fix = add `id_verified` to `_DIR_BASE` or relabel "Empanelled teachers".
- **D-7.2:** Legacy city fallback excludes any teacher with a `teacher_service_localities` record even if not `confirmed`.
- **D-7.3:** Previously noted: empty CP draft created when the apply page opens; no CP email notifications.
- Compatibility: assigned localities, partner status, referrals and teacher PIN mapping all use `locality_id`/`pin` from the same dataset, so 8B–8D can aggregate them directly.

## 9. Screenshot inventory (original owner references, this job's uploads)
| Ref | Content | Relevance |
|---|---|---|
| 03.png, 14.png | Community Partner "Venues Network" (partner-side) | Closest layout reference for an admin Venues/Spaces network list (stats strip, filter tabs, table rows with model/status/Manage) — partner-side, not admin |
| 02.png, 12.png | Community Partner Dashboard (local impact, programme pipeline, locality map) | Layout reference for impact cards / locality panel |
| 11.png | CP "Performance, Impact & Earnings" | Impact charts/tables are a useful layout reference, but it contains earnings / revenue allocation panels that are **prohibited** — must not be reproduced |
| 01, 13 | CP locality selection | Locality picker patterns |
| Others (04–10, 15–33) | Space onboarding, listing, enquiries, programmes, registrations, owner/teacher dashboards | Already used in Phases 3–7 |
| Admin Localities Dashboard | **Not found** | Original required before 8B visual work |
| Admin Venues Network Dashboard | **Not found** (only CP-side 03/14) | Original required before 8C |
| Admin Teacher Network Dashboard | **Not found** | Original required before 8B/8C teacher panels |
| Community Impact Dashboard / Reports & Impact Dashboard | **Not found** (only CP-side 11, financial) | Original required before 8D |

## 10. Testing & regression plan
- Every subphase: new pytest file (`test_spaces_admin_localities_phase8b.py`, `…_spaces_phase8c.py`, `…_impact_phase8d.py`) using TEST_ fixtures with cleanup; authz matrix (anon 401, learner/teacher/CP 403, admin 200); audit entries asserted; money-term scan extended.
- Regression after each subphase: all Spaces/CP/enquiry/programme/registration suites, `test_admin_bff_security.py`, `test_b51_admin_gate.py`, `test_venue_partner_overview.py`, Global Venues pages smoke.
- Browser (testing agent) at 1280×800 and 1600×900 against original screenshots once supplied.

## 11. Effort & risks
| Subphase | Effort | Main risks |
|---|---|---|
| 8B | Medium (≈1–1.5 days agent time) | Aggregation over 154k-row dataset must stay index-driven; teacher data sparse (0 PIN records) |
| 8C | Medium (≈1–1.5 days) | Correction/transfer endpoints touch ownership — must not affect Global Venue ownership |
| 8D | Medium (≈1 day) | Preview has almost no genuine data → dashboards show zeros; verification needs TEST_ fixtures; directory lacks verification dates |

## 12. Decisions requiring explicit approval
1. Coverage overlay collection `spaces_locality_coverage` with statuses not_started / onboarding / active / paused (reference data stays read-only).
2. Definition of "verified teacher" = empanelled AND id_verified (and fix D-7.1 accordingly).
3. Whether admins may correct Space details and/or transfer Space ownership (8C).
4. Adding additive MongoDB indexes.
5. CSV export of aggregate impact figures only (no personal data).
6. A new admin page `/app/admin/spaces-impact`, leaving the financial `/app/admin/reports` untouched.
7. Supply the original screenshots for Admin Localities, Admin Venues Network, Admin Teacher Network, Community Impact and Reports & Impact (or approve building those screens functionally using the existing Spaces visual system without screenshot-matching).
8. Whether to fix Phase 7 items D-7.1 / D-7.2 / D-7.3 before 8B.
