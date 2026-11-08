# HOST YOUR RETREAT — Prompt 1 Audit (read-only; nothing modified)

Date: 2026-06 (fork). Scope: Next.js web app at /app/frontend + live backend contract
(https://pro-learn-connect-1.emergent.host, 610 endpoints). **The FastAPI/remote backend and its
MongoDB are READ-ONLY for this agent — I cannot add/change backend endpoints, DB schema, or backend
authorization. Any such need is flagged to the BACKEND TEAM.** `/app/backend` is only a thin passthrough proxy.

Governing ethos (source of truth, see PRD "CORE ETHOS"): Teacher-First; NOSTOPS must never enable
**student poaching**. Every part of Host Your Retreat must be reviewed against this.

## 0) Teacher levels & the L1 exclusion (verified live)
- GET /retreats/host-eligibility → `{eligible, host_type, host_name, host_handle, platform_fee_pct}`.
  host_type ∈ `teacher_shikshak` (L1), `teacher_pracharak` (L2), `teacher_guru` (L3).
- GET /teachers/me/retreat-rate-context → `{tier, level:1|2|3, label:"Yoga Pracharak · Level 2",
  hourly_min_inr, hourly_max_inr, suggested_price_per_seat_low/high, cooperative_note}`.
- Rule: **only L2 Pracharak + L3 Guru may Host**. L1 Shikshak excluded.
- Where enforced today:
  - Backend: `host-eligibility` returns `eligible:false` for L1 (authoritative gate; create/edit/cohort/group
    mutations presumably re-check server-side — **MUST be verified with an L1 token; I can't create one**).
  - Frontend: `/app/teacher/retreats/new` server-redirects if `!eligible`. List page shows a "path to hosting"
    empty-state for ineligible.
  - GAPS: create BFF route does not itself re-check eligibility (relies on backend); nav "Retreats" is shown to
    all teachers; no UI for edit/cohort/group/partnership yet (so no gate there yet). Level names not surfaced.

## 1) Existing architecture by participant

### A. TEACHER (host)  — backend: MOSTLY COMPLETE · frontend: PARTIAL
Backend:
- Eligibility/pricing: host-eligibility, teachers/me/retreat-rate-context, teachers/me/commission-tier,
  retreats/settings/platform (`platform_fee_pct:15`, currency INR/USD/EUR/GBP, capacity 1–500).
- Create: POST /retreats/create — RetreatCreateBody (RICH): title, theme, start/end_date, venue_name/city/state,
  venue_lat/lng, venue_description, venue_hero_image, how_to_get_there, weather_notes, what_to_carry[],
  nearby_attractions[], youtube_tour_url, description, seats_total, price_per_seat_inr,
  **venue_cost_per_seat_inr, venue_partner_id**, audience_tags[], cover_image, images[], inclusions[], tier,
  framings[], pre_ramp_content, post_sanskara_content, **cohort_curated, cohort_persona_mix[], cohort_seniority,
  cohort_language, cohort_notes**.
- Manage: GET /retreats/{id}, PATCH /retreats/{id}, /edit-lock, /reservations (returns counts+revenue),
  /refund-preview, reservations {cancel, cancel-with-refund, mark-paid, create-payment-link, cohort-decision}.
- Lists/payouts: /retreats/my-hosted, /retreats/listings/mine, /retreats/payouts/mine, teacher-wallet/*.
- Peer/network invites: /retreats/{id}/invite-peer (invitee_teacher_id), /retreats/{id}/invites (create/list/
  delete/mark-invited), /retreats/invitations/mine + accept/decline.
Frontend (built): lib/server/retreat-host.ts (eligibility, base location, my-hosted, detail+edit-lock+reservations+
counts+revenue, ownership guard). Pages: /app/teacher/retreats (list, eligibility-aware empty state),
/new (eligibility-gated create), /[id] (manage: reservations, revenue, edit-lock, RetreatShare).
CreateRetreatForm + EditRetreatForm capture only a SUBSET (title/desc/venue/dates/seats/price/coords/inclusions/
audience + new Google-maps venue link). Wallet page exists.
Frontend (missing): rate-context/level display; venue_cost_per_seat, venue_partner_id, cohort_*, framings,
images/cover, pre_ramp/post_sanskara in create/edit; peer-invite UI; payout/fee-waterfall detail.

### B. VENUE OWNER (center)  — backend: COMPLETE · frontend: NONE
Backend:
- Centers: POST /retreats/centers (CenterCreateReq: name, city, address, state, pincode, capacity, amenities[],
  food_type, room_types[], photos[], distinguishing_feature, open_to_partnerships), GET centers/mine,
  GET centers/discoverable, PATCH centers/{id}.
- Owner listings: POST /retreats/listings/owner-create (center_id, title, theme, starts_on/ends_on, seats_total,
  price_per_seat_inr, curriculum, inclusions[], early_bird_seats, early_bird_price_inr), GET listings/mine.
- Venue enrichment for centers: venue-enrichment/centers/{id}/connect|disconnect|venue|photo. GET /venue-partners.
- Teacher↔owner partnerships: POST /retreats/{id}/partnerships (PartnershipInviteReq: partner_email, partner_name,
  **model, owner_share_pct, guest_fee_inr, rental_inr, rental_owner_share_pct**, note); partnerships incoming/
  outgoing; {pid}/accept, /counter, /decline, DELETE {pid}.
Frontend: NONE. No venue-owner role, no centers UI, no partnership UI. Public pages show only Google venue
enrichment (reviews/photos) — not the NOSTOPS "center/venue-owner" object.

### C. PARTICIPANT / GROUP  — backend: COMPLETE · frontend: WAITLIST ONLY
Backend:
- Individual reserve: POST /retreats/{id}/reserve (ReserveBody: name,email,phone + sponsor, company_name, dietary,
  emergency_contact, notes, nomination_token, karma_redeem_coins, nominee_persona, cohort_fit_note, attribution).
- Payment: reservations/{rid}/create-payment-link; GET /retreats/reservation/{rid}/payment-status; Cashfree
  (POST /payments/cashfree/orders, GET checkout/{order_id}, orders/{id}, refunds, webhook, diag, mock-checkout);
  Razorpay (create-order/verify/callback/webhook); v1/payments (orders/checkout/return/status/webhook).
- Group (teacher-led / org): POST /retreats/{id}/group-book (GroupBookingBody: group_size, organisation_name/type,
  contact_*), GET /retreats/{id}/group-quote, /group-bookings, GET /retreats/{id}/cohort,
  reservations/{rid}/cohort-decision, group-booking-agreements {generate, mine, {id}, accept, decline}.
- Waitlist: GET/POST /retreats/{id}/waitlist.
Frontend (built): public retreat detail "Reserve your seat" CTA only routes to /login?next=/app (DEAD-END, no
booking). EnquiryForm → /bff/retreats/{id}/waitlist (waitlist only, shown when sold out). Cashfree rails exist
(components/payments/CashfreePayButton, CashfreeReturn, /bff/payments/cashfree/orders, /cashfree-return page) but
NOT wired to retreat reserve. NO reserve/group-book/group-quote/payment-link BFF for retreat participants.

## 2) Fee waterfall / economics (current)
- Platform fee: flat **15%** on retreats (settings/platform). Host keeps 85% (shown in create/manage).
- Commission-tier (org batch delivery, separate system): 70/30 pilot → 80/20 (3mo) → target 85/15; 1:1 = 85/15.
- 3-way split (participant → platform 15% → teacher/venue per PARTNERSHIP model owner_share_pct/guest_fee/rental).
  Backend already returns per-reservation `host_net_inr`. **No frontend surface for the 3-way waterfall.**
- Min price: no hard floor in settings; backend gives cooperative SUGGESTED bands per level (invariant across
  cities). CreateRetreatForm currently hard-codes client min ₹500 — arbitrary, should align to rate-context bands.

## 3) Google / AI / SEO / Notifications (reuse as-is)
- Google Places/Reviews/Photos: venue-enrichment connect/venue/photo for retreats AND centers. Teacher connects via
  Create form venue link → /bff/teacher/retreats/{id}/venue → backend connect. Public detail renders reviews+photos.
- NOSTOPS AI: backend nostops_ai_summary (admin/schedule-gated) + OUR fallback lib/server/venue-insight.ts (Emergent
  LLM, cached 24h) so the insight shows immediately. Also teachers/ai-bio-suggest, home/guru-ai/chat.
- Public retreat pages + SEO: /retreats, /retreats/[id], /retreats/in/[city]; /api/seo/retreat/{id} JSON-LD; sitemap;
  ISR. Reuse; do not regress noindex/canonical rules.
- Notifications/WhatsApp: /notifications/*, /twilio/* (test-whatsapp, cohort-onboard, hr-pilot-invite),
  home/whatsapp-share-tracked; RetreatShare component shares public links. In-app notifications page exists.

## 4) Reusable components/modules (do NOT rebuild)
- Auth/BFF: lib/server/session.ts (backendFetch + bearer cookie + getSessionUser), lib/server/bff.ts (badOrigin
  CSRF), proxy.ts (CHIPS + CSRF meta), lib/auth-client.ts (postBff/sendBff).
- Retreat data: lib/server/retreats.ts (public projection + venue enrichment mapper), lib/server/retreat-host.ts
  (host layer), lib/server/venue-insight.ts (AI fallback).
- UI: CreateRetreatForm, EditRetreatForm, RetreatShare, RetreatCard, RetreatsExplorer, RetreatGallery, VenueReviews,
  EnquiryForm; payments CashfreePayButton/CashfreeReturn + /bff/payments/cashfree/*; nav-config.ts; roles.ts.

## 5) Required DATABASE changes
- By this agent: **NONE** (no local DB; backend Mongo is read-only). 
- Backend team (only if the final spec needs new persisted fields beyond what RetreatCreateBody/Center/Partnership
  already store — none identified yet): TBD. Current models already cover teacher tiers, retreat+venue_partner+cohort,
  centers, partnerships, reservations, group bookings, payments, payouts.

## 6) Required API changes
- Backend endpoints: **NONE required** — endpoints for all three participants already exist. (If, during build, the
  UI needs a field/endpoint that's missing, FLAG to backend team; do not fabricate.)
- New **Next.js BFF routes** (frontend, allowed): reserve, group-quote, group-book, centers (CRUD), owner-create,
  partnerships (invite/accept/counter/decline), invite-peer/invites, retreat reservation payment-link + Cashfree
  order + payment-status. All must be CSRF-guarded (badOrigin) + bearer via backendFetch + **eligibility-guarded**
  for host/cohort/group/partnership actions (defense-in-depth on top of backend).

## 7) Required FRONTEND changes (the build for Prompt 2+)
A. Levels & gating: surface L1/L2/L3 clearly; gate all Host UI to L2/L3; give L1 an explicit "grow to Pracharak"
   path; add server-side eligibility guard to every host/cohort/group/partnership BFF route.
B. In-app participant booking: real reserve→pay on the public retreat page (reserve BFF → create-payment-link/
   Cashfree order → /cashfree-return), individual + group; replace the /login dead-end CTA.
C. Group/cohort: teacher-led group booking + cohort curation (group-quote, group-book, cohort, cohort-decision,
   group-booking-agreements).
D. Venue-owner experience (NEW role surface): centers create/manage, owner-create listings, discoverable centers,
   venue-partners; teacher↔venue partnership flow with the 3-way split preview.
E. Rich create/edit: expand forms to the full RetreatCreateBody (venue_cost_per_seat, venue_partner_id, cohort_*,
   framings, images/cover, pre_ramp/post_sanskara, weather/how-to-get-there).
F. Fee-waterfall UI: participant price → platform 15% → teacher/venue split, on create + manage + partnership.
G. Peer invites WITH anti-poaching: invite peers WITHOUT exposing participant PII to invitees.
H. Public page: wire the reserve CTA; preserve SEO/noindex/canonical.

## 8) Potential conflicts / risks
- **Backend read-only**: cannot add authorization/fields; MUST verify (not assume) that the backend blocks L1 on
  every host mutation (create/edit/cohort/group/partnership). If a gap exists, it's a backend-team fix.
- **Cashfree 401** (prod keys not activated) blocks real payments — booking flow only testable via sandbox/
  mock-checkout endpoints until the user activates Cashfree.
- Existing "Reserve your seat" dead-ends to /login; converting to real booking must not break SEO/noindex boundary.
- CreateRetreatForm client min ₹500 conflicts with cooperative rate bands — align to retreat-rate-context.
- **Anti-poaching**: peer-invite/co-host and venue-owner visibility must be PII-minimizing (rosters/contacts only to
  the owning host + platform; venue owner gets logistics only; invited peers get NO participant contacts;
  discovery/nearby must not expose another teacher's participants).
- Multiple booking namespaces exist (/retreats/{id}/reserve vs /v1/bookings/retreat vs /bookings) — must standardize
  on the RETREAT reservation path (/retreats/{id}/reserve + /retreats/reservation/{id}/payment-status) and not
  confuse with org/1:1/HR booking systems.
- Nav shows "Retreats" to all teachers — needs level-aware messaging that doesn't mislead L1.

## 9) Migration requirements
- Frontend: no data migration.
- Test data / personas (REQUEST from backend/data team — I can't create backend personas):
  - An L1 **Yoga Shikshak** account (to prove exclusion), an L3 **Yoga Guru** account, and a **Venue-Owner** account
    (to build/verify centers + partnerships). Current: teacher.demo = L2 Pracharak (eligible).
  - Admin persona still pending (BACKEND_REQUEST_admin_persona.md) — needed to force venue AI resync + payouts ops.
- Deployment: add EMERGENT_LLM_KEY + EMERGENT_EMAIL_KEY as deployment secrets.

## 10) Bottom line
The backend already implements ~90% of Host Your Retreat for all three participants. The work is almost entirely
FRONTEND (Next.js UI + BFF routes) + reusing existing backend endpoints, with strict L1 exclusion (UI+BFF, backend
verified) and Teacher-First / anti-poaching guardrails baked into every surface. No backend/DB changes are expected
from us; anything that turns out to need one is flagged to the backend team.

## 11) EMPIRICAL VERIFICATION (2026 fork) — L1 gap RESOLVED
Ran live calls to prove the eligibility guarantee (accounts in memory/test_credentials.md):
- L1/unempanelled (`qa.shikshak.l1@nostopsqa.com`, self-registered via /auth/register — no SMS):
  - host-eligibility → `{eligible:false, reason:"Retreat hosting is available for Council Gurus and empanelled
    Level 2 (Yoga Pracharak) or Level 3 (Yoga Guru) teachers."}`
  - POST /retreats/create → **403** "…empanelled Level 2/3 teachers"  (mutation blocked, not just the read)
  - POST /retreats/centers → **403** "…reserved for empanelled Level 2 (Pracharak) or Level 3 (Guru)…"
- L2 Pracharak (`teacher.demo`, empanelled): host-eligibility eligible:true (fee 15%); POST /retreats/create → 200;
  POST /retreats/centers → **403** (Retreat-Owner capability requires more than L2 empanelment).
- Council Guru (`guru.demo`): host-eligibility eligible:true host_type `council_guru` **fee 0%**; POST /retreats/centers
  → 200 (`ctr_0c01674df73d`). So centers/owner-listings/partnerships are buildable/verifiable with guru.demo.
CONCLUSIONS:
- Backend authoritatively enforces the L1 exclusion on BOTH host and owner mutations → the eligibility guarantee holds.
  Frontend must still gate UI + add eligibility guards on host/owner BFF routes (defense-in-depth), but backend is the
  boundary. No backend change needed for the guarantee.
- Refined model: "Venue/Retreat Owner" = a capability (create centers) gated STRICTER than hosting — guru.demo has it,
  empanelled L2 teacher.demo does not. External non-teacher venue owners participate via partnership-invite-by-email.
OPEN ITEMS (flag to owner/backend team):
1. Clarify what unlocks "Retreat Owner" (center creation) for an empanelled L2 (teacher.demo blocked despite
   is_empanelled:true) — is it intended that only Gurus / a special empanelment can own centers?
2. Delete QA artifacts: retreat `rt_1cf46fdf0f`, center `ctr_0c01674df73d` (no unpublish/delete API on the frontend).
3. Optional: a dedicated external Venue-Owner (non-teacher) test account for the partnership-accept side.
No test needed to re-run; verification is recorded above.

## 12) OWNER DECISIONS (2026 fork) — source of truth for Prompt 2
1. Venue/Retreat Owner gate: **LEAVE AS-IS** (do not push a backend change). Whoever the backend allows (e.g., Council
   Gurus) can create centers; **external / non-teacher venue owners join via PARTNERSHIP-INVITE-BY-EMAIL**
   (POST /retreats/{id}/partnerships {partner_email,...} → partner accepts/counters/declines). Build the venue-owner
   experience around this: teacher/guru creates or links a center + invites the venue owner by email to a partnership
   (revenue-share / guest-fee / rental model).
2. QA test records: **LEAVE THEM** (retreat rt_1cf46fdf0f, center ctr_0c01674df73d). No cleanup required.
3. Platform fee intent (owner): **15% for everyone, including Council Gurus** (same as teachers).
   ⚠️ DISCREPANCY: live backend currently returns `platform_fee_pct: 0` for `host_type: council_guru`
   (teachers return 15). Frontend MUST keep displaying the backend's authoritative `platform_fee_pct` (never hardcode —
   the fee drives settlement/payout). The 0% for Gurus is a **backend fix to FLAG to the backend team** so it returns 15.
   Until fixed, the UI will faithfully show whatever the backend returns.
