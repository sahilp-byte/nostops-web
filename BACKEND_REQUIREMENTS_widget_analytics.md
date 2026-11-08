# Backend Requirements — Widget Analytics & Attribution (for the FastAPI/backend team)

The web **My Widgets** Teacher Growth System (`/app/teacher/widgets`) already renders every metric the
backend exposes today (individual + organisation funnel, reputation, referral earnings, city demand).
The **only** thing it cannot show is view/click + source attribution, because **no backend capability
exists for it**. Per our contract the frontend never fabricates these numbers — it shows an honest
"Not yet tracked" panel instead. To turn those charts on, the backend needs the following.

Frontend is READY: the moment these endpoints exist, the "Where are people finding you?" and widget
performance charts can be wired in with no data-model guessing.

---

## 1. Event ingestion — record a widget/profile interaction

**Endpoint required (NEW):** `POST /api/teachers/{handle}/track`  (public, unauthenticated, high-volume)

**Request data required:**
```json
{
  "event": "profile_view | widget_view | widget_click",
  "widget": "identity | profile | verified | book | group | organisation | qr | email | social | embed | referral",
  "source": "whatsapp | instagram | facebook | linkedin | email | website | qr | nostops | direct",
  "ts": "ISO-8601 (server may set)"
}
```
- `source` should be derivable from a short `?src=` param the widgets already can append (e.g. the
  share/QR links can carry `?src=whatsapp`). The backend records the event against the teacher.
- Must be abuse-resistant (rate-limit / dedupe per IP+session) and must store NO PII about the visitor.

**Current limitation:** no event/impression store exists; nothing records profile visits or widget taps.

**Feature affected:** the funnel's top of the funnel (REACH → WIDGET VIEW → WIDGET CLICK → PROFILE VISIT).

---

## 2. Aggregated analytics — read back for the teacher dashboard

**Endpoint required (NEW):** `GET /api/teachers/me/widget-analytics?range=30d`

**Response data required:**
```json
{
  "totals": { "profile_views": 0, "widget_views": 0, "widget_clicks": 0, "ctr": 0.0 },
  "by_source": [ { "source": "whatsapp", "views": 0, "profile_visits": 0, "enquiries": 0, "bookings": 0 } ],
  "by_widget":  [ { "widget": "profile", "views": 0, "clicks": 0, "profile_visits": 0 } ],
  "individual_vs_organisation": { "individual_visits": 0, "organisation_visits": 0 }
}
```

**Current limitation:** no read model; `GET /api/dashboards/teacher-stats` has demand signals but no
per-teacher view/click/source data.

**Feature affected:**
- "Where are people finding you?" source breakdown (§13)
- Per-widget performance (Identity/Booking/Organisation views→clicks→enquiries) (§19)
- Individual vs Organisation demand split at the TOP of the funnel (§14) — the bottom of the funnel
  (bookings/students/earnings) is already shown from real data.

---

## 3. (Optional) Enquiry attribution join

To connect a source to an actual enquiry/booking (REACH → … → BOOKING → INCOME by source), tag the
existing one-on-one / premium-session enquiry records with the originating `source` captured in #1, and
surface it in #2's `by_source[].enquiries/bookings`.

**Current limitation:** enquiry/booking records carry no acquisition source.

---

### Notes
- Do NOT expose visitor identities. Aggregate counts only (§13, §25).
- No FastAPI/Mongo change was made by the web app — this is a spec for the backend team.
- Also cosmetic (backend-owned): the embed badge HTML rendered by `GET /api/embed/...` hardcodes the
  display label `nostops.com/mission`; update it to the canonical `www.nostops.org/mission`.

---

## 4. (Optional) Cross-teacher referral leaderboard & raw link clicks

The **teacher invite program** (`GET /api/teacher-referrals/dashboard`) exposes a per-teacher **tier ladder**
(Bronze→Silver→Gold→Ambassador) + conversion counts (invited / kyc_verified / empanelled) + wallet — all of
which the Referral widget now shows. It does NOT expose:
- **A cross-teacher ranking** for THIS program. `GET /api/referrals/leaderboard` is a DIFFERENT (generic
  "mission"/employee) referral system and does not reflect teacher-invite data, so we do not use it here.
  Needed: `GET /api/teacher-referrals/leaderboard` (rank, name, empanelled_referrals, tier) + my rank.
- **Raw invite-link click/visit counts** for the teacher. `GET /api/teacher-referrals/track/{code}` only
  validates a code for the landing page; it returns no per-teacher visit tally. Needed: expose
  `link_clicks` / `link_visits` in the dashboard so the widget can show link-level reach.

**Feature affected:** a comparative "top-inviting teachers" leaderboard and link-click reach on the Referral
widget. (Shipped instead: the real tier-rank progression + invited/verified/empanelled conversion counts.)
