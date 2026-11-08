# Phase 8B.1.8 — Teacher Identity Reconciliation (read-only investigation)
Preview · main project `/app` @ `main`. No records, mappings, ids, indexes or routes were changed.
Personal contact data was compared only in memory and is not reproduced here.
**[V]** = verified (code, Preview DB, or read-only GETs to the main backend as `admin.demo` / `teacher.demo`).

## 1. Identity fields actually available
| Source | Identity fields | Notes |
|---|---|---|
| **Local** `inst_teacher_directory` (66) [V] | `teacher_id` (unique index), `handle` (8/66), `email` (58/66, no duplicates), `status_source`, `status_synced_at` (7/66), `created_at`/`updated_at` | **No** `user_id`, `main_teacher_id`, external or sync-reference field exists |
| Main `GET /api/admin/people/teachers?limit=200` (complete roster, total 90) [V] | `teacher_id` (90/90, unique; prefixes `yoga_` 81, `tn_` 9), **`user_id` (58/90, unique)**, `handle` (90/90, **1 duplicate value**), email, phone, status, `deleted_at` | The only list that carries **both** account id and teacher id |
| Main `GET /api/teachers/directory` (41, public) [V] | `teacher_id`, `handle`, `legacy_teacher_id`, `legacy_handle`, `legacy_yogayukt_id` | No `user_id` |
| Main `GET /api/admin/empanelment/teachers` [V] | `teacher_id`, name, `is_empanelled` | Paginated (50 of 88), no `user_id` |
| Main `GET /api/teachers/me/native-profile` (teacher session) [V] | **`teacher_id` (`tn_…`) AND `user_id` (= `/auth/me` `user_id`)**, `handle` | This is what the BFF already reads for every status sync |
| Admin route `/app/admin/teachers/[id]` [V] | expects the **main `teacher_id`** (`getAdminTeacherDetail` looks up the directory / empanelment / people lists by `teacher_id`) | |

## 2. Synchronisation mechanism and the reason for the mismatch [V]
- Local records are written only by:
  - `POST /api/institutional/teacher/directory/sync` (`institutional.teacher_directory_sync`, l.3954, via `lib/server/institutional.ts#syncTeacherDirectory`);
  - `POST /api/institutional/space-programmes/teacher-status` (`space_programmes.teacher_status_refresh`, via `lib/server/space-programmes.ts`).
- Both set **`teacher_id = str(user.user_id)`**, i.e. the signed-in **account id** (`user_…`) taken from the session (`institutionalActor` → `X-Pulse-User`). Neither stores the main backend's `teacher_id` (`tn_…`/`yoga_…`), even though `/teachers/me/native-profile` returns it.
- All other local rows are fixtures: 57 `qa_…` (QA), 6 `demo_…` (`is_demo_seeded`) and 1 `tn_…` legacy row that is not in any main list.
- **So the two directories use different id namespaces: local = account `user_id`, main admin = `teacher_id`.** An authoritative relationship already exists in the main backend (`user_id ↔ teacher_id` on the people roster and on native-profile). It was simply not used. The 8B.1.7 BFF compared the local id with main `teacher_id`s, which can never match for `user_…` ids.

## 3. Match counts (local 66 records) [V]
| Group | Count | A: user_id → people.user_id | B: same teacher_id | C: same handle | Conflicts |
|---|---|---|---|---|---|
| Account-keyed (`user_…`) | 2 | **1 matched** (→ a `tn_` main teacher; handle agrees) · 1 unmatched (not in the roster) | 0 | 1 (same record as A) | 0 |
| Legacy `tn_…` | 1 | n/a | 0 (not in any main list) | 0 | 0 |
| QA `qa_…` (excluded from Spaces) | 57 | 0 | 0 | 0 | 0 |
| Demo `demo_…` (excluded) | 6 | 0 | 0 | 0 | 0 |

- **Exact matches: 1. Unmatched: 65 (63 of them QA/demo fixtures). Conflicts: 0.**
- Roster caveat: 32 of 90 main teachers have **no `user_id`** (likely imported/legacy accounts), so those can never be matched by account id.
- Collision risk: the main people roster contains **one duplicated handle value**.

## 4. Matching approaches
| Method | In both systems? | Stable & unique? | Authoritative? | Safe for automatic matching? | Risks |
|---|---|---|---|---|---|
| **A. Account user_id** | Yes: local `teacher_id` **is** the account id; main `people.user_id` and `native-profile.user_id` | Yes (unique in both, immutable account key) | Yes: main backend account | **Yes** | 32/90 main teachers have no user_id → unmatched, not mis-matched |
| B. Teacher id | No: local never stores the main `teacher_id` | Unique within each system, but different namespaces | Main only | No (0 matches by design) | none, it simply never matches |
| C. Public handle | Local 8/66; main 90/90 | **Not unique** in main (1 duplicate) and editable | Main, but mutable | **No** (cross-check only) | duplicates, renames, `legacy_handle` |
| D. Canonical mapping held by the main backend | Exists already: `user_id ↔ teacher_id` on `/admin/people/teachers` and `/teachers/me/native-profile` | Yes | **Yes** | Yes. This is A, served by the authority | Roster `limit=200` max: must paginate if more than 200 |
| E. Manual admin reconciliation | — | Depends on the admin | Would create a second source of truth | No (manual only) | Wrong links, drift. Not recommended now |

No name-similarity matching is used anywhere.

## 5. Recommended canonical identity architecture (smallest safe option)
**Resolve at read time from the main backend's own mapping (A + D). No local mapping store and no database change.**
- Local key (unchanged) = account `user_id`. Main key = `teacher_id`. The **only** link used is the main backend's `user_id → teacher_id` pair from `GET /admin/people/teachers` (already fetched by `lib/server/admin-teachers.ts#fetchSources` as `peopleById`; the `user_id` field just needs to be kept).
- Per teacher:
  - **matched**: exactly one roster row has this `user_id`. The admin link is `/app/admin/teachers/{main teacher_id}`, which `getAdminTeacherDetail` already resolves.
  - **conflict**: more than one roster row has this `user_id`, or the local `handle` is set and differs from that row's handle. Show no link and the label "Identity conflict, needs review".
  - **unmatched**: no row. Show no link and "Not found in main directory" (as today).
  - **unavailable**: the roster call failed. Show no link and "Main teacher directory is unavailable right now" (never shown as "not found").
- A local `teacher_id` that already looks like a main `teacher_id` (e.g. a legacy `tn_…` row) is matched only by **exact** equality with a roster `teacher_id` (method B as a secondary exact check).
- The main backend stays authoritative for identity, verification and empanelment. Nothing is copied or persisted.
- Optional later step (needs separate approval): have the existing BFF-attested sync also record `main_teacher_id` from native-profile. This is a cached foreign key, written only by that sync, if offline resolution is ever needed.

## 6. Minimum implementation scope (for approval)
- `frontend/lib/server/admin-teachers.ts`:
  - keep `user_id` in `peopleById` rows;
  - replace `getMainDirectoryTeacherIds()` with `getMainTeacherIdentity()` → `{available, byUserId: Map<user_id, teacher_id[]>, handleByTeacherId, teacherIds:Set}`;
  - follow roster pagination if the total exceeds 200.
- `frontend/app/bff/admin/spaces-coverage/locality/[lid]/teachers/route.ts`: use the mapping, return `admin_path=/app/admin/teachers/{main_teacher_id}`, `admin_link_status ∈ matched|unmatched|conflict|unavailable`, and `main_teacher_id` (no personal data).
- No backend, database, index or route changes. `/app/admin/teachers/[id]` is unchanged.
- Tests: new `backend/tests/test_teacher_identity_8b18.py` (pure resolver tests via a small extracted pure function in `lib/teacher-identity.ts`, exercised with a Node test or through the BFF with stubbed data), plus one live read-only check as `admin.demo`.

## 7. Proposed test plan
1. **Uniqueness:** a roster with a duplicated `user_id` → `conflict`, no link. A duplicated handle never produces a match.
2. **Correct match:** local `user_X` with roster `{user_id:user_X, teacher_id:tn_Y}` → `/app/admin/teachers/tn_Y`, and that page resolves (live check with the one genuine matched record, read-only).
3. **Incorrect matches prevented:**
   - same name or same handle but a different `user_id` → not matched;
   - local handle differs from the roster handle for the same `user_id` → `conflict`;
   - local `user_X` never matches roster `teacher_id user_X` unless it is an exact teacher id.
4. **Unmatched:** a `user_id` not in the roster, or a roster row without `user_id` → `unmatched` with "Not found in main directory" and no link.
5. **Unavailable:** the roster fetch fails → `unavailable`, never `unmatched`.
6. **Duplicate prevention:** no records are written; local directory, service-locality and main data checksums are identical before and after.
7. **Privacy:** responses contain no email, phone or user_id of other teachers.
8. **Regression:** Phase 5B, 6, 7, 8B-0 and 8B.1.7 suites stay green.
