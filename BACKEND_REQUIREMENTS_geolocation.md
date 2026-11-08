# Backend spec — Teacher geo-location (lat/lng, nearby search, coordinator pins)

The web app already does **city-name** geo (Discover "near you", `/cities/[city]`,
coordinator city roster). To unlock true distance-based discovery + maps, the
backend needs coordinates. This is the frontend-ready contract.

## 1) Store coordinates on the teacher
Add to the teacher record (all optional, filled during onboarding/profile edit):
```
location: {
  lat: number|null,          // -90..90
  lng: number|null,          // -180..180
  city: string,              // existing
  area?: string,             // neighbourhood/locality (optional, display only)
  geohash?: string           // optional, for fast bucketed queries
}
```
Accept these on the existing profile update (add to the profile PATCH schema):
`lat`, `lng`, `area`. Recompute `geohash` server-side on save. Never expose exact
lat/lng of a teacher publicly at full precision — round to ~2–3 decimals (~1 km)
in any public payload for privacy.

## 2) Nearby search endpoint (public)
`GET /api/teachers/nearby?lat=..&lng=..&radius_km=25&limit=48`
→ same teacher shape as `/teachers/directory` (PII-safe whitelist) PLUS
`distance_km: number`, sorted ascending by distance. Only include teachers who
are `is_available`, empanelled/public, and have coordinates. `radius_km` default 25,
max 200.

## 3) Include coords in existing public payloads
Add rounded `location.lat/lng` (+ `area`) to `GET /api/teachers/public/{handle}`
and `GET /api/teachers/directory` so the map + distance labels render.

## 4) City Coordinator pins & radius
Coordinators already reference "within 25 km of your pin". Formalise:
- Coordinator record: `pin: { lat, lng }`, `radius_km` (default 25), and allow
  multiple `service_areas: [{ lat, lng, radius_km, label }]` for multi-area coords.
- `GET /api/coordinators/me/dashboard` → include `pin`, `radius_km`, and a
  `coverage: { teacher_count, empanelled_count, cities: string[] }` computed from
  teachers whose coordinates fall inside the pin/radius (not just exact city string).
- Auto-attach empanelled teachers to a coordinator when their coordinates fall in
  the coordinator's radius (replaces today's exact city-string match).

## Frontend readiness
When these ship, the frontend will add: a "Use my location" GPS button (needs a
maps/geocoding provider — deferred), map pins on Discover + teacher profiles, a
"within X km" radius slider, and a coordinator coverage map. No backend rework
needed beyond the above.
