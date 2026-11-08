# NOSTOPS — Phase 0 Audit: Master Architecture, Existing Platform & Spaces Readiness
Date: Oct 2026 · Scope: AUDIT ONLY. No code, route, schema, data, auth, payment or deployment was changed.
This report is the only file written. Evidence = file paths / endpoints / live preview DB queries (read-only).

Evidence caveat: the preview DB is a local MongoDB. Production venue data lives in the production DB
and in the main business backend (`BACKEND_URL`, a separate Emergent app this repo does not contain).
Counts below are from preview and only show record *shapes*, not production volumes.

---------------------------------------------------------------------------------------------------
## 1. Executive summary

1. **Global venue owners cannot edit listings because there are two disconnected venue worlds:**
   - **(a) Venue Studio.** Venues created in `/app/venue` (`/retreats/centers` on the main backend, or a local
     `venue_centers` fallback) are owner-editable. But access is gated to host-eligible *teachers* (Level 2/3)
     and Council Gurus (`canOwnVenues`, `lib/server/venue-owner.ts`).
   - **(b) Public submissions.** Most public Global Venues come from `/venues/submit`, admin curation or email
     requests, stored in the local `venue_submissions` collection **without `owner_id`**. Their only edit path is
     an **emailed 45-minute magic link** (`/venues/submit/edit`). It needs the exact submitter email, can't change
     photos, and every change waits for admin approval.
   - **No "venue owner" account role exists.** `lib/roles.ts` ROLE_MAP has no `venue` / `venue_owner` key.
     A non-teacher venue owner has no dashboard and no way to claim their listing into an account.
2. **Moderation bypass in the existing owner path (data-integrity finding).** Venue Studio *mirrors* the owner's
   centres into `venue_submissions` on **every dashboard page load**, using `$set` on the live record
   (`POST /api/venues/submissions/mirror`, `backend/venues.py` ~L619). For a published listing this:
   - pushes owner edits live **without review**, and
   - can overwrite admin-curated fields (`description`, `photos`, `venue_type`, `best_for`, `website_or_maps_url`).

   The public-submission path, by contrast, requires approval. The two paths follow **inconsistent moderation policies**.
3. **India-only PIN-code architecture: not present.**
   - `pincode` is free text (≤12 characters, any alphanumerics) and `country` is free text.
   - There is no Indian postal dataset, no PIN→locality/district/state mapping, and no India-only enforcement
     anywhere except the festive campaign's +91 phone check.
4. **NOSTOPS Spaces and the Community Partner Network do not exist** in code: no `/spaces` routes, no collections,
   no role, no screens. Reusable building blocks do exist (listed in §10).
5. **Business-rule conflicts already in code** that need an owner decision before Spaces is built:
   - **Revenue share exists as a model.** Teacher–Venue partnerships offer `co_host`, `rental` and `revenue_share`
     (`app/bff/venue/partnerships/route.ts:18`, `ownerSharePct` / `rentalOwnerSharePct` in `venue-owner.ts`).
     This directly contradicts "no Revenue Share model".
   - **A payout/escrow path exists for venue owners.** Venue Studio reads `/retreats/payouts/mine` (escrow held /
     settled), and there is an admin Payouts page (`/app/admin/payouts`). This must not be extended into Cashfree
     payouts. Its real money mechanics are owned by the main backend and need separate confirmation.
6. **Recommended order (with one change to the provisional order):**
   - Phase 1 = unified venue-owner identity + claim + owner editing for Global Venues, with a single moderation policy.
   - **Phase 2 also includes resolving the revenue-share and payout conflicts** before any Spaces partnership flow.

---------------------------------------------------------------------------------------------------
## 2. Existing architecture

```
Browser ──► Next.js 15 App Router (/app/frontend)  ── public site (SSR/ISR, SEO), /app dashboards, /bff/* route handlers
                │  httpOnly session cookie + double-submit CSRF (lib/server/bff.ts badOrigin, lib/server/session.ts)
                │  Preview isolation: mutating calls → 423 on preview pods (lib/server/preview-isolation.ts)
                ├──► MAIN BUSINESS BACKEND  BACKEND_URL (separate Emergent app, NOT in this repo)
                │      auth (/auth/*, OTP via Twilio), users/roles, teachers, bookings, retreats, /retreats/centers,
                │      partnerships, payouts/escrow, wallet, KYC, notifications
                └──► LOCAL SIDECAR FastAPI  PULSE_API_URL (/app/backend, port 8001) + local MongoDB
                       auth: shared secret X-Pulse-Secret + BFF-signed user context X-Pulse-User (venues.py current_user)
                       venues.py (venue_submissions, venue_revisions, venue_centers fallback, extras, google grants)
                       venue_growth*.py (widgets, posters, monthly email), ai_onboarding.py (paid AI onboarding)
                       institutional.py (inst_* cohorts/programmes), coordinator.py, discovery.py (claim profiles)
                       guru/ (AI Guru), festive_kyc.py, payment_routing.py, paypal_*.py, cashfree_diag.py, audit.py
```
- **Storage:** Emergent Object Storage for venue photos (`app/bff/venue/photo/route.ts`, served by `/bff/media/**`).
  Cloudflare R2 is referenced in `backend/r2_storage.py`.
- **Payments:**
  - Cashfree: acceptance and refunds only. PayPal: checkout plus webhook.
  - A global money lock, `FINANCIAL_ACTIONS_UNLOCKED`, controls financial actions (`lib/server/financial-lock.ts`).
  - Only `FINANCIAL_UNLOCKED_FLOWS` (venue AI-onboarding checkout) is opened.
- **SEO:**
  - `app/(public)/sitemap.xml`; canonical origin `NEXT_PUBLIC_SITE_URL` = www.nostops.org.
  - Venue profile URLs: `/venues/[venue_id]` permanently redirects to `/venues/in/[city]/[venue]`.
  - City hubs: `/venues/in/[city]`.
- **Size:** 82 public pages, 129 dashboard pages, 221 BFF routes.
- **Feature flags:** `VENUE_TIER2_PREVIEW`, `VENUE_CHECKOUT_ENABLED`, `FINANCIAL_*`, plus preview isolation.

---------------------------------------------------------------------------------------------------
## 3. Route & page inventory (venue-relevant; the full site has 82 public pages)

| Route | Component / data | API → store | Status |
|---|---|---|---|
| `/venues` | `VenueExplorer`, `lib/server/venues.getVenues` | main backend bindable venues + `GET /api/venues/published` (local `venue_submissions` status=published) merged by name+city | A |
| `/venues/in/[city]`, `/venues/in/[city]/[venue]` | `VenueProfile` | same merge + enrichment, Google grants | A |
| `/venues/all`, `/compare`, `/saved` | explorer variants | same | A |
| `/venues/submit` (+ thank-you, email-preferences) | public submit form (captcha, honeypot, rate limit) | `POST /api/venues/public-submissions` → `venue_submissions` (no owner_id) | A |
| `/venues/submit/edit` | `SubmitEditClient` | `request-edit` (email magic link, 45 min) → `by-token` → `edit` → `pending_changes` | A, but limited (§6) |
| `/venues/ai-onboarding` (+ result) | paid AI onboarding | `ai_onboarding.py` create-order/status/PayPal | A (flagged) |
| `/list-your-venue` (+ enquire) | marketing + tiers | static + enquiry | A |
| `/app/venue` (Venue Studio) | `VenueOwnerHome` | `/retreats/host-eligibility`, `/retreats/centers/mine`, `/retreats/listings/mine`, `/retreats/partnerships/*`, `/retreats/payouts/mine` + local mirror | A, but gated to teachers/gurus |
| `/app/venue/centers/new`, `/[id]/edit` | `CenterForm`, `VenuePhotosSection` | `PATCH /bff/venue/centers/[id]` → main `/retreats/centers/{id}` or local `venue_centers` | A |
| `/app/venue/listings/new` | `ListingForm` | `/retreats/listings/owner-create` | A |
| `/app/admin/venue-review` (+ `[id]`) | admin review console | `/api/venues/submissions*` (actions, notes, pending approve/reject, revisions/restore) | A |
| `/app/admin/venue-partners`, `venue-widgets`, `venue-monitor` | growth partners / widgets / monitor | `venue_growth*.py` | A |
| `/retreats/host` | host a retreat | retreat binds only to listed venues (`lib/server/venue-binding.ts`) | A |
| `/city-coordinator`, `/claim`, `/yoga-teachers/[city]` | coordinator application, teacher claim, city hubs | `coordinator.py`, `discovery.py` | A |
| `/spaces/*` | — | — | **Does not exist (D)** |
| Community Partner pages | — | — | **Does not exist (D)** |

---------------------------------------------------------------------------------------------------
## 4. Persona & permission matrix (current)

| Persona (backend role → app role) | Dashboard | Venue capabilities today |
|---|---|---|
| seeker/employee/member/user → learner | `/app` | browse, save, compare venues |
| teacher → teacher (L1) | `/app/teacher/*` | none (Venue Studio shows locked) |
| teacher L2/L3 → teacher | + `/app/venue` | create/edit own centres, retreat listings, partnerships |
| guru/council → council | `/app/council/*` + `/app/venue` | same as L2/L3 (`host_type === council_guru`) |
| hr/organisation → corporate | `/app/org/*` | none |
| coordinator → coordinator | `/app/coordinator` | none |
| admin → admin | `/app/admin/*` | full venue review, publish, verify, revisions, Google grants |
| **Non-teacher venue owner** (international hotel, ashram, studio) | **none** | **anonymous submit + magic-link edit only** |
| Community Partner | **none** | — |

Enforcement:
- **Sidecar:** `_require_admin` checks `role == "admin"` (`venues.py:278`). Owner reads are scoped by
  `_own_id` to the BFF-signed `X-Pulse-User`, never to a client-supplied id (TVR-16).
- **Main backend:** enforces host eligibility on writes (per comments in `venue-owner.ts`). Not verifiable from this repo.

---------------------------------------------------------------------------------------------------
## 5. Global Venues functionality audit

| Journey step | Status | Evidence |
|---|---|---|
| Discovery | A | `getVenues` merges remote and local; city pages; compare; saved |
| Listing submission (public) | A | `/venues/submit` → `public-submissions` with captcha, honeypot, IP-hash rate limit, `status: submitted` |
| Owner registration / authentication | **B** | no venue-owner role or signup persona; Venue Studio requires a teacher L2/L3 or guru account |
| Ownership verification | **B** | only "submitter email = owner" (magic link). No claim flow, no document or domain proof. Admin "verify" (`/api/venues/verify`) is a quality badge, not ownership proof |
| Listing management (dashboard) | **B** | only for Venue Studio centres; public submissions don't appear in any dashboard |
| Moderation | A, but inconsistent | admin actions with `_ACTION_STATUS` + history; pending-changes approve/reject; revisions and restore (`venue_revisions`). The mirror path bypasses all of this (§1.2) |
| Profile updates | **B** | magic link: no photos (`photos: None = unchanged`), single latest submission per email, 45-minute TTL |
| Images | B | Studio: up to 5 photos to object storage. Public edit: none. Google photos only via admin grant or paid AI onboarding |
| Enquiries | B | `/list-your-venue/enquire` (to NOSTOPS); teacher→venue partnership invites in Studio. No guest/teacher enquiry inbox for public-submitted venues |
| Availability | B | `/venues/[venue_id]/availability` route exists (read). No owner-side availability editor found |
| Retreat hosting | A | retreats must bind to an eligible listed venue (`venue-binding.ts`). Name, city and state are always taken from the venue record |
| International support | A | free-text country, `countryFromCoords` fallback, postal field accepts international formats (`CenterForm`) |

---------------------------------------------------------------------------------------------------
## 6. Diagnosis — why Global Venue owners cannot edit their listings

1. **No account link.** Public-path records are created without `owner_id`.
   - Preview data: all published records (`curated`, `email_request`, `published`, `public_submission`) have no
     `owner_id`. Only the `owner_center` and `public_retreat` kinds carry one.
   - `my-venue-status` and the Studio query by `owner_id`, so these venues are invisible to any logged-in user.
2. **No venue-owner persona.** ROLE_MAP has no venue role, and `canOwnVenues` requires teacher host-eligibility.
   A hotel or ashram owner cannot get a dashboard at all.
3. **No claim flow.** There is a claim flow for teachers (`/claim`, `discovery.py my-claim`) but none for venues.
4. **The magic-link editor is deliberately narrow:**
   - emailed link only, and it finds only the *latest* submission for that email;
   - 45-minute TTL;
   - no photo management;
   - blocked for rejected or archived records;
   - every change becomes `pending_changes` for admin approval.
5. **Two sources of truth for the same physical venue:**
   - main-backend centres (`ctr_*`), local fallback centres (`loc_*`) and `venue_submissions`, joined by
     `dedupe_key` = normalized name|city;
   - the mirror also `delete_many`s `public_retreat` backfill records with the same key.

   A claim must reconcile these, or duplicates and lost edits will follow.
6. **The main backend's `/retreats/centers` model is "frozen".** It drops `website_or_maps_url` and `country`,
   which is why the `venue_center_extras` workaround exists. Fields beyond its schema (description, best_for,
   open_months, getting_there, weather_band, things_to_carry) live only in `venue_submissions`.

**Not a cause:** security. The existing endpoints are correctly owner-scoped. The gap is missing identity and
claim linkage, plus UI.

---------------------------------------------------------------------------------------------------
## 7. Recommended owner-editing architecture (Phase 1)

- **Single editable record = `venue_submissions`** (it already powers `/venues` and SEO, and has revisions,
  history and moderation). Do not create a new venue collection. Keep IDs and URLs unchanged.
- **Add an ownership link, not a new owner record:**
  - add `owner_id` (main-backend `user_id`), `owner_claimed_at` and `claim_method` to existing `venue_submissions` docs;
  - `owner_id` may also be set at submit time when the submitter is logged in.
- **Venue claim flow** (reuse the magic-link token signer and captcha from `venues.py`):
  - "Claim this venue" on the venue profile → the owner signs in or signs up (main-backend auth) → verifies by
    the submitter email link, **or** admin approval with evidence (website domain email / Google Business match /
    document);
  - admin sees claims in `/app/admin/venue-review`;
  - one owner per venue; claim transfer only by admin.
- **Owner role:**
  - Preferred: let *any* authenticated user hold venues through ownership (an `owner_id` match), not a role.
  - Add a Venue Owner sign-up persona that routes to `/app/venue`.
  - Requires a backend `venue_owner` role **only if** the main backend's roles are extensible. Decision D3.
- **Owner editor:**
  - New authenticated BFF route → new sidecar endpoint `PATCH /api/venues/owned/{sid}`, scoped by
    `owner_id == X-Pulse-User.user_id`.
  - Whitelisted fields: the `PublicEditIn` fields + photos (≤10) + open_months, getting_there, things_to_carry,
    contact.
  - Reuse `pending_changes` + `venue_revisions` + `decide_pending_changes`.
- **One moderation policy for both paths** (Decision D1):
  - **Option A:** all owner edits → pending review. This is today's public path.
  - **Option B:** low-risk fields (contact, availability, amenities) publish instantly; name, city, photos and
    description go to review.
  - Either way, **change the mirror to stop `$set`ing live fields on published records.** It should write to
    `pending_changes` instead.
- **Cross-owner protection:**
  - server-side `owner_id` match on every write;
  - never accept owner_id from the client;
  - admin-only claim transfer;
  - audit every claim and edit in `history` + `venue_revisions` + `audit.py`.

---------------------------------------------------------------------------------------------------
## 8. Unified Venue Owner account / dashboard

- **One account (main-backend user) → one Venue Studio (`/app/venue`)** with two tabs:
  - **Global Venues:** claimed listings, Studio centres, retreat listings.
  - **NOSTOPS Spaces:** India-only, shown only after Spaces onboarding.
- **Existing Global owners are never pushed through Spaces onboarding.** The Spaces tab shows "List a Space (India)"
  as an opt-in.
- **Keep the teacher-host features** (centres, partnerships, retreat listings) as they are. Make `canOwnVenues` true
  also for users with claimed venues.
- **Reconcile duplicates on claim** using `dedupe_key`. Show possible duplicates to admin; never auto-merge.

---------------------------------------------------------------------------------------------------
## 9. India-only Venue Network & Community Partner architecture

- **Current state:**
  - no PIN validation;
  - `pincode` is free text in `venue_centers`, `CenterForm` and the mirror;
  - `venue_submissions` public intake has no pincode field;
  - city is stored as free text (with slugging for `/venues/in/[city]`);
  - state and district are not normalized.
- **Recommended:**
  - **Reference dataset:** a local `in_pincodes` collection loaded from the India Post all-India PIN directory
    (data.gov.in; ~19k PINs, ~150k post offices). One PIN maps to **many** localities. Store
    `{pin, office_name, locality, district, state}` with an index on `pin`.
    Decision D5: data source and refresh cadence.
  - **Validation at three layers:**
    - UI: `^[1-9][0-9]{5}$`, then locality picker from the PIN lookup;
    - API: reject unknown PINs and set `country = "IN"` server-side;
    - DB: Spaces and Community Partner records carry a `pin` + `locality_id` that must exist in `in_pincodes`.
  - **Boundary:** India-only rules apply **only** to the new collections (`spaces`, `community_partners`,
    `space_applications`). Never to `venue_submissions` or Studio centres. That way Global Venues and international
    owners cannot be affected.
  - **UX:** "NOSTOPS Spaces is available in India only (6-digit PIN code required)" before step 1. International
    visitors are pointed to Global Venues.

---------------------------------------------------------------------------------------------------
## 10. NOSTOPS Spaces — readiness (journeys 1–21)

| # | Journey | Reuse | New | Decision / dependency |
|---|---|---|---|---|
| 1–3 | Discover / search by city, locality, PIN / detail | `VenueExplorer` pattern, city slugs, `VenueProfile` layout, sitemap | `/spaces`, `/spaces/in/[city]`, `/spaces/[id]`, `spaces` collection, PIN search | D5 dataset; SEO slug scheme |
| 4–9 | List a Space, onboarding, participation model, details, images/docs, review & submit | `CenterForm` steps, captcha/rate limit, object-storage photo upload, draft autosave | `space_applications`, model enum `commercial / subsidised / community`, document upload (private bucket) | D6 required documents; D7 pricing fields per model |
| 10 | Verification & approval | venue-review console, `_ACTION_STATUS`, revisions, email-on-status | Spaces tab in review console, site-visit checklist | D8 who verifies (admin / City Coordinator / Community Partner) |
| 11 | Space owner dashboard | Venue Studio shell | Spaces tab | — |
| 12 | Teacher discovery near a Space | teacher directory, city hubs | PIN/locality → teacher city match | teacher records have city, not PIN (gap) |
| 13–15 | Teacher→Space enquiry, response, private agreement | partnership invite/respond UI (`PartnershipActions`) | `space_enquiries` (message thread, status) — **no money fields** | D2: remove or hide `revenue_share` from Spaces; agreement is off-platform |
| 16–17 | Programme creation/publishing | institutional programmes (`inst_*`), MIND / BODY / SPECIAL NEEDS taxonomy (`lib/org/cohort-landing.ts`) | bind a programme to a `space_id` | D9 who may create (teacher only? empanelled only?) |
| 18–19 | Registration & confirmation | institutional participant registration, booking-invite, email | Space-programme registration capacity from the Space | D7 fees for Subsidised / Community |
| 20 | Community Partner | City Coordinator model (`coordinator.py`, `inst_city_coordinator_assignments`) is the closest analogue | `community_partners`, application, locality assignment | D10 Community Partner role, eligibility and responsibilities |
| 21 | Admin oversight & reporting | admin reports, audit-log, venue-monitor | Spaces & localities reports | D11 KPIs |

---------------------------------------------------------------------------------------------------
## 11. Existing vs proposed matrix

| Capability | Exists | Incomplete | Proposed / missing |
|---|---|---|---|
| Global venue directory & SEO | ✓ | | |
| Public submit + admin moderation + revisions | ✓ | | |
| Owner edit (Studio centres) | ✓ (teachers/gurus) | moderation bypass | |
| Owner edit (public listings) | | magic link only, no photos | account-based editor |
| Venue claim | | | ✓ needed |
| Venue Owner persona/sign-up | | | ✓ needed |
| Indian PIN validation / locality map | | | ✓ needed |
| Spaces (routes, data, onboarding) | | | ✓ needed |
| Community Partner Network | | | ✓ needed (City Coordinator is reusable) |
| Participation models C/S/C | | | ✓ needed (current partnership models conflict) |
| Admin Localities / Venues Network / Outreach Pipeline / Community Impact | | | ✓ not found in code |

---------------------------------------------------------------------------------------------------
## 12. Screenshot & design-reference inventory (106 project assets reviewed by name; key ones opened)

| Reference | Screen | Status |
|---|---|---|
| `file_…0098dc8211…png` (3 duplicates) | List Your Venue (tiers, how it works) | A (implemented `/list-your-venue`) |
| `file_…fcac8211…png` | Host a Retreat | A (`/retreats/host`) |
| `file_…f2e08211…png` | For Organisations — Companies | A |
| `file_…563081fb…png` | Past event page (Founders Circle) | A |
| `file_…bd908211…png` | Teacher dashboard, festive InstaKYC | A |
| `01–06_*.png` | Organisation event wizard (cohort → publish) | A (institutional flow) |
| `nostops_signup_persona_page.png`, `nostops_login_page-1.png` | Sign up / Login | A |
| Android screenshots Sep–Oct 2026 | bug reports / reviews of live pages | reference only |
| **Spaces screens, Space Owner dashboard, Community Partner, Admin Localities / Venues Network / Yoga Outreach Pipeline / Community Programmes / Reports & Impact** | — | **Not found in project assets.** C or D (cannot confirm "designed") |

Duplicates: List-Your-Venue PNG ×3, `file_…3d4882…png` ×4, `file_…3dc482…png` ×2. The most recent upload wins.

---------------------------------------------------------------------------------------------------
## 13. API & database dependency map (venue domain)

- `venue_submissions` (local):
  - **public directory source** (status=published);
  - fields: `owner_id?`, `submitter_email`, `status`, `pending_changes`, `history[]`, `notes[]`, `dedupe_key`,
    `verification_status`, `source_kind`.
- `venue_revisions` (versions, approved/rejected); `venue_centers` (local fallback, owner_id);
  `venue_center_extras`; `venue_google_grants`; `venue_growth_*`.
- Main backend: `/retreats/centers*`, `/retreats/listings*`, `/retreats/partnerships*`, `/retreats/payouts/mine`,
  `/retreats/host-eligibility`, plus bindable venues for retreats.
- Institutional: `inst_*` (cohorts, programmes, city coordinator assignments, revenue allocations).
  `coordinator_applications`.

---------------------------------------------------------------------------------------------------
## 14. Security & data-integrity findings

| Sev | Finding | Evidence |
|---|---|---|
| **High** | Mirror on page load overwrites live published listings (moderation bypass, admin edits lost) | `venues.py` `mirror_submissions` `$set venue_fields`, called from `getVenueOwnerState` |
| **High** | Revenue-share model present, contradicting business rules | `bff/venue/partnerships/route.ts:18` |
| **High** | Escrow/payout reads for venue owners exist; mechanics live in the main backend (Cashfree payouts not allowed) | `venue-owner.ts` `/retreats/payouts/mine`, `/app/admin/payouts` |
| Med | Ownership = submitter email only; no claim verification | `request-edit` |
| Med | Mirror `delete_many` on `dedupe_key` can remove backfill records for same-name venues in one city | `venues.py` mirror |
| Med | `center-extras` POST upserts by `center_id` without checking ownership (any signed-in user can write extras for any id) | `save_center_extra` |
| Low | Free-text country/pincode makes later India-only filtering unreliable on legacy data | `CenterIn` |
| Info | Good: owner reads scoped to signed user; CSRF; captcha + rate limit; HMAC edit tokens; revision history | `_own_id`, `badOrigin` |

---------------------------------------------------------------------------------------------------
## 15. Missing screens & design recommendations

Can be created from existing NOSTOPS patterns (no screenshot needed):
- "Claim this venue"
- Venue Owner sign-up persona
- Owner venue editor (extends `CenterForm` / `SubmitEditClient`)
- Studio tabs (Global / Spaces)
- Spaces directory, city page and detail (mirror the `/venues` pages)
- PIN + locality picker
- Admin claims queue

Blocked by decisions: participation-model pricing fields, Community Partner application and dashboard,
admin Localities and Impact dashboards.

---------------------------------------------------------------------------------------------------
## 16. Critical gaps & risks (ranked)

1. Moderation bypass via mirror (High).
2. Revenue-share and payout conflicts (High; business).
3. No venue-owner identity or claim, so the main goal is blocked (High).
4. No PIN dataset or validation (High for Spaces).
5. Main backend not in repo: any role change or new owner field there needs that app (Medium; dependency).
6. Duplicate venue records across three stores (Medium).
7. Admin Spaces / localities screens not designed (Medium).

---------------------------------------------------------------------------------------------------
## 17. Recommended implementation sequence

- **Phase 1:** Venue-owner identity + claim + account-based editor + single moderation policy, including fixing
  the mirror bypass and the extras ownership check. Global Venues only.
- **Phase 1b:** Business-rule alignment (decisions D2/D4):
  - hide or remove `revenue_share` from new flows;
  - document that escrow/payouts are out of scope for Spaces.

  **Moved earlier because Phase 4 depends on it.**
- **Phase 2:** India PIN dataset + `localities` + validation service (no UI changes to Global Venues).
- **Phase 3:** Spaces listing + onboarding (C/S/C models) + verification.
- **Phase 4:** Teacher→Space enquiry + private agreement record (no money).
- **Phase 5:** Programmes bound to Spaces (MIND / BODY / SPECIAL NEEDS).
- **Phase 6:** Registration / checkout (Cashfree acceptance and refunds only; Community = free).
- **Phase 7:** Community Partner Network (reuse the City Coordinator pattern).
- **Phase 8:** Admin Localities / Spaces / Impact reporting.
- **Phase 9:** End-to-end, security, SEO regression, release.

---------------------------------------------------------------------------------------------------
## 18. Acceptance criteria (per phase)

- **P1:**
  - a non-teacher owner signs up, claims an existing published venue, edits text and photos;
  - the change follows decision D1;
  - another user gets 403 on that venue;
  - `/venues` URLs, titles, canonicals and sitemap are unchanged;
  - an international venue is still editable;
  - the mirror no longer changes live published fields.
- **P2:**
  - 6-digit PIN lookup returns multiple localities;
  - non-Indian codes are rejected on Spaces APIs only;
  - Global Venue writes are unaffected (regression test).
- **P3:**
  - Space application with model C/S/C, images and documents (documents private);
  - admin approve/reject with history;
  - the Space appears only after approval.
- **P4:**
  - a teacher sends an enquiry; the owner accepts or declines;
  - no price, share or payout fields anywhere.
- **P5–P6:**
  - programme bound to a Space with taxonomy MIND / BODY / SPECIAL NEEDS;
  - registration respects Space capacity;
  - Community model = free;
  - Cashfree used only for acceptance and refunds.
- **P7:** Community Partner applies with a PIN and is assigned localities; the dashboard is scoped to them.
- **P8:** reports per locality and model; admin actions audit-logged.
- **P9:** full regression of existing venues, retreats, teachers, orgs; security tests for cross-owner writes.

---------------------------------------------------------------------------------------------------
## 19. Screenshots requested from the owner

| Screen | Class | Why |
|---|---|---|
| Admin: Localities, Venues Network, Yoga Outreach Pipeline, Community Programmes, Reports & Impact, Community Impact, Performance & Impact, Resources & Support | **ESSENTIAL** (for Phase 8 only) | Named in the brief but not present in code or project assets. Columns, metrics and actions can't be inferred. |
| Community Partner application & dashboard | **ESSENTIAL** (Phase 7) | Role responsibilities are a business decision |
| Spaces listing / detail / onboarding | OPTIONAL | Can follow the `/venues` and `/list-your-venue` design |
| Space Owner dashboard tab | OPTIONAL | Can extend Venue Studio |

---------------------------------------------------------------------------------------------------
## 20. Business decisions required

| # | Decision |
|---|---|
| **D1** | Owner edits: always reviewed, or instant for low-risk fields? |
| **D2** | Existing `revenue_share` (and `co_host` owner share %) Teacher–Venue model: remove for everyone, keep for retreats only, or hide from Spaces only? |
| **D3** | Venue owner as a new backend role vs ownership-based access for any account (recommended)? |
| **D4** | Confirm the existing retreat escrow/payout reads (main backend) are out of scope and not to be extended. |
| **D5** | PIN dataset source (India Post via data.gov.in) and refresh cadence. |
| **D6** | Documents required for a Space (ownership/permission letter, society NOC, ID). |
| **D7** | Fee rules for Subsidised and Community models (who sets prices, caps). |
| **D8** | Who verifies Spaces: admin, City Coordinator, or Community Partner? |
| **D9** | Which teachers may run Space programmes (any verified, or empanelled only)? |
| **D10** | Community Partner definition, eligibility, responsibilities, dashboard scope. |
| **D11** | Impact KPIs for reports. |
| **D12** | Venue claim proof accepted (email domain, Google Business match, document, admin call). |
