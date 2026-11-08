# PROMPT 42 — Anti-Abuse (simple, transparent, teacher-friendly)

Goal: stop gaming of referrals, bookings, attribution, cancellations and reviews **without**
making the system hostile to genuine teachers. Controls are simple and explained to the user.

## Controls matrix

| Abuse vector | Rule | Enforcement | Web-app status |
|--------------|------|-------------|----------------|
| **Self-referral** | A user cannot refer themselves (same account / same verified phone/email) | Backend (referral service) + FE guard | FE: block entering your own code / self as invitee, with a clear message |
| **Duplicate accounts** | Detect same phone/email/device signing up repeatedly to farm rewards | Backend (identity graph) | FE: rely on backend; surface "already registered" clearly |
| **Artificial bookings** | Reservations that never pay shouldn't earn attribution/rewards | Backend: rewards only on **paid** bookings; holds expire | ✅ FE already treats only `paid` as confirmed; holds show expiry |
| **Circular referral** | A→B→A reward loops | Backend: referral graph cycle check | Backend |
| **Double attribution** | One participant attributed to two cohorts/teachers | Backend: first-touch wins, idempotent on `reservation_id` | FE: send a single `attribution` per reserve; never re-attribute an existing booking |
| **Repeated cancellation abuse** | Book→cancel→rebook to manipulate seat scarcity / refunds | Backend: cancellation rate limits + refund policy tiers | FE: cancellation policy + acknowledgements (PROMPT 24) shown before booking |
| **Fake reviews** | Reviews from non-participants | **Reviews only after a completed retreat by a real participant** | ✅ FE: review UI gated to completed retreats (PROMPT 43/44); backend should bind review→`booking_id` |
| **Fabricated cohort members** | Inflating a cohort with non-real people | Backend: cohort counts derive from real reservations, not free-typed names | ✅ FE: cohort funnel counts come from reservations, not manual entry |

## Frontend guards shipped now (simple + transparent)
- **Review-after-completion gate**: the post-retreat review experience (`/app/reservations/{id}/complete`)
  only opens its review forms when the retreat has ended; otherwise it shows
  "Reviews open after your retreat finishes." (fake-review + non-participant prevention, visible to user).
- **Single attribution**: the reserve flow attaches at most one `attribution {source, cohort, via}`;
  it never rewrites an existing booking's attribution (double-attribution prevention).
- **Paid-only confirmation**: everywhere, only `paid` bookings count as confirmed/earning; unpaid holds
  expire — artificial (never-paying) bookings can't inflate metrics or rewards.
- **Self-referral messaging**: referral surfaces explain that you can't refer yourself and rewards land
  only when a referred friend actually books & pays.

## Post-audit hardening applied (this session)
- **Fail-closed retreat ownership** (`lib/server/retreat-host.ts`): the manage-screen guard now denies when a `userId` is supplied and the retreat's owner id is missing OR mismatched (previously it only denied on an explicit mismatch). Owners always carry `host_user_id`/`guru_id`, so this never locks a host out of their own retreat, but it removes any dependency on the backend to withhold a foreign host's data.
- **Media proxy `X-Content-Type-Options: nosniff`** (`app/bff/media/[...path]/route.ts`): prevents any stored object from being sniffed as HTML.

## Backend to-do (flagged, not frontend-fixable)
- **Teacher review POST** (`/public-reviews/{handle}`) should require an authenticated, verified participant bound to a completed `booking_id`, plus per-identity/IP rate limiting — the strongest fake-review defense lives server-side. The web app already gates the review UI to completed retreats and does not submit unauthenticated in the post-retreat flow.

