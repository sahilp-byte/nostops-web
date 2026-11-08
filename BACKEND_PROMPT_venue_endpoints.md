# Backend Implementation Prompt — Venue Center endpoints (fix + contract)

Copy everything below into your backend repo / backend coding agent.

---

You are working on the NOSTOPS FastAPI backend. There is a **production-blocking bug**:
`POST /api/retreats/centers` ("Create Center") returns **HTTP 500 for every eligible owner**,
even for the minimal valid body `{ "name", "city", "capacity" }`. Validation passes (a schema
violation would return 422), so the exception is **inside the handler after validation** — most
likely the DB insert, a unique-index conflict, or the handler reading an owner/attribute field
that is not populated. Fix the root cause and make the four venue-center endpoints below behave
exactly as specified. Do not change unrelated routes.

## Auth & eligibility (all endpoints)
- Require a valid authenticated session (same auth used elsewhere).
- Owner eligibility for writes = same rule as `GET /retreats/host-eligibility` (`eligible == true`,
  i.e. Level 2/Level 3 teachers and Council Gurus). If not eligible → `403` with a clear message.
- A user may only read/update **their own** centers.

## 1) POST /api/retreats/centers  — Create Center
Request model `CenterCreateReq` (already defined):
- required: `name` (str), `city` (str), `capacity` (int, 1–1000)
- optional: `address` (str), `state` (str), `pincode` (str), `amenities` (str[]),
  `food_type` (str), `room_types` (str[]), `photos` (str[]), `distinguishing_feature` (str),
  `open_to_partnerships` (bool, default true)

Behaviour:
- Trim/clip strings; coerce `capacity` to int and validate 1–1000 (else `422`).
- Generate a stable `center_id`, set `owner_id` from the session user, `is_active = true`,
  timestamps `created_at`/`updated_at`.
- Persist to the centers collection. **Wrap the DB write in try/except, log the full traceback,
  and never leak a bare 500** — on an unexpected failure return `502` with
  `{"detail": "Could not create the venue."}`.
- On success return `201` with the created center object (see shape below).

## 2) GET /api/retreats/centers/mine  — list my centers
- Return `{ "items": [<center>, ...], "count": <int> }` for the session owner, newest first.

## 3) GET /api/retreats/centers/{center_id}  — get one (owner only)
- `404` if not found or not owned by the caller. Return `{ "center": <center> }`.

## 4) PATCH /api/retreats/centers/{center_id}  — edit (owner only)
- Accept any subset of the create fields plus `is_active` (bool). Only update provided fields.
- Validate `capacity` if present (1–1000). `404` if not found/owned. Return the updated center.

## Canonical center object (response shape the frontend expects)
```json
{
  "center_id": "string",
  "name": "string",
  "city": "string",
  "state": "string | null",
  "address": "string | null",
  "pincode": "string | null",
  "capacity": 30,
  "amenities": ["wifi", "yoga_hall"],
  "food_type": "sattvic | null",
  "room_types": ["single", "twin_share"],
  "photos": ["<url>"],
  "distinguishing_feature": "string | null",
  "open_to_partnerships": true,
  "is_active": true
}
```

## Acceptance criteria
- `POST /api/retreats/centers` with `{ "name": "Test", "city": "Pune", "capacity": 20 }` returns
  `201` and a center with a `center_id` (no more 500).
- The created center immediately appears in `GET /retreats/centers/mine`.
- `PATCH` updates persist; `GET /{center_id}` reflects them.
- Non-eligible users get `403`; cross-owner access gets `404`.
- All DB operations are wrapped with error handling + traceback logging; no unhandled 500s.

## Notes / migration
- The web app currently has a temporary local fallback that stores venues with ids prefixed
  `loc_` while this endpoint is down. Once this is fixed, those `loc_*` centers are not known to
  the backend — either accept a one-time re-create of them via this endpoint or ignore (they are
  few, from the outage window).
