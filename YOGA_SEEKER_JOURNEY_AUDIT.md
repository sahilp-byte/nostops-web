# NOSTOPS — Yoga Seeker → 1:1 Booking Journey · Pre-launch Audit (Parts 1–28)

_Audit produced before implementation per PART 27 (AUDIT → MAP → MODIFY → IMPLEMENT → TEST → AUDIT AGAIN)._

## 0. Architecture reality (the single most important constraint)
- **Frontend**: Next.js App Router (SSR/RSC) on :3000 with a server-side **BFF** (`/app/bff/*`). The BFF runs on the server, reads the httpOnly bearer, and is NOT client-manipulable.
- **Two backends**:
  - **REMOTE FastAPI** `https://pro-learn-connect-1.emergent.host` — the real business backend (auth, teachers, directory, profiles, premium_session fee + `tier_rules`, 1:1 bookings + `amount_inr`, payments Cashfree+Razorpay, commission). **NOT in this repo → cannot be modified.**
  - **LOCAL FastAPI** `/app/backend` (:8001) — serves `/api/pulse/*` locally (local Mongo) and **proxies everything else to REMOTE**. **I CAN add local routers here** (like Pulse) for server-side orchestration + local Mongo, without touching REMOTE.
- Implication: any NEW server-side enforcement (price re-validation, gateway routing decision, stored seeker country, matrix reason capture) is implemented in the **BFF and/or the local FastAPI**, calling REMOTE as the system of record.

## 1. EXISTING COMPONENTS FOUND (reusable)
- Auth/login → role routing → `LearnerHome` (seeker dashboard).
- Discovery: `/app/discover` (`lib/server/discover.ts`, `DiscoverFilters`, `TeacherCard`) — facets city/parampara/style/specialization + "near me".
- Public profile: `/teachers/[handle]` (public) & `/app/teachers/[handle]` (in-app) + `/book`.
- Booking: `BookingForm` → `/bff/one-on-one/bookings` (reserve PENDING_PAYMENT) → `CashfreePayButton` → `/bff/payments/cashfree/orders` → `/app/bookings`.
- Teacher fee UI: `/app/teacher/offerings` (`OfferingsForm`, `getPremiumConfig`).
- Admin: `/app/admin/bookings` (`admin-bookings.ts`), `/app/admin/payouts`.
- Geo: `/bff/geo/reverse` (GPS→city+**country**), `/bff/nearby`.

## 2. DATABASE MODELS FOUND (REMOTE, read-only to us)
- **Teacher** (`/teachers/directory`, `/teachers/public/{handle}`, `/teachers/me/native-profile`): `experience_years`, `premium_session {enabled, rate_inr, duration_min}`, `yoga_dimensions` (body/mind/special_needs — present on profile, **NOT in directory**), `styles`, `specializations`, `offers_online/private/group/corporate`, `city`, `country`, `tier`, `rating`, `reviews_count`.
- **Tier rules** (returned by `PUT /teachers/me/premium-session-config` → `tier_rules {level,label,min,max,note}`, e.g. L3 = ₹2,000–₹5,500).
- **User** (`/auth/me`): `user_id,name,email,role,location,teacher_handle,…` — **NO `country` field**.
- **Booking** (`/one-on-one/my-bookings`): `booking_id, teacher_id/handle, student_user_id, amount_inr, status, provider, note, preferred_slot, created/updated_at`.
- Local Mongo (`nostops_web`): Pulse collections only (isolated).

## 3. EXISTING APIs FOUND
- `POST /auth/login` (`session_token`), `GET /auth/me`.
- `GET /teachers/directory?limit=200`, `GET /teachers/public/{handle}`, `GET /teachers/me/native-profile`, `PUT /teachers/me/premium-session-config` (rate floor `ge:500`; returns tier_rules).
- `POST /one-on-one/bookings` (returns booking_id + amount), `GET /one-on-one/my-bookings`, `GET /premium-sessions/my`.
- `POST /payments/cashfree/orders` (exists), `POST /payments/razorpay/create-order` (exists). PayPal/Stripe → **404 (none)**.
- `GET /geo/reverse?lat&lng` (returns country), `GET /users/me/nearby`.

## 4. EXISTING PAYMENT FLOWS FOUND
- Reserve (`/bff/one-on-one/bookings`) resolves handle→teacher_id server-side, creates PENDING_PAYMENT, returns authoritative `amount`.
- Order (`/bff/payments/cashfree/orders`) — **⚠️ takes `amount` FROM THE CLIENT BODY** and creates a Cashfree order for it (identity/phone derived server-side). Currency hardcoded INR. **Gap vs Part 12/14** (frontend can pass any amount).
- Only **Cashfree** BFF exists (no Razorpay BFF). Both gateways are India-based.

## 5. EXISTING MOBILE SEEKER CONTENT FOUND
- 3-matrix copy (Body/Mind/Special Needs) in `booking-invite` `DIMENSION_META` + onboarding. Granular examples (stress/back/ankylosing) are in the **mobile app only** (not this repo) — provided in the brief, mirrored generically per user instruction ("open to all seekers, no 'Indians abroad' framing").
- Reference "Our Mission Abroad" screens (SmartMatch 3-tap, promises, how-it-works, traditions, cooperative model, mission) mirrored generically on web.

## 6. COMPONENTS THAT CAN BE REUSED (no duplication)
Discovery, public/in-app profile, BookingForm, CashfreePayButton, OfferingsForm, admin bookings, geo — all reused. No parallel systems.

## 7. COMPONENTS THAT REQUIRE MODIFICATION
- `lib/yoga-dimensions.ts` (NEW config, single source; matrices + sub-requirements + keyword mapping) — **done**.
- Discover (`discover.ts` + page + `DiscoverFilters`): multi-matrix OR filter + relevance ranking + focus banner + empty-state ("broaden") — **partly done**.
- `TeacherCard`: show name, photo, **experience + own fee**, online/offline, **Book a Session** (stretched profile link) — **partly done**.
- `BookJourney` (NEW guided route `/app/book-journey`): region → intro → **multi-select matrices + optional sub-requirements** → discover — **single-select done; multi-select pending**.
- `BookingForm`: Online/In-person mode + fold mode/matrix reason into note; **price = fee × duration**; amount NOT client-authoritative — **mode done; price/reason pending**.
- `OfferingsForm`: **remove the tier-based minimum** UI restriction (keep ≥ ₹500 remote floor) — pending.
- Nav + LearnerHome CTA → `/app/book-journey` — **done**.

## 8. NEW COMPONENTS REQUIRED
- Local FastAPI router (in `/app/backend`) OR BFF endpoints for: (a) **server-side seeker country** store/confirm (local Mongo), (b) **order orchestrator** that re-derives amount from `booking_id` (`amount_inr`) and **chooses the gateway server-side**, (c) capture selected **matrix reason** into the booking note.
- Razorpay BFF/orchestration for the international route (calls REMOTE `/payments/razorpay/create-order`).
- Empty-state block on discover.

## 9. DATABASE CHANGES REQUIRED
- **REMOTE**: none possible (frozen).
- **LOCAL Mongo**: 1 small collection `seeker_prefs` (`user_id`, `country`/`region`, `updated_at`) for the server-side, tamper-proof country used in payment routing. Everything else reuses REMOTE entities (Part 21 satisfied — no duplication).

## 10. SECURITY / PERMISSION CHANGES REQUIRED (Part 23)
- Enforce order **amount server-side** from booking_id (fixes client-amount gap). Reject mismatch.
- Gateway decision server-side from stored country (never trust the client cookie).
- Reuse existing guards: seekers can't edit pricing (teacher-only `/bff/teacher/*` behind `requireVerifiedTeacher`); public profile already whitelists fields; booking APIs already resolve identity server-side.

## 11. PAYMENT ROUTING CHANGES REQUIRED (Parts 13/25)
- **India → Cashfree** (existing). **Outside India → Razorpay** (existing; the only non-Cashfree gateway — acts as the "international gateway", live only if the Razorpay account has international enabled). Decision **server-side**.
- **Unknown country (Case C)** → do NOT guess; require the region-confirm step and persist server-side before order creation.
- ⚠️ **No dedicated PayPal/Stripe** exists on REMOTE and REMOTE is frozen → a *true* international processor can't be added by us.

## 12. TEST PLAN (Parts 24/25/26)
- Seeker E2E: login → journey → region (India/Outside/Unknown) → select 1/2/3 matrices (+ sub-req) → ranked results / empty-state → open profile → back → book (mode + duration) → **price = fee×duration** → gateway per country → confirmation.
- Teacher: set fee (below old tier-min now allowed in UI; ≥₹500) → public profile/directory/booking reflect ONE fee.
- Admin: booking shows teacher, seeker, fee, gateway, status, matrix reason.
- Payment routing Case A/B/C.
- Regression: profiles, directory, onboarding, verification, levels, dashboards, retreats, guru, payments, auth, admin — unchanged.

---

## HARD CONSTRAINTS (need a decision — cannot be solved in-repo)
1. **International gateway (13/25):** only Cashfree + Razorpay (both India) exist; PayPal/Stripe absent; REMOTE frozen. Proposal: route Outside-India → **Razorpay** as the international route (server-side), India → Cashfree.
2. **Remove platform minimum fee (10, "critical"):** the minimum is the REMOTE `tier_rules.min` (e.g. ₹2,000 for L3) + a ₹500 schema floor. I can remove the **frontend** restriction so teachers set their own fee, but REMOTE will still enforce its tier band/floor. **Full removal requires a REMOTE change (outside this environment).**
3. **Online vs offline separate fees (10/11):** REMOTE stores ONE `rate_inr` (no per-mode fee). Keep ONE authoritative fee (mode chosen at booking); a dual-fee schema would need REMOTE changes.
4. **Server-side country:** `/auth/me` has no country → store seeker's confirmed India/Outside in LOCAL Mongo (authenticated) and route from that; unknown → confirm.
