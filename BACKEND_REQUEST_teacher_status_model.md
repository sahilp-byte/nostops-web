# BACKEND REQUEST — Stored Authoritative Teacher Status (optional Part B)

> The web app now derives the authoritative teacher status (Verification / Empanelment / Level) from existing
> read-only fields (see `TEACHER_STATUS_MODEL.md`). This request is the OPTIONAL backend-side upgrade to PERSIST
> the three attributes so they are stored (not derived), removing the "pending"-state ambiguity and the KYC
> flag/timestamp inconsistency we observed. Web cannot implement this (backend is read-only for the agent).

## Why
- No explicit status enum exists today; "pending" must be inferred. `GET /kyc/sandbox/status` returned
  internally inconsistent data for `teacher.demo` (`verified:true`, `kyc_paid_at`/`verified_at` set, yet
  `kyc_verified:false`, `kyc_paid:false`, `pan_verified:false`, `bank_verified:false`). One stored source of
  truth avoids UIs disagreeing.

## Proposed change (ADDITIVE — no new collection, no record duplication)
Add three server-owned fields to the EXISTING teacher document (alongside `kyc_verified`, `is_empanelled`, `tier`):

| Field | Type / values | Set by |
|---|---|---|
| `verification_status` | `'verified' \| 'pending' \| 'not_verified'` | KYC flow (payment + Aadhaar/PAN/Bank checks) |
| `empanelment_status` | `'empanelled' \| 'pending' \| 'not_empanelled'` | empanelment flow (fast-track request + Council decision; free-track merit) |
| `teacher_level` | `'none' \| 1 \| 2 \| 3` (or `'shikshak'/'pracharak'/'guru'` + `'none'`) | tier-assignment flow |

Owner-approved derivation rules to encode:
- `verification_status`: `verified` = KYC identity done **and** ₹799 paid; `pending` = any KYC step started but not finished; else `not_verified`.
- `empanelment_status`: `empanelled` = `is_empanelled`; `pending` = a fast-track request awaiting decision **or** free-track merit in progress; else `not_empanelled`.
- `teacher_level`: from `tier`; a newly onboarded teacher with no tier ⇒ **Level 1 (Shikshak)** (default), with `none` reserved for future use.

## Requirements
1. **Backfill** existing teachers once from current flags (`kyc_*`, `is_empanelled`, `tier`) using the rules above.
2. **Populate** from the same code paths that already set `kyc_verified` / `is_empanelled` / `tier`.
3. **Write-protect:** never accepted by `PATCH /teachers/me/profile` (teachers must not self-assign). Keep the three as SEPARATE attributes — do not collapse into one status.
4. Expose them on `GET /teachers/me/native-profile` (and `/teachers/dashboard`).
5. Fix the `kyc/sandbox/status` flag/timestamp inconsistency (booleans should agree with the recorded timestamps).

## Web-side follow-up (once available)
`lib/teacher-status.ts` will read these stored values directly and fall back to derivation only when absent — no other web change required.
