# PROMPT 37 — Venue + Teacher Repeat-Business Architecture

## Goal
Enable durable Teacher⇄Venue relationships so a venue accumulates a **history** and a
**reputation**, and teachers/venues discover each other based on real track record:

- Teacher hosts Retreat A at Venue X → later Retreat B at Venue X.
- Another Teacher hosts Retreat C at Venue X.
- Venue X develops a history → repeat relationships, reputation, occupancy history,
  teacher recommendations, and venue discovery ranking.

## What is already SHIPPED on the frontend (read-only backend, today)
Derived live from existing endpoints — no new persistence required:

- **Venue track record** (`/venues/{id}`, `data-testid=venue-track-record`): retreats hosted,
  distinct teachers hosted, **teachers who returned** (repeat count > 1), and **average occupancy**
  — all computed from `getRetreatsAtVenue(id)` (`GET /retreats` filtered by venue) + the public seat
  counts. "Returning teacher" badges appear in *Teachers who host here*.
- **Occupancy history**: average fill across the venue's retreats (past + current).
- **Venue discovery**: `/venues` (listing) + `/venues/{id}` (rich SEO page, PROMPT 33) + JSON-LD
  `LodgingBusiness` make each venue an indexable discovery asset. Retreat pages cross-link to the venue;
  the venue page cross-links to upcoming retreats and the teachers who host there.
- **Venue-owner private view** (`/app/venue`): upcoming vs past retreats, occupancy, participant counts,
  cancellations, settlements — scoped strictly to the owner's venues (PROMPT 36).

## What the BACKEND should add to make this first-class (proposed data model)
The frontend can only *derive* history from the current retreat list. To make repeat-business a
durable, rankable asset, the backend (owner of the DB) should persist:

### 1. `venue_history` (append-only per retreat lifecycle)
```
venue_history {
  venue_id, retreat_id, teacher_user_id,
  status,                       # published | completed | cancelled
  seats_total, seats_filled,    # snapshot at completion
  occupancy_pct,                # seats_filled / seats_total at completion
  started_on, ended_on,
  revenue_venue_inr,            # settled venue payout (from ledger)
  created_at
}
```
Powers: retreat history, occupancy history, completed-retreat counts.

### 2. `teacher_venue_relationship` (the repeat edge)
```
teacher_venue_relationship {
  teacher_user_id, venue_id,
  retreats_count, last_hosted_on, first_hosted_on,
  avg_occupancy_pct, total_participants,
  relationship_score           # recency + frequency + occupancy
}
```
Powers: "returning teacher", repeat-relationship strength, "host here again" prompts.

### 3. `venue_reputation` (aggregate, public-safe)
```
venue_reputation {
  venue_id,
  retreats_hosted, teachers_hosted, repeat_teachers,
  avg_occupancy_pct, completed_retreats,
  rating_google, rating_count,  # already available via venue-enrichment
  reputation_score              # composite for discovery ranking
}
```
Powers: venue discovery ranking, trust badges, `/venues` sort order.

### 4. `venue_recommendations` (teacher-facing, private)
For a teacher building a retreat, recommend venues by:
`match(theme, region, capacity) × venue_reputation.reputation_score × (prior relationship boost)`.
Surface in the Host wizard venue-selection step and as "You hosted here before" repeat prompts.

## Privacy invariants (must hold in every surface)
- Venue owners **never** see teacher profit or the teacher's negotiated margin — only their own agreed
  terms + occupancy that affects their rooms, and aggregate participant **counts** (no identities).
- Public venue pages expose only aggregate history + public teacher identity (anti-poaching): never
  student/attendee data, never money terms.

## API additions (suggested, read paths)
- `GET /venues/{id}/history` → completed retreats + occupancy history (public-safe aggregate).
- `GET /venues/{id}/reputation` → the `venue_reputation` row.
- `GET /retreats/venues/recommended?theme=&region=&capacity=` → ranked venues for the host wizard
  (private, teacher-scoped, includes prior-relationship boost).

## Migration note
All frontend surfaces above already read from existing endpoints and will **transparently upgrade**
to these richer fields when the backend adds them (e.g. swap derived `avgOccupancyPct` for
`venue_reputation.avg_occupancy_pct`). No frontend rewrite needed — only field wiring.
