# Backend Request — Public "Add / Suggest a Venue" submission endpoint

**Host:** `https://pro-learn-connect-1.emergent.host` · **Priority:** P2 (feature enabler)

## Why
The public Venues page (`/venues`) was repositioned to serve two purposes — **Discover** venues and **List** a venue. The "Add your venue" and "Who can add a venue?" sections invite a broad set of contributors (owners, managers, retreat hosts, teachers, hospitality businesses, organisations, and community members) to submit venues for consideration.

Today the ONLY way to create a venue is the **authenticated** venue-owner studio (`POST /api/retreats/centers`, host-eligibility required). Verified live:
- `POST /api/venue-partners` → **405** (public directory is read-only GET)
- `POST /api/venues/submit`, `/api/venue-suggestions`, `/api/venue-leads`, `/api/venues/suggest` → **404** (do not exist)

So there is **no way for a logged-out person (or a non-host) to suggest a venue**. The web app currently routes "Add your venue" to the authenticated studio (logged-out users are sent to login) — which is correct but excludes community members / owners without accounts.

## Requested endpoints

### 1) Create a public venue submission (NEW, unauthenticated, abuse-resistant)
```
POST /api/venue-submissions
{
  venue_name: string,            // required
  city: string,                  // required
  state?: string,
  address?: string,
  lat?: number, lng?: number,
  capacity?: number,
  venue_type?: "studio|retreat_centre|resort|ashram|community|hotel|other",
  best_for?: string[],           // ["yoga","retreats","workshops","corporate","camps","training"]
  yoga_suitable?: boolean,
  retreat_suitable?: boolean,
  indoor?: boolean, outdoor?: boolean,
  country?: string,              // default "India"
  accommodation?: boolean, room_types?: string[], amenities?: string[],
  website_or_maps_url?: string,  // Google Maps / site link (used for enrichment)
  google_place_id?: string,
  photos?: string[],             // object-storage keys or URLs (optional)
  submitter_role: "owner|manager|host|teacher|business|organisation|community",
  submitter_name: string,        // required
  submitter_email: string,       // required
  submitter_phone?: string,
  relationship_note?: string,    // how they know / represent the venue
  message?: string
}
-> 201 { submission_id, status: "pending_review" }
```
Requirements: rate-limit / captcha-friendly (public, high-abuse surface); store with `status` in `pending_review | verifying | approved | rejected | published`; NEVER auto-publish. Deduplicate on (google_place_id) or (venue_name + city). Notify the NOSTOPS moderation queue (email/in-app) on new submission.

### 2) Moderation review (admin only)
```
GET  /api/admin/venue-submissions?status=pending_review   -> list (admin auth)
POST /api/admin/venue-submissions/{id}/approve            -> creates/links a venue-partner record, status=published
POST /api/admin/venue-submissions/{id}/reject  { reason } -> status=rejected (optional notify submitter)
```
Approval should reuse the existing venue-partner model + Google enrichment + NOSTOPS AI so approved submissions flow into the same `/venue-partners` directory the public page already reads.

### 3) (Optional) Submitter status lookup
```
GET /api/venue-submissions/{submission_id}  -> { status } (no PII of reviewers)
```

## Acceptance
- Anonymous `POST /api/venue-submissions` with valid body → 201 `pending_review`; missing required field → 422.
- Submission is NOT visible in public `GET /api/venue-partners` until an admin approves it.
- Admin approve → the venue appears in `GET /api/venue-partners` (and thus on `/venues`).

## Frontend readiness
Once (1) ships, the web team will add a public multi-step "Suggest a venue" form (Object-Storage photo upload already available) that posts to `/api/venue-submissions` via a BFF, plus a submitter status page. Until then, "Add your venue" points to the authenticated studio (`/app/venue/centers/new`).

---

# v2 — FULL Admin "Venue Quality & Verification Console" (FRONTEND ALREADY BUILT)

**Status:** The web console is **built, admin-gated and live** at `/app/admin/venue-review` (queue + review screen + Submitted-vs-Enriched compare + moderation buttons). It currently reads the real `/api/venue-partners` directory as the **Published** bucket and shows **honest empty states** for every submission bucket because the endpoints below return 404. **Implement the endpoints + response fields below exactly and the console lights up end-to-end with ZERO frontend changes.**

Everything is called server-side through an authenticated BFF; the browser never talks to the backend directly. All routes are **admin-only** (see "Admin persona" below).

## A. Lifecycle (canonical statuses) — PROMPT 22
Store `status` as one of these 8 values:
```
submitted → under_review → needs_information → approved → published
                                   ↘ rejected   ↘ duplicate   ↘ archived
```
- `submitted` new, unreviewed. `under_review` a moderator has it. `needs_information` waiting on submitter. `approved` accepted, not yet in the public directory. `published` live in `/api/venue-partners`. `rejected` / `duplicate` / `archived` are terminal.
- The frontend also tolerates aliases (`pending_review`→submitted, `verifying`→under_review, `pending`→submitted), but please emit the canonical values.

## B. Endpoints the console calls (EXACT paths)
```
GET  /api/admin/venue-submissions?limit=200        # queue list (admin)
GET  /api/admin/venue-submissions/{submission_id}  # one record for the review screen (admin)
POST /api/admin/venue-submissions/{submission_id}/{action}   # admin moderation write
        action ∈ approve | reject | request-info | mark-duplicate | archive
        body: { "note"?: string, "reason"?: string }   # ≤2000 chars, optional
```
Readiness probe: the console calls `GET /api/admin/venue-submissions?limit=1`; **any 200 turns the whole console "live"** (enables the action buttons). While it 404s, buttons stay disabled with an honest "activates when backend is live" note.

### B1. List response (either shape accepted)
```
200  { "submissions": [ <SubmissionSummary>, ... ] }     # preferred
  or 200  [ <SubmissionSummary>, ... ]
```
`SubmissionSummary` (only these keys are read for the queue rows; all optional except id+name):
```
submission_id | id | _id      : string   (REQUIRED — row key + detail link)
venue_name | name             : string   (REQUIRED)
city, state                   : string
venue_type                    : string
status                        : one of the 8 canonical statuses
submitter_role | submitter_type : "owner|manager|host|teacher|business|organisation|community"
submitter_name                : string
created_at | submitted_at     : ISO-8601 string  (used for Newest/Oldest sort)
website_or_maps_url | website : string
address                       : string
verification_status           : "verified" | "unverified" | string
claimed                       : boolean
```

### B2. Detail response (review screen — PROMPT 24) — `{ "submission": {...} }` or the object directly
All optional except `submission_id|id|_id` and `venue_name|name`. Field names read verbatim by the frontend:
```
submission_id|id|_id, venue_name|name, venue_type, status,
city, state, country (default "India"), address,
website_or_maps_url|website, description|message,
capacity:number, indoor:boolean, outdoor:boolean,
yoga_suitable:boolean, retreat_suitable:boolean, sattvic_certified:boolean,
best_for:string[], amenities:string[], photos:string[] (URLs or object-storage keys resolvable to URLs),
open_months:string[], weather_band:string, getting_there:string, nearby_attractions:string[], video_url:string,
submitter_role|submitter_type, submitter_name, submitter_email, submitter_phone,
relationship_note, created_at|submitted_at
```

### B3. Action semantics — PROMPT 21/22
```
approve        → status=approved, then create/link a venue-partner via the EXISTING model
                 + run the EXISTING Google Places + NOSTOPS AI enrichment, then status=published.
                 Result must appear in GET /api/venue-partners (and thus /venues).
reject         → status=rejected;  body.reason optionally emailed to submitter.
request-info   → status=needs_information; body.note is the question sent to the submitter.
mark-duplicate → status=duplicate (optionally store duplicate_of=<venue_partner_id|submission_id>).
archive        → status=archived (hidden from active queues; recoverable).
```
Response: `200 { ok: true, ...updated }`. Non-2xx → `{ error | detail }` (surfaced verbatim in the UI). Enforce legal transitions server-side.

## C. Admin persona (BLOCKER for testing this console)
The console redirects any non-`admin` user to `/app`. Today `admin.demo@nostops.com` resolves to a **teacher** persona, so no one can reach the console. Please provide a working **admin** account/role (JWT `role: "admin"`) — e.g. seed `admin.demo@nostops.com / <pw>` with `role=admin`, or document how to mint one. Without this, the admin console cannot be QA'd. (See `/app/BACKEND_REQUEST_admin_persona.md` if present.)

## D. Enrichment reuse (PROMPT 25) — do NOT rebuild
The review screen already renders Google Places rating/reviews/photos/maps + NOSTOPS AI via the EXISTING `/venue-enrichment` + venue-insight path once a submission is linked to a Google place (`google_place_id` or `website_or_maps_url`). Just persist that link on approve; no new enrichment API needed.

## E. Acceptance (v2)
1. `GET /api/admin/venue-submissions?limit=1` as admin → 200 (console goes "live").
2. Queue lists submissions with correct bucket counts; filters (status/city/state/type/submitter/verification/claimed) + search (name/city/submitter/website/address) operate over the list.
3. `GET /api/admin/venue-submissions/{id}` returns all B2 fields → review screen fully populated.
4. `POST …/{id}/approve` → record becomes `published` and shows up in `GET /api/venue-partners`.
5. `reject` / `request-info` / `mark-duplicate` / `archive` transition status and are reflected on refresh.
6. Non-admin / logged-out requests to any `/api/admin/venue-submissions*` → 401/403.

---

# COPY-PASTE PROMPT FOR THE BACKEND TEAM

> **Task:** Implement the NOSTOPS Venue Submission + Admin Moderation API. The web "Venue Quality & Verification Console" is already built and admin-gated at `/app/admin/venue-review`; it will light up with zero frontend changes once these ship.
>
> **1. Data model `venue_submission`** with fields: `submission_id` (pk), `venue_name`, `city`, `state`, `country`(default "India"), `address`, `lat`, `lng`, `venue_type`, `best_for[]`, `yoga_suitable`, `retreat_suitable`, `indoor`, `outdoor`, `sattvic_certified`, `capacity`, `amenities[]`, `photos[]`, `open_months[]`, `weather_band`, `getting_there`, `nearby_attractions[]`, `video_url`, `website_or_maps_url`, `google_place_id`, `submitter_role` (owner|manager|host|teacher|business|organisation|community), `submitter_name`, `submitter_email`, `submitter_phone`, `relationship_note`, `message`, `verification_status` (unverified|verified), `claimed` (bool), `duplicate_of`, `status`, `created_at`, `updated_at`.
>
> **2. Status lifecycle (8):** `submitted → under_review → needs_information → approved → published`, plus terminal `rejected`, `duplicate`, `archived`. Never auto-publish.
>
> **3. Public create (unauthenticated, abuse-resistant):** `POST /api/venue-submissions` (body per §1 above; required: `venue_name`, `city`, `submitter_role`, `submitter_name`, `submitter_email`) → `201 { submission_id, status:"submitted" }`. Rate-limit/captcha-friendly. Dedupe on `google_place_id` else (`venue_name`+`city`) → set `status=duplicate` + `duplicate_of`. Notify the moderation queue. Never appears in `/api/venue-partners` until approved.
>
> **4. Admin queue + review (JWT role=admin only):**
> `GET /api/admin/venue-submissions?status=&limit=` → `{ submissions: [ {submission_id, venue_name, city, state, venue_type, status, submitter_role, submitter_name, created_at, website_or_maps_url, address, verification_status, claimed} ] }`.
> `GET /api/admin/venue-submissions/{id}` → the full record (all §1 fields).
>
> **5. Admin actions (JWT role=admin only):** `POST /api/admin/venue-submissions/{id}/{action}` where action ∈ `approve|reject|request-info|mark-duplicate|archive`, body `{ note?, reason? }`. `approve` must create/link a **venue-partner using the existing model + existing Google Places + NOSTOPS AI enrichment** and set `status=published` so it flows into the existing `GET /api/venue-partners`. Others just transition status (optionally email the submitter using the note/reason). Return `200 { ok:true, ...updated }`; enforce legal transitions; 401/403 for non-admin.
>
> **6. Admin persona:** provide a real `role:"admin"` account (e.g. seed `admin.demo@nostops.com`) so the console can be tested — currently `admin.demo` resolves to a teacher and cannot reach the console.
>
> **7. Optional:** `GET /api/venue-submissions/{id}` public status lookup returning only `{ status }` (no reviewer PII).
>
> **Acceptance:** admin `GET …?limit=1`→200; anon create→201 & hidden from `/venue-partners`; admin `approve`→venue visible in `/venue-partners`; other actions transition status; non-admin→403.

---

# v3 — Assessment, Duplicate signals, Notes & Audit (PROMPTS 26-30) — frontend BUILT

The review screen already renders these; wire the backend fields/endpoints below and they populate automatically.

## AI assessment (PROMPT 26)
The console computes a deterministic decision-support assessment (classification, yoga/retreat suitability, facilities, location, information-completeness %, missing fields, data inconsistencies, potential concerns, potential-duplicate flag) from the submitted fields + the EXISTING venue-insight AI. **No new endpoint required.** If the backend later produces a richer AI verdict, return it under the detail object and we can surface it; keep it clearly positioned as decision support (admin decides).

## Duplicate detection signals (PROMPT 27)
The console already detects likely duplicates against `/api/venue-partners` using **name similarity + same city + geo proximity (haversine)**. To strengthen this server-side, please also expose on submission records (and, ideally, on venue-partners): `phone`, `website`/`website_or_maps_url`, `google_place_id`, `lat`, `lng`. Optional server dedup response field on the detail: `duplicate_candidates: [{ venue_id, name, city, reasons[] }]` (frontend will merge/display them). Optional merge endpoint (admin-confirmed only, NEVER automatic):
```
POST /api/admin/venue-submissions/{id}/merge  { into_venue_id }   -> 200 { ok, venue_id }
```

## Admin notes (PROMPT 29) — internal, never public
Return existing notes on the detail object as `notes: [{ id, author, text, created_at }]`, and accept new ones:
```
POST /api/admin/venue-submissions/{id}/notes   { text }   -> 201 { ok, note:{id,author,text,created_at} }   (admin only)
```
The console already posts here via a CSRF-guarded BFF and shows a disabled state until this returns non-404. Notes MUST never be exposed on any public endpoint.

## Audit trail (PROMPT 30)
Return an action history on the detail object as `history: [{ action, actor, at, from, to, note }]` (newest last is fine; the UI renders a timeline). Record at least: `submission_received, reviewed, information_requested, information_supplied, approved, rejected, published, unpublished, marked_duplicate, edited, archived`, each with the admin (`actor`), timestamp (`at`) and status change (`from`→`to`). Reuse existing audit infra if present.

### Additions to the COPY-PASTE PROMPT above
> **8. Admin notes:** return `notes:[{id,author,text,created_at}]` on the detail; `POST /api/admin/venue-submissions/{id}/notes {text}` → 201 (admin only, never public).
> **9. Audit history:** return `history:[{action,actor,at,from,to,note}]` on the detail, logging submission_received/reviewed/information_requested/information_supplied/approved/rejected/published/unpublished/marked_duplicate/edited/archived.
> **10. Duplicate signals:** expose `phone`, `website`, `google_place_id`, `lat`, `lng`; optional `duplicate_candidates[]` on the detail; optional admin-confirmed `POST …/{id}/merge {into_venue_id}` (never auto-merge).

---

# v4 — Edit, Visibility, Claims, Metrics & Quality (PROMPTS 31-35) — frontend BUILT

## Edit before publication (PROMPT 31)
Frontend POSTs corrected fields to the CSRF-guarded BFF, which PATCHes the record:
```
PATCH /api/admin/venue-submissions/{id}   { venue_name?, venue_type?, city?, state?, address?, website_or_maps_url?, description?, capacity? }   (admin only) -> 200 { ok, ...updated }
```
MUST retain the **original submitted values** (provenance/history) — corrections are edits on top, never a silent overwrite that destroys the original. The review screen already shows "Submitted vs enriched"; keeping originals lets that stay accurate.

## Publish / Unpublish / Temporarily hide / Archive (PROMPT 32)
Add `hidden` to the status set (9 total). The action endpoint already accepts these:
```
POST /api/admin/venue-submissions/{id}/publish     -> status=published (visible in /api/venue-partners)
POST /api/admin/venue-submissions/{id}/unpublish   -> status=approved  (removed from /api/venue-partners)
POST /api/admin/venue-submissions/{id}/hide        -> status=hidden    (removed from /api/venue-partners)
POST /api/admin/venue-submissions/{id}/archive     -> status=archived
```
**CRITICAL:** existing in the DB must NEVER imply public visibility. A venue appears in the public `/api/venue-partners` (and thus `/venues`) **only when `status === 'published'`**. `approved`, `hidden`, `archived`, `duplicate`, `rejected` must all be excluded from public endpoints.

## Ownership claims (PROMPT 33)
Return claims on the detail object as `claims: [{ id, claimant, relationship, supporting, contact, status, created_at }]` where `status ∈ claim_submitted | verification_required | verified | rejected`. Optional admin claim actions (never auto-grant management privileges — verification is mandatory):
```
POST /api/admin/venue-submissions/{id}/claims/{claim_id}/{verify|reject|require-verification}   (admin only)
```
A submitted claim MUST NOT, by itself, grant any management/ownership privileges.

## Metrics (PROMPT 34) & Quality score (PROMPT 35)
Both are computed by the frontend from the list/detail (pipeline counts, potential-duplicate count via name+city+geo, 7-day "recently *", and a 13-indicator completeness/quality score). **No new endpoints required.** To improve accuracy, please include `updated_at` on records (drives "Recently updated") and the duplicate signals from v3. The quality score is an internal QC aid and must never gate publication on its own.

### Additions to the COPY-PASTE PROMPT above
> **11. Edit:** `PATCH /api/admin/venue-submissions/{id}` (admin) with the listed fields, retaining original submitted values (provenance) — never destroy the original.
> **12. Visibility:** add `hidden` status; support `publish|unpublish|hide|archive` actions; public `/api/venue-partners` returns ONLY `status==='published'` — DB presence ≠ public visibility.
> **13. Claims:** return `claims:[{id,claimant,relationship,supporting,contact,status(claim_submitted|verification_required|verified|rejected),created_at}]`; optional `POST …/{id}/claims/{claim_id}/{verify|reject|require-verification}`; a claim NEVER auto-grants management. Also include `updated_at` on records for the "Recently updated" metric.
