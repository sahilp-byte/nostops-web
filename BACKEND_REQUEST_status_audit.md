# Backend request — Teacher status audit trail (Prompt 29)

The web app needs an authoritative audit log for admin changes to a teacher's
**Verification**, **Empanelment** and **Teacher Level**. The web layer already
captures previous → new value + admin identity + timestamp and is ready to read
and write these two endpoints. Until they ship, the web app shows an honest
"activates when live" state and forwards writes best-effort (a missing endpoint is
a harmless no-op).

Auth: both endpoints are **admin-only** (same guard as the existing
`/admin/teachers/*` and `/admin/empanelment/*` routes).

## 1. Read — history for one teacher

```
GET /admin/teachers/{teacher_id}/status-history
```

Response (any of these shapes is accepted; the web app normalizes them):

```json
{
  "entries": [
    {
      "field": "level",                 // "verification" | "empanelment" | "level"
      "from": 1,                          // previous value (see value formats below)
      "to": 2,                            // new value
      "admin_name": "Riya Admin",        // who changed it
      "admin_id": "user_...",            // optional
      "at": "2026-09-10T04:00:00Z"        // ISO 8601 (UTC ok; UI renders IST)
    }
  ]
}
```

Accepted field aliases (the web normalizer reads the first present):
- field:        `field` | `attribute` | `type`
- previous:     `from` | `previous` | `previous_value` | `old` | `old_value`
- new:          `to` | `new` | `new_value` | `value`
- admin:        `admin_name` | `changed_by_name` | `changed_by` | `actor_name` | `actor`
- timestamp:    `at` | `timestamp` | `created_at` | `changed_at`

A bare JSON array (no `entries` wrapper) or a `history` key are also accepted.
Order does not matter — the web app sorts newest-first.

### Value formats
- `verification`: `"verified" | "pending" | "not_verified"`
- `empanelment`:  `"empanelled" | "pending" | "not_empanelled"`
- `level`:        integer `0..3` (0 = no level) **or** `"none"`. The UI maps these
  to "Yoga Shikshak / Pracharak / Council Guru" labels.

## 2. Write — append one entry (best-effort from the web layer)

```
POST /admin/teachers/{teacher_id}/status-history
Content-Type: application/json

{
  "field": "level",
  "from": 1,
  "to": 2,
  "admin_id": "user_...",
  "admin_name": "Riya Admin",
  "at": "2026-09-10T04:00:00Z"
}
```

Called once per persisted, changed field immediately after the corresponding
setter (`/admin/empanelment/{id}`, `/admin/teachers/{id}/verification`,
`/admin/teachers/{id}/level`) succeeds. Return `2xx` on success. If the backend
prefers to derive the audit entry itself inside those setters, that is also fine —
just implement the GET and the web app will display it (the POST becomes redundant
but harmless).

## Where it appears
Admin → Teachers → open a teacher → **"Status change history"** card
(`data-testid="status-audit-trail"`), rendering e.g.:

> **Teacher Level**  Yoga Shikshak → Yoga Pracharak
> Changed by **Riya Admin** · 10 September 2026, 09:30 IST
