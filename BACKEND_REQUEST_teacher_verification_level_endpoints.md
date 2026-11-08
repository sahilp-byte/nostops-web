# Backend Change Request — ship the Teacher **Verification** & **Level** setters (so the remote record flips)

**Target:** the business backend at `https://pro-learn-connect-1.emergent.host`
**Severity:** P1 — admin decisions persist in NOSTOPS today (local override), but the remote record's own `is_verified` / `tier` never change, so remote-driven logic (KYC gates, any remote badge/eligibility) stays out of sync.
**Frontend status:** ALREADY WIRED. NOSTOPS makes a **best-effort mirror** call to both endpoints on every admin save (see `lib/server/admin-teacher-write.ts`). The calls currently 404 and are ignored. **The moment you ship these two endpoints exactly as specified below, the remote record will start flipping automatically — no NOSTOPS change required.**

> Context: because these endpoints did not exist, NOSTOPS added a local override store (`teacher_status_override`) that is authoritative for NOSTOPS display. Once the remote is the true source again, we can retire/relegate the override — but it is safe to leave in place; it simply reflects the admin's intent.

---

## 1. Endpoint A — Verification

```
POST /api/admin/teachers/{teacher_id}/verification
Auth: admin session (same guard as POST /api/admin/empanelment/{id})
Content-Type: application/json
```

**Request body (exactly what NOSTOPS sends):**
```jsonc
{
  "status": "verified" | "pending" | "not_verified",   // required
  "reason": "string"                                     // optional; present for demotions/notes (<=500 chars)
}
```

**Required effect on the teacher record:**
| status | set `is_verified` | notes |
|---|---|---|
| `verified` | `true` | teacher is a verified NOSTOPS teacher |
| `pending` | `false` | under review; not yet verified |
| `not_verified` | `false` | explicitly not verified / revoked (store `reason`) |

- Persist a `verification_status` string field (`verified` / `pending` / `not_verified`) on the teacher **in addition to** the boolean `is_verified`, so "pending" vs "not_verified" is distinguishable. If you cannot add the string field, at minimum set `is_verified` per the table.
- Optionally record `verification_reason`, `verified_by` (admin id), `verified_at` (epoch ms) for audit.
- Idempotent: re-sending the same status is a no-op success.

**Response:**
```jsonc
{ "success": true, "teacher_id": "...", "is_verified": true, "verification_status": "verified" }
```
Return HTTP 200 on success. Use 4xx with `{ "detail": "..." }` for bad input / not found. (NOSTOPS treats 404/405/501 as "not implemented" and silently falls back — any other non-2xx is surfaced.)

**Note on the existing KYC route:** NOSTOPS also best-effort calls `POST /api/admin/kyc/{id}/approve` (on `verified`) and `POST /api/admin/kyc/{id}/reject` `{reason}` (on `not_verified`). Those only work when a KYC submission exists. This new endpoint MUST work **regardless of whether a KYC submission exists** — an admin can verify a teacher directly.

---

## 2. Endpoint B — NOSTOPS Level (tier)

```
POST /api/admin/teachers/{teacher_id}/level
Auth: admin session
Content-Type: application/json
```

**Request body (exactly what NOSTOPS sends):**
```jsonc
{
  "level": 0 | 1 | 2 | 3,                                   // required
  "tier":  null | "shikshak" | "pracharak" | "guru"          // required; derived from level (see map)
}
```

**Level ⇄ tier ⇄ badge map (authoritative):**
| level | tier | badge (display) |
|---|---|---|
| 0 | `null` | *(no level assigned — clear tier/badge)* |
| 1 | `shikshak` | Yoga Shikshak |
| 2 | `pracharak` | Yoga Pracharak |
| 3 | `guru` | Yoga Guru |

**Required effect on the teacher record:**
- Set the teacher's `tier` (string or null). Level `0` clears the tier (and any derived primary badge).
- If you maintain a numeric `level`, set it too.
- If the teacher directory record carries a `badge_primary` / `badges` field, set it from the map (Yoga Shikshak / Pracharak / Guru), or clear it for level 0.
- Idempotent.

**Response:**
```jsonc
{ "success": true, "teacher_id": "...", "level": 2, "tier": "pracharak" }
```
HTTP 200 on success.

---

## 3. Surfacing on reads (so NOSTOPS can drop the local override later)

For NOSTOPS to treat the remote as the source of truth, please expose the fields on the two existing read endpoints NOSTOPS already consumes:

- `GET /api/teachers/directory` — each teacher object should include `is_verified` (bool), `verification_status` (string, optional), `tier` (string|null), and `badge_primary`/`badges` if used.
- `GET /api/teachers/public/{handle}` — same fields on the returned teacher.

(These are read by the public profile, the public/city directories, and the admin panel.)

---

## 4. Acceptance checks

```
# Verify a teacher who has NO KYC submission → must still flip:
POST /api/admin/teachers/{id}/verification  {"status":"verified"}
  → 200; GET directory shows is_verified=true, verification_status="verified"

# Demote:
POST /api/admin/teachers/{id}/verification  {"status":"not_verified","reason":"Docs expired"}
  → 200; is_verified=false, verification_status="not_verified", reason stored

# Assign level:
POST /api/admin/teachers/{id}/level  {"level":2,"tier":"pracharak"}
  → 200; GET public/{handle} shows tier="pracharak" (badge "Yoga Pracharak")

# Clear level:
POST /api/admin/teachers/{id}/level  {"level":0,"tier":null}
  → 200; tier=null, no level badge

# Both are idempotent (re-send → 200, no change).
```

---

## 5. What NOT to change
- Do not change `POST /api/admin/empanelment/{id}` (empanelment already works and NOSTOPS relies on it).
- No NOSTOPS frontend change is needed — the best-effort mirror calls are already in `setVerification`/`setLevel` (`lib/server/admin-teacher-write.ts`) and will succeed the instant these endpoints return 2xx.
