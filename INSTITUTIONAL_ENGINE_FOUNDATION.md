# NOSTOPS Institutional Program Engine — Prompt 1 Foundation

**Status:** Foundation complete & tested (46/46 checks green). No Event Creator UI (per scope).
**Module:** `/app/backend/institutional.py` · **Routes:** `/api/institutional/*` · **Collections:** `inst_*` (local Mongo `nostops_web`)
**Flag:** `INSTITUTIONAL_ENGINE_ENABLED` (FALSE | TEST_ONLY | TRUE) — currently `TRUE` · **Version:** `INSTITUTIONAL_ENGINE_V1.0`

---

## 1. Architecture & safety

Mirrors the proven isolated-engine pattern (pulse / verification / discovery): a local FastAPI router
mounted **before** the catch-all proxy in `server.py`, so `/api/institutional/*` is served locally and
**never forwarded** to the frozen remote business backend.

- **Purely additive.** Touches ONLY new `inst_*` collections.
- **Never** reads/writes existing teacher, HR/booking, payment, InstaKYC, Empanelment, Council, or
  `verification_*` records — those stay authoritative and untouched.
- **Auth:** shared secret `X-Pulse-Secret` + server-injected identity `X-Pulse-User` (base64 JSON actor
  from the Next BFF; never trusted from the browser). Same as sibling engines.
- **Anti-poaching (CORE ETHOS):** participant/registration/attendance records are scoped to the owning
  organisation + event creator; org reads are membership-gated (404 on non-member to avoid existence leaks).
  No cross-teacher student rosters exist in the model.

## 2. Immutable internal IDs (§14)

Format: `NOSTOPS-<PREFIX>-<YEAR>-<NNNNNN>` (6-digit zero-padded, atomic per prefix+year via `inst_counters`
using `find_one_and_update($inc, upsert)`). Examples: `NOSTOPS-ORG-2026-000001`, `NOSTOPS-EVT-2026-000291`.
Public URLs will use human-readable slugs that map to these immutable IDs.

## 3. The 23 foundation entities (§14) — modeling decisions

**21 standalone collections** + **2 enums** (owner-approved: model as enums/subdocs where they are
intrinsically an attribute, to avoid duplicate collections).

| # | Entity | Model | Collection / location | ID prefix | Notes |
|---|--------|-------|------------------------|-----------|-------|
| 1 | Organisation | collection | `inst_organisations` | ORG | cohort_type, trust_state, city dimension |
| 2 | OrganisationMember | collection | `inst_org_members` | MBR | holds EventCreatorRole enum field |
| 3 | **EventCreatorRole** | **enum on member** | field on `inst_org_members` (`event_creator`, `event_creator_role`) | — | intrinsic membership attribute → no separate collection |
| 4 | CouncilProgramme | collection | `inst_council_programmes` | PGM | Council-controlled knowledge |
| 5 | ProgrammeVersion | collection | `inst_programme_versions` | PGV | immutable version snapshots |
| 6 | OrganisationProgramme | collection | `inst_org_programmes` | OPG | org's adoption of a council programme |
| 7 | Event | collection | `inst_events` | EVT | holds EventVisibility enum field + lifecycle |
| 8 | EventSession | collection | `inst_event_sessions` | SES | teacher-delivered session |
| 9 | Participant | collection | `inst_participants` | PTP | org-scoped |
| 10 | Registration | collection | `inst_registrations` | REG | unique (event,participant) |
| 11 | Attendance | collection | `inst_attendance` | ATT | unique (session,participant) |
| 12 | Feedback | collection | `inst_feedback` | FBK | |
| 13 | TeacherAssignment | collection | `inst_teacher_assignments` | TAS | |
| 14 | TeacherRecommendation | collection | `inst_teacher_recommendations` | TRC | |
| 15 | CityCoordinatorAssignment | collection | `inst_city_coordinator_assignments` | CCA | support layer, not a gate |
| 16 | ProgrammeIPMetadata | collection | `inst_programme_ip_metadata` | IPM | one per programme; IP/royalty, **no hard-coded %** |
| 17 | PricingCalculation | collection | `inst_pricing_calculations` | PRC | structure only; percentages are inputs/config |
| 18 | RevenueAllocation | collection | `inst_revenue_allocations` | RVA | |
| 19 | Settlement | collection | `inst_settlements` | STL | |
| 20 | Renewal | collection | `inst_renewals` | RNW | |
| 21 | EventSEO | collection | `inst_event_seo` | SEO | one per event (slug/meta/jsonld/indexability) |
| 22 | **EventVisibility** | **enum on event** | field on `inst_events` (`visibility`) | — | PRIVATE/UNLISTED/PUBLIC + behaviour helpers |
| 23 | EventAuditLog | collection (append-only) | `inst_event_audit_log` | (uuid) | immutable; records all engine state changes |

Infra (not business entities): `inst_counters`, `inst_platform_config`.

## 4. Relationship chain (§1)

```
Council Guru → CouncilProgramme (+ProgrammeVersion, +ProgrammeIPMetadata)
            → OrganisationProgramme (org adopts a council programme)
            → Event (org-created occurrence; visibility + lifecycle + EventSEO)
            → EventSession (teacher-delivered)
            → Participant → Registration → Attendance → Feedback
            → TeacherRecommendation → TeacherAssignment
            → PricingCalculation → RevenueAllocation → Settlement → Renewal
CityCoordinatorAssignment = human support/exception layer (NOT a gate)
```

## 5. Strict governance vocabulary (served by `GET /api/institutional/meta`)

- **Taxonomy (STRICT):** `Mind` / `Body` / `Special Needs` (slugs `mind`/`body`/`special-needs`). **Never "Specific Needs"** (asserted in tests).
- **Cohorts (3 entry points, 1 engine):** Company · Educational Institution · Startup & Networking Group.
- **Event lifecycle:** DRAFT → PUBLISHED → LIVE → COMPLETED → ARCHIVED/EVERGREEN. Public completed events kept ≥ **90 days**.
- **Event visibility:** PRIVATE / UNLISTED / PUBLIC. Only **PUBLIC** is discoverable + indexable (Private/Unlisted → noindex + excluded from sitemaps — enforced when public rendering lands in a later prompt).
- **Org trust:** UNVERIFIED / VERIFICATION_PENDING / VERIFIED / EXCEPTION_MANUAL_REVIEW (domain + manual exception).
- **Council-controlled fields** vs **Organisation-controlled fields** split exposed in `meta` so UIs never let an org rewrite Council knowledge or make unsupported health/clinical claims.
- **IP principle:** Guru Background IP kept separate from Council Programme IP; records attribution/provenance/licensing/royalty; **no hard-coded commercial percentages**.
- **Personas:** 6 operational (Event Creator, Participant, Teacher, City Coordinator, Council Guru, NOSTOPS Admin) + `PUBLIC_VISITOR`.
- **Cities:** 9 launch cities as a **data dimension** (Mumbai, Navi Mumbai, Pune, Nashik, Delhi, Gurgaon, Bangalore, Chandigarh, Hyderabad). No per-city systems.

## 6. Foundation routes (Prompt 1)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/institutional/health` | none | engine + db + flag |
| GET | `/api/institutional/meta` | none | full strict vocabulary (enums/taxonomy/cities/id formats/governance) |
| GET | `/api/institutional/config` | secret | engine config singleton |
| POST | `/api/institutional/organisations` | secret | self-service org create (owner member + audit) |
| GET | `/api/institutional/organisations` | secret | caller's orgs (membership-scoped) |
| GET | `/api/institutional/organisations/{id}` | secret | single org (member-only; 404 otherwise) |
| GET | `/api/institutional/organisations/{id}/members` | secret | org staff (member-only; no learner rosters) |

Programmes / events / sessions / registrations / pricing / settlements endpoints arrive in Prompts 2–6.

## 7. Existing NOSTOPS components to REUSE in Prompts 2–6 (§15.8)

- **Backend proxy & pattern:** `server.py` mount order; `verification.py` as the reference engine (statuses, audit, idempotency).
- **BFF write pattern:** `/bff/*` route handlers + `lib/server/bff.ts` (`badOrigin` double-submit CSRF) + `lib/auth-client.ts` (`sendBff`).
- **Server data-layer pattern:** `lib/server/verification.ts` (`X-Pulse-Secret`/`X-Pulse-User` fetch) → clone as `lib/server/institutional.ts`.
- **Org persona surfaces (to extend, not replace):** `components/app/org/*` (OrgHome, CreateBookingForm, BatchShare, CloseEnrollment, RoiCalculator), `app/app/org/*`, `app/bff/org/*`, `lib/server/org.ts`.
- **Public cohort landings (to wire to real programmes):** `app/(public)/for-companies`, `/for-educational-institutions`, `/for-startup-networks` (`components/.../OrgLanding.tsx`).
- **Council governance:** `app/app/council/*`, `lib/server/guru.ts` (programme curation/approval queues).
- **Teacher matching inputs:** `lib/server/discover.ts` + `/teachers/directory` (public-safe projection) + `verification_*` trust signals + `TrustStrip`.
- **Public SEO stack (for PUBLIC events):** `lib/seo.ts`, `lib/site.ts`, `components/JsonLd.tsx`, `app/(public)/sitemap.xml` (add EventSEO URLs for PUBLIC-only).
- **Payments:** existing Cashfree/Razorpay unified payment surfaces (`cashfree-return`, `/pay`) for event bookings.
- **City dimension:** `lib/server/cities.ts`, `app/(public)/cities/[city]`.

## 8. Verification (Prompt 1 §15)

`python /app/backend/test_institutional_foundation.py` → **46/46 passed**:
health; strict taxonomy (no "Specific Needs"); lifecycle/visibility/trust/cohorts/cities/personas/IP/field-split;
auth (401 without secret); org create with immutable ID; invalid cohort/role → 400; membership scoping (A cannot
see/GET B's org → 404); monotonic ID sequence; **isolation + regression** (`/api/health` proxy healthy,
remote `/api/teachers/directory` reachable, `verification/config` still 401 = sibling engine alive).
Backend boots clean (no errors). Existing teacher onboarding / InstaKYC / empanelment / auth untouched
(not referenced by this module).

**QA data:** a few `inst_organisations` created by `qa_inst_owner_A/B` during testing — harmless, no UI, local only.
