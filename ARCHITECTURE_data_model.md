# PROMPT 39 — Data Model (extend, don't replace)

The backend owns the database and is read-only to the web app. This spec maps every
conceptual entity to what already exists and defines the foreign-key / reference
relationships the backend should maintain. Frontend types (in `lib/server/*.ts`) already
project most of these; new entities are additive.

## Entities & key references (→ = references / FK)

| Entity | Exists today as | Key fields | References |
|--------|-----------------|-----------|-----------|
| **Teacher** | `teachers` (`/teachers/me/profile`, directory) | `user_id`, `handle`, `tier`, `geo` | — |
| **Venue** | `centers` (`/retreats/centers/mine`) + public `venue-partners` | `center_id`, `capacity`, `room_types`, `food_type`, `amenities`, `getting_there` | owner → Teacher.user_id |
| **Retreat** | `retreats` (`/retreats/*`) | `retreat_id`, `status`, `seats_total`, `price_per_seat_inr`, `venue_cost_per_seat_inr`, `platform_fee_pct` | `host_user_id` → Teacher; `center_id` → Venue |
| **RetreatItinerary** | encoded in `retreat.description` (parsed by `retreat-content.ts`) → should become rows | `day`, `category`, `text` | `retreat_id` → Retreat |
| **CancellationPolicy** | section in `description` + `refund-preview` | `tiers[]`, `text` | `retreat_id` → Retreat |
| **RetreatFAQ** | derived from facts (client) → should become rows | `q`, `a` | `retreat_id` → Retreat |
| **RetreatMedia** | `retreat.cover_image` + `images[]` (Object Storage, PROMPT: cover upload) + venue Google photos | `url`, `kind`, `order` | `retreat_id` → Retreat |
| **TeacherCohort** | cohort attribution (`/retreats/{id}/cohort`) | `cohort`, `confirmed_count`, `seats_total` | `retreat_id` → Retreat; `teacher_user_id` → Teacher |
| **CohortInvitation** | `/retreats/{id}/invites` | `invite_id`, `invitee_name`, `status` (added→invited→accepted) | `retreat_id` → Retreat; `cohort` → TeacherCohort |
| **GroupBooking** | `/retreats/{id}/group-book`, `group-bookings` | `group_id`, `group_size`, `organiser` | `retreat_id` → Retreat; `reservation_id` → Booking |
| **Participant** | reservation `name/email/phone` (host-side only) | `user_id?`, `name`, `email`, `phone` | — |
| **Booking** | reservation (`/retreats/{id}/reservations`, `/reserve`) | `reservation_id`, `status`, `group_size`, `attribution{source,cohort,via}` | `retreat_id` → Retreat; `participant` → Participant; `cohort` → TeacherCohort |
| **Payment** | `payment-status`, `mark-paid`, `create-payment-link` | `payment_id`, `amount`, `status`, `provider` | `reservation_id` → Booking |
| **Settlement** | teacher payouts (`/teachers/me/payouts`, ledger) | `settlement_id`, `teacher_net_inr`, `platform_fee_inr` | `retreat_id` → Retreat; `teacher_user_id` → Teacher |
| **TeacherCohortBenefit** | cohort pricing model (`retreat-content.cohortBenefit`) | `model` (A/B/C/D), `flat/pct/everyN`, `amount_inr` | `retreat_id` → Retreat; `cohort` → TeacherCohort |
| **VenueSettlement** | `/retreats/payouts/mine` (escrow/settled) | `venue_settlement_id`, `amount_inr`, `held_in_escrow`, `settled` | `center_id` → Venue; `retreat_id` → Retreat |
| **RetreatInquiry** | waitlist / enquiry (`/retreats/{id}/waitlist`) + "Ask the teacher" | `inquiry_id`, `name`, `email`, `phone`, `message?` | `retreat_id` → Retreat |
| **Wishlist** | client-only today (`lib/saved-retreats.ts`) → should become rows | `user_id`, `retreat_id` | `user_id` → Participant/Teacher; `retreat_id` → Retreat |

## Proposed additive tables (backend)
`retreat_itinerary`, `retreat_faq`, `retreat_media`, `wishlist`, `retreat_inquiry`,
plus **review split** (see PROMPT 43): `retreat_review`, `venue_review` alongside the existing
teacher review store. Also `retreat_review` and `venue_review` reference `booking_id` so only real
participants can review (anti-abuse, PROMPT 42).

## Invariants
- Never replace existing tables — add columns / side tables and backfill.
- Money entities (Payment, Settlement, VenueSettlement, TeacherCohortBenefit) are **append-only** (PROMPT 40).
- Confidential economics (teacher net, venue negotiated terms) never denormalise onto public/participant reads.
