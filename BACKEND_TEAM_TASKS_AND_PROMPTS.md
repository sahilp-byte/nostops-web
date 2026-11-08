# NOSTOPS — Backend Team: Task List + Agent Prompts

> Consolidated hand-off for the **FastAPI + MongoDB backend team** at
> `https://pro-learn-connect-1.emergent.host`.
> The web app is read-only against this backend; every item below needs a **backend/data change**.
> Each task has: **why**, **exact change**, **acceptance**, and a **copy-paste agent prompt**.
> Verification account (teacher): `teacher.demo@nostops.com` / `<demo-password>`.
> Council guru: `guru.demo@nostops.com` / `<demo-password>`. Admin: `admin.demo@nostops.com` / `<demo-password>`.

---

## PRIORITY OVERVIEW

| # | Task | Priority | Type | Source doc |
|---|------|----------|------|-----------|
| 1 | Remove the ₹500 minimum retreat price | 🔴 P1 | Product principle | `BACKEND_REQUEST_no_minimum_price.md` |
| 2 | Backfill `platform_fee_pct = 15` for Council-Guru retreats | 🔴 P1 | Financial correctness | `BACKEND_REQUEST_council_guru_fee.md` |
| 3 | Stop leaking venue cost / platform fee in PUBLIC retreat payload | 🟠 P2 | Privacy | `BACKEND_REQUEST_privacy_public_payload.md` |
| 4 | Cashfree go-live: 3 flows (KYC / booking / wallet) + return URL | 🟠 P2 | Payments | `BACKEND_PROMPT_cashfree*.md` |
| 5 | Grant `admin.demo` an Admin persona | 🟠 P2 | Auth/data | `BACKEND_REQUEST_admin_persona.md` |
| 6 | Teacher weekly availability schedule endpoints | 🟡 P2 | Feature (FE ready) | `BACKEND_REQUIREMENTS_availability_schedule.md` |
| 7 | Teacher geolocation (lat/lng, nearby search, coordinator pins) | 🟡 P3 | Feature (FE ready) | `BACKEND_REQUIREMENTS_geolocation.md` |
| 8 | Widget analytics & source attribution | 🟡 P3 | Feature (FE ready) | `BACKEND_REQUIREMENTS_widget_analytics.md` |
| 9 | Waitlist → Seat: seeker endpoints (my-waitlist / notify / convert) | 🟡 P3 | Feature (FE ready) | `test_credentials.md` (contract) |
| 10 | Sitemap over-listing (45 orphan / 35 TEST retreat URLs) | 🟢 P3 | Data hygiene | `test_result.md` |
| 11 | Teacher public display NAME is an email string | 🟢 P3 | Data quality | `test_result.md` |
| 12 | Embed badge HTML hardcodes `nostops.com/mission` | 🟢 P3 | Cosmetic | `BACKEND_REQUIREMENTS_widget_analytics.md` |
| 13 | Delete QA artifacts (no delete API today) | 🟢 P3 | Cleanup | `test_credentials.md` |
| 14 | (Optional) teacher-referrals leaderboard + link-click counts | ⚪ P4 | Feature | `BACKEND_REQUIREMENTS_widget_analytics.md` |

---

# ===== AGENT PROMPTS (paste one block per task to your backend agent) =====

Every prompt assumes: *"You are working on the NOSTOPS FastAPI + MongoDB backend at
`https://pro-learn-connect-1.emergent.host`. Do not break existing flows. Keep secrets server-side.
Add/extend tests. Reply with the verification results."*

---

## PROMPT 1 — Remove the ₹500 minimum retreat price 🔴 P1

```
Remove the platform-imposed minimum retreat price. Product Principle #4 states "There is no
NOSTOPS-imposed minimum retreat price," but POST /api/retreats/create currently rejects any
price_per_seat_inr < 500 with:
  422 {"type":"greater_than_equal","loc":["body","price_per_seat_inr"],"ctx":{"ge":500}}

Change:
- Remove the ge=500 Pydantic constraint (and any equivalent >=500 service check) on
  price_per_seat_inr in BOTH the retreat CREATE and EDIT/PATCH schemas.
- Keep only a sane floor of >= 0 (or >= 1 if a positive integer is required). Do NOT enforce any
  platform minimum above that. A teacher must be free to set any price (incl. donation-based / very low).
- If a payment gateway has a technical minimum (e.g. < ₹1), enforce it at the payment step and label it
  a gateway limitation, NOT a NOSTOPS price rule.

Acceptance:
- POST /api/retreats/create {..., price_per_seat_inr: 1}  -> 200 (created)
- PATCH /api/retreats/{id}  {price_per_seat_inr: 50}      -> 200
Verify with teacher.demo@nostops.com. Reply with the two status codes.
```

---

## PROMPT 2 — Backfill Council-Guru platform fee (15%) 🔴 P1

```
For host_type == "council_guru", the retreat platform fee must be 15% (same as empanelled L2
teacher_pracharak). GET /api/retreats/host-eligibility already returns 15 for guru.demo (fixed).
BUT per-retreat stored values were NOT backfilled: GET /api/retreats/my-hosted and
GET /api/retreats/{id} still return platform_fee_pct: 0 (≈23 of 31 guru retreats) or null (≈8) for
existing council_guru retreats. Settlement/payout math reads these stored values, so payouts are wrong.

Change:
1. Backfill platform_fee_pct = 15 on ALL existing council_guru retreats (data migration).
2. Ensure NEW guru retreats persist platform_fee_pct = 15 at create time (align with teacher_pracharak).
3. Recompute derived money fields (host_net_inr on reservations, venue payable, escrow/settlement)
   for council_guru so ledgers agree with the 15% fee.
4. Fix the fee-resolution map/branch so host_type "council_guru" -> 15 everywhere it is emitted OR used
   in money math (host-eligibility, my-hosted, retreats/{id}, payouts/mine, escrow/settled).

Acceptance (as guru.demo@nostops.com):
- GET /api/retreats/host-eligibility -> platform_fee_pct == 15
- GET /api/retreats/my-hosted        -> platform_fee_pct == 15 on every retreat
- GET /api/retreats/{id} (guru-owned)-> platform_fee_pct == 15
- A guru retreat reservation host_net_inr == participant_amount − 15% − venue_cost.
Reply with counts of backfilled retreats and the three status/values above.
```

---

## PROMPT 3 — Stop leaking venue cost / platform fee publicly 🟠 P2

```
The UNAUTHENTICATED GET /api/retreats/{id} response currently includes two confidential fields:
  - venue_cost_per_seat_inr  (the Teacher<->Venue negotiated rate)
  - platform_fee_pct         (NOSTOPS<->teacher economics)
This violates Product Principle #13 ("Teacher–Venue commercial negotiations remain confidential") and
the P49 assertion ("Participant does NOT see venue negotiated rate"). price_per_seat_inr is the
participant price and SHOULD stay public.

Change:
- Remove venue_cost_per_seat_inr and platform_fee_pct from the PUBLIC/unauthenticated retreat read.
- Keep them ONLY on authenticated, ownership-scoped reads (the host's own retreat, the venue owner's
  own listing, admin), where economics are legitimately needed.

Acceptance:
- Anonymous GET /api/retreats/{id} -> response has NO venue_cost_per_seat_inr and NO platform_fee_pct.
- Authenticated host GET of their own retreat -> both fields still present.
Reply with the anonymous JSON keys for one retreat proving the fields are gone.
```

---

## PROMPT 4 — Cashfree go-live: KYC + booking + wallet + return URL 🟠 P2

```
Cashfree Payments is integrated but running in MOCK mode on THIS host
(https://pro-learn-connect-1.emergent.host): POST /api/payments/cashfree/orders returns "mode":"mock".
The web frontend already has the full checkout foundation (create-order BFF, status BFF,
/cashfree-return page, <CashfreePayButton>) wired to your contracts and is waiting on the backend.
Do NOT change these request/response field names, do NOT break the existing Razorpay KYC path, verify
webhook signatures, keep secrets server-side, and make every business state change idempotent on the
Cashfree webhook (never trust the client). COMMIT AND DEPLOY to the exact host above.

TASK 0 — Go-live + return URL:
- Read production creds from env/secret (CASHFREE_APP_ID, CASHFREE_SECRET_KEY) + CASHFREE_ENV
  (sandbox/production) which also drives the returned "mode". Never hardcode/return the secret.
  Production App ID (provided): 1361249f58d46386df83dcd77819421631 ; Secret cfsk_ma_prod_… (private).
- Fix the return-URL host bug (redirect currently lands on the API host and 404s when app+api are on
  different hosts). Either drive the base from WEB_APP_BASE_URL (e.g. https://www.nostops.org ->
  {WEB_APP_BASE_URL}/cashfree-return?order_id=...) OR accept an optional return_url on
  POST /api/payments/cashfree/orders (and /api/v1/payments/orders).
- Keep sandbox mock working when CASHFREE_ENV=sandbox.

TASK 1 — InstaKYC ₹799 via Cashfree:
- On a PAID Cashfree webhook where order_type=="instakyc" (reference_id==teacher_id, amount==799),
  set the same kyc_paid state that POST /api/kyc/sandbox/verify-payment reads today. Keep Razorpay KYC
  intact. Idempotent (replaying the webhook must not double-mark).

TASK 2 — 1:1 booking create + pay -> confirm:
- Add POST /api/one-on-one/bookings {teacher_id, slot_iso, learner_name, learner_phone, note?}
  (learner session) -> creates a PENDING_PAYMENT booking, returns {booking_id, amount, teacher_name,
  slot_iso}.
- POST /api/v1/payments/orders {booking_id, student_email, student_phone, amount} -> Cashfree order
  tied to that booking, returns checkout_url (+ web_return_url per Task 0).
- On PAID webhook -> booking CONFIRMED, visible in GET /api/one-on-one/my-bookings (learner) and the
  teacher's sessions. On FAILED/EXPIRED -> release the slot. Idempotent.

TASK 3 — Wallet top-up via Cashfree:
- Accept order_type=="wallet_topup" (customer_id==teacher_id, amount==N). On PAID webhook -> credit the
  teacher wallet and add a wallet_topup transaction in /wallet/transactions. Idempotent per order_id.

Acceptance (run against https://pro-learn-connect-1.emergent.host and reply with results + the
create-booking contract):
1. POST /api/payments/cashfree/orders returns mode:"production" (non-mock) on this host.
2. PAID instakyc order flips /api/kyc/sandbox/verify-payment paid:true.
3. PAID wallet_topup order increases /api/teacher-wallet/balance + adds a transaction.
4. POST /api/one-on-one/bookings exists (share exact request/response + how booking_id links to
   /api/v1/payments/orders); PAID booking order -> CONFIRMED in /api/one-on-one/my-bookings.
5. web_return_url points at the WEB app origin (WEB_APP_BASE_URL) OR create-order accepts return_url.
```

---

## PROMPT 5 — Grant admin.demo an Admin persona 🟠 P2

```
The web app routes each signed-in account to its dashboard by the persona auth returns. Four of five
demo accounts land correctly; admin.demo@nostops.com does NOT — it has only a "teacher" persona, so it
opens the teacher dashboard instead of the admin console.

Evidence (read-only, live):
- POST /api/auth/login (admin.demo) -> user.role = "teacher"
- GET /api/auth/personas/mine (admin.demo) -> only {"role":"teacher"}; no admin persona
- POST /api/auth/login-by-role {"role":"admin", ...} -> role_mismatch

Change (backend/data only — no frontend change needed):
Attach an "admin" persona to admin.demo@nostops.com so that:
1. GET /api/auth/personas/mine includes a persona with role:"admin", and
2. POST /api/auth/login-by-role {role:"admin"} (or default POST /auth/login) returns user.role="admin".

Acceptance: verify with admin.demo@nostops.com / <demo-password> -> personas include admin and login-by-role
admin returns role:"admin". Reply with the personas/mine output.
```

---

## PROMPT 6 — Teacher weekly availability schedule 🟡 P2

```
Add a teacher weekly availability schedule. The web app already has a day+slot scheduler UI wired to the
contract below (BFF GET/PUT /bff/teacher/availability), waiting on these endpoints.

Data model (per teacher):
  availability_schedule: {
    timezone: string,               // IANA, default from teacher.time_zone or "Asia/Kolkata"
    slots: { mon:string[], tue:string[], wed:string[], thu:string[], fri:string[], sat:string[], sun:string[] }
  }
Allowed slot tokens ONLY: "morning" (06:00–12:00), "afternoon" (12:00–17:00), "evening" (17:00–22:00).
Empty array = closed that day. Keep the existing boolean is_available as master on/off.

Endpoints (teacher session, under /api):
GET /api/teachers/me/availability -> { available, timezone, slots }. If never set, return
  { available:<is_available>, timezone:<teacher.time_zone or "Asia/Kolkata">, slots:{} }.
PUT /api/teachers/me/availability body { available, slots } -> validate strictly (reject unknown day
  keys / slot tokens), persist availability_schedule.slots, set is_available=available, missing days =
  closed, return the saved object in the GET shape.

Booking integration:
- Include availability_schedule (timezone+slots) in public GET /api/teachers/public/{handle} so the 1:1
  booking screen can grey out closed days/blocks.
- In POST /api/one-on-one/bookings, validate slot_iso lands on an open weekday+block (teacher timezone);
  else 409 {detail:"That time is outside the teacher's available slots."}.

Acceptance: PUT then GET round-trips the same slots; unknown token/day -> 422; public handle payload
carries availability_schedule; a booking outside open slots -> 409. Reply with a GET sample.
```

---

## PROMPT 7 — Teacher geolocation (coords, nearby, coordinator pins) 🟡 P3

```
Add coordinates to unlock true distance discovery + maps. The web app already does city-name geo and is
ready to wire distance the moment these ship.

1) Store coords on the teacher:
   location: { lat:number|null (-90..90), lng:number|null (-180..180), city:string, area?:string, geohash?:string }
   Accept lat, lng, area on the existing profile PATCH; recompute geohash on save. In ANY public payload,
   round lat/lng to ~2–3 decimals (~1 km) for privacy — never full precision publicly.

2) Public nearby search:
   GET /api/teachers/nearby?lat=..&lng=..&radius_km=25&limit=48
   -> same PII-safe teacher shape as /teachers/directory PLUS distance_km, sorted ascending. Only
   is_available + empanelled/public teachers WITH coords. radius_km default 25, max 200.

3) Include rounded location.lat/lng (+area) in GET /api/teachers/public/{handle} and
   GET /api/teachers/directory.

4) City Coordinator pins & radius:
   Coordinator record: pin:{lat,lng}, radius_km (default 25), service_areas:[{lat,lng,radius_km,label}].
   GET /api/coordinators/me/dashboard -> include pin, radius_km, coverage:{teacher_count, empanelled_count,
   cities:string[]} computed from coords inside pin/radius. Auto-attach empanelled teachers to a coordinator
   when their coords fall in the radius (replacing exact city-string match).

Acceptance: profile PATCH with lat/lng persists + geohash set; /teachers/nearby returns distance-sorted
PII-safe results; public payloads carry rounded coords; coordinator dashboard returns pin+coverage.
```

---

## PROMPT 8 — Widget analytics & source attribution 🟡 P3

```
The web "My Widgets" teacher growth system shows every metric you expose today, but cannot show
view/click + source attribution because no capability exists. The frontend never fabricates these — it
shows an honest "Not yet tracked" panel. Add:

1) Event ingestion (NEW, public, unauthenticated, high-volume, abuse-resistant, NO visitor PII):
   POST /api/teachers/{handle}/track
   { event:"profile_view|widget_view|widget_click",
     widget:"identity|profile|verified|book|group|organisation|qr|email|social|embed|referral",
     source:"whatsapp|instagram|facebook|linkedin|email|website|qr|nostops|direct",
     ts:"ISO-8601 (server may set)" }
   source derivable from a ?src= param the widgets append. Rate-limit/dedupe per IP+session.

2) Aggregated read (NEW, teacher session):
   GET /api/teachers/me/widget-analytics?range=30d ->
   { totals:{profile_views,widget_views,widget_clicks,ctr},
     by_source:[{source,views,profile_visits,enquiries,bookings}],
     by_widget:[{widget,views,clicks,profile_visits}],
     individual_vs_organisation:{individual_visits,organisation_visits} }

3) (Optional) tag one-on-one/premium-session enquiry records with the originating source from #1 and
   surface it in #2 by_source[].enquiries/bookings.

Also cosmetic: the embed badge HTML from GET /api/embed/... hardcodes "nostops.com/mission" — change to
"www.nostops.org/mission".

Acceptance: POST track records an event (no PII); GET widget-analytics returns the shape above with real
counts. Reply with a sample analytics payload.
```

---

## PROMPT 9 — Waitlist → Seat (seeker side) 🟡 P3

```
Today's waitlist is host-facing only. Verified live contract:
- POST /api/retreats/{id}/waitlist (PUBLIC) {name,email,phone} -> 400 "Seats are still available…"
  unless SOLD OUT; on success {ok, already_on_list, position}.
- GET /api/retreats/{id}/waitlist (HOST-ONLY, 401 anon) -> {waitlist:[{waitlist_id,name,email,phone,
  status,created_at}], count}. Ownership enforced (anti-poaching safe).
- POST /api/retreats/{id}/reserve (AUTH) accepts attribution {source:'waitlist'}.
Missing (so the seeker "grab a freed seat" loop can't be automated): a seeker "my waitlist" list, a
seat-open notification, and a waitlist->seat convert endpoint.

Add (all seeker-session, anti-poaching safe — a seeker sees only THEIR OWN waitlist rows, never other
seekers or the host's roster):
1) GET /api/me/waitlist -> retreats the caller is waitlisted on, each with {retreat_id, position,
   status, seats_available_now:boolean}.
2) POST /api/retreats/{id}/waitlist/claim -> if a seat is now free AND the caller is on the waitlist,
   atomically convert to a reservation (source:'waitlist') and remove them from the waitlist; else
   409 {detail:"No seat available yet."}. Idempotent / race-safe (no overselling).
3) (Optional) a notify hook / flag so a freed seat can alert the next waitlisted seeker in position order.

Acceptance: seeker on a sold-out waitlist sees seats_available_now flip true when a seat frees; claim
converts exactly one seat with no oversell; a second concurrent claim -> 409. Reply with the two payloads.
```

---

## PROMPT 10 — Sitemap over-listing (orphan/TEST retreats) 🟢 P3

```
The public SEO sitemap over-lists retreats. Backend GET /api/seo/sitemap.xml emits ~65 retreat URLs, but
GET /api/retreats returns total=20 public retreats. ~45 are orphans (≈35 TEST-titled + ~10 real) reachable
ONLY via the sitemap — they should not be indexed.

Change: emit in /api/seo/sitemap.xml ONLY retreats that are public + indexable (status in
published/filling/sold_out AND not TEST/unpublished/hidden) — the same set /api/retreats returns. Exclude
TEST-titled and non-public retreats.

Acceptance: sitemap retreat <loc> count == public retreat count from /api/retreats; no TEST_* retreat URLs
in the sitemap. Reply with before/after counts.
(Frontend note: the web app already drops non-indexable TEACHER URLs from its own /sitemap.xml, but the
retreat list is taken from your backend feed, so this fix must be server-side.)
```

---

## PROMPT 11 — Teacher public display NAME is an email 🟢 P3

```
Data quality: at least one teacher's public display NAME is an email string (e.g.
"rishikeshyog@kendra.com"), so it renders as Person.name on the public directory/profile and in JSON-LD.
Fix the underlying teacher record's display name to a proper human/studio name (data correction), and
consider validating on profile save that `name` is not an email address. Not a privacy leak (the field is
already public), but it looks broken and pollutes SEO.

Acceptance: no teacher in /api/teachers/directory has an email-formatted name. Reply with the corrected
record id + new name.
```

---

## PROMPT 12 — Embed badge hardcoded label 🟢 P3

```
Cosmetic: the embed badge HTML returned by GET /api/embed/... hardcodes the display label
"nostops.com/mission". Change the hardcoded string to the canonical "www.nostops.org/mission".
Acceptance: embed badge HTML shows www.nostops.org/mission.
```

---

## PROMPT 13 — Delete QA artifacts (no delete API today) 🟢 P3

```
During web QA we created test records but there is NO unpublish/delete API, so please remove these
server-side (or add a delete endpoint). All are harmless (not in public feeds / not discoverable), owner
approved leaving them, but clean removal is preferred:

Retreats (owner teacher.demo): rt_1cf46fdf0f ("QA L2 host allowed check"), rt_d96a28cb70 ("QA Wizard
Full-Field Retreat").
Center (owner guru.demo): ctr_0c01674df73d ("QA Guru Center (delete me)").
Reservation: rs_3482291683 on rt_e8715c9ed0 (employee.demo) + its hosted payment link.
Waitlist entry: wl_fdf63b619eea48 on sold-out rt_1a7b25b9bd ("QA Waitlist DeleteMe").
Invite: rin_2ff7f4c13c ("QA Invite DeleteMe" / +919990001234) on rt_67e770b5c5.
Object storage (unreferenced): nostops/retreats/_qa/probe.txt, nostops/retreats/_qa/cover.jpg, and orphan
covers under nostops/retreats/user_1f18960aeaba/.

Acceptance: the above ids no longer resolve. Reply with what was removed.
```

---

## PROMPT 14 — (Optional) Teacher-referral leaderboard + link clicks ⚪ P4

```
The teacher-invite program GET /api/teacher-referrals/dashboard exposes a per-teacher tier ladder +
invited/kyc_verified/empanelled counts + wallet (all shown in the Referral widget), but NOT:
1) A cross-teacher ranking FOR THIS program. (GET /api/referrals/leaderboard is a different generic
   program and must not be conflated.) Add GET /api/teacher-referrals/leaderboard -> [{rank, name,
   empanelled_referrals, tier}] + the caller's own rank.
2) Raw invite-link click/visit counts. GET /api/teacher-referrals/track/{code} only validates a code.
   Expose link_clicks / link_visits in the dashboard so the widget can show link-level reach.
Acceptance: leaderboard returns ranked teachers + my rank; dashboard includes link_clicks. Reply with a
sample leaderboard row.
```

---

## Cross-cutting reminders for every task
- Do **not** change request/response field names the frontend already uses.
- Verify against the exact host `https://pro-learn-connect-1.emergent.host` and confirm changes are
  **deployed** there (a prior Cashfree round was "done" in code but not live on this host).
- Keep all payment/business mutations idempotent and driven by verified webhooks; never trust the client.
- Never expose secrets, bearer tokens, or visitor PII. Aggregate-only analytics.
- Anti-poaching (core ethos): never surface one teacher's students/roster/contacts to another teacher.
