# NOSTOPS Verification + Empanelment Engine

Status: **PROMPT 1 — Foundation, Data Model & Safe Migration — IMPLEMENTED & TESTED.**
Purely additive. The existing system is untouched and fully operational.

---

## 1. Existing functionality (PRESERVED — do NOT remove/alter)

All of the following live on the **frozen remote business backend**
(`pro-learn-connect-1.emergent.host`) and remain authoritative. The frontend
talks to them via BFF routes that forward to the remote backend. Prompt 1 does
**not** touch any of these.

| Area | Existing touchpoints (unchanged) |
|---|---|
| InstaKYC CTA | Teacher dashboard "Complete InstaKYC (₹…)" → `/app/teacher/kyc` |
| InstaKYC flow/backend | BFF `app/bff/teacher/kyc/[...action]` → remote `/teachers/...` |
| InstaKYC status fields | remote `onboarding-state`: `kyc_verified`, `pan_verified`, `bank_verified`; profile `kycVerified`, `kycPaid` |
| Admin KYC | `app/app/admin/kyc`, BFF `app/bff/admin/kyc/[teacherId]/[action]` |
| Empanelment CTA | Teacher dashboard "Become an Empanelled Teacher" → `/app/teacher/empanelment` (+ `/fast-track`) |
| Empanelment application | BFF `app/bff/teacher/empanelment/fast-track/[...action]` → remote |
| Empanelment records / `is_empanelled` | remote `onboarding-state.is_empanelled`, profile `isEmpanelled` |
| Council workflow | `app/app/admin/empanelment`, Guru review BFF `app/bff/guru/empanelment/[requestId]/[action]`, admin `app/bff/admin/empanelment/fast-track/...` |
| Teacher entitlements | `lib/teacher-access.ts`, `lib/server/teacher-access.ts`, level gating |
| Dashboard logic | `components/app/teacher/TeacherHome.tsx`, `TeacherProgressCards.tsx` |
| Payment records | remote (InstaKYC payment) |

**Indian identity stays authoritative via existing InstaKYC. International identity
will use Didit (wired in a later prompt).**

---

## 2. New engine (ISOLATED local feature)

- Module: `backend/verification.py`, mounted in `server.py` **before** the
  catch-all proxy, so `/api/verification/*` is served locally and **never**
  forwarded to the remote backend (same pattern as discovery / pulse / knowledge).
- Storage: local Mongo `nostops_web`, new `verification_*` collections only.
- Auth: shared secret `X-Pulse-Secret` + server-injected identity `X-Pulse-User`.

### Collections / data model (Prompt 1)
- `verification_applications` — one journey per teacher (fields: application_id, teacher_id, teacher_handle, teacher_level, country, nationality, verification_route, verification_provider, verification_status, credential_status, professional_evidence_status, empanelment_status, council_review_required, council_review_reason, payment_status/reference/amount/currency, rule_version, created_at/updated_at/completed_at).
- `verification_identity` — identity_verification (provider, provider_reference, document_type, issuing_country, document_expiry, verification_status, liveness_status, face_match_status, risk_status, verification_timestamp, failure_reason).
- `verification_credentials` — teacher_credentials (multiple per teacher).
- `verification_professional_evidence` — teaching history / references / links.
- `verification_lineage` — tradition / lineage / guru / school / philosophy.
- `verification_empanelment_assessments` — rule_version, rules_evaluated/passed/failed, exceptions, decision, decision_reason, assessed_at (immutable decisions).
- `verification_audit_log` — append-only immutable events.

### Routes & providers
- **INDIA** → `INSTAKYC` (existing, authoritative identity) → NEW credential verification → NEW empanelment engine.
- **INTERNATIONAL** → `DIDIT` → credential verification → professional evidence → empanelment engine.

### Levels
- LEVEL_1 Yoga Shikshak · LEVEL_2 Yoga Pracharak · LEVEL_3 Yoga Guru.
- Automated verification + empanelment primarily targets **LEVEL_2**.
- **LEVEL_3 always requires Council** (`council_review_required=true`, reason `LEVEL_3_GURU_REQUIRES_COUNCIL`).

### Rule version
- `EMPANELMENT_RULES_V1.0` — stamped on every application and every assessment; historical decisions are never overwritten.

### Status models
- Verification: NOT_STARTED, PAYMENT_PENDING, PAYMENT_SUCCESS, VERIFICATION_PENDING, IDENTITY_VERIFIED, IDENTITY_FAILED, CREDENTIAL_VERIFICATION, CREDENTIALS_VERIFIED, PROFESSIONAL_EVIDENCE_PENDING, EMPANELMENT_ASSESSMENT, VERIFIED, NOT_VERIFIED.
- Empanelment: NOT_STARTED, ASSESSMENT_PENDING, ELIGIBLE, EMPANELLED, ADDITIONAL_INFORMATION_REQUIRED, COUNCIL_REVIEW, NOT_EMPANELLED, APPEAL_PENDING.

### Audit events (immutable)
APPLICATION_CREATED, PAYMENT_SUCCESS, IDENTITY_VERIFICATION_STARTED, IDENTITY_VERIFIED, IDENTITY_FAILED, CREDENTIAL_SUBMITTED, CREDENTIAL_VERIFIED, PROFESSIONAL_EVIDENCE_SUBMITTED, EMPANELMENT_ASSESSMENT_STARTED, EMPANELMENT_APPROVED, ADDITIONAL_INFORMATION_REQUESTED, COUNCIL_REVIEW_REQUESTED, COUNCIL_APPROVED, COUNCIL_REJECTED, APPEAL_SUBMITTED.

### Endpoints (Prompt 1 foundation)
- `GET  /api/verification/config` — rule version, levels, routes, providers, status enums, audit events.
- `POST /api/verification/application` — create (idempotent; returns the open one if present).
- `GET  /api/verification/application/me` — the signed-in teacher's current application.
- `GET  /api/verification/application/{id}` — full aggregate (application + sub-records; owner/admin).
- `GET  /api/verification/application/{id}/audit` — append-only audit trail.

---

## 3. Acceptance (Prompt 1) — RESULTS
- Existing Indian InstaKYC: **works** (untouched; proxy intact — verified `/api/auth/me` still forwards to remote).
- Existing Empanelment / dashboard / entitlements: **works** (untouched).
- New application records: **can be created** (India→INSTAKYC, International→DIDIT, L3→Council required). Idempotent re-create verified.
- Immutable audit: APPLICATION_CREATED recorded (append-only).
- No historical record modified; no existing functionality deleted.

**REPORT: IMPLEMENTED / TESTED — PASS.**

> NOTE: Later prompts will add identity (Didit integration — needs API keys),
> credential verification, professional evidence, the empanelment rule engine,
> payment unification, and finally consolidation of the two dashboard CTAs (only
> after final QA). The CTAs remain unchanged until then.


---

## 4. PROMPT 2 — Didit international identity + evidence — IMPLEMENTED & TESTED
- `POST /api/verification/application/{id}/mark-paid` (admin/service) — records a confirmed payment; teachers can never self-confirm.
- `POST /api/verification/didit/session` — gated on PAYMENT_SUCCESS + international route; idempotent; surfaces provider errors without leaking internals.
- `GET  /api/verification/didit/session/{session_id}/decision` — server-side reconcile (owner/admin).
- `POST /api/verification/didit/webhook` — PUBLIC; authenticated by Didit `X-Signature-V2` (HMAC-SHA256 over canonical JSON) + timestamp skew (±5 min); idempotent via `verification_provider_events` (unique `event_id`). Maps the Didit result onto NOSTOPS identity + ingests the questionnaire into credentials/evidence/lineage. **Never auto-empanels.**
- Internal provider cost ledger (`verification_provider_costs`) — never shown to teachers.
- NOTE: live Didit session creation needs a funded Didit account (business.didit.me). The code passes 23/24 automated checks on a fresh DB; the one failing check is the live session call when the account balance is 0.

---

## 5. PROMPT 3 — Credential Verification + Professional Evidence — IMPLEMENTED & TESTED
Purely additive. Indian InstaKYC and the existing Empanelment flow are untouched.

### Verification ladder (cascades until resolved)
| Level | What it does | Outcome |
|---|---|---|
| **A — Digital** | certificate lookup / QR / digital credential / public registry / verification API (via `verification_url` reachability + certificate-number match, or a service-recorded `digital_result`) | `CREDENTIAL_VERIFIED` |
| **B — Institution** | institution existence (built-in known set → live website reachability → AI recognition → service-recorded `institution_result`), country, website, issuing authority, contact | `INSTITUTION_VALIDATED` |
| **C — Document** | certificate, certificate number, teacher name (variation/initials accepted), qualification, institution, dates | `DOCUMENT_REVIEWED` |
| **D — Exception** | insufficient → `ADDITIONAL_INFORMATION_REQUIRED`; conflict / anomaly / institution-not-established → `COUNCIL_REVIEW` | — |

Each credential records `verification_status`, `verification_level` (A/B/C/D), `verification_method`, per-field `checks`, and `evidence_notes`.

### AI assist (ADVISORY ONLY — never decides empanelment)
Reuses the proven `emergentintegrations` Claude integration (`claude-sonnet-4-6`, `EMERGENT_LLM_KEY`) for institution matching/recognition. Duplicate & conflict detection are rule-based; name-variation matching is deterministic. Live network + AI checks are controlled by `VERIFICATION_LIVE_CHECKS` (default ON in prod; the acceptance suite runs offline/deterministic by pre-recording `digital_result`/`institution_result` and using well-known institutions).

### Identity reuse (no re-verification)
- **India** → `POST /api/verification/application/{id}/reuse-identity` records the existing verified InstaKYC result and advances straight to credential verification. International teachers are rejected (400).
- **International** → Didit identity (Prompt 2) is reused automatically on an approved webhook.

### Evidence Matrix (8 categories)
`GET /api/verification/application/{id}/evidence-matrix` → IDENTITY, QUALIFICATION, INSTITUTION, EXPERIENCE, LINEAGE, PROFESSIONAL_HISTORY, REFERENCES, DOCUMENTS — each cell has `status` / `source` / `verification_method` / `date` / `notes`.

### New endpoints
- `POST   /api/verification/application/{id}/credentials` — submit a qualification + run the ladder.
- `GET    /api/verification/application/{id}/credentials` — list.
- `PATCH  /api/verification/application/{id}/credentials/{cid}` — update + re-assess.
- `POST   /api/verification/application/{id}/credentials/{cid}/reverify` — re-assess.
- `POST   /api/verification/application/{id}/credentials/verify-all` — re-assess all + roll up + return matrix.
- `POST   /api/verification/application/{id}/professional-evidence` — upsert; `GET` to read.
- `POST   /api/verification/application/{id}/lineage` — add lineage.
- `POST   /api/verification/application/{id}/reuse-identity` — India InstaKYC reuse.
- `GET    /api/verification/application/{id}/evidence-matrix` — the 8-category matrix.

### Acceptance (Prompt 3) — RESULTS
`backend/test_credential_flow.py` — **30/30 PASS** (re-runnable; unique run token avoids state pollution). Covers: verified qualification, unverifiable qualification, incomplete certificate, conflicting certificate, multiple qualifications, international qualification, name variation, institution-not-established, additional-evidence resolution, Council escalation, India identity reuse, professional evidence + audit, 8-category matrix, and **no auto-empanelment**. Live AI path separately smoke-verified (real institution → `AI_RECOGNISED`; fake institution → `AI_NOT_ESTABLISHED` → Council). Existing InstaKYC/Didit paths verified intact (fresh-ID Didit webhook → IDENTITY_VERIFIED + evidence ingested, `credential_id` now stamped).

**REPORT: IMPLEMENTED / TESTED — PASS. No empanelment decision is made here — that is Prompt 4.**

---

## 6. PROMPT 4 — Rules-Based Empanelment Engine — IMPLEMENTED & TESTED
Transparent, auditable, explainable, version-stamped. **No opaque AI score.** Runs in **parallel/shadow** mode (feature flag `engine_mode`, default `parallel`) and does NOT touch the existing remote Empanelment workflow or the teacher's authoritative `is_empanelled`.

### Mandatory rules (each PASS / FAIL / REVIEW / ADDITIONAL / NOT_CONFIGURED with reason + evidence)
- **RULE-01** Identity verified · **RULE-02** Primary yoga qualification satisfies requirement · **RULE-03** Teaching experience · **RULE-04** Profile complete · **RULE-05** Required evidence/documents available · **RULE-06** No unresolved identity discrepancy · **RULE-07** No unresolved credential contradiction · **RULE-08** No unresolved mandatory exception.

### Admin configuration (NO invented thresholds — defaults unset)
`minimum_teaching_years`, `minimum_teaching_hours`, `required_qualification_level`, `required_documents`, `required_evidence`, `accepted_verification_methods`, `review_triggers`, `engine_mode`. Stored per `rule_version` in `verification_rules_config`. `GET/PUT /api/verification/empanelment/config` (PUT = admin). Unset numeric thresholds are `NOT_CONFIGURED` (treated as pass, flagged) so no threshold is ever invented.

### Decision logic
any FAIL → **NOT_EMPANELLED** · else any REVIEW → **COUNCIL_REVIEW** · else any ADDITIONAL → **ADDITIONAL_INFORMATION_REQUIRED** · else **EMPANELLED**. **Level 3 (Yoga Guru) is never auto-granted** → forced to COUNCIL_REVIEW with `council_recognition_required=true`, `decision_reason="COUNCIL_RECOGNITION_REQUIRED"`.

### Immutable decision record (`verification_empanelment_assessments`, never overwritten)
application_id, teacher_id, teacher_level, rule_version, mode, rules_evaluated (full trace), rules_passed, rules_failed, evidence_used, exceptions, decision, decision_reason, council_recognition_required, config_snapshot, assessed_at, assessed_by. The local application `empanelment_status` is updated (shadow); EMPANELLED→`verification_status=VERIFIED`, NOT_EMPANELLED→`NOT_VERIFIED`. Audit events: EMPANELMENT_ASSESSMENT_STARTED, then EMPANELMENT_APPROVED / EMPANELMENT_REJECTED / COUNCIL_REVIEW_REQUESTED / ADDITIONAL_INFORMATION_REQUESTED.

### Endpoints
- `GET/PUT /api/verification/empanelment/config`
- `POST /api/verification/application/{id}/empanelment/assess` (body: `profile_complete`, `profile_completeness`, `teaching_hours`; admin-only: `config_override`, `mode_override` for safe test runs)
- `GET  /api/verification/application/{id}/empanelment/assessments` (immutable history)
- `GET  /api/verification/application/{id}/empanelment/latest`

### Acceptance (Prompt 4) — RESULTS
`backend/test_empanelment_flow.py` — **28/28 PASS** (re-runnable; resets shared config). Covers: all-pass→EMPANELLED, missing-evidence→ADDITIONAL, unusual-credential→COUNCIL, credential-conflict→COUNCIL, mandatory-failure→NOT_EMPANELLED, L3→COUNCIL_RECOGNITION_REQUIRED, decision-record completeness + rule-version stamp, immutable history, parallel vs active mode flag, admin-only config. Prompt 3 regression 30/30 intact.

**REPORT: IMPLEMENTED / TESTED — PASS. Existing Empanelment NOT removed; new engine runs in parallel/shadow.**


---

## 7. PROMPT 5 — Council Governance, Exceptions, Appeals & Audit — IMPLEMENTED & TESTED
Enhances (does NOT remove) the existing Council/Empanelment flow. The Council is the STANDARDS / EXCEPTION / APPEAL / LEVEL-3 / AUDIT authority — it does NOT interview normal automated Level-2 applications. All endpoints guarded by `council_user` (role ∈ {admin, council, guru}).

### Council queue — `GET /api/verification/council/queue?country=&level=`
Only COUNCIL_REVIEW, Level-3 and appeal-pending applications appear (normal automated L2 never does). Each item carries §2 fields: teacher, country, teacher_level, identity_status, credential_status, professional_evidence_status, exception_codes (with labels), reason, evidence_summary (full matrix), automated_assessment, rule_version, council_recognition_required.

### Council actions — `POST /api/verification/application/{id}/council/action`
APPROVE · REQUEST_INFORMATION · REJECT · ESCALATE; Level-3: RECOGNISE_AS_YOGA_GURU · REQUEST_FURTHER_REVIEW. Each writes an **immutable** ruling to `verification_council_decisions` (with an INTERNAL `internal_note`, council/admin-only) + an audit event. `GET .../council/decisions` lists them (privileged only).

### Exception codes (configurable) — EX-01…EX-12
Default registry + `GET/PUT /api/verification/council/exception-codes` (PUT admin-only). Auto-derived from engine findings (identity risk → EX-01, expired doc → EX-02, face/liveness → EX-03, unverified qualification → EX-04, institution not established → EX-05, conflicting certificate → EX-06, insufficient experience → EX-07, unusual international qualification → EX-08, name variation → EX-09, pending appeal → EX-10; EX-11 document manipulation / EX-12 council discretion reserved).

### Information request (no restart) — `GET .../information-request`
REQUEST_INFORMATION sets `empanelment_status=ADDITIONAL_INFORMATION_REQUIRED` + `information_requested[]`; the teacher sees exactly what's missing and adds it via the normal submit endpoints — the application is never restarted.

### Appeals — `verification_appeals`
`POST .../appeal` (owner; only on NOT_EMPANELLED) captures reason/evidence/documents/date/status. `GET .../appeals` (owner redacted — no council_note), `GET /council/appeals?status=`, `POST /council/appeal/{id}/decide` (UPHELD → re-opens COUNCIL_REVIEW, never auto-empanels; DENIED → stays NOT_EMPANELLED). Audit: APPEAL_SUBMITTED, COUNCIL_APPROVED/REJECTED.

### Audit — `GET /api/verification/council/audit`
Filters: country, level, decision, exception, reviewer, qualification, rule_version, date_from/to — over automated assessments + council rulings. Periodic sampling `GET /council/audit/sample` returns AUTO-empanelled teachers for review and is **non-destructive** — empanelment is only changed by an explicit Council action.

### §9 Security (enforced)
`council_user` gates all council endpoints. Teacher-facing views are redacted: raw identity fields (document type/expiry, risk/face/liveness/failure, provider refs, didit_status) hidden; credential internal `checks`/`digital_result`/`institution_result`/`expected_teacher_name` hidden; RULE-06 identity reasons generalised; Council internal notes and the provider cost ledger never exposed. `_load_app` now admits owner OR privileged reviewer (redaction applied downstream).

### Acceptance (Prompt 5) — RESULTS
`backend/test_council_flow.py` — **41/41 PASS** (re-runnable). Covers: normal-L2-not-in-queue, exception→queue (+§2 fields + EX codes), APPROVE→EMPANELLED, REQUEST_INFORMATION→teacher sees missing items (no restart), L3→recognition (guru action blocked for non-L3), appeal submit/decide (upheld re-opens, no auto-empanel), audit filters, non-destructive sampling, exception-code config, and security (teacher blocked from council endpoints; raw identity/fraud signals/internal notes hidden). Prompts 3/4 regression 30/30 + 28/28 intact.

**REPORT: IMPLEMENTED / TESTED — PASS. Existing Council/Empanelment preserved; new engine runs in parallel/shadow with full governance.**

