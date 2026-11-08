# Phase 8B.1.5 — Original Implementation Inventory & Backend Handover
Source of truth: MAIN NOSTOPS PROJECT WINDOW. Read-only investigation: no code, data, index or payment changes.
Legend: **[V]** = verified by reading the code, git, env or DB in this workspace · **[A]** = assumption or information supplied by the user.

---
## 1. Repository & environment identification
| Item | Value |
|---|---|
| Repository path | `/app` **[V]** |
| Git branch / HEAD | `main` @ `e2b21f35` (2026-11-07 01:45 UTC, "Prompt 8B-0.1"); 1,424 commits; **no git remote configured** **[V]** |
| Key commits | Phase 2 localities `6824c76b` (2026-11-05) · Phase 5B `fad336aa` (2026-11-06 03:10) · Phase 6 `59f470ff` (2026-11-06 04:44) · Phase 7 `8cd0977a` (2026-11-06 06:29) · 8A `c6acb9ba` · 8B-0 `74ce8106` · 8B-0.1 `e2b21f35` **[V]** (first commit touching each module) |
| Emergent job id | `d41a47d4-aa76-4065-8fc5-f1fd127157a9` (`.emergent/emergent.yml`, created 2026-11-05) **[V]** |
| Backend entry | `/app/backend/server.py` → `uvicorn server:app --host 0.0.0.0 --port 8001` (supervisor) **[V]** |
| Frontend entry | `/app/frontend` Next.js 16.3.3 App Router (`package.json` name `nostops-web`, `next dev -p 3000`); it is also the BFF (`app/bff/**`) **[V]** |
| Database | Local MongoDB via `MONGO_URL` (set, value not printed); `DB_NAME=nostops_web` **[V]** |
| Preview URL | `https://nostops-spaces--0fieag2d.preview.emergentagent.com` (also `WEB_APP_BASE_URL`) **[V]** |
| Production | Public site canonical `NEXT_PUBLIC_SITE_URL=https://www.nostops.org`; live business backend proxied at `BACKEND_URL=https://pro-learn-connect-1.emergent.host` **[V env]**. Whether Phases 5B–7 are deployed there: **not deployed**. Every phase report says Preview only, and no deployment ids exist in the repo **[V repo / A deploy state]** |
| Preview isolation | `frontend/lib/server/preview-isolation.ts`: preview writes to the live business backend are refused with HTTP 423 **[V]** |

## 2. Phase 5B — Space-linked programmes (verified)
- **Module:** `backend/space_programmes.py` (555 lines), router `/api/institutional/space-programmes`, included in `server.py` line 141.
- **Routes:** `POST /teacher-status`, `POST ""` (create draft), `PATCH /{eid}`, `POST /{eid}/submit`, `POST /{eid}/owner-decision`, `POST /{eid}/admin-decision` (reason ≥10 chars), `POST /{eid}/publish`, `GET /mine`, `GET /owner`, `GET /{eid}`.
- **Storage:** the existing engine collections are reused: `inst_events` (`host_kind="SPACE"`, `space_id`, `space_enquiry_id`, `teacher_id`, `space_snapshot` (display only), `programme_snapshot`, `listing_approval{status, owner_id_at_approval, …}`, `lifecycle`, `visibility`), `inst_event_sessions`, `inst_event_seo`, and the append-only `inst_event_audit_log`.
- **Teacher eligibility:** role must be `teacher` or `council` (admins cannot create) and `institutional._match_eligible`: active, not demo-seeded, `status_source="main_backend"`, `empanelled` AND `id_verified`. The status must be refreshed from the live backend within 600 s for create/edit/publish (`FRESH_SECONDS`), or 24 h for public reads (`PUBLIC_STATUS_TTL_SECONDS`). Withdrawn handles force `empanelled=false`.
- **Special Needs:** a `SPECIAL_NEEDS` taxonomy requires `_adaptive_verified` (`adaptive_practice_verified` plus `…_verified_by` and `…_verified_at`, written only by an admin or Council).
- **Space and enquiry requirements (`_link`, re-checked live):** the Space must be `approved`, the enquiry `accepted_in_principle`, and the enquiry's space, teacher and owner must equal the Space's current `owner_id`. The taxonomy must be one of the enquiry's agreed `focus_areas`. Capacity can't exceed the Space capacity.
- **Ownership binding:** owner approval stores `owner_id_at_approval`. Publish and public reads fail if the Space owner has since changed (`_approval_valid`).
- **Publication and visibility:** DRAFT → (owner or admin approval) → PUBLISHED. Visibility is PUBLIC, UNLISTED or PRIVATE. SEO is indexable only if PUBLIC. Public reads re-run `space_public_problems`. Money fields are rejected (`FINANCIAL_FIELDS` + `MONEY_KEY_RE`) and `_fixed_money()` forces FREE / no venue cost.
- **Tests:** `tests/test_space_programmes_phase5b.py`, `…_negative.py`, `…_public_e2e.py`. Browser: `test_reports/iteration_218.json` (28/28 backend). Last run 2026-11-07 (8B-0.1 regression): pass.

## 3. Phase 6 — Registrations (verified)
- **Module:** `backend/space_registrations.py` (665 lines), router `/api/institutional/space-registrations` (server.py line 146).
- **Routes:** `POST /register`, `POST /webhook`, `GET /mine`, `GET /admin/overview`, `GET /{rid}`, `POST /{rid}/verify`, `POST /{rid}/cancel`, `POST /{rid}/admin-cancel` (reason ≥10), `POST /programmes/{eid}/pricing`, `POST /programmes/{eid}/registration` (open/close), `GET /programmes/{eid}/participants`, `POST /sweep` (cron).
- **Collections:** `space_registrations` (`_id SPR-…`, event_id, space_id, teacher_id, participant_id/name/email, status, active, pricing_mode, amount_minor, payment{}, refund{}, hold_expires_at, history[]) and `space_registration_webhooks` (dedupe by sha256 of the body). Seat counter `inst_events.space_seats_used`.
- **Free registration:** confirmed immediately (status CONFIRMED) when the state is open (public, PUBLISHED/LIVE, not closed, not started, seats left).
- **Duplicates and capacity:** a unique partial index `(event_id, participant_id)` where `active=true` is claimed first, then a conditional `$inc` seat take. The loser becomes `NOT_PLACED`. Seats are released exactly once by a conditional status transition.
- **Paid checkout:** Cashfree PG orders only. The 20-min hold equals the order expiry. Verification is always server-side (`reconcile`), with an amount and currency check (mismatch → `AMOUNT_MISMATCH`). A payment received after the hold ended is refunded automatically.
- **Cancellation and refunds:** free places can be cancelled until the start date. Paid places get a full refund if cancelled ≥2 days before the start. Admin cancel always refunds. Refunds use the Cashfree refund API (idempotent `rf_{rid}`), otherwise `MANUAL_REVIEW`. There are no payouts.
- **Webhook:** HMAC-SHA256 (timestamp + body, client secret), 24 h max age and 5 min skew. Only `spr_` orders are accepted, from the same gateway mode, and the webhook only triggers a re-read from the gateway.
- **Dashboards:** admin `/app/admin/space-registrations`; teacher `/app/spaces/programmes/[id]/participants` (names and status only); participant `/app/spaces/registrations` and `/[id]`.
- **Current payment configuration [V env]:**
  - `SPACE_CHECKOUT_ENABLED` is **unset** → paid registration is refused before any seat or order is created ("CHECKOUT_UNAVAILABLE").
  - `SPACE_LIVE_PAYMENTS` is **unset** → live mode is refused even if checkout were enabled.
  - Note: `CASHFREE_API_BASE` points at the LIVE host (`api.cashfree.com/pg`), so enabling checkout would still be refused (`live_payments_not_authorised`).
  - **Live payments are disabled.** No orders, payments or refunds were created during this audit.
- **Tests:** `tests/test_space_registrations_phase6.py`, `…_phase6_paid.py` (paid flow uses a mocked Cashfree transport). Browser: iterations 219–221. Last run 2026-11-07: pass.

## 4. Phase 7 — Community Partner Network (verified)
- **Module:** `backend/community_partners.py`, router `/api/spaces/partners`; `backend/teacher_service_localities.py`, router `/api/spaces/teacher-localities`.
- **Application:** `GET/POST/PATCH /mine`, `POST /mine/documents`, `POST /mine/submit`. Statuses: `draft, submitted, info_requested, approved, rejected`. Save and resume uses PATCH. Since 8B-0 a draft is created only by an explicit `POST /mine` (Start Application button).
- **Admin:** `GET /admin`, `GET /admin/{aid}`, `GET /admin/doc/{did}` (audited), `POST /admin/{aid}/decision/{decision}`, `PUT /admin/{aid}/localities`, `POST /admin/{aid}/partner/{action}` (activate, suspend, deactivate), `GET /admin/referrals`, `POST /admin/referrals/{rid}/status`.
- **Partner:** `GET /dashboard`, `GET /discover/spaces`, `GET /discover/teachers`, `POST/GET /referrals`. Referral kinds: teacher, space, space_owner. Referral statuses: submitted → contacted → onboarding → onboarded → closed.
- **Collections:** `community_partners`, `cp_docs` (private files), `cp_referrals`, `cp_audit`, `teacher_service_localities`.
- **Authorization:** admin = `role=="admin"`. A partner must be approved and active, re-checked on each request. The BFF `app/bff/spaces/partners/[...path]/route.ts` has a strict allow-list. Partners get no admin rights and there is no financial field anywhere.
- **Verified-teacher rule (8B-0/8B-0.1):** `_DIR_BASE` mirrors `_match_eligible`, plus `_NOT_GENUINE` excludes `user_TEST_|qa_|sp_|spn_`. Exact confirmed service-PIN match first; city/district fallback only for teachers without a confirmed PIN record.
- **Screens:** `/spaces/community-partners` (public), `/app/spaces/partner`, `/partner/apply`, `/partner/network`, `/partner/referrals`, `/app/spaces/teaching-localities`, `/app/admin/community-partners`, `/[id]`, `/referrals`.
- **Tests:** `tests/test_community_partners_phase7.py`, `test_teacher_service_localities_phase7.py`, `test_cp_integrity_8b0.py`. Browser: iterations 222, 228, 229. Last run 2026-11-07: pass.

## 5. Three participation models (verified)
- `backend/spaces.py` line 31: `MODELS = {"commercial", "subsidised", "community"}`. This is enforced on create and patch (lines 103, 153) and the models are `extra="forbid"`. There is no fourth model, and Revenue Share is absent.
- The model lives on the Space record (`spaces.model`), which is owned by `spaces.owner_id`. Programmes copy it into `space_snapshot.model` for display only. Financial-term guard: `tests/test_spaces_phase1b.py`.
- Spaces are separate from Global Venues (`venue_submissions`, `/venues`, retreats, venue ownership): `spaces.py` never reads or writes them.

## 6. Locality relationship schemas
| Entity | Structured, validated fields | Free-text / derived |
|---|---|---|
| India Post reference | `in_pincodes` (`_id = <pin>-<slug>`, pin, name, taluk, district, state, `dataset_version=india-post-2026.06-v2`) | — |
| Space | `spaces.location{pin, locality_id, locality, district, state, country="IN"}` via `validate_india_location` **[V]** | `address_line`, `landmark` |
| Community Partner | `localities[]` (applied) and `assigned_localities[]` (admin), each `{locality_id, locality, pin, district, state}`, validated **[V]** | `applicant.city` |
| Teacher | `teacher_service_localities{_id=user_id, primary{pin, locality_id, locality}, additional[≤4], pins[], confirmed}` **[V]** | `inst_teacher_directory.city` (legacy free text) |
| Programme | `inst_events.space_id` → Space location (authoritative); `space_snapshot{locality, pin, district, state}` is display only | `city`/`city_slug` derived from district |
| Registration | `space_registrations.space_id` / `event_id` → Space location | none stored |
| CP referral | `cp_referrals.locality_id` (validated against the partner's assigned localities) **[V]** | contact details |

India Post locality ids and PIN codes are available and authoritative for Spaces, partners, teacher service localities and referrals. Programmes and registrations inherit them through `space_id`.

## 7. API prefixes and collections (summary)
- `/api/spaces/localities` · `/api/spaces` · `/api/spaces/enquiries` · `/api/spaces/partners` · `/api/spaces/teacher-localities` · `/api/institutional/space-programmes` · `/api/institutional/space-registrations`
- `in_pincodes`, `in_pincodes_meta`, `spaces`, `space_docs`, `space_audit`, `space_enquiries`, `space_enquiry_docs`, `inst_events` (SPACE), `inst_event_sessions`, `inst_event_seo`, `inst_event_audit_log`, `space_registrations`, `space_registration_webhooks`, `community_partners`, `cp_docs`, `cp_referrals`, `cp_audit`, `teacher_service_localities`, `inst_teacher_directory`.
- BFF helpers: `frontend/lib/server/spaces.ts`, `space-programmes.ts`, `space-registrations.ts`, `spaces-localities.ts`.

## 8. Test evidence and current status
- 2026-11-07 regression (8B-0.1): **85 passed** across the Phase 5B (3 files), Phase 6 (2), Phase 7 (2), 8B-0 and financial-guard suites. Earlier full Spaces suite: 212 passed.
- Browser reports: `/app/test_reports/iteration_218.json` – `iteration_229.json`.
- Tests were **not** re-run for this audit, because they write and remove `TEST_` records and this audit is restricted from writing to the database.
- Preview data (read-only counts): 1 Space (QA, `unlisted`), 0 Space programmes, 0 registrations, 0 partner applications, 0 teacher service-locality records.

## 9. Comparison with the separate backend `/app` (branch `main`, HEAD `5d3ef8e4`, no remote)
That repository is not accessible from this workspace, so this comparison relies on the user-supplied 8B.1–8B.1.4 findings **[A]**.
- **Present here, absent there:** Phase 5B (`space_programmes.py`), Phase 6 (`space_registrations.py`, Cashfree gating), Phase 7 (`community_partners.py`, `teacher_service_localities.py`), the 8B-0/8B-0.1 fixes, and the whole Next.js BFF and Spaces UI.
- **Present there, absent here:** Phase 8B.1 locality coverage. **[V]** no `coverage` collection or code exists in this repo.
- **Likely implemented differently [A]:** Phase 5A foundations there vs. Phases 2–4 here (`spaces_localities.py`, `spaces.py`, `space_enquiries.py`). Field names, the dataset version and the locality id format must be compared before any integration.
- **Must remain authoritative:**
  - this repo's `spaces`, `in_pincodes` (`<pin>-<slug>` ids, version `india-post-2026.06-v2`), `inst_events` SPACE records, `space_registrations`, `community_partners`, `cp_referrals` and `teacher_service_localities`, plus their API prefixes above;
  - `_match_eligible` and `_adaptive_verified`, plus the payment gates.
- **Can they be connected safely?** Not directly.
  - The two repositories share a commit history only up to an unknown point; neither has a remote, and HEADs `e2b21f35` and `5d3ef8e4` differ.
  - Merging would risk overwriting Phases 5B–7.
  - Safe path: treat this repo as the base and re-implement or port only the 8B.1 coverage design here, after a field-level diff of the 8B.1 data model against §6.

## 10. Recommended integration architecture
1. Keep this repository (`/app`, `main` @ `e2b21f35`) as the single source of truth for Spaces.
2. Bring Phase 8B.1 in as a design spec, not as a code or data copy:
   - a new additive collection (e.g. `spaces_locality_coverage`, keyed by `in_pincodes._id`) plus admin-only endpoints under `/api/spaces/admin/localities/*`;
   - BFF routes under `app/bff/admin/spaces-localities/*`;
   - the existing `/app/admin/spaces-localities` page extended.
3. Dependencies:
   - India Post dataset version parity (`india-post-2026.06-v2`);
   - locality id format `<pin>-<slug>`;
   - admin guard (`venues._require_admin` and BFF `requireAdmin`);
   - roll-ups read the partner `assigned_localities`, teacher `pins` and Space `location.locality_id` fields.
4. Do not connect the other repository's database or merge its git history until the user approves a diff review.
5. Payments stay disabled: `SPACE_CHECKOUT_ENABLED` and `SPACE_LIVE_PAYMENTS` unset.
