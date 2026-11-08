# Phase 8B.1.6 — Locality Coverage Architecture Alignment & Implementation Plan
Revision 2 (PIN → locality hierarchy clarification): §2A added; §4 three-level dedup; §5 search + PIN endpoints; §6 items 9–10; §7 PIN-grouped UI; §9 8B.2 acceptance; §10 City resolved.
Revision 3 (Yoga Teacher directory in PIN view + search option A): §2B added; §5 teacher endpoint; §6 item 10 resolved with safety assessment; §7 teacher list; §9 teacher acceptance; §10 items 1a–1c.
Main NOSTOPS project · Preview · read-only. No code, data, index, API or payment changes were made.
Repo `/app` `main` @ `e2b21f35`, DB `nostops_web`. **[V]** = verified here (code or read-only DB query) · **[P]** = proposal · **[U]** = cannot be verified.

---
## 1. Verified locality infrastructure
| Item | Fact |
|---|---|
| Reference collection | `in_pincodes`: one document per post-office locality **[V]** |
| Fields | `_id, pin, locality, locality_lc, office_name, office_type (BO/SO/HO), delivery, taluk, district, state, dataset_version` **[V]**. There is **no city field**; 8,277 rows have an empty `taluk`. |
| Counts | 154,746 localities · 19,097 PINs · 631 (state, district) pairs · 36 states/UTs · version `india-post-2026.06-v2` · `in_pincodes_meta` complete=true, loaded 2026-11-05 **[V]** |
| Source | `backend/data/in_pincodes.csv.gz`, India Post all-India PIN directory (data.gov.in, OGDL-India) **[V]** |
| Canonical locality id | `locality_id(pin, name) = f"{pin}-{slug(name)}"`, where the slug is lowercase, non-alphanumerics become `-`, max 60 chars (`spaces_localities.py` l.39–44). Example `400703-k-u-bazar`. CSV 154,746 rows produce 154,746 unique ids, with no pin+name duplicates and no district name shared by two states **[V]** |
| PIN ↔ locality | 1 PIN : N localities; the PIN is the id prefix **[V]** |
| Validation | `validate_india_location(pin, locality_id, country)` checks the 6-digit format and that the id exists in the current dataset version **and** belongs to that PIN; it returns `{pin, locality_id, locality, taluk, district, state, country:"IN"}`. `lookup_pin(pin)` serves the picker. APIs: `/api/spaces/localities/{meta, pin/{pin}, id/{lid}, validate}` (shared secret) **[V]** |
| Normalisation | Only the slug in the id plus `locality_lc`. Dataset reloads are idempotent (`ReplaceOne` by `_id`) and happen only when `DATASET_VERSION` changes **[V]** |
| Indexes | `_id`, `pin`, `(pin, dataset_version)`, `(state, district)` **[V]** |

## 2. Actual business relationship schemas
**Spaces** (`spaces`) **[V]**
- `_id` (e.g. `spc_…`), `owner_id`, `owner_name`, `owner_email`
- `model` ∈ {commercial, subsidised, community} (enforced, l.31)
- `status` ∈ draft, submitted, changes_requested, approved, rejected, unlisted
- `location{pin, locality_id, locality, taluk, district, state, country}`: **confirmed**, because it is written only via `validate_india_location`. Exactly **one** locality per Space.
- There is no city field and no separate visibility flag: public = `status=="approved"` (unlisted is hidden).

**Community Partners** (`community_partners`) **[V]**
- `_id`, `user_id` (unique), `ref` (unique)
- `status` ∈ draft, submitted, info_requested, approved, rejected; `partner_status` ∈ null, active, suspended, deactivated
- `localities[]` = applied (≤2); `assigned_localities[]` = admin-confirmed (`{locality_id, locality, pin, district, state}`). Only `assigned_localities` is authoritative for coverage.
- Referrals (`cp_referrals`): `_id cpr_…`, `partner_id → community_partners._id`, `kind` ∈ teacher, space, space_owner, `locality_id` (must be one of the partner's assigned localities), `status` ∈ submitted, contacted, onboarding, onboarded, closed, plus `contact` (personal data).

**Teachers** **[V]**
- `inst_teacher_directory`: `teacher_id` (unique), `active`, `empanelled`, `id_verified`, `status_source` (`main_backend`), `status_synced_at` (present on only 7 of 66 records), `is_demo_seeded`, `adaptive_practice_verified`, `…_by`, `…_at` (0 records currently verified), and `city` (**legacy free text**, not used for coverage).
- `teacher_service_localities`: `_id = user_id = teacher_id`, `primary{pin, locality_id, locality}`, `additional[≤4]`, `pins[]`, `confirmed`, `confirmed_at`, `source` ∈ manual, device_suggestion. **Confirmed** relationship only when `confirmed=true`. 0 records in Preview.
- Verified rule: `institutional._match_eligible`. Partner-side exclusions: `community_partners._NOT_GENUINE` (`^(user_TEST_|qa_|sp_|spn_)`).

**Space programmes** (`inst_events`, `host_kind="SPACE"`) **[V]**
- `event_id` (unique), `space_id` (**confirmed** link), `space_enquiry_id`, `teacher_id`
- `programme_snapshot.taxonomy` ∈ MIND, BODY, SPECIAL_NEEDS
- `visibility` ∈ PUBLIC, UNLISTED, PRIVATE
- `lifecycle` (stored DRAFT/PUBLISHED; effective via `_effective_lifecycle` → PUBLISHED, LIVE, COMPLETED, ARCHIVED, …)
- `listing_approval`, `space_seats_used`. `space_snapshot.locality/pin` is **display only (derived)**.

**Space registrations** (`space_registrations`) **[V]**
- `_id SPR-…`, `event_id`, `space_id` (copied at creation), `participant_id`, `status` ∈ PENDING_PAYMENT, CONFIRMED, CANCELLED, EXPIRED, PAYMENT_FAILED, NOT_PLACED, and `active`.
- **One registration = one participant.** There is no party-size field, so the confirmed participant count is distinct `participant_id` with status CONFIRMED.

## 2A. PIN → locality hierarchy (clarification, revision 2) [P on V data]
- **PIN code is the primary geographic grouping.** The hierarchy is read live from `in_pincodes`: `find({pin, dataset_version: DATASET_VERSION})` uses the existing `(pin, dataset_version)` index and returns **every** locality officially mapped to that PIN (1–N; for example, PIN 400703 has several). Nothing is copied or modified.
- **Each locality keeps its own canonical id** (`<pin>-<slug>`) and its **own** coverage record and status. There is **no PIN-level status field** anywhere. A PIN view only *summarises* its localities' statuses (for example "2 Active · 1 Onboarding · 4 No record").
- A locality without a coverage record is shown as "No record (Not started)" inside its PIN group, so a PIN always shows its complete official list.
- **Filters:** PIN, locality name, District, State and coverage status. **No City filter** (there is no verified city source); `taluk` is shown as read-only reference text.

## 2B. Yoga Teacher directory in the PIN-grouped view (revision 3) [V sources / P design]
**Exact sources (verified):**
- **Teacher directory:** `inst_teacher_directory` (local mirror of the main NOSTOPS backend; unique index `teacher_id`). Fields used: `teacher_id`, `name`, `handle` (present on 8 of 66), `active`, `empanelled`, `id_verified`, `status_source` (`"main_backend"` = authoritative), `status_synced_at`, `is_demo_seeded`, `adaptive_practice_verified(+_by, _at)`. Writers: `space_programmes.teacher_status_refresh` (BFF-attested from `/teachers/me/native-profile`) and the institutional directory sync (`institutional.py` ~l.857, 3923–4004). This feature never writes to it.
- **Confirmed service localities:** `teacher_service_localities` (`_id` = teacher user id = `inst_teacher_directory.teacher_id`, the same id used by Phase 5B/7), `primary{pin, locality_id, locality}`, `additional[≤4]{…}`, `pins[]`, `confirmed:true`, `confirmed_at`. Only `confirmed:true` records are used. **No** `city` / `city_slug`, residential address or approximate matching (the legacy Phase 7 city fallback is **not** used here).
- **Profile links (existing routes):** admin teacher detail `/app/admin/teachers/[teacherId]` (`frontend/app/app/admin/teachers/[id]/page.tsx`, via `lib/server/admin-teachers.ts#getAdminTeacherDetail`; the same link pattern is used in `components/app/admin/TeacherDirectoryTable.tsx` l.296), plus the public profile `/teachers/[handle]` (`frontend/app/(public)/teachers/[handle]/page.tsx`), shown only when `handle` exists.
- **[U]** Whether every local `teacher_id` resolves in the main backend's admin teacher detail. The fallback, if `getAdminTeacherDetail` returns null, is to show the name without a link plus a "Not found in main directory" note.

**Classification per teacher** (shown under every locality the teacher has confirmed; QA/test/demo excluded from lists and counts via `_NOT_GENUINE` `^(user_TEST_|qa_|sp_|spn_)` + `is_demo_seeded`):
| Bucket | Rule |
|---|---|
| **Verified & eligible** | `institutional._match_eligible`: `active is True` AND `status_source=="main_backend"` AND `empanelled is True` AND `id_verified is True` |
| **Registered, not yet verified** | `active is True` AND `status_source=="main_backend"` AND NOT (`empanelled` AND `id_verified`) |
| **Inactive / otherwise ineligible** | `active is not True`, OR `status_source≠"main_backend"`, OR confirmed service record with **no** directory entry |

Each row shows: name · admin profile link (+ public link if a handle exists) · Empanelled ✓/✗ · ID verified ✓/✗ · Active/Inactive · Verified Teacher eligibility (bucket) · Special Needs qualified (`_adaptive_verified`) · "status last refreshed" date (stale if more than 24 h or missing). Email, phone and the teacher's other PINs are **not** shown here.

**Counting:** a teacher appears under each confirmed locality, but PIN-level "unique teachers" = distinct `teacher_id` over `pins ∋ p`, and platform/district/state totals = distinct `teacher_id`. Each bucket is deduplicated the same way.

## 3. Proposed coverage data model [P]
Collection **`spaces_locality_coverage`** (new, additive):
```
_id              = canonical locality_id ("<pin>-<slug>")  ← one record per locality, enforced by _id
pin              = "400703"            (immutable; equals the id prefix, kept for filtering)
dataset_version  = "india-post-2026.06-v2" at creation (used to detect stale references)
status           ∈ NOT_STARTED | ONBOARDING | ACTIVE | PAUSED
version          = int (optimistic concurrency, +1 per change)
notes[]          = append-only {id, text, by_id, by_name, at}
history[]        = append-only {from, to, reason, by_id, by_name, at}
created_at/created_by, updated_at/updated_by
```
Plus an append-only audit collection **`spaces_locality_coverage_audit`** (`_id cva_…`, `locality_id`, `action`, `from`, `to`, `reason`, `actor_id`, `actor`, `actor_role`, `at`). It is insert-only, following the same pattern as `space_audit` and `cp_audit`.

How it maps to the existing schema:
- Locality name, taluk, district and state are **not copied**. They are read from `in_pincodes` by `_id` (an O(1) primary-key lookup).
- Filters by state or district resolve through the existing `in_pincodes (state, district)` index first, then `$in` on coverage `_id`. An average district has about 245 localities, so this stays small.
- Duplicate prevention: creation uses `insert_one` with `_id = locality_id`, so a concurrent second insert hits `DuplicateKeyError` and returns 409. No extra unique index is needed.
- Creation also requires `validate_india_location(pin, locality_id)` to pass against the current dataset.
- Status changes use `update_one({_id, version: expected})` plus `$push history`. A stale version returns 409, so there are no lost updates. Records are never deleted.
- A locality without a record is shown as "No record (Not started)". Records are **not** auto-created in bulk.

## 4. Metric definitions and query sources [P on top of V fields]
Shared exclusion `GENUINE`:
- teachers: `_NOT_GENUINE` on `teacher_id` plus `is_demo_seeded≠true`;
- Spaces: `owner_id` not matching `^(user_TEST_|qa_|sp_|spn_)` and `_id` not matching `^(spc_qa_|TEST_)`;
- partners: `user_id` not matching the same prefix list.

**Needs approval:** the Space QA rule. The only QA Space today is `spc_qa_preview_demo`.

| Metric (per locality L, PIN p) | Source & rule | Dedupe |
|---|---|---|
| Approved Spaces | `spaces{status:"approved", "location.locality_id":L}` + GENUINE. Excludes draft, submitted, changes_requested, rejected and unlisted. | One locality per Space, so no double counting |
| Spaces by model | same query, grouped by `model`. Exactly 3 buckets (commercial, subsidised, community); any other value goes to an "invalid" integrity flag and is never shown as a model | same |
| Active Community Partners | `community_partners{status:"approved", partner_status:"active", "assigned_localities.locality_id":L}` + GENUINE | One document per partner, counted once per L; platform total = distinct `_id` |
| Eligible verified teachers | `teacher_service_localities{confirmed:true, $or:[{"primary.locality_id":L},{"additional.locality_id":L}]}` ⋈ `inst_teacher_directory` with `_match_eligible` fields + GENUINE. **No city fallback and no residential address** | distinct `teacher_id`; platform total distinct across all of the teacher's PINs |
| …PIN-level variant (optional) | the same join on `pins: p` | distinct |
| Special Needs-qualified teachers | the above AND `_adaptive_verified` (flag + by + at) | distinct |
| Public Space programmes | `inst_events{host_kind:"SPACE", space_id ∈ approvedSpaces(L), visibility:"PUBLIC"}`, effective lifecycle ∈ {PUBLISHED, LIVE}, AND `space_programmes.space_public_problems(ev)==[]` (the same live check public pages use) | `event_id` |
| Completed Space programmes | as above with effective lifecycle COMPLETED | `event_id` |
| Confirmed registrations / participants | `space_registrations{event_id ∈ publicOrCompletedEvents(L), status:"CONFIRMED", active:true}`; participants = distinct `participant_id` | registrations by `_id`; participants distinct |

**Three counting levels, each deduplicated at its own level (revision 2):**
| Level | Spaces | Community Partners | Verified teachers |
|---|---|---|---|
| Locality L (headline) | `location.locality_id = L` | `assigned_localities.locality_id = L` | confirmed `primary/additional.locality_id = L` |
| PIN p (optional aggregate) | distinct `_id` with `location.pin = p` | distinct `_id` with any assigned locality whose `pin = p` (a partner assigned two localities in the same PIN counts **once**) | distinct `teacher_id` with confirmed `pins ∋ p` (a teacher serving two localities in one PIN counts **once**) |
| Platform / filter (district, state) | distinct `_id` | distinct `_id` | distinct `teacher_id` |

The PIN and platform figures are computed with `$group` on the entity id (or `distinct`). They are **never** the sum of locality rows; the UI labels them "unique across this PIN". The same rule applies to programmes (`event_id`) and participants (`participant_id`).

**Unavailable rather than zero.** Each metric returns `{value, available, reason}`. Examples:
- Teacher metrics are `available:false, reason:"teacher_status_stale"` when matched teachers lack a `status_synced_at` within the 24 h public TTL. Their eligibility can't be confirmed (only 7 of 66 records have a sync time today).
- Programme counts are unavailable if the institutional engine is disabled.
- Any metric is unavailable if the dataset is not ready.

## 5. Proposed admin API contracts [P] (not created)
New module `backend/spaces_locality_coverage.py`, router prefix **`/api/spaces/coverage`**. This deliberately avoids `/api/spaces/admin/*`, because the existing `GET /api/spaces/admin/{sid}` route would capture `/admin/localities` **[V route order risk]**. All routes are admin-only (`venues._require_admin`, role re-checked from `X-Pulse-User` on every call) and money keys are rejected (`extra="forbid"`).

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /api/spaces/coverage/search` | `q` = 6-digit PIN **or** locality-name prefix (≥3 chars, case-insensitive on `in_pincodes.locality_lc`), optional `state`, `district`, `page_size≤25` | `{pins:[{pin, district, state, locality_count}], localities:[{locality_id, pin, locality, district, state, coverage_status|null}]}`, i.e. results are grouped by PIN |
| `GET /api/spaces/coverage/locality/{lid}/teachers` | — | `{locality_id, teachers:[{teacher_id, name, admin_path, public_path|null, empanelled, id_verified, active, status_source_ok, bucket: VERIFIED_ELIGIBLE|REGISTERED_NOT_VERIFIED|INELIGIBLE, special_needs_qualified, status_synced_at, status_stale}], counts{verified_eligible, registered_not_verified, ineligible}}`: admin-only, read-only, QA/test/demo excluded |
| `GET /api/spaces/coverage/pin/{pin}` | `counts=locality,pin` | `{pin, district, state, localities:[{locality_id, locality, taluk, office_type, coverage_status|null, counts{spaces, partners, teachers{verified_eligible, registered_not_verified, ineligible}}}], status_summary{…}, pin_counts?{spaces, partners, unique_teachers{3 buckets}}}`. Teacher rows load per locality on expand via the endpoint above |
| `GET /api/spaces/coverage` | `pin`, `q`, `state`, `district`, `status`, `page`, `page_size≤50`, `group=pin|locality` (default `pin`) | tracked records only, grouped by PIN (one row per PIN with nested locality rows) or flat; `{items, total, page}` with locality-level counts and optional PIN aggregates |
| `GET /api/spaces/coverage/summary` | — | `{total_records, by_status{4}, active_localities}` |
| `GET /api/spaces/coverage/{lid}` | — | record + reference row + `reference_status` (ok / stale) |
| `POST /api/spaces/coverage` | `{pin, locality_id, status="NOT_STARTED", reason(≥10), note?}` | 201 record · 409 already exists · 422 invalid locality |
| `POST /api/spaces/coverage/{lid}/status` | `{status, reason(≥10), expected_version}` | record · 409 stale version or same status |
| `POST /api/spaces/coverage/{lid}/notes` | `{text 3–2000}` | record (notes append-only) |
| `GET /api/spaces/coverage/{lid}/history` | — | status history + audit entries, newest first |
| `GET /api/spaces/coverage/{lid}/intelligence` | `from?`, `to?` (ISO dates) | §4 metrics with `{value, available, reason}` |
| `GET /api/spaces/coverage/consistency` (8B.4) | — | stale ids, Spaces/partners/teachers whose `locality_id` isn't in the current dataset, localities with activity but no record |

BFF (Next.js): `app/bff/admin/spaces-coverage/route.ts` (list/create) and `app/bff/admin/spaces-coverage/[lid]/[action]/route.ts` (status, notes), using `requireAdmin` + `badOrigin` (CSRF). Reads go through `lib/server/spaces-coverage.ts` with `requireAdminUser`.

## 6. Index and performance recommendations [P]
Existing indexes reviewed (§1, plus `community_partners.user_id/ref` unique, `cp_referrals(partner_id, created_at)`, `inst_events.event_id` unique / `(visibility, lifecycle, city_slug)`, `space_registrations` unique partial `(event_id, participant_id) where active`, `inst_event_audit_log(entity_type, entity_id, created_at)`). `spaces`, `space_audit`, `cp_audit` and `teacher_service_localities` have **only `_id`** **[V]**.

New indexes, all additive. No existing index is modified.
1. `spaces_locality_coverage`: `_id` (identity) + `{status:1, updated_at:-1}`.
2. `spaces_locality_coverage_audit`: `{locality_id:1, at:-1}`.
3. `spaces`: `{"location.locality_id":1, status:1}`.
4. `community_partners`: `{"assigned_localities.locality_id":1}` (multikey).
5. `teacher_service_localities`: `{"primary.locality_id":1}` and `{"additional.locality_id":1}`.
6. `inst_events`: `{space_id:1}` (sparse; only Space events carry it).
7. Registrations: **no new index**. Queries include `active:true` with `event_id`, so they use the existing partial unique index.
8. `cp_referrals`: `{locality_id:1}` only if referral counts per locality are approved for 8B.3.
9. PIN-level aggregates add `spaces {"location.pin":1, status:1}` and `community_partners {"assigned_localities.pin":1}`. Teacher PIN counts use `teacher_service_localities {pins:1}` (multikey). Locality-level counts use indexes 3–5.
10. **Locality-name search: Option A chosen by the user (revision 3)**, an additive `in_pincodes {locality_lc:1}` index, created in 8B.1.7 by the new module (never inside `ensure_dataset`'s reload path).
    - **Safety assessment** (engineering assessment, not a formal Emergent platform sign-off):
      - Preview MongoDB is **7.0.45**, which uses the optimized index build: an exclusive lock only briefly at the start and end, and reads and writes continue during the build.
      - The collection is 41.7 MB / 154,746 docs (existing indexes 7.4 MB), so the build takes seconds and adds roughly 4–6 MB.
      - Building an index writes **no** document; `in_pincodes` data, ids and `dataset_version` are unchanged.
      - Dataset reloads (`ReplaceOne` by `_id`) keep the index.
      - It is fully reversible with `dropIndex("locality_lc_1")`.
    - Production would get it on first start after a future approved deployment. Option B is withdrawn.

Cost model:
- List pages compute counts only for the ≤50 localities on the page, using `$in` on the indexed fields above: three to four small aggregations per page.
- Summary is a `$group` on the small coverage collection.
- Intelligence is per locality on demand.
- No full scans of `in_pincodes` (name search runs only over joined coverage records; creation uses the indexed PIN lookup).
- Counts are always live and computed from authoritative collections. No cached counters, so there is no drift. If load grows later, a short-lived (60 s) in-process cache can be added without schema changes.

## 7. Phase 8B.2 UI functional specification [P]
Location: the existing `/app/admin/spaces-localities` (keep the dataset card and PIN tester as a "Reference data" tab). New detail page `/app/admin/spaces-localities/[lid]`. It uses only the existing Spaces design system (`spaces-theme.css`, `components/spaces/ui.tsx`: SpacesPageHeader, SpStat, SpSection, SpEmpty, SpNote; ivory, teal and saffron palette). Nothing outside the admin localities area changes.
- **Summary strip:** total coverage records, Active, Onboarding, Paused, Not started (SpStat).
- **Toolbar:** one search box (6-digit PIN or locality name), **State** and **District** selects (district list from `in_pincodes` for the chosen state), coverage-status filter, clear. **No City filter.**
- **PIN-grouped table (paginated, 25 PINs/page):** each PIN row shows PIN · District · State · status summary chips (e.g. "2 Active · 1 Onboarding · 4 No record") · optional "unique across PIN" counts. It expands to its locality rows: Locality · Taluk · Status pill (per locality) · Approved Spaces · Active Partners · Verified Teachers · Updated · actions.
- **Selecting a PIN** (from search or a row) opens the PIN panel/page `/app/admin/spaces-localities/pin/[pin]`, listing **all** official localities of that PIN with their individual statuses and counts, and "Track" / "Change status" per locality. There is no PIN-wide status control.
- **Add / track locality:** directly from a locality row in the PIN view (initial status + mandatory reason). A duplicate shows "Already tracked".
- **Expanding a PIN** shows each official locality, and under each locality its **Yoga Teachers** list (§2B): name with an admin profile link (and public profile link if one exists), Empanelled, ID verified, Active, eligibility bucket pill (Verified & eligible / Registered, not yet verified / Inactive or ineligible), Special Needs qualified, and status freshness. The locality row shows the three bucket counts; the PIN row shows "unique teachers across this PIN" per bucket. The list is read-only: no edit, verify or empanel actions here, because those stay in the existing teacher admin screens.
- Counts showing "—" have a tooltip with the "unavailable" reason. PIN aggregates are labelled "unique across this PIN".
- **Detail page:** reference data (read-only); status card with "Change status" (status select + reason ≥10 chars + confirm); notes (add-only list); history timeline (status changes + audit); "View locality intelligence" link (8B.3).
- **States:** loading, empty, error, and a dataset-not-ready banner. Screenshot matching is deferred until the original Admin Localities screenshot is supplied.

## 8. Security and data-integrity safeguards [P]
- **Invalid or ambiguous references:** creation requires `validate_india_location` (id exists in the current version and matches the PIN). Free-text names are never accepted as identity.
- **Duplicates:** `_id = locality_id` plus `DuplicateKeyError` gives 409, and optimistic `version` protects status changes.
- **Stale references:** if a dataset upgrade removes an id, the record is kept, flagged `reference_status:"stale"` and listed in the consistency report. It is never auto-deleted or remapped.
- **Access:** three layers (admin layout, BFF `requireAdmin` + CSRF, backend role check). Community Partners, teachers and owners get 403. Identity comes only from the session.
- **QA, test and demo data:** GENUINE filters (§4) apply in every count. Tests use `TEST_` users and Preview-only fixture localities, removed by exact id.
- **Unavailable metrics:** shown as "—" with a reason, never 0.
- **History:** `history[]` and `notes[]` are only ever `$push`ed. The audit collection is insert-only. There are no delete endpoints, and the reference data stays read-only.
- **Privacy:** intelligence returns counts only. No owner contacts, teacher PINs, participant identities or referral contacts.
- **Non-financial:** no revenue, fee or earnings fields. The money-term guard test is extended to the new files. The model set stays at 3.

## 9. Implementation roadmap [P]
**8B.1.7: coverage backend and database**
- Files: new `backend/spaces_locality_coverage.py`; `backend/server.py` (include router); new `backend/tests/test_spaces_coverage_8b17.py`.
- Scope: collections and indexes §6 (1, 2), plus the endpoints list, summary, get, create, status, notes and history.
- Depends on: `spaces_localities` (validation, dataset ready).
- Tests:
  - authz matrix: anon 401; learner, teacher and partner 403; admin 200;
  - invalid or mismatched locality → 422; concurrent duplicate create → exactly one 201 and one 409;
  - reason required; stale version → 409; history and audit appended; no delete route;
  - money keys rejected; Phase 5B, 6 and 7 regression.
- Acceptance: all of the above pass and the reference-data checksum is unchanged.
- Risk: route collision. Mitigated by the `/api/spaces/coverage` prefix.

**8B.2: Admin Localities dashboard**
- Files: `frontend/app/app/admin/spaces-localities/page.tsx` (extended), new `[lid]/page.tsx`, new `components/spaces/admin/Coverage*.tsx`, new `lib/server/spaces-coverage.ts`, new BFF `app/bff/admin/spaces-coverage/**`, plus backend count fields on the list endpoint (indexes §6 3–5).
- Depends on: 8B.1.7.
- Tests: BFF security (CSRF, non-admin), pagination and filters, browser test at 1280×800 and 1600×900.
- Acceptance:
  - §7 complete; counts match direct database queries on TEST_ fixtures.
  - Searching a PIN lists exactly the localities `in_pincodes` holds for that PIN in the current dataset version, each with its own status (or "No record").
  - Searching a locality name returns matches grouped under their PINs.
  - Changing one locality's status leaves every sibling locality in the same PIN unchanged; there is no PIN-level status field or endpoint.
  - PIN and platform totals are distinct counts. A TEST_ partner with two localities in one PIN and a TEST_ teacher serving two localities in one PIN each count once at PIN level and once in platform totals, while appearing under each locality.
  - Only State, District, status, PIN and name filters exist (no City).
  - **Teachers (revision 3):**
    - A TEST_ teacher with a confirmed service locality appears under exactly its confirmed localities; one with an unconfirmed record, or only a matching `city`, appears nowhere.
    - Bucket fixtures (fully verified, empanelled-only, ID-only, inactive, non-main status, demo-seeded, `qa_` id) land in the correct bucket or are excluded.
    - A teacher with two localities in one PIN appears under both but counts once in PIN and platform unique totals.
    - Profile links point to `/app/admin/teachers/{teacher_id}` (and `/teachers/{handle}` only when a handle exists).
    - Non-admins get 403. Responses contain no email or phone.
    - `inst_teacher_directory` and `teacher_service_localities` are checksum-identical before and after.
  - `in_pincodes` documents are checksum-identical before and after.

**8B.3: consolidated locality intelligence**
- Files: `spaces_locality_coverage.py` (intelligence), an import of `space_programmes.space_public_problems`, the detail-page intelligence section including the **Teacher discovery panel** (the §2B three buckets and teacher list for the locality, plus district/state unique totals); index §6 6 (and 8 if approved).
- Depends on: 8B.2.
- Tests: every §4 rule with positive and negative fixtures (draft or unlisted Spaces excluded, suspended partners excluded, empanelled-only and `qa_` teachers excluded, Special Needs needs adaptive verification, unpublished/private programmes excluded, pending/cancelled/expired registrations excluded, a partner with 2 localities counted once in totals, stale teacher status handled per decision 1b, teacher buckets match §2B).
- Acceptance: no metric differs from the reference query; no personal data in responses.

**8B.4: locality integrity and administrative corrections**
- Files: `/consistency` endpoint, a UI tab, an optional "create coverage record from activity" action (explicit admin action with reason).
- Depends on: 8B.3.
- Tests: stale-id detection with a TEST_ fixture whose id isn't in the dataset; nothing auto-fixed; corrections audited.
- Acceptance: the report lists every orphan and changes no genuine records.

## 10. Cannot be verified, or needs your decision
1. **City (resolved in revision 2):** no City filter. The filters are District and State only, until a verified city-mapping source is supplied.
1a. **Locality-name search index:** resolved, Option A (see §6 item 10).
1b. **Stale teacher status (revision 3):** recommended: buckets follow the recorded authoritative flags, and a "status not refreshed in 24 h" badge plus a per-locality "N stale" caveat are shown, instead of marking teacher counts unavailable. (Only 7 of 66 records have `status_synced_at`, so the "unavailable" approach would blank most figures.) Approve or keep "unavailable".
1c. **Teacher list scope:** QA/test/demo records are hidden entirely, with no "show test records" toggle. Approve.
2. **Space QA/test rule:** `_id ^(spc_qa_|TEST_)` + owner prefix list. Approve.
3. **Coverage counts:** the dashboard total counts all records; "covered" = ACTIVE only. Approve.
4. **Status transitions:** any status to any other with a reason (no fixed sequence). Approve, or specify the allowed transitions.
5. **Teacher locality basis:** locality-level (`primary`/`additional.locality_id`) as the headline, with an optional PIN-level figure. Approve.
6. **Teacher data freshness:** only 7 of 66 directory records carry `status_synced_at`, so teacher metrics may often show "unavailable" in Preview.
7. **Real counts:** Preview has 1 Space (unlisted QA), 0 partners, 0 service-locality records, 0 Space programmes and 0 registrations, so real-data counts can't be checked. Verification will rely on TEST_ fixtures.
8. **The separate repository's 8B.1 field names:** not accessible here; only its functional requirements were used.
9. **Screenshots:** the original Admin Localities screenshot is still not available.
