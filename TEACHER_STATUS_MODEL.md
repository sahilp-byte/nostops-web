# PROMPT 4 — Authoritative Teacher Status Model (proposed schema/approach — NOT yet implemented)

> Design for the single authoritative teacher-status model used throughout NOSTOPS. Three **separate**
> attributes (Verification, Empanelment, Level) — never combined, never self-assignable. This document is the
> **proposed approach for approval before implementation** (as required by Prompt 4). Some derivation branches
> depend on the PRODUCT DECISIONS raised in `ACCESS_CONTROL_GAPS.md` and are marked ⚠️.

## 0. Hard constraint — backend is READ-ONLY
This agent cannot run DB migrations or change FastAPI. The model therefore has two parts:
- **Part A (implementable now):** a web-side authoritative status layer that **derives** the three attributes
  from the teacher's existing backend record — one module, used everywhere. No DB change, no record duplication.
- **Part B (recommended, backend-team only):** persist the three attributes as explicit, write-protected fields
  on the **existing** teacher document so status is stored (not derived). Delivered as a `BACKEND_REQUEST_*.md`.

## 1. Existing DB fields (naming conventions to adapt to)
Observed on the live teacher document (`/teachers/me/native-profile`, `/auth/me`, `/kyc/sandbox/status`, `/empanelment/fast-track/my-status`):
- Verification: `kyc_verified`, `kyc_paid`, `kyc_paid_at`, `kyc_verified_at`, `pan_verified`, `bank_verified`, `kyc_method`, plus legacy `is_verified`.
- Empanelment: `is_empanelled`, `empanelled_at`, `empanelled_via`, `empanelment_path` (`fast`/`slow`), `empanelment_cert`, and fast-track requests via `/empanelment/fast-track/my-status` (`active` vs `history`, each with `status` + `payment.status` + `decision.outcome`).
- Level: `tier` (`shikshak`/`pracharak`/`guru`/`council_guru`), `badges[]`, `badge_primary`.
- Identity: `user_id`, `teacher_id` (`tn_…`), `handle`, `created_at`.
Backend uses **snake_case**; the web projection (`TeacherSelf`) uses **camelCase**. The model mirrors both.

## 2. The three attributes (separate; never combined)

### 2.1 VerificationStatus — `'verified' | 'pending' | 'not_verified'`
| Value | Derivation from existing fields | Notes |
|---|---|---|
| `verified` | ⚠️ **depends on D2** — either strict `kyc_verified && kyc_paid && is_empanelled`, OR backend `is_verified` | authoritative rule TBD |
| `pending` | ⚠️ **depends on D5** — e.g. `kyc_paid` (or `kyc_paid_at`) set but not yet `kyc_verified` | "initiated, awaiting completion" |
| `not_verified` | none of the above | default |

### 2.2 EmpanelmentStatus — `'empanelled' | 'pending' | 'not_empanelled'`
| Value | Derivation | Notes |
|---|---|---|
| `empanelled` | `is_empanelled === true` | authoritative, unambiguous |
| `pending` | ⚠️ **depends on D4** — fast-track `my-status.active` request undecided, and/or free-track `sessions_done < min` in progress | definition TBD |
| `not_empanelled` | else | default |
(Also expose `empanelledVia` = `empanelment_path`/`empanelled_via` for display only.)

### 2.3 TeacherLevel — `'none' | 1 | 2 | 3`
| Value | Derivation (`lib/teacher-levels.tierToLevel`) | Notes |
|---|---|---|
| `1` | `tier==='shikshak'` (or badge "Yoga Shikshak") | Foundation |
| `2` | `tier==='pracharak'` | Growth (host-eligible) |
| `3` | `tier==='guru' \| 'council_guru'` | Leadership |
| `none` | `tier` null/absent | ⚠️ **depends on D3** — today the web defaults this to L1 |

## 3. Proposed Part A implementation (web-side, on approval)
- **New file `lib/teacher-status.ts`** — the ONE source of truth:
  ```ts
  export type VerificationStatus = 'verified' | 'pending' | 'not_verified';
  export type EmpanelmentStatus  = 'empanelled' | 'pending' | 'not_empanelled';
  export type LevelStatus        = 'none' | 1 | 2 | 3;
  export type TeacherStatus = {
    verification: VerificationStatus;
    empanelment:  EmpanelmentStatus;
    level:        LevelStatus;              // separate from the two above
    // convenience (derived, not authoritative): canOperate = verification==='verified' && empanelment==='empanelled'
  };
  export function deriveTeacherStatus(self: TeacherSelf, extra?: { fastTrackActive?: boolean }): TeacherStatus { … }
  ```
- **Reuse, do not duplicate:** `deriveTeacherStatus` reads the existing `TeacherSelf` projection (single `native-profile` record). `isTeacherVerified()` / `getTeacherGate()` / `getTeacherLevel()` become thin wrappers over it so the whole app has ONE definition. No second teacher record, no new collection, no data copy.
- **No self-assign:** all three are derived from read-only backend fields; the `/bff/teacher/profile` whitelist already rejects `tier`/`is_verified`/`is_empanelled`/`kyc_*` (confirmed). The model adds no write path for them.
- **Enforcement (fixes D1):** a shared BFF guard (e.g. `requireTeacherStatus()`) applied to the gated write routes so the rule holds at UI + route (+ backend), once D2 fixes the canonical rule.
- **Migration for the web layer:** none (pure derivation). Rollout = introduce the module, refactor the existing scattered checks to call it, verify parity, no behaviour change beyond the agreed decisions.

## 4. Proposed Part B (backend-team, recommended — cannot implement here)
If product wants **stored** authoritative status (not web-derived), the migration approach on the **existing** teacher document (no new collection, no record duplication):
- Add additive, server-owned, write-protected fields alongside the current ones:
  `verification_status` (enum), `empanelment_status` (enum), `teacher_level` (enum/int + `none`).
- **Backfill** once from existing flags (`kyc_*`, `is_empanelled`, `tier`) using the agreed D2–D5 rules.
- **Populate** them from the existing KYC / empanelment-decision / tier-assignment flows (the same code paths that already set `kyc_verified`, `is_empanelled`, `tier`).
- **Write-protect:** never accepted by `PATCH /teachers/me/profile` (teachers cannot self-assign).
- The web then reads these directly (derivation becomes a fallback). Documented in `BACKEND_REQUEST_teacher_status_model.md`.

## 5. What needs your sign-off before I implement Part A
The PRODUCT DECISIONS (D2, D5, D4, D3, D7 in `ACCESS_CONTROL_GAPS.md`) fix the ⚠️ branches above. On your answers I will implement `lib/teacher-status.ts` + the shared BFF guard, refactor the existing checks to it (behaviour-preserving except the agreed decisions), and file the Part B backend request. No code is written until you approve.
