# BACKEND REQUEST (P49 privacy) — Don't expose venue negotiated rate / platform fee in PUBLIC retreat payload

**Severity:** P2 — confidentiality (Product Principles #13 & the P49 assertion
"Participant does NOT see venue negotiated rate").
**Environment:** `https://pro-learn-connect-1.emergent.host`

## Finding (verified live, 2026-06)
The **unauthenticated** `GET /api/retreats/{id}` response includes:
```
price_per_seat_inr        (OK — this is the participant price, meant to be public)
platform_fee_pct          (leaked — NOSTOPS↔teacher economics)
venue_cost_per_seat_inr   (leaked — the Teacher↔Venue negotiated rate)
```
For most current retreats `venue_cost_per_seat_inr` is `0` (no partnership economics set), so the practical
exposure is small today — but as soon as a real negotiated venue rate is stored, it is visible to anyone who
reads the public JSON.

## Why this matters
- **Product Principle #13**: "Teacher–Venue commercial negotiations remain confidential."
- **PROMPT 49**: "Participant does NOT see venue negotiated rate."

## Fix
- Remove `venue_cost_per_seat_inr` and `platform_fee_pct` from the **public/unauthenticated** retreat read.
- Keep them only on **authenticated, ownership-scoped** reads (the host's own retreat, the venue owner's own
  listing, admin) — where the web app already uses them for economics.

## Frontend status
The web app **never renders** `venue_cost_per_seat_inr` or `platform_fee_pct` to participants — the public
retreat page and the reserve flow show only the participant seat price. So the UI honours the principle; this
request is purely to stop the raw API from carrying confidential fields to unauthenticated clients.
