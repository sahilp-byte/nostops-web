# NOSTOPS — Architecture notes (living document)

Keep this file updated whenever a fact below changes.

## Stack
- Frontend: Next.js App Router in `/app/frontend`, which is also the BFF (`app/bff/**` route handlers).
- Backend: FastAPI gateway in `/app/backend` (local engines plus a proxy to the live business backend).
- Database: MongoDB (local engines only).

## Preview isolation (do not change)
- `frontend/lib/server/preview-isolation.ts`: in preview, every POST/PUT/PATCH/DELETE sent to the live
  business backend is refused with **HTTP 423** and body `{ error, detail, preview_read_only: true }`.
- BFF routes that forward upstream errors keep the status code (423 stays 423) but usually map the body to
  `{ error }`. Clients must therefore treat **status 423 OR `preview_read_only: true`** as "saving is
  disabled in preview". That is never a success and never a validation or handle conflict.

## Shared BFF helpers (reuse; do not add new HTTP helpers)
- `frontend/lib/server/bff.ts`: `badOrigin` (CSRF origin check), `toErrorText` (backend detail → text).
- `frontend/lib/server/session.ts`: `backendFetch` (adds the bearer from the httpOnly cookie, 10 s timeout),
  `getSessionToken`, `getSessionUser` (null on ANY /auth/me failure, not only on an expired session).
- `frontend/lib/auth-client.ts` (browser): `postBff` / `sendBff` return `{ ok, status, data }` and never
  throw (a network failure gives `status: 0`).

## Teacher onboarding wizard
- Component: `frontend/components/app/teacher/OnboardingWizard.tsx`; page: `frontend/app/app/teacher/onboarding/page.tsx`.
- Five screens: Basics (0), Lineage (1), Specs (2), Bio + handle (3), Review & publish (4).
- Draft: `localStorage` key `nostops.teacher.onboarding.draft.v1` (saved on every change; removed only
  after a fully successful publish).
- Screen 4 handle check: `frontend/app/bff/teacher/handle-check/route.ts` proxies
  `GET /teachers/handle-check/{handle}`. The upstream always answers 200 with `available` true/false (+ `reason`).
  - Genuine conflict: upstream 200 with `available: false` → "This handle is unavailable".
  - Invalid format (checked locally): 200 `{ available: false, invalid: true, reason }`.
  - Any other failure: `{ error: true, error_type: 'session_expired' | 'backend_error' | 'timeout' }`
    (401 / 502 / 504). The wizard shows "sign in again" or a Retry button, and never blocks Continue on an error.
- Screen 5 publish runs three required steps:
  1. `POST /bff/teacher/native-register` (upsert on the backend; no idempotency logic needed)
  2. `PATCH /bff/teacher/profile` (re-saves the content fields so `/teachers/me/native-profile` reads them back)
  3. `POST /bff/teacher/avatar` (only when a photo was picked)
  The draft is removed and success is shown only when every required step succeeded. A failed run keeps
  the draft, lists each step's result, and Retry re-runs only the steps that did not succeed. The
  best-effort follow-ups (`trackVenueGrowth('profile_complete')` and
  `POST /bff/discovery/my-claim/complete`) run only after success.
- Public visibility of a teacher (website side): `frontend/lib/public-teacher.ts` `isTeacherActivePublic`
  (handle + not hidden/removed + `public_profile_visible !== false` + `is_active !== false` + not suspended).
  The website does not check KYC itself. Any KYC gating comes from the backend flags.

## Guru Nominations (Phase 1, in progress)
- Local engine `backend/guru_nominations.py` (collections `guru_nominations`, `guru_nomination_app_archive`).
- BFF: `app/bff/nominations/**`, `app/bff/admin/guru-nominations/[id]`, `app/bff/admin/nominations/[nominationId]/[action]`.
- Pages: `/council/nominate` (signed-in form), `/app/nominations` (nominator), `/app/admin/nominations` (admin).
- Council publication gate: `lib/server/council-gate.ts` → `lib/council-visibility.ts`.

## Server-side onboarding draft + funnel events (Prompt 3, preview only, awaiting approval)
- Built from the live backend's published API (the contract file was not in this workspace):
  - `GET /teachers/me/onboarding-draft` → `{ ok, exists, draft: { screens, last_completed_screen, version, completed, draft_photo, has_photo, ... } }`
  - `PUT /teachers/me/onboarding-draft` `{ screens, last_completed_screen 0–5, draft_photo?, expected_version }`. The first write
    sends `null`. A wrong or missing version gives 409 `{detail:{error:'stale_draft', message, current_version}}`. The first
    write emits ONBOARDING_STARTED and advancing a screen emits ONBOARDING_SCREEN_COMPLETED (both on the backend).
    Leaving out draft_photo keeps the stored photo, and the photo can't be cleared.
  - `POST /teachers/me/onboarding-draft/complete` only flips the completed flag.
  - `POST /v1/events` accepts only these onboarding types: ONBOARDING_REGISTERED / _STARTED / _SCREEN_COMPLETED / _RESUMED /
    _PROFILE_CREATED / _PROFILE_FAILED. Others are rejected with 422.
  - `GET /admin/onboarding-analytics` → distinct-subject metrics; instrumentation_date 2026-06-01; earlier data "unavailable".
- Preview: `lib/server/preview-isolation.ts` `PREVIEW_ALLOWED_WRITES` lets ONLY those three writes through (owner decision).
  Events sent from preview carry `source: "preview"`, and those from production carry `"web"`.
- BFF: `app/bff/teacher/onboarding-draft` (GET/PUT), `.../onboarding-draft/complete` (POST), `app/bff/teacher/onboarding-event` (POST).
  Each checks the session first (401 session_expired), then CSRF (`badOrigin`).
- Client: `lib/onboarding-sync.ts` (screens mapping, load/save/complete, `trackOnboarding` with per-key event_ids kept in
  sessionStorage so retries reuse the same id). In the wizard, the server draft wins on load. The local draft carries `owner`
  (account id) and is restored or uploaded only for the same account, and only uploaded when no server draft exists.
  Anything else is discarded. Saves happen on each Continue (queued); a 409 reloads the server copy and shows a notice.
- Admin: `/app/admin/onboarding-conversion` (`lib/server/admin-onboarding-analytics.ts`).

## Teacher Record Reconciliation (Prompt 4, read-only)
- `/app/admin/teacher-reconciliation`: `getTeacherRoster()` in `lib/server/admin-teachers.ts`
  (`GET /admin/people/teachers?limit=200&status=all`), classified in `lib/server/teacher-reconciliation.ts`.
- The roster returns: teacher_id, user_id, name, handle, city, email, phone, experience_years, empanelled, is_active,
  suspended_until, deleted_at, created_at, status. It does NOT return the draft, KYC, claim flag, profile completeness or
  public_profile_visible, so categories 2 and 3 are "not determinable".

## Homepage (2026 redesign)
- `app/(public)/page.tsx`: HomeHeroBanner → CelebrationStrip → WhoAreYou → existing sections. Images in `public/brand/home2/`.
- Header nav: `lib/site-nav.ts` HEADER_NAV (8 items). Homepage button styles: `components/HeaderAuthCta.tsx`.

## Dev-only
- `frontend/scripts/dev-cache-guard.mjs` (loaded by `next.config.mjs` in `next dev` only) keeps
  `.next/dev/cache` from filling the disk.

## Sign Up / Login (June 2026, preview only)
- /signup + /login live in app/(entry) (site header/footer). Other auth screens stay in app/(auth).
- Login: components/auth/LoginPanel.tsx (Mobile OTP +91 for existing accounts of any persona; Email/Password for all).
- OTP BFF: otp-start checks /auth/otp/lookup first (no SMS for unknown numbers), throttles per number + IP;
  otp-verify sends no role, so the account keeps its own role. Do not add a role there (it may attach a persona).
- 30-day inactivity: nostops_active cookie (lib/session-cookie.ts) checked and refreshed in proxy.ts.

## Festive InstaKYC campaign (backend/festive_kyc.py)
- Website backend decides eligibility/claims/fees on its own IST-aware clock; BFF only gathers facts (lib/server/festive-kyc.ts).
- Never create an InstaKYC Cashfree order without instaKycIsComplimentary() === false (orders route). Fails closed.
- Fee waiver never sets KYC verified. Main app still needs POST /api/kyc/promo-waiver (BACKEND_REQUEST_festive_instakyc.md).

---------------------------------------------------------------------------------------------------
## NOSTOPS Spaces — 9-phase plan, screens and status (living tracker)

**Update rule:** update this section at the end of EVERY phase (and whenever a screen's status changes):
phase status, the screen table, the "Last updated" line, and the change log. Source plan:
`/app/memory/PHASE0_AUDIT_NOSTOPS_SPACES.md` §17 (sequence) and §18 (acceptance criteria).

Last updated: June 2026, Phase 4 screen 2 (Preview only, not published).

Status key: ✅ Done (agent-verified on Preview) · 🟡 In progress / partial · ⬜ Not started · ⛔ Blocked on an owner decision

### Two products, kept separate
- **Global Venues**: destination venues, retreats and international listings (`/venues/*`, `venue_submissions`). Live.
- **NOSTOPS Spaces**: India-only, locality/PIN-based community and neighbourhood spaces (`/spaces/*`). Not built yet.
  Spaces-only concepts (PIN codes, Commercial / Subsidised / Community models, Community Partners) must never leak
  into Global Venues.

### Phase plan
| Phase | Scope | Status | Acceptance (summary) |
|---|---|---|---|
| 0 | Architecture audit and readiness report | ✅ Done | Report at `/app/memory/PHASE0_AUDIT_NOSTOPS_SPACES.md` |
| 1 | Global Venue ownership: claim → admin approval → owner editing (low-risk live, sensitive → review); Venue Studio overwrite fix; City Coordinator hidden | ✅ Done (Preview, awaiting publish approval) | Owner claims and edits; non-owners get 403/404; `/venues` SEO unchanged; international venues editable; Studio never overwrites live data |
| 1b | Business-rule alignment: hide `revenue_share` in new flows; escrow/payouts out of scope for Spaces | ✅ Done (Preview, awaiting approval) | No revenue-share or payout fields in any Spaces flow |
| 2 | India PIN dataset + `localities` + validation service (no Global Venues UI change) | ✅ Done (Preview, awaiting publish approval) | A 6-digit PIN returns its localities; non-Indian codes rejected on Spaces APIs only |
| 3 | Space listing + onboarding (C/S/C models) + verification | ✅ Done (Preview, awaiting publish approval) | Application with model, images and private documents; admin approve/reject with history; visible only after approval |
| 4 | Teacher → Space enquiry + private mutual agreement (no money) | ✅ Done (Preview, awaiting publish approval) | Enquiry, accept/decline; no price/share/payout fields |
| 5 | Programmes bound to Spaces (MIND / BODY / SPECIAL NEEDS) | 🟡 5B built in Preview (awaiting review) | Teacher-created Space programmes on `inst_events` (`host_kind=SPACE`) |
| 6 | Participant registration and checkout (Cashfree acceptance/refunds only; Community = free) | 🟡 Built in Preview (awaiting review; paid checkout gated off, sandbox only) | `space_registrations`; FREE live in Preview; PAID needs sandbox keys + `SPACE_CHECKOUT_ENABLED=true` |
| 7 | Community Partner Network (reuses the City Coordinator pattern) | 🟡 Implemented in Preview — formal acceptance pending (not closed) | Partner applies with PIN, is assigned localities, dashboard scoped |
| 8 | Admin Localities / Spaces / Impact reporting | ⬜ Not started · ⛔ D11 + screenshots | Per-locality/model reports; admin actions audit-logged |
| 9 | End-to-end, security, SEO regression, release | ⬜ Not started | Full regression; cross-owner write security tests |

### Phase 1 rules in force (Global Venues)
- **Who can claim and manage venues:** only empanelled teachers (L2/L3, host-eligible), Council Gurus and admins (owner decision).
  - The BFF checks `canClaimVenues()` in `lib/server/venue-owner.ts` and then signs `venue_eligible:true`.
  - The sidecar (`backend/venue_ownership.py`) returns 403 without that flag.
  - Yoga Seekers see `VenueNotEligible`.
- **Moderation:**
  - Low-risk fields go live on save: contact, website, amenities, open months, getting there, things to carry, open to partnerships.
  - Sensitive fields go through Review & Submit and then `pending_changes`: name, location, capacity, description, photos, venue type, best for.
- **Concurrency:**
  - Claim approval is a compare-and-set on `owner_claim_id == claim.expected_owner_claim_id`, so exactly one winner. The loser gets 409 `{conflict}` and is marked `rejected` with `conflict:true`.
  - Owner saves use an atomic `updated_at` optimistic lock.
  - On a transfer, the previous owner's pending changes are discarded, and the discard is audited.
- **Emails:** claim approve/reject goes to the claimant. Pending-change approve/reject goes to `owner_email`.

### Phase 2 rules in force (NOSTOPS Spaces localities)
- **Dataset (D5):** India Post all-India PIN directory (data.gov.in, OGD Licence) → `backend/data/in_pincodes.csv.gz`
  (19,097 PINs, 154,746 localities, 36 states/UTs; Leh/Kargil mapped to Ladakh, DNH + Daman and Diu merged), built by `backend/scripts/build_in_pincodes.py`.
  Refresh: rebuild the file and bump `DATASET_VERSION` in `backend/spaces_localities.py`; the startup loader reloads it.
  Old-version rows are never deleted; every read filters on the current version.
- **Collection `in_pincodes`:** one doc per locality, `_id` = `<pin>-<slug>` (the `locality_id`), indexed on pin and state/district.
  `in_pincodes_meta` holds version and counts. Loaded in the background at startup (lookups answer 503 until ready).
- **Sidecar API** (`/api/spaces/localities`, shared secret): `GET /pin/{pin}`, `GET /id/{locality_id}`, `POST /validate`, `GET /meta`.
  Errors: 422 `invalid_pin` / `india_only` / `locality_mismatch`, 404 `unknown_pin`, 503 `dataset_loading`.
- **Validation service:** `validate_india_location(pin, locality_id, country)` — every future Spaces / Community Partner write
  MUST call it. It sets `country = "IN"` server-side; a missing or blank country is treated as India.
- **BFF:** public read-only `GET /bff/spaces/pin/[pin]` (cached). **UI:** `PinLocalityPicker` (S1).
- **Boundary:** Global Venues (`venues.py`, `venue_ownership.py`, `venue_growth.py`, forms) never import or call this module
  (regression test `backend/tests/test_spaces_localities_phase2.py`).

### Phase 4 rules in force (Space enquiries, screen 1)
- **Backend:** `backend/space_enquiries.py` stores enquiries in `space_enquiries` and their private files in `space_enquiry_docs`.
- **Who can send:**
  - Only teachers, Council Gurus and admins (role from the BFF), and only to approved Spaces.
  - A teacher can't send an enquiry to their own Space.
- **Draft → sent:**
  - Sending is a compare-and-set and is idempotent: a repeat or a parallel click returns the same enquiry and the same `NSE-YYYY-XXXXXX` reference.
  - A second open enquiry from the same teacher, for the same Space, title and start date, is refused with 409 `duplicate`.
- **Privacy:**
  - A draft is visible to the teacher (and admins) only.
  - A sent enquiry and its documents are visible to the teacher, the Space owner and admins.
- **Notifications:** the owner is emailed, and the result is recorded in `owner_notified` and the enquiry history.
- **No money:** there are no price, fee, revenue-share, payout, booking or checkout fields. Unknown fields are rejected.
- **Owner side (screen 2):**
  - `GET /incoming` shows only sent enquiries for the caller's *approved* Spaces (admins see all), with status counts and Space, status and date filters.
  - Access is checked against the Space's *current* `owner_id` and requires the Space to be approved.
  - `POST /{id}/respond` takes accept (accepted_in_principle, which is NOT a booking), discuss, propose_dates or decline (a reason is required, and the enquiry is closed for good). The write is compare-and-set, and the teacher is emailed with the result recorded in history.
  - `POST /{id}/messages` is the private, timestamped conversation (teacher ↔ owner).
  - `PUT /{id}/venue-terms` takes non-financial terms only: availability, facilities, access and conditions.
    - Partial update: only the fields sent are changed; omitted fields keep their saved values.
    - Any financial key (price, fee, rent, percentage, commission, payout, revenue/share, cost, charge, rate, deposit, payment) is rejected with 422 and a clear message (`detail.message`, `detail.rejected_fields`). Nothing is saved.
  - The AI Guru greeting pop-up never auto-opens on `/app/spaces/incoming*` (owner) or `/app/spaces/enquiries*` (teacher); the launcher button remains. Other pages are unchanged.
  - Venue-term free text (availability, access, conditions) is checked by `money_in_text()` in `backend/space_enquiries.py`. It is contextual, not keyword-only:
    - Always financial: currency or amounts (₹, Rs, INR, rupees, lakh, crore, 5k), and words such as rent, fee, tariff, commission, honorarium, payout, payment, price, revenue, profit, percentage, refund.
    - Financial only in context: "<number> per/a <period>" or "<number> monthly" (but not after a capacity word: "Max 2 per day"), ratios followed by share/split ("60:40 share"), "N% share/of fees/to owner", security/refundable deposit or "deposit of N", charges (plural) or "<kind> charge", "cost of/per", "pay N" or "pay the owner", "advance of N" or "N advance", "donation/contribution N".
    - Ordinary wording is allowed: "free of charge", "at no cost", "paid parking", "charging points", "Deposit bags", "Split-level", "Pay attention", "100% wheelchair accessible".
    - Any failing field rejects the whole save with 422 (`detail.message`, `detail.rejected_fields`), and nothing is saved. Conversation messages are never scanned.
  - Role wording (`enquiryParties()` in `lib/spaces.ts`): a teacher sees "between you and the venue owner", an owner sees "between you and the teacher", and an admin sees "between the enquiry participants".
  - Enquiry history is shown oldest first for every role (`historyOldestFirst()`).
  - On Spaces enquiry pages (`ENQUIRY_ROUTE`), the Ask AI Guru launcher never covers content:
    - md and up: it docks over a reserved, non-scrolling sidebar footer (`guru-dock-reserve`).
    - Below md: it sits in an opaque full-width bottom bar, and `main` keeps `pb-24` up to md.
  - Admin wording: on all four enquiry screens, admins see neutral, administrator labels. The conversation on the teacher page is read-only for admins. An owner who opens the teacher URL is redirected to the owner screen.
  - Teacher view of a declined enquiry: "Declined · Closed" banner with the owner's reason, a closed notice (no further responses or messages), status-specific "What happens next", and the full enquiry history.
  - Status groups: New = sent · In Discussion = in_discussion + accepted_in_principle · Closed = declined.
  - Optional teacher focus areas: MIND / BODY / SPECIAL NEEDS.

### Phase 1b rules in force (NOSTOPS Spaces: no revenue share / payouts)
- **The 3 models are classification only.** Commercial / Subsidised / Community are the only three official participation models (`lib/spaces.ts` SPACE_MODELS). They carry no price, rent, percentage or payout.
- **Official notice.** `OFFICIAL_MODELS_NOTE` reads: "There are only three official venue models on NOSTOPS. There is no revenue share model. Private teacher–owner arrangements are outside the platform." It is shown on:
  - the wizard's Model step
  - `/spaces`
  - `/spaces/[id]`
- **Backend.** `SpaceIn` uses `extra="forbid"`, so any unknown field (price, rent, revenue_share, commission, payout, ...) is rejected with 422 and never stored.
  - Spaces has no payout or revenue-share routes.
  - Money-keyword paths are also refused up front by the global money lock (423).
- **Community Partner.** Implemented in Preview (Phase 7, acceptance pending): landing, application wizard, status, dashboard, network, referrals and admin screens. None of them link to any rewards, earnings, revenue-share or payout flow.
- **Global Venues** keep their own existing fields and flows, unchanged.

### Phase 3 rules in force (NOSTOPS Spaces listing)
- **Owner decisions:**
  - D6: any signed-in NOSTOPS account can list a Space. These 4 private documents are required: ownership/permission proof, society/building NOC, government photo ID and address proof.
  - D7: the model (Commercial / Subsidised / Community) is a classification only. There are no price, fee, share or payout fields (see Phase 1b).
  - D8: NOSTOPS admins verify each Space, with an optional site-visit checklist.
- **Backend:**
  - `backend/spaces.py` stores data in the collections `spaces`, `space_docs` (private binary, admin-only read, each view audited) and `space_audit`.
  - Statuses: draft → submitted → approved / rejected / changes_requested. Only draft, changes_requested and rejected Spaces can be edited. Approved Spaces are locked; changes go through support for now.
  - Location always goes through `validate_india_location`.
  - Photos must be the owner's own `/bff/venue/photo` uploads (max 5).
  - Documents are checked against their real file signature (PDF/JPG/PNG/WebP) and must be 4 MB or less.
  - A decision is compare-and-set on `status == submitted`, so exactly one admin decision wins. Reject and changes-requested require a note. The owner is emailed.
  - The public API returns approved Spaces only, without owner identity, contact details, documents or history.
- **BFF:**
  - Owner: `/bff/spaces/mine`, `/bff/spaces/mine/[id]`, `.../documents`, `.../submit`.
  - Admin: `/bff/admin/spaces/[id]/[approve|reject|request_changes|site-visit]`, `/bff/admin/spaces/doc/[id]`.
- **Nearby teachers:** `/spaces` matches teacher `city` against the PIN's district, taluks and localities, plus aliases such as Bengaluru/Bangalore. Teachers have no PIN on record.
- **Nav:**
  - "Spaces near me" (seekers).
  - "My Spaces" (seekers, teachers, Gurus).
  - "Spaces Verification" (admin).

### Screen inventory
| # | Screen | Route / component | Phase | Status |
|---|---|---|---|---|
| G1 | Global Venues directory, city pages, venue profile | `/venues`, `/venues/in/[city]/[venue]` · `VenueProfile.tsx` | existing | ✅ Live (claim CTA mentions empanelled teachers) |
| G2 | List your Venue: form + **Review & Submit** step | `/venues/submit` · `PublicSubmitForm.tsx` + `VenueReviewSubmit.tsx` | 1 | ✅ Done |
| G3 | Magic-link edit of a submission | `/venues/submit/edit` · `SubmitEditClient` | existing | ✅ Unchanged |
| G4 | Claim this venue (form / existing-claim status / not-eligible) | `/app/venue/claim/[id]` · `ClaimVenueForm.tsx`, `VenueNotEligible.tsx` | 1 | ✅ Done |
| G5 | **Venue Listing Dashboard** (My Venues: counts, filters, cards, Add another venue) | `/app/venue` · `VenueListingDashboard.tsx` | 1 | ✅ Done |
| G6 | **Venue Profile Dashboard** (profile, ownership, contact, preferences, Save/Discard/Preview) | `/app/venue/owned/[id]` · `VenueProfileDashboard.tsx` | 1 | ✅ Done |
| G7 | **Review & Submit** for owner sensitive changes | inside G6 · `VenueReviewSubmit.tsx` | 1 | ✅ Done |
| G8 | **Public Venue Listing Preview** | `/app/venue/owned/[id]/preview` | 1 | ✅ Done |
| G9 | Venue Studio (teacher/guru centres, retreats, partnerships) | `/app/venue` · `VenueOwnerHome.tsx` | existing | ✅ Unchanged (read-only load) |
| A1 | Admin Venue Claims queue (approve/reject/dispute, Conflict badge) | `/app/admin/venue-claims` · `ClaimDecision.tsx` | 1 | ✅ Done |
| A2 | Admin Venue Review (pending changes, approved owner, claims, versions) | `/app/admin/venue-review/[id]` | 1 | ✅ Done |
| S1 | India PIN + locality picker (type PIN → district/state fill in, choose locality) | `components/spaces/PinLocalityPicker.tsx` | 2 | ✅ Done |
| A3 | Admin Spaces Localities (dataset stats + PIN lookup tester) | `/app/admin/spaces-localities` | 2 | ✅ Done |
| S2 | Spaces search by PIN (Spaces at PIN, more in district, nearby teachers) + Space detail | `/spaces?pin=`, `/spaces/[id]` | 3 | ✅ Done (noindex until Google search rules) |
| S3 | List a Space: onboarding steps (location, details, model, facilities & photos, documents, review & submit) | `/app/spaces/new`, `/app/spaces/[id]` · `SpaceWizard.tsx` | 3 | ✅ Done |
| S4 | Space Owner dashboard (My Spaces) | `/app/spaces` | 3 | ✅ Done |
| S5 | Admin Spaces verification / site-visit checklist | `/app/admin/spaces`, `/app/admin/spaces/[id]` · `AdminSpaceActions.tsx` | 3 | ✅ Done |
| S6 | Teacher → Space enquiry + owner response + agreement record | `/app/spaces/enquiries/new?space=`, `/app/spaces/enquiries/[id]` (Review & Send / Sent), `/app/spaces/enquiries/[id]/edit`, `/app/spaces/enquiries` | 4 | 🟡 Teacher side + owner dashboard/details done (`/app/spaces/incoming`, `/app/spaces/incoming/[id]`) |
| S7 | Programme creation / publishing at a Space | — | 5 | ⬜ ⛔ D9 |
| S8 | Participant registration & confirmation for a Space programme | — | 6 | ⬜ |
| S9 | Community Partner application & dashboard | — | 7 | 🟡 Implemented in Preview — acceptance pending |
| S10 | Admin Localities, Venues Network, Yoga Outreach Pipeline, Community Programmes, Reports & Impact | — | 8 | ⬜ ⛔ D11 + screenshots |

### Change log
- **Phase 0:** audit delivered.
- **Phase 1:**
  - Claims, owner editing and moderation.
  - Studio overwrite fix; City Coordinator hidden.
  - Screens G2, G4–G8, A1 and A2.
  - Atomic claim approval and stale-save lock.
  - Claiming restricted to empanelled teachers and Gurus.
  - Tests: `backend/tests/test_venue_ownership_*.py`, `test_venue_claim_race_iter205.py`, `test_venue_eligibility_iter206.py`.
- **Phase 2:**
  - India PIN/locality dataset, `in_pincodes` collection, lookup + validation service (India-only, Spaces-only).
  - Screens S1 (PIN + locality picker) and A3 (admin Spaces Localities).
  - Tests: `backend/tests/test_spaces_localities_phase2.py`, `test_spaces_localities_phase2_extended.py`.
- **Phase 3:**
  - Space listing wizard, My Spaces, admin verification with site-visit checklist, public PIN search with nearby teachers, Space detail.
  - Screens S2–S5.
  - Tests: `backend/tests/test_spaces_phase3.py`.
- **Phase 1b:**
  - Participation-model step redesigned: 3 cards, How to choose, Examples, and the Important notice.
  - The official-models notice is also shown on the public Spaces pages.
  - The backend refuses unknown or financial fields.
  - Tests: `backend/tests/test_spaces_phase1b.py`.
- **Phase 4 (screen 1):**
  - Teacher enquiry form, Review & Send, Enquiry Successfully Sent, My Enquiries, and a "Send an Enquiry" button on `/spaces/[id]`.
  - Tests: `backend/tests/test_space_enquiries_phase4.py`.
- **Phase 4 (screen 2):**
  - Venue Owner Enquiries Dashboard and Enquiry Details: response panel, conversation, venue terms, documents and history.
  - The teacher's Sent screen now shows the status and the conversation.
  - Tests: `backend/tests/test_space_enquiries_owner_phase4.py`.

## Phase 5B: Space-linked programmes (Preview)

- **Files**
  - Backend: `backend/space_programmes.py` (router `/api/institutional/space-programmes`, mounted in `server.py` after the institutional router and before the proxy).
  - Hooks in `backend/institutional.py`: `_auto_assign_teacher`, `get_public_event`, `list_public_events`, `participant_register`, and the payment intent, attach-order and confirm routes (via `_refuse_space_payment`).
  - Website server: `lib/server/space-programmes.ts`.
  - Website request routes: `app/bff/spaces/programmes/route.ts`, `[id]/route.ts`, `[id]/[action]/route.ts`.
  - Pages: `app/app/spaces/programmes` (list, new, `[id]`).
  - Components: `components/spaces/SpaceProgrammeForm.tsx`, `SpaceProgrammeActions.tsx`.
  - "Hosted at a NOSTOPS Space" card in `components/events/EventLanding.tsx`.
  - Register page returns 404 for Space programmes.
- **Sources of truth (read live, never copied)**
  - `spaces`: `_id`, `status == "approved"`, `owner_id`, `capacity`.
  - `space_enquiries`: `status == "accepted_in_principle"`, `space_id`, `teacher_id`, `owner_id`.
  - `inst_teacher_directory`: `_match_eligible()` and `_adaptive_verified()`.
  - `space_snapshot` on the event is for display only.
- **Identity**
  - `institutionalActor()` and `spaces.ts` no longer fall back to the email address.
  - A request without a genuine `user_id` fails closed (401).
  - The backend also rejects user IDs that look like an email address.
- **Teacher eligibility**
  - Roles `teacher` and `council` (Council Gurus) may create Space programmes. Both pass exactly the same checks, with no exemptions. Admins cannot use this teacher pathway.
  - The website server reads the live backend's `/teachers/me/native-profile` and calls `POST /space-programmes/teacher-status` with `empanelled` and `id_verified` only.
  - That endpoint writes only `empanelled` (the suspended/revoked rule still applies), `id_verified`, `status_source` and `status_synced_at`. A new directory record also gets `teacher_id`, `active`, `name` and `created_at`.
  - It never writes adaptive-practice fields, level or pathways, and never runs any teacher-offer workflow.
  - Create, update and publish require a status refresh no older than 10 minutes (`FRESH_SECONDS`) and `_match_eligible()`. Special Needs programmes also require `_adaptive_verified()`.
  - If the profile is unavailable or the status fields are missing, the request is refused.
- **New event fields (`inst_events`)**
  - `host_kind: "SPACE"`, `space_id`, `space_enquiry_id`, `teacher_id`, `teacher_name`, `space_snapshot`.
  - `organisation_id: null`.
  - `listing_approval{status: NOT_REQUESTED|PENDING|APPROVED|REJECTED, type: OWNER|ADMIN_ON_BEHALF, approver_user_id, approver_role, owner_id_at_approval, at, note|reason}`.
  - Fixed values: `pricing_type=FREE`, `participant_fee=null`, `external_venue_cost=null`, `economics_inputs=null`, `venue_type=EXISTING_SPACE`, `registration_access=CLOSED`.
- **Request validation**
  - Create and update models reject unknown fields (`extra="forbid"`).
  - Financial keys (the explicit list plus `MONEY_KEY_RE`) are rejected with 422.
  - `space_id` and `space_enquiry_id` can never be changed.
  - Capacity must not exceed the Space's capacity.
  - The programme's category must be one of the enquiry's focus areas: mind→MIND, body→BODY, special_needs→SPECIAL_NEEDS.
  - Editing is allowed in DRAFT only, and any edit resets the listing approval.
- **Teacher routes**
  - `POST /space-programmes` and `PATCH /{id}`: create and edit a draft.
  - `POST /{id}/submit`: send to the owner (sets PENDING).
  - `POST /{id}/publish`.
- **Owner and admin decisions**
  - `POST /{id}/owner-decision`: the current Space owner only, with an optional note.
  - `POST /{id}/admin-decision`: admin only, with a required reason.
  - Every decision and status change is appended to `inst_event_audit_log`.
- **Reads**
  - `GET /space-programmes/mine`, `/owner` and `/{id}`.
  - Each item includes its live `problems` list.
- **Publishing**
  - Requires all of the following, re-checked at publish time:
    - the Space is approved
    - the enquiry is accepted in principle, and its Space, teacher and owner still match
    - the teacher is eligible, and has verified adaptive practice for Special Needs
    - `listing_approval` is APPROVED and `owner_id_at_approval` equals the Space's current `owner_id`
    - the required fields are filled in
  - Publishing never calls teacher matching or offers.
- **Public reads** (`get_public_event`, `list_public_events`, and through them the `/events` list, the sitemap, page indexing metadata and structured data)
  - `space_public_problems()` re-runs every condition (including capacity no more than the Space's current capacity).
  - **Teacher-status freshness policy:** public reads never call the live backend. The last authoritative status in `inst_teacher_directory` (written by the narrow refresh or the existing directory sync) is used only while `status_synced_at` is younger than `PUBLIC_STATUS_TTL_SECONDS` (24 h). Older or missing status fails closed: 404, and the programme is left out of the list and sitemap.
    - The status is refreshed whenever the teacher creates, edits or publishes, or opens `/app/spaces/programmes`.
    - Create, edit and publish need a refresh within `FRESH_SECONDS` (10 min).
    - No in-process cache is used, so each public read checks the database records directly.
    - A `status_synced_at` set in the future is never treated as fresh.
  - Publish is single-winner: a second or concurrent publish returns 409.
  - Event structured data has no `offers` for Space programmes (`lib/event-seo.ts`).
  - If any condition fails, the programme returns 404 and is left out of listings. The record and its audit history are kept.
  - Indexing rule for Space programmes: PUBLIC, plus a published, live, completed or evergreen lifecycle, plus valid conditions. Organisation verification does not apply.
  - UNLISTED: direct link only, never indexed or listed.
  - PRIVATE and DRAFT: 404.
- **Teacher offers:** `_auto_assign_teacher()` returns `None` for Space events. This covers publish, directory sync, the adaptive-practice re-run, the re-offer after a decline and the cron sweep.
- **Registration and payments:** `participant_register`, payment intent, attach-order and confirm all return 409 for Space programmes. The public projection always sets `registration_open=false`.
- **Tests:** `backend/tests/test_space_programmes_phase5b.py`.

## Phase 6: Space programme participant registration and checkout (Preview)

- **Files**
  - Backend: `backend/space_registrations.py` (router `/api/institutional/space-registrations`, mounted in `server.py` after the space-programmes router).
  - Hooks in `backend/space_programmes.py`: `public_space_projection` shows the live registration state (open/closed reason, places left, fee); `_view` adds `space_seats_used`, `space_registration_closed`, `space_pricing`.
  - Website server: `lib/server/space-registrations.ts`.
  - Website request routes: `app/bff/spaces/registrations/route.ts` (register), `app/bff/spaces/registrations/[id]/[action]/route.ts` (verify, cancel, admin-cancel). The existing `app/bff/spaces/programmes/[id]/[action]` route also takes `pricing` and `registration`.
  - Pages:
    - `/events/[slug]/register` renders `SpaceRegisterView` for Space programmes.
    - `/app/spaces/registrations` and `/app/spaces/registrations/[id]` (confirmation and status).
    - `/app/spaces/programmes/[id]/participants`.
    - `/app/admin/space-registrations`.
  - Components: `SpaceRegisterView`, `SpaceRegisterPanel`, `RegSteps`, `SpaceRegistrationActions`, `SpaceRegistrationSettings`, `AdminRegCancel`.
  - Ask AI Guru moves to the bottom-left on `/events/*/register` so it doesn't cover the Register button.
- **Kept separate from existing flows**
  - Organisation programme registration and payment (`inst_registrations`, `participant/payment/*`) still refuse Space events (409).
  - Global Venues, retreats and organisation payments are unchanged.
- **Records: `space_registrations`**
  - Identity: `_id SPR-…`, `event_id`, `space_id`, `teacher_id`, `participant_id` / `participant_name` / `participant_email` (from the session only), `contact_phone` (for the payment gateway only).
  - Status: `status` (CONFIRMED | PENDING_PAYMENT | CANCELLED | EXPIRED | PAYMENT_FAILED | NOT_PLACED) and `active`.
  - Price: `pricing_mode`, `amount_minor`, `currency=INR` (set by the server).
  - Payment: `payment{provider, mode, status, order_id=spr_<id>, payment_session_id, payment_id, paid_at}`.
  - Refund: `refund{status, refund_id=rf_<id>, amount_minor}`.
  - Timing and history: `hold_expires_at`, timestamps, `history[]`. Every change is also written to `inst_event_audit_log` (entity `SpaceRegistration`).
  - Unique partial index on (event_id, participant_id) where `active=true` means one active registration per person.
  - `space_registration_webhooks` holds idempotency rows (keyed by sha256 of the signed body).
- **Capacity**
  - `inst_events.space_seats_used` counts CONFIRMED places plus PENDING_PAYMENT holds.
  - A seat is taken with a conditional `$inc` (`$expr used < capacity`).
  - The unique index is claimed first, so simultaneous requests from the same participant can't take two seats. A request that loses the race for the last seat is kept as NOT_PLACED.
  - A seat is released exactly once, by a conditional status change.
  - Unpaid holds expire after 20 minutes. The Cashfree order expires at the same time. Expiry is swept on every read and by `POST /sweep` (cron secret).
- **Who can register**
  - The participant must be signed in, and must not be the programme's teacher.
  - The terms must be accepted.
  - Re-checked live on every attempt: all Phase 5B public conditions (Space approved, enquiry accepted, owner approval valid for the current owner, teacher eligible and fresh, Special Needs qualification, capacity).
  - The programme must be PUBLIC, PUBLISHED or LIVE, not closed by the teacher or an admin, not yet started, and not full.
  - UNLISTED, PRIVATE and DRAFT programmes are refused.
- **Pricing**
  - `POST /programmes/{id}/pricing` is for the programme creator only: FREE, or PAID with a whole-rupee fee (₹1–₹10,00,000, checked by `pricing_engine`).
  - The fee can't change once anyone has registered.
  - It is stored in `space_pricing`. The Phase 5B fields (`pricing_type`, `participant_fee`, …) are never written, and 5B create/update still refuse every money field.
- **Payments**
  - Cashfree Payment Gateway, server-side only: create order, read order and payments, refunds. No payouts, settlements, transfers, commissions or beneficiaries.
  - A new checkout needs both `SPACE_CHECKOUT_ENABLED=true` and an allowed `payment_guard.checkout_decision`. Live mode is refused unless `SPACE_LIVE_PAYMENTS=true`, which is not authorised.
  - A place is CONFIRMED only when the server re-reads the order as PAID with a matching amount and INR currency (verify endpoint, webhook or sweep).
  - A mismatch is recorded and never confirmed.
  - A payment that arrives after the hold has ended is refunded in full automatically.
  - The webhook checks the HMAC-SHA256 signature over timestamp plus body using the client secret, enforces a 24-hour replay window, keeps live and test transactions apart, and is idempotent. It only triggers a re-read of the order; refund webhooks update the refund status.
  - PayPal is not used: Space programme fees are INR only, and international prices are deferred.
- **Cancellation**
  - A pending reservation can be cancelled any time.
  - A free place can be cancelled until the start date.
  - A paid place can be cancelled up to 2 days before the start date, with a full refund.
  - An admin can cancel any active registration, with a reason of at least 10 characters (full refund if paid).
  - Records are never deleted.
- **Who sees what**
  - Teacher: participant names and statuses only.
  - Admin: also email and payment details.
  - Space owner: places taken only, no participant data.
  - Public page: no participant data.
- **Tests (26):** `tests/test_space_registrations_phase6.py` (FREE path and safeguards, against the running server) and `tests/test_space_registrations_phase6_paid.py` (paid flow in-process against a mock Cashfree sandbox). Seed helper: `tests/space_reg_seed.py`.
- **Status (Preview, verification of 2026-11-06)**
  - **Free registration:** implemented and tested, end to end in the browser.
  - **Paid checkout:**
    - Implemented behind `SPACE_CHECKOUT_ENABLED`. The flag is not set in Preview, so paid checkout is OFF and paid programmes show "Online payment … isn't open yet".
    - Paid-path tests use *simulated* Cashfree sandbox responses (an in-process mock); no real gateway is called.
    - Real Cashfree sandbox checkout is still pending genuine sandbox credentials. The Preview Cashfree API base is the live host, which the checkout guard refuses on a preview origin.
  - **Live payments:** not authorised. `SPACE_LIVE_PAYMENTS` is not set and live mode is refused.
  - **Confirmation emails:** not implemented. No email is sent on registration, payment or cancellation.
  - **Production deployment:** not performed. Phase 6 exists only in Preview.
  - **PayPal:** not used for Space registration. A PayPal client ID exists elsewhere in Preview for other flows, but the Space registration code never uses PayPal (Space fees are INR only).
  - **Tests:**

    | Run | Result |
    |---|---|
    | Phase 6 tests | 26/26 passed |
    | Phase 5B tests | 29/29 passed |
    | Phase 5B and Phase 6 combined | 55/55 passed |
    | Wider payment and institutional regression (earlier run) | 462 passed, 12 skipped, 1 error |

  - **Three failures that existed before Phase 6:** `test_event_seo_og.py::TestEventMeta::test_description_built_sentence`, `test_event_seo_og.py::TestJsonLd::test_event_jsonld`, and `test_institutional_prompt6_participant.py::TestMyRegistrations::test_anti_poaching_second_participant_isolated` (an error: a participant record already in the database wasn't created by the test). All three reproduce with every Phase 6 change removed, so they are unrelated to Phase 6.
  - **Browser verification at 1280×800 (iteration_220), all passing:**
    - Public page: shows no participant data.
    - Register page: step bar, Free / ₹0, and Ask AI Guru docked bottom-left (no overlap with the register card or button).
    - Confirm → cancel → re-register: works. A cancelled registration shows step 1 and no cancel button.
    - Admin cancel: refuses a reason under 10 characters or made only of spaces.
    - Admin overview and participants list: show emails (admin only).
    - Sidebar links: working.
    - Teacher participant list: checked through the API only, because the TEST_ teacher has no login. Names and status only; Space owner gets 404.
  - **Open issues (not fixed):**
    - The terms box ticked straight after sign-in, before the page is ready, leaves Register disabled until it is ticked again or the page is reloaded.
    - My Registrations shows the raw date (`2026-12-06`), and the register and registration pages omit the weekday.
    - The sign-in tip from Ask AI Guru appears for signed-in users and covers some content.
    - At 1280×720, the Guru launcher covers the last line of the left Venue card.
    - Admin Cancel buttons are 40px tall.
    - The admin participants table has no registration ID column.

### Phase 6.1: UX corrections and closure (Preview, 2026-11-06)

**Terms-checkbox defect (fixed)**
- Root cause: right after sign-in, the register page is server-rendered. A tick made before React hydrates changed only the DOM checkbox. React 19 does not replay that change, so the `terms` state stayed false while the box looked ticked. Reproduced: tick made while not yet hydrated, box checked, submit still disabled 8 seconds later.
- Fix (`SpaceRegisterPanel`): on mount, the checkbox and phone inputs (accessed through refs) copy any value the user already entered into state.
  - No timers or reloads are used.
  - The server-side checks are unchanged.
- Regression test: `tests/test_phase61_terms_hydration.py` (Playwright against Preview).
  - It confirms the tick happened before hydration, that Register then enables, and that un-ticking disables it.
  - It submits nothing.

**Ask AI Guru**
- On `/events/*/register` the launcher is a 48px circle at left 8px, in the page gutter. At 1280px, content starts at 60px.
- No proactive tip is shown on register pages.
- The account-help tip ("Need a hand with your account?") is never shown to signed-in users (`context.ts`: `account` returns null when signed in).

**Dates and admin usability**
- Dates use `fmtDateLong` ("Sun, 6 Dec 2026") on the register page, My Programme Registrations and the registration status page. Timestamps keep `fmtDateTime` (UTC); stored values are unchanged.
- Admin Cancel controls are at least 44px tall.
- The admin participants table has a Registration ID column, shown to admins only.
- The teacher participant list no longer includes registration IDs anywhere, including the page HTML row keys.

**Teacher participant view (verified in the browser, iteration_221)**
- The designated `teacher.demo` account was bound to a TEST_ private draft programme for the check. Its verification and empanelment were not changed.
- Result: 200, names and statuses only. No emails, phone numbers, IDs or payment references in the HTML.
- The Space owner (employee.demo on a TEST_ Space) and an unrelated teacher (guru.demo) got the not-found screen.

**Admin sign-in redirect**
- Admin sign-in followed straight away by opening the participants page was tried 3 times; no redirect occurred.
- The earlier single occurrence couldn't be reproduced, so authentication was not changed. Likely cause: `/auth/me` timing out (10 seconds) on the first request after sign-in.

**Audit isolation**
- Cause: `test_space_programmes_phase5b.py::test_payments_blocked_and_no_auto_offer` called `/teacher/directory/sync`. That call re-runs matching across every unassigned published programme, writing `TEACHER_UNAVAILABLE` audit entries and `teacher_search_exhausted` flags on genuine programmes.
- The test now checks the sync code instead, confirming it can only offer programmes through `_auto_assign_teacher`.
- After the change, a full Phase 5B and Phase 6 run touched 0 genuine programmes.
- The 234 entries already written to genuine programme audit history were left untouched. The flags those runs set on genuine programmes are also unchanged and were not reverted.

**Tests (from `/app/backend`, `python -m pytest -q -p no:cacheprovider …`)**

| Suite | Result |
|---|---|
| `test_space_registrations_phase6.py` | 15/15 passed |
| `test_space_registrations_phase6_paid.py` (simulated sandbox) | 11/11 passed |
| Phase 5B (3 files) | 29/29 passed |
| Phase 5B and Phase 6 combined | 55/55 passed |
| `test_phase61_terms_hydration.py` | 1/1 passed (twice) |
| Browser round, iteration_221 | All 7 checks passed at 1280×720 and 1280×800 |

The three failures that existed before Phase 6 are unchanged (see above).

**Still true**
- Paid checkout is disabled (`SPACE_CHECKOUT_ENABLED` and `SPACE_LIVE_PAYMENTS` are unset), pending real Cashfree sandbox validation.
- Confirmation emails are not implemented.
- Nothing has been deployed to production.
- The participation models remain Commercial, Subsidised and Community.

**Remaining limitations**
- Preview only: the Next.js dev badge sits over the bottom-left launcher. This does not appear in production builds.
- At exactly 1280px the launcher clears the content by only 4px; narrower desktop widths may overlap.
- Opening a programme you have no access to shows the generic "Not available yet" screen.
- The `/login` "Email / Password" tab ignores clicks until that page hydrates. This is separate from the defect above.

## Phase 7: Community Partner Network (Preview)

- **Files**
  - Backend: `backend/community_partners.py` (router `/api/spaces/partners`, mounted in `server.py` before `spaces.router`).
  - Website request routes: `app/bff/spaces/partners/[...path]/route.ts` (an allow-list of paths, forwarded through `spacesCall` so identity comes from the session only).
  - Website server: `lib/server/community-partners.ts`.
  - Components: `CPWizard`, `CPReferralForm`, `CPAdmin` (`CPAdminActions` / `CPDocButton` / `CPRefStatus`).
- **Screens**
  - Public landing: `/spaces/community-partners`.
  - Application wizard: `/app/spaces/partner/apply`. Seven steps with save and resume: Locality (India Post PIN, up to 2 localities) → About you → Role and responsibilities → Optional team (up to 5) → MIND / BODY / SPECIAL NEEDS focus, activation plan and timeline → Documents (identity, address, photo) and declarations → Review and submit.
  - Status, confirmation and reference (`CP-YYYY-XXXXXX`), and the dashboard once active: `/app/spaces/partner`.
  - Spaces and verified-teacher discovery plus referrals: `/app/spaces/partner/network`.
  - My referrals: `/app/spaces/partner/referrals`.
  - Admin: `/app/admin/community-partners` (filter, search), `/[id]` (applicant, documents, decisions, localities, partner state, referrals, audit) and `/referrals`.
- **Collections** (new; nothing duplicated)
  - `community_partners`: one per user (unique `user_id`, unique `ref`); holds the application and partner state.
  - `cp_docs`: private documents, viewed by admins only; each view is audited.
  - `cp_referrals`.
  - `cp_audit`.
- **Reused** (read only)
  - `spaces` (approved, public projection `spaces._public`).
  - `inst_teacher_directory` (empanelled, public fields only).
  - `inst_events` (public Space programmes).
  - `space_registrations` (CONFIRMED count only).
  - `spaces_localities.validate_india_location`.
- **Lifecycle**
  - Application: draft → submitted → (info_requested → submitted) → approved / rejected. Every decision needs a reason of at least 10 characters.
  - Approval assigns the localities applied for; an admin can change them (with a reason).
  - Partner state: active / suspended / deactivated. Admins can re-activate after deactivation, with a reason.
  - Dashboard, discovery and referrals require approved + active, re-checked on every request, so a suspension takes effect immediately.
- **Boundaries**
  - The identity used is always the session `user_id`; an email-shaped ID is refused.
  - Partners get no rights in the Spaces owner/admin, teacher, enquiry or programme APIs.
  - Referrals are limited to the partner's assigned localities, need the referred person's consent, and can be read only by that partner and admins.
- **No money**
  - Every request model has extra="forbid", plus a money-key filter (fee, rent, revenue, share, commission, earning, payout, settle, payment, bank, upi, …). It covers the application, referrals and admin locality assignment; other requests have only the fixed fields and no money fields.
  - The dashboard shows only non-financial counts: localities, active Spaces by model (Commercial / Subsidised / Community), verified teachers, public programmes, confirmed participants, referrals.
  - Not built: 70:24:6 revenue split, earnings, statements, settlements, payouts, partner fees.
- **Tests**
  - `tests/test_community_partners_phase7.py`: 16/16 pass.
  - Wider Spaces, Space enquiries, Phase 5B, Phase 6 and Global Venues payment-guard regression: 219 passed, 10 skipped, 1 failed. The failure is `test_spaces_phase1b.py::test_no_financial_fields_in_spaces_code_or_db`, which flags the Phase 6 participant-fee wording (`SpaceRegisterPanel`, `SpaceRegistrationSettings`, `app/app/spaces/programmes/[id]/page.tsx`). It existed before Phase 7; Phase 7 wording no longer triggers it, and the test was not modified.
  - Browser test iteration_222: all 8 flows pass. The four small issues it found were fixed afterwards and not browser-retested:
    - the admin locality picker going blank after approval;
    - resubmit opening on the first step instead of Review;
    - no feedback when a referral status save fails;
    - button spacing.
- **Limitations**
  - No email notifications.
  - Teacher discovery matches the teacher directory's city against locality districts, because the directory has no PIN codes.
  - Referral follow-up is tracked manually by admins.
  - Production deployment has not been performed.

## Spaces Visual System (Master Visual Source of Truth) — implemented in Preview, awaiting owner review
- Scope switch: any page containing `.sp-page` (public `app/(public)/spaces/layout.tsx`; signed-in `AppShell` for `/app/spaces/**` and `/app/admin/{spaces,spaces-localities,community-partners,space-registrations}`) turns on `app/spaces-theme.css` via `body:has(.sp-page)`. The rest of the site is untouched.
- Tokens: teal #0F4C4A (serif headings), saffron #F28A1E→#E8690C (primary), saffron-soft #FDE7CC, ivory #FFFAF2, cream #FCF4E6, line #EEDFC8, green #22A447, lavender #EEE7FB, navy #1C2A47. Fonts: Merriweather 700/900 + Fira Sans (SIL OFL, self-hosted in `public/fonts/spaces`).
- Shared components: `components/spaces/ui.tsx` (SpacesPageHeader, SpBreadcrumbs, SpSwash, SpStepper, SpStepChip, SpSection, SpStat, SpEmpty, SpNote, SpIcon). Buttons: `.sp-btn-primary`, `.sp-btn-secondary`; `.sp-card`, `.sp-panel-peach/green`.
- Header: `SPACES_HEADER_NAV` (lib/site-nav.ts) adds "Spaces" only inside the Spaces section; HEADER_NAV unchanged.
- Imagery: cropped from the owner's reference screenshots into `public/brand/spaces/` (decorative only; never used as venue photos).
- Data rule: only genuine data is shown; empty states replace missing photos/data. No prices/reviews/hours invented.
- Test `test_no_financial_fields_in_spaces_code_or_db` narrowed (owner-approved): pricing wording allowed in code; revenue share/allocation, payouts, commissions, earnings, settlements, franchise remain prohibited; CP files now also scanned; DB key check unchanged.
- Admin listing control (Spaces): `POST /api/spaces/admin/{sid}/unlist` (approved → unlisted, reason required) and `/relist` (unlisted → approved). Nothing is deleted; history + space_audit entries recorded. Unlisted Spaces are excluded everywhere "approved" is required (public search/detail, enquiries, programmes, CP discovery). QA record spc_qa_preview_demo unlisted (owner-authorised). Enquiry regression suites now use a session-scoped temporary TEST_ fixture (`tests/_space_fixture.py`, `spc_test_enq_fixture`).
- Imagery: Spaces decorative photos are AI-generated (Gemini Nano Banana, owner-requested), 1376×768 / 1200×800, lotus-free. Lotus imagery/icons/🪷 emoji removed site-wide (owner request).

## Phase 7 finalisation (Preview, acceptance pending — NOT closed)
- Teacher service localities: `backend/teacher_service_localities.py` → `GET/PUT /api/spaces/teacher-localities/me` (teacher roles only, session identity, extra="forbid", `confirm: true` required). Collection `teacher_service_localities` (_id = user_id): primary {pin, locality_id, locality, district, state}, additional[≤4], pins[], source (manual | device_suggestion), confirmed, confirmed_at, updated_at, created_at. PINs validated with `validate_india_location`; locality/district/state derived from India Post data. The teacher directory and the production teacher backend are not written.
- UI: `/app/spaces/teaching-localities` (`TeacherServiceLocalities.tsx`), BFF `/bff/spaces/teacher-localities`; nav "Teaching Localities" under Teaching & Programmes.
- CP matching (`community_partners._public_teachers`): exact confirmed service PIN ∈ partner's assigned locality PINs (match="pin", locality name only); city/district text fallback ONLY for teachers with no PIN record (match="city"). No PINs, emails or ids in the response.
- Geolocation: NOT implemented — the India Post dataset has no coordinates, so a device location cannot be turned into a PIN without an external reverse-geocoding service (decision pending). Manual PIN entry is the path.
- Suspension/deactivation policy: proposed changes recorded in the final report; current logic unchanged pending review.
