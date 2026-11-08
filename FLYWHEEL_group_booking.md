# PROMPT 38 — Group Booking Flywheel → Feature Mapping

The flywheel is the core product loop. Each stage below maps to a shipped surface, so the
concept is not just a diagram — it is wired into the product. Visualised for users on the
public **`/how-it-works`** page and inside the private **Teacher Group Dashboard**
(`/app/teacher/dashboard`) via `components/marketing/GroupBookingFlywheel.tsx`.

| # | Flywheel stage | Where it happens in the product |
|---|----------------|---------------------------------|
| 1 | Teacher selects a venue | Host wizard venue step + `/venues` discovery; partnerships (`/app/venue`) |
| 2 | Teacher negotiates venue economics | Partnerships model (owner share / rental / guest fee) — `PartnershipActions`, `venue-owner.ts` |
| 3 | Teacher creates a retreat | `HostRetreatWizard` → `POST /retreats/create` |
| 4 | Teacher sets the participant price | Wizard pricing step + `retreat-rate-context` guidance |
| 5 | Teacher creates a cohort | `CohortManager` / `MinimumCohort` — cohort attribution + minimum-cohort |
| 6 | Teacher invites students / group | `InviteManager` (add → invite), **Bring Your Group** landing `/retreats/{id}/group` |
| 7 | Participants book | Reserve flow `POST /retreats/{id}/reserve`; group-book; **Seat Progress** momentum bar |
| 8 | Venue receives occupancy + service revenue | Venue Owner dashboard — occupancy, expected revenue, settlements (PROMPT 36) |
| 9 | Teacher earns teaching + retreat income | `RetreatEconomics` + **Teacher Group Dashboard** private economics (PROMPT 35) |
| 10 | NOSTOPS earns platform fee | Platform fee % in economics + settlement ledger (`SettlementLedger`) |
| 11 | Participants experience the retreat | The retreat itself; cancellation policy + acknowledgements (PROMPT 24) |
| 12 | Reviews are generated | Public reviews mapped to retreat/teacher; Review/AggregateRating JSON-LD (PROMPT 32) |
| 13 | Teacher reputation increases | Teacher profile + directory ranking; reviews on `/teachers/{handle}` |
| 14 | Venue reputation increases | **Venue track record** (retreats hosted, repeat teachers, occupancy) — PROMPT 37 |
| 15 | Teacher returns | `teacher_venue_relationship` (proposed) + "You hosted here before" repeat prompts |
| 16 | Venue hosts more retreats | Venue listings grow; upcoming-retreats history on `/venues/{id}` |
| 17 | More teachers discover the venue · more participants discover NOSTOPS | SEO surfaces: `/venues`, `/retreats`, `/how-it-works`, structured data (PROMPTS 32–33) |
| ↻ | The loop repeats, stronger | Reputation + occupancy history compound → better discovery → more demand |

## Actor colour legend (in the visual)
- **Teacher** (teal) · **Venue** (purple) · **NOSTOPS** (amber) · **Participant** (slate) · **Reputation** (emerald)

## Why this is a flywheel (not a funnel)
Stages 12–17 feed back into stages 1–7: every completed retreat raises teacher + venue reputation,
which improves discovery, which brings more participants and more teachers, which fills more venues —
so each turn of the loop needs less push than the last.
