# Backend request — public "city coordinator" lookup (for the City Coordinator Spotlight)

## Why
The new **City Yoga Community** pages (`/yoga-teachers/{city}`) should feature the
local **City Coordinator** — their name, city and a short story — to build trust
and local identity ("who looks after yoga in this city"). This is the last piece
of that page; everything else (teacher discovery, traditions, purposes, retreats,
venues, corporate CTA, FAQ, SEO) already ships from real data.

Today the web app **cannot** build this because there is **no public, read-only
endpoint** that returns a city's coordinator with public-safe fields. The web app
never invents data, so the section is intentionally omitted until this exists.

## Evidence (read-only checks against the live API, 2026-09)
- `GET /api/coordinators/me` → **401** (authenticated coordinator only — unusable
  for a public, logged-out city page).
- `GET /api/coordinators/nearby?latitude=19.033&longitude=73.02&radius_km=50`
  → `{"coordinators": [], "count": 0}` — geo-based, and it needs lat/lng that the
  public teacher directory does **not** expose (teacher `location.lat/lng` are
  `null`), so it returns nothing for real cities.
- `GET /api/coordinators/city/{slug}`, `/coordinators/by-city/{slug}`,
  `/cities/{slug}/coordinator`, `/coordinators/public`, `/seo/coordinators`
  → **404 / 405** (no such route).
- `GET /api/teachers/public/{handle}` → exposes **no** coordinator name/story
  (no `coordinator_*` keys).
- The public directory row carries `city_coordinator_id` (e.g. Navi Mumbai's
  Anjali Teacher has `city_coordinator_id: "coord_933cbe84ad79"`), but there is
  no endpoint to resolve that opaque id to a public coordinator profile.

## Requested change (backend only — web app needs no other change)
Add a **public, unauthenticated, read-only** endpoint keyed by city:

```
GET /api/coordinators/city/{city_slug}
```

- `{city_slug}` is the lowercase, hyphenated city slug the site already uses
  (e.g. `navi-mumbai`, `bangalore`), matching the directory `city` field.
- Returns `200` with the coordinator (or `null` / `404` when a city has none).

### Suggested PII-safe response shape
Return **only** public-safe fields (see privacy constraints below):

```json
{
  "city": "Navi Mumbai",
  "city_slug": "navi-mumbai",
  "coordinator": {
    "name": "Anjali Teacher",
    "teacher_handle": "anjali-teacher",   // optional: links to public profile if they teach
    "avatar_url": "https://.../a.jpg",     // optional
    "since": "2026-01",                     // optional (month/year appointed)
    "story": "A short public bio / why they coordinate yoga in Navi Mumbai.",
    "teacher_count": 3                      // optional: teachers they support in the city
  }
}
```

If a city has no coordinator, return `{"city": "...", "coordinator": null}` (or `404`).

## Privacy / teacher-first constraints (must hold)
- **No PII**: never include the coordinator's email, phone, WhatsApp, address,
  payout/KYC/bank details, or `user_id`. Name + optional avatar + short story only.
- **Anti-poaching (core ethos)**: do **not** include any student roster, attendee
  lists, other teachers' student/contact data, or booking history in this payload.
  The `teacher_count` (aggregate number) is fine; individual teacher PII is not.
- The `story` must be a coordinator-authored public bio, not scraped private notes.

## What the web app will do once this exists
The City page will render a **City Coordinator Spotlight** card automatically:
name + avatar + story + (if `teacher_handle` present) a link to their public
teacher profile, and a "teachers they support" count. No further backend changes
needed — the web app will fetch this endpoint server-side (PII-safe projection)
and hide the section whenever `coordinator` is `null`.

## Credentials for verification
Public endpoint — no auth required. Coordinator demo account for cross-checking
the data: `teacher.demo@nostops.com` / `<demo-password>` (is a City Coordinator for Pune).
