# PROMPT 40 — Audit Trail (immutable economic events)

Every important economic event must be auditable and **financial history must never be
overwritten**. The backend owns money movement, so the immutable log must live server-side;
this spec defines it and lists what the web app already surfaces read-only.

## Immutable event log (append-only) — proposed backend table `audit_event`
```
audit_event {
  event_id        (uuid, pk)
  event_type      (enum, below)
  actor_user_id   (who triggered it)
  actor_role      (teacher | venue_owner | participant | admin | system)
  retreat_id?     booking_id?  reservation_id?  cohort?  center_id?
  amount_inr?     currency?
  before_json?    after_json?      # snapshot for value changes (never edit in place)
  created_at      (immutable)
  correlation_id  (groups a settlement run, a refund, etc.)
}
```
- **Append-only**: corrections are new compensating events (e.g. `cohort_benefit_reversed`), never edits.
- Money events carry `amount_inr` + `before/after` snapshots so history reconstructs exactly.

## Event types to record (all from the prompt)
| Event | Emitted when | Existing hook |
|-------|-------------|---------------|
| `retreat_created` | `POST /retreats/create` | ✅ |
| `retreat_price_changed` | `PATCH /retreats/{id}` price/venue-cost | ✅ (before/after) |
| `cohort_created` | first cohort attribution / cohort link created | ✅ `/retreats/{id}/cohort` |
| `invitation_generated` | `POST /retreats/{id}/invites` | ✅ |
| `participant_attributed` | reserve with `attribution.source=cohort` | ✅ `/reserve` |
| `booking_created` | `POST /retreats/{id}/reserve` / `group-book` | ✅ |
| `payment_received` | `mark-paid` / provider webhook | ✅ |
| `booking_cancelled` | `reservations/{id}/cancel` | ✅ |
| `refund_issued` | `cancel-with-refund` | ✅ (refund-preview) |
| `cohort_benefit_calculated` | at booking/settlement using `TeacherCohortBenefit` | derive |
| `cohort_benefit_reversed` | on cancel/refund of a cohort booking | derive (compensating) |
| `teacher_settlement` | payout run (`/teachers/me/payouts`) | ✅ |
| `venue_settlement` | escrow→settled (`/retreats/payouts/mine`) | ✅ |

## What the web app already surfaces (read-only, today)
- **Per-retreat Settlement Ledger** (`SettlementLedger.tsx`, PROMPT 23): every reservation as a
  participant→platform/venue/teacher line, with settled vs refunded, reconciling only over collected
  money — an auditable, non-destructive view.
- **Attribution audit trail** (`ReservationsManager.tsx`, PROMPT 19): reserved/paid/cancelled lifecycle
  + cohort attribution per reservation.
- **Teacher Group Dashboard** economics roll-up (PROMPT 35) and **Venue Owner** settlements (PROMPT 36).
- Generic user activity: `POST /user/activity/log` + `GET /user/activity/recent` exist and can back a
  visible "Activity" timeline once economic events are logged to it.

## API additions (suggested, read)
- `GET /retreats/{id}/audit` (host + admin) → the retreat's economic events.
- `GET /admin/audit?type=&from=&to=` (admin) → global economic audit.
- `GET /me/settlements` (teacher) and `GET /venues/{id}/settlements` (owner) → immutable settlement history.

## Invariants
- No UPDATE/DELETE on money rows; only INSERT of new (possibly compensating) events.
- Reads are role-scoped (PROMPT 41): a teacher's audit never exposes another teacher's economics;
  a venue owner's audit shows only their venue settlements, never teacher profit.
