# BACKEND REQUEST — Admin setters for Teacher VERIFICATION and LEVEL (authoritative record)

Status: **requested** (frontend is built + wired to this exact contract; both controls light up automatically the moment these ship)
Consumer: Admin Teacher Review screen `/app/admin/teachers/[id]` → BFF `POST /bff/admin/teachers/[id]/status`
Related (ALREADY LIVE, no change needed): `POST /api/admin/empanelment/{teacher_id}` `{ "is_empanelled": bool }` — used for the Empanelment control today.

## Why
The admin Teacher Review panel now has write controls for three INDEPENDENT attributes:
Verification, Empanelment and Teacher Level (Prompts 9–12). Empanelment already persists
via the existing endpoint. Verification and Level have **no direct setter** today:
- `PATCH /api/admin/people/teachers/{id}` only accepts name/city/email/phone/experience_years/bio/is_active.
- `POST /api/admin/empanelment/{id}` only reads `is_empanelled` (ignores `is_verified`/`tier`).
- `POST /api/admin/kyc/{id}/approve|reject` flips `kyc_verified` for teachers with a pending KYC
  submission — it is NOT a general `is_verified` toggle (approve is a no-op when there is no pending
  submission). The frontend uses it as a best-effort fallback but needs the dedicated endpoints below.

RULE (must hold): Verification and Empanelment are **completely independent**. Do NOT auto-empanel a
verified teacher, and do NOT auto-verify an empanelled one. Persist against the EXISTING teacher
record (no new collection). Teachers must never be able to set these themselves (admin-only).

## 1) Set Verification
```
POST /api/admin/teachers/{teacher_id}/verification
Body: { "status": "verified" | "pending" | "not_verified", "reason"?: string }
```
Behaviour:
- `verified`      → set `is_verified = true`.
- `not_verified`  → set `is_verified = false`  (accept optional `reason`, store on an audit trail).
- `pending`       → set `is_verified = false` AND set a `verification_status = "pending"` marker
                    (an optional string field) so the UI can show Pending distinctly from Not Verified.
                    If you prefer not to add a marker field, treat `pending` == `not_verified` and say so.
- Return: `{ "success": true, "teacher_id": "...", "is_verified": bool, "verification_status"?: "..." }`
- Admin-only (403 otherwise). Do NOT touch `is_empanelled`, `tier`, or `kyc_*`.

## 2) Set Teacher Level
```
POST /api/admin/teachers/{teacher_id}/level
Body: { "level": 0 | 1 | 2 | 3, "tier"?: "shikshak" | "pracharak" | "guru" | null }
```
Level ↔ tier ↔ badge mapping (canonical, from lib/teacher-levels.ts):
| level | tier      | badge_primary   |
|-------|-----------|-----------------|
| 0     | null / "" | (clear)         |
| 1     | shikshak  | Yoga Shikshak   |
| 2     | pracharak | Yoga Pracharak  |
| 3     | guru      | Yoga Guru       |
Behaviour:
- Set `tier` (and `badge_primary`) per the table. `level: 0` clears the tier/badge
  ("No Level Assigned"). The frontend sends both `level` and the derived `tier`; honour `level`
  as the source of truth (use `tier` only as a hint).
- Return: `{ "success": true, "teacher_id": "...", "tier": "...", "level": n }`
- Admin-only. Do NOT change verification or empanelment. Level stays independent.

## Frontend contract already implemented
- BFF `POST /bff/admin/teachers/[id]/status` (admin-gated + CSRF) accepts any subset of
  `{ verification, verificationReason, empanelment, level }` and calls:
  - empanelment → `POST /admin/empanelment/{id}` (LIVE).
  - verification → tries `POST /admin/teachers/{id}/verification` first; on 404/405/501 falls back to
    `POST /admin/kyc/{id}/approve` (verified) / `POST /admin/kyc/{id}/reject` (not_verified, reason≥10).
  - level → tries `POST /admin/teachers/{id}/level`; on 404/405/501 reports an honest
    "activates when live" state.
- A 404/405/501 from the two new endpoints is treated as "not implemented yet" (honest pending UI),
  anything else is surfaced as a real error. Ship the two endpoints above and BOTH controls persist
  with zero frontend changes.

## Acceptance
- Admin sets Verification=Verified on a teacher → `is_verified=true` persists across refresh / re-login / navigation.
- Admin sets Level=Level 2 → `tier=pracharak`, `badge_primary=Yoga Pracharak` persists; directory + public
  profile reflect Level 2.
- Verification and Empanelment can be changed independently (neither cascades to the other).
- Non-admins get 403; teachers have no path to set any of these.

---

## COPY-PASTE PROMPT FOR THE BACKEND TEAM

> **Task: Add two admin-only setters on the authoritative teacher record — Verification and Level — mirroring the existing Empanelment setter.**
>
> Context: The NOSTOPS admin Teacher Review screen already sets **empanelment** via the existing
> `POST /api/admin/empanelment/{teacher_id}` (`{ "is_empanelled": bool }`). We now need the SAME
> capability for **verification** and **teacher level**. These three attributes are INDEPENDENT and
> must never cascade into each other (do NOT auto-verify an empanelled teacher; do NOT auto-empanel a
> verified one). Admin-only (return 403 for any non-admin). Persist on the EXISTING teacher document —
> do NOT create a new collection. Add an audit-log entry for each change if you have one.
>
> ### Endpoint 1 — Set Verification
> ```
> POST /api/admin/teachers/{teacher_id}/verification
> Body: { "status": "verified" | "pending" | "not_verified", "reason"?: string }
> ```
> - `verified`     → set `is_verified = true`
> - `not_verified` → set `is_verified = false` (store optional `reason` on the audit trail)
> - `pending`      → set `is_verified = false` and set an optional string field
>                    `verification_status = "pending"` so the UI can distinguish Pending from
>                    Not Verified. (If you'd rather not add that field, treat `pending` == `not_verified`.)
> - Response: `{ "success": true, "teacher_id": "<id>", "is_verified": <bool>, "verification_status"?: "<str>" }`
> - Must NOT touch `is_empanelled`, `tier`, `badge_primary`, or any `kyc_*` field.
>
> ### Endpoint 2 — Set Teacher Level
> ```
> POST /api/admin/teachers/{teacher_id}/level
> Body: { "level": 0 | 1 | 2 | 3, "tier"?: "shikshak" | "pracharak" | "guru" | null }
> ```
> Canonical level ↔ tier ↔ badge mapping:
> | level | tier      | badge_primary  |
> |-------|-----------|----------------|
> | 0     | null      | (clear both)   |
> | 1     | shikshak  | Yoga Shikshak  |
> | 2     | pracharak | Yoga Pracharak |
> | 3     | guru      | Yoga Guru      |
> - Set `tier` and `badge_primary` per the table. `level: 0` clears tier+badge ("No Level Assigned").
> - Treat `level` as the source of truth; `tier` in the body is only a hint.
> - Response: `{ "success": true, "teacher_id": "<id>", "tier": "<str|null>", "level": <int> }`
> - Must NOT change verification or empanelment.
>
> ### Auth & errors
> - Both endpoints: admin session required → 403 for non-admins. 404 if `teacher_id` doesn't exist.
> - Return normal FastAPI validation (422) for bad `status`/`level` values.
>
> ### Acceptance
> 1. Admin sets Verification=Verified on a teacher → `is_verified=true` persists across refresh /
>    re-login / navigation. Setting Not Verified sets it back to false. Pending is distinguishable.
> 2. Admin sets Level=Level 2 → `tier=pracharak`, `badge_primary=Yoga Pracharak` persist; Level 0 clears them.
> 3. Verification and Empanelment change independently — neither cascades to the other.
> 4. Non-admins get 403; teachers have no path to set any of these.
>
> Note: the NOSTOPS web frontend is ALREADY wired to these exact routes (it currently probes them and
> falls back gracefully while they 404). No frontend change is needed — both admin controls persist
> automatically the moment these two endpoints go live.
