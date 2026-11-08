# Backend spec — Teacher weekly availability schedule

The web app now has a day-and-slot scheduler UI wired to the contract below. It is
LIVE-READY: the moment these two endpoints exist, the scheduler starts saving and
reading real data (no further frontend change needed). Until then the UI loads
empty and shows a friendly "will activate once live" message on save.

## Data model (per teacher)
Add to the teacher record:
```
availability_schedule: {
  timezone: string,                 // IANA, e.g. "Asia/Kolkata" (default from teacher.time_zone)
  slots: {                          // which time-of-day blocks the teacher is open, per weekday
    mon: string[], tue: string[], wed: string[], thu: string[],
    fri: string[], sat: string[], sun: string[]
  }
}
```
Allowed slot block values (exactly these tokens): `"morning"` (06:00–12:00),
`"afternoon"` (12:00–17:00), `"evening"` (17:00–22:00). Empty array = closed that day.

Keep the existing boolean `is_available` as the master on/off (already wired).

## Endpoints (both auth: teacher session; mounted under /api)

### GET /api/teachers/me/availability
Returns the caller's schedule:
```json
{ "available": true,
  "timezone": "Asia/Kolkata",
  "slots": { "mon": ["morning","evening"], "tue": [], "wed": [], "thu": [],
             "fri": ["morning"], "sat": ["morning","afternoon"], "sun": [] } }
```
If never set, return `{ "available": <current is_available>, "timezone": <teacher.time_zone or "Asia/Kolkata">, "slots": {} }`.

### PUT /api/teachers/me/availability
Body (validate strictly; reject unknown day keys / slot tokens):
```json
{ "available": true,
  "slots": { "mon": ["morning","evening"], "fri": ["morning"], "sat": ["morning","afternoon"] } }
```
- Persist `availability_schedule.slots` and set `is_available = available`.
- Missing day keys ⇒ treated as empty (closed).
- Return the saved object in the same shape as GET.

## Expose to the booking flow (so seekers book real open times)
1. Include `availability_schedule` (timezone + slots) in the public teacher payload
   `GET /api/teachers/public/{handle}` so the 1:1 booking screen can grey out closed
   days/blocks.
2. In `POST /api/one-on-one/bookings`, validate the requested `slot_iso` falls on a
   weekday+block the teacher has marked open (using the teacher's timezone). Reject
   otherwise with `409 { detail: "That time is outside the teacher's available slots." }`.

## Notes
- Frontend BFF proxy already built: `GET/PUT /bff/teacher/availability` (session + CSRF)
  forwards to the above. It returns a graceful empty schedule if the endpoints 404,
  so shipping the backend is non-breaking and can be done independently.
