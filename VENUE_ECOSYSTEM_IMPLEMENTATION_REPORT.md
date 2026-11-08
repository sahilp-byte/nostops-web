# NOSTOPS Venue Ecosystem — Implementation Report (Prompts 1–40)

**Scope:** Contribution → Discovery → Verification → Enrichment → Moderation → Publication, delivered on the web (Next.js App Router) against the existing **read-only** FastAPI backend.
**Guiding principle honoured:** *"Anyone may help NOSTOPS discover a place. NOSTOPS ensures that what it publishes is useful and trustworthy."*
**Backend:** NOT modified (agent is read-only). Where a capability needs the backend, the UI is fully built and **wired to an agreed contract** that lights up automatically once the backend ships it — with honest empty/disabled states in the meantime. **No fabricated public venues.**

---

## 1. What changed
**Public**
- `/venues` rebuilt: premium hero + ecosystem narrative (P16/17), submission-vs-publication trust model (P18), 4 visitor-journey CTAs (P19), real search + city/suitability filters (`VenueExplorer`), listing FAQ + FAQPage JSON-LD, mobile-first layout (P20).
- Venue detail (`/venues/[id]`): FAQ enriched (getting-there from route/Google address/nearby; best-time from open-months+climate), city internal links (gated to live pages), share button hydration fix (canonical URL).
- City pages (`/cities/[city]`, `/become-a-teacher/[city]`): search-friendly FAQ + FAQPage JSON-LD.
- Retreat detail FAQ: price-specific refund, richer getting-there, weather-informed packing.

**Admin — new "Venue Quality & Verification Console"** (`/app/admin/venue-review`, admin-only)
- Queue with 9-status lifecycle buckets + 7-metric pipeline KPIs (P22/23/34); rich filters + search.
- Review screen: "Review at a glance" summary (P36), NOSTOPS assessment (P26), duplicate detection (P27), quality/completeness score (P35), Submitted-vs-Enriched compare + Google/AI enrichment (P24/25), edit-before-publication (P31), publish/unpublish/hide/archive + visibility badge (P32), admin notes (P29), audit trail (P30), ownership claims (P33), moderation actions (P28).

**App shell:** fixed a pre-existing notifications timestamp hydration warning.

## 2. Components reused
`VenueCard`, `RetreatCard`, `RetreatFaq`, `JsonLd`, `AppShell`/nav, `TeacherCard`, existing BFF helpers (`badOrigin`, `backendFetch`, `getSessionUser`), `postBff`, `lib/geo` (haversine), `lib/format` (titleCase/inr), `lib/site` (canonical), `lib/seo` (normalizeJsonLd), `lib/cancellation` (refundFor), and the existing server loaders `getVenues/getVenue/getRetreatsAtVenue/getVenueGoogle`, `getPublicRetreats`, `getCities/citySlug`, `getRetreatInsight` (NOSTOPS AI).

## 3. New components
- `components/venues/VenueExplorer.tsx` (public search/filter)
- `components/app/admin/VenueReviewQueue.tsx`
- `components/app/admin/VenueReviewActions.tsx`
- `components/app/admin/VenueAdminNotes.tsx`
- `components/app/admin/VenueEditForm.tsx`
- `lib/server/venue-review.ts` (admin data layer + duplicate/assessment/quality/metrics logic)
- `lib/venue-review-shared.ts` (client-safe types/constants)
- Pages: `app/app/admin/venue-review/page.tsx`, `.../[id]/page.tsx`
- BFF: `app/bff/admin/venue-submissions/[id]/[action]`, `/notes`, `/edit`

## 4. New APIs / DB fields (BACKEND — requested, not built by agent)
All specified in `/app/BACKEND_REQUEST_venue_submissions.md` (v1–v4 + copy-paste prompt). Frontend consumes these exact shapes:
- `POST /api/venue-submissions` (public create), `GET /api/venue-submissions/{id}` (status).
- `GET /api/admin/venue-submissions[?limit,status]`, `GET /{id}`.
- `POST /api/admin/venue-submissions/{id}/{approve|reject|request-info|mark-duplicate|archive|publish|unpublish|hide}`.
- `PATCH /api/admin/venue-submissions/{id}` (edit, retain provenance).
- `POST /{id}/notes`; detail returns `notes[]`, `history[]`, `claims[]`, `duplicate_candidates[]`, `updated_at`.
- Optional: `POST /{id}/merge`, `POST /{id}/claims/{claim_id}/{verify|reject|require-verification}`.
- New `venue_submission` model + 9-status lifecycle. **Public `/venue-partners` must return only `status==='published'`.**
- Working **admin persona** (`role:"admin"`) — current `admin.demo` resolves to teacher.

## 5. Existing integrations reused
- Emergent Managed Object Storage (cover photos), Google Places/Maps/Reviews/Photos (existing `/venue-enrichment` via BFF photo proxy), NOSTOPS AI venue insight (`getRetreatInsight`, Emergent LLM key), Emergent Google Auth (session), Cashfree/Razorpay (unchanged).

## 6. New integrations
- **None.** No new third-party integrations were added.

## 7. Submission lifecycle (P22/32)
`submitted → under_review → needs_information → approved → published`, plus `hidden` (temporarily hidden), and terminal `rejected` / `duplicate` / `archived`. A DB record is **never** public unless `published`.

## 8. Admin moderation capabilities
Review queue + filters/search; at-a-glance summary; NOSTOPS assessment + quality score; duplicate detection (name+city+geo); Submitted-vs-Enriched + Google/AI enrichment; edit before publication (provenance retained); approve/reject(reason)/request-info(message)/mark-duplicate/archive; publish/unpublish/temporarily-hide; internal admin notes; audit trail; ownership-claim review (never auto-grants). All admin writes are CSRF-guarded + admin-only; live actions activate with the backend.

## 9. SEO changes
- FAQPage JSON-LD on `/venues`, both city page types, and (existing) venue/retreat detail; enriched retreat + venue FAQ answers.
- `/venues` CollectionPage/ItemList/BreadcrumbList; per-venue LodgingBusiness + Breadcrumb (existing, retained).
- Contextual internal linking venue↔city↔retreat↔teacher (all gated to live pages — no 404 links).
- Admin pages are `robots: noindex, nofollow`.

## 10. Security / permission changes (P37)
- Console pages redirect non-admins to `/app` and logged-out to `/login`.
- All admin BFF routes enforce `role==='admin'` **and** CSRF (`badOrigin`).
- Admin-only data (submitter contact, notes, audit, claims) is served exclusively through the admin-gated data layer; public loaders return only `PublicVenue`/`PublicRetreat` (no submitter/notes/contact). Verified: the admin data layer is imported only by admin pages/components.

## 11. Assumptions
- Backend will implement the agreed contract field-for-field (defensive mappers already tolerate common field-name variants).
- "Add a venue" and "Suggest a venue" both route to the existing authenticated studio (`/app/venue/centers/new`) until the public `POST /venue-submissions` endpoint exists (per prior user instruction — no mock form).
- Duplicate detection currently uses name + city + geo proximity over the live directory; phone/website/place-id matching strengthens server-side once those fields are exposed.
- The 5 existing `/venue-partners` are the real published set; submission buckets are legitimately empty today.

## 12. Business-policy decisions requiring NOSTOPS approval
- **Public submission API + abuse controls** (captcha/rate-limit) and whether unauthenticated suggestions are allowed.
- **Admin persona/roles** — who gets `admin`; provide a real admin account (blocks admin QA today).
- **Claim verification policy** — evidence required before "verified"; SLA for review.
- **Notification policy** — whether reject/request-info emails the submitter (reuse existing infra).
- **Merge policy** — what fields may be safely merged, and audit requirements.
- **Refund/host-note wording** surfaced in FAQ is derived from existing on-site copy; confirm canonical policy text.

---

### QA status (P40)
- Public (venues page/search/filters/cards/detail/CTAs/mobile+desktop/SEO/structured-data/internal-links): PASS (testing agent iter57 + share/FAQ regressions).
- Admin (queue/filters/review/assessment/duplicate/quality/edit/notes/audit/claims/visibility/permissions): manually verified end-to-end (login-as-non-admin preview, then strict gate restored). Live moderation writes await backend + admin persona.
- Regression (venues/retreats/teachers/auth/APIs/Google/AI/SEO/public pages): PASS.
- Submission (auth/validation/create/duplicate/status/photos/persistence): **blocked on backend** — UI + contract ready.
