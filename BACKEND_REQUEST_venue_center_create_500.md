# BACKEND REQUEST — `POST /retreats/centers` returns HTTP 500 (blocks all venue creation)

## Severity: HIGH (production-blocking)
Every eligible venue owner (Level 2/3 + Council) gets **"Could not create the venue."**
Reported by a Yoga Guru (Level 3) from Nepal; reproduced for the demo Guru too.

## Reproduction (remote API, admin/owner bearer)
```
POST /api/retreats/centers
Authorization: Bearer <session_token of an eligible owner>
Content-Type: application/json
{ "name": "Test Venue", "city": "Pune", "capacity": 20, "open_to_partnerships": true }
→ HTTP 500  "Internal Server Error"
```
- `GET /retreats/host-eligibility` → `{"eligible": true, "host_type": "teacher_guru", ...}` ✅
- `GET /retreats/centers/mine` → `{"items": [], "count": 0}` ✅ (200)
- `POST /retreats/centers` → **500 for EVERY payload**, including the minimal `{name, city, capacity}`.

Because minimal valid input also 500s, the failure is an **unhandled exception inside the
handler AFTER validation** (not a 422 / not payload-specific / not Nepal-specific). Likely a
DB write or a downstream call throwing. Please add error handling + fix the root cause and
return the created center (`center_id`, ...).

## Confirmed root cause (from the live OpenAPI schema)
`POST /api/retreats/centers` → operationId **"Create Center"**, request model **`CenterCreateReq`**:
- `required`: `["name", "city", "capacity"]`
- properties: name, city, address, state, pincode, capacity, amenities, food_type, room_types, photos, distinguishing_feature, open_to_partnerships (default true)

Our request **matches this schema exactly** and passes validation (a schema violation would return 422, not 500). Therefore the exception is **inside the `Create Center` handler, after validation** — e.g. the DB insert, a unique-index conflict, or the handler reading an attribute/owner field that isn't populated. Please wrap the handler in proper error handling, log the traceback, fix the failing operation, and return the created center.

## Interim mitigation already shipped (frontend)
To unblock owners, the Next.js BFF now tries the remote first and, on a 5xx/404, falls back to
a **local venue-centers store** (`backend/venues.py`, local Mongo `venue_centers`, ids prefixed
`loc_`). These appear in the owner's Venue Studio and are editable. When this remote endpoint is
fixed, the remote-first path resumes automatically and new venues use the remote again.

### Follow-up once remote is fixed
Locally-created `loc_*` centers are not known to the remote, so remote-side retreat listings /
partnerships that reference a `center_id` won't see them. A small migration to re-create the
`loc_*` centers via the fixed endpoint (or accept `loc_*` ids) may be desired.
