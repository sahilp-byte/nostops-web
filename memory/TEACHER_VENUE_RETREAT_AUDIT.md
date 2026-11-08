# NOSTOPS — Teacher, Venue and Retreat End-to-End Workflow Audit (v2 re-audit)

**Date:** 2026-06 (fork) · **Supersedes:** v1 of this file (git history) · **Mode:** inspection + safe tests, report only (no product code changed)
**What was done:** code re-inspection after the 4 directives (hide test retreats, protect live venues, fair AI onboarding, safer
retreat publishing); read-only GETs against the live backend with the demo accounts; sign-ups the backend must reject; a new
automated suite (§7) run against this preview's local backend + web preview only.
**Not done:** no live-backend writes, no production-data change, no payment completed, no deployment, no defect fixed.
**Evidence legend:** **V** verified by a call/test in this audit · **C** from code · **S** suspected.
**Raw live evidence:** `/app/memory/audit_evidence_live_2026-06.json` (script `/app/scripts/audit_live_readonly.py`).

> ⚠ **Correction: the payment gateway is live Cashfree, not the sandbox (TVR-26).** This preview's backend uses the **live**
> Cashfree account (`CASHFREE_API_BASE=https://api.cashfree.com/pg`). The checks run after the 4 directives (the
> `qa_venue_pending_flow.py` script, and the testing agent clicking Pay) therefore created a few **real but unpaid** checkout
> orders. No payment was completed and no money moved; unpaid orders expire on their own. Earlier summaries called this "sandbox", which
> was wrong. The new suite refuses to create orders unless the gateway is the sandbox, and the QA script is now guarded too.

---

## 1. What changed since v1

| v1 defect | Status now | Evidence |
|---|---|---|
| TVR-02 QA/duplicate retreats public | **Website fixed, live backend still dirty.** 11 ids + QA title/venue patterns hidden from lists, city pages, sitemap; detail → 404 | V (tests `test_hidden_test_retreats_are_404`, `test_sitemap_excludes_hidden_retreats`); live list still has 6 (all QA/dupes) |
| TVR-03 retreat venue = free text | **Web fixed; backend says it enforces.** BFF requires a listed venue and takes name/city/state from that venue record. Live OpenAPI now documents `venue_partner_id` as REQUIRED (422). Legacy public retreats still have no venue | V/C — write path not tested (would create live data) |
| TVR-05 owner edit unpublishes live venue | **Fixed** — pending changes, typo auto-approve, admin approve/reject | V (12 tests) |
| TVR-06 AI data not versioned | **Fixed** — `venue_revisions` with owner/admin/ai/system tags; AI-sourced text never auto-applied | V |
| TVR-07 Google content on free listings | **Fixed** — only grandfathered + paid venues; proxies refuse other place ids and name lookups | V |
| TVR-08 AI purchase keyed by email | **Mostly fixed** — tied to one listing via the signed edit link; 409 if already paid; unfinished checkout re-used; duplicate payment flagged. Still open: refunds don't revoke, UI price is a hard-coded copy, simultaneous-click race (TVR-24) | V |
| TVR-13 retreat validation | **Partly fixed** — seats ≤ listed venue capacity (UI + BFF). Still open: past start dates, no PATCH date checks, ₹500 floor only in web, no idempotency key | V |
| TVR-01, 04, 09, 10, 11, 12, 14, 15, 16, 17 | **Still open** (details §4) | V/C |

---

## 2. Workflow diagrams (current)

### 2.1 Teacher
```mermaid
flowchart TD
  A[/register · /join/] -->|BFF /bff/auth/register|role → remote /auth/*| B[Account]
  B --> C[/app/teacher/onboarding — requireOnboardedTeacher (profile_complete)/]
  C --> D[Profile + media]
  D --> E{India?}
  E -->|yes| F[InstaKYC — remote /kyc/*]
  E -->|no| G[Didit — local /api/verification/*]
  F --> H[Admin KYC review — remote /admin/kyc/* ⚠ reads open to any signed-in user]
  H --> I{Empanelment — remote /admin/empanelment/*}
  G --> L[Local Council decision ⚠ not synced to remote]
  I --> M[(remote is_verified / is_empanelled / tier)]
  M --> N[/teachers directory — Hybrid policy/]
  M --> O[host-eligibility (backend) vs canOperate (web) ⚠ can disagree]
```

### 2.2 Venue
```mermaid
flowchart TD
  A[/venues/submit — FREE/] -->|captcha · honeypot · spam · 3/h IP · 5/day email · dedupe name+city| B[(venue_submissions: submitted)]
  B --> C[Admin /app/admin/venue-review — approve · publish · reject · hide …  (history + notes + email)]
  C --> D[(approved / published = LIVE)]
  D --> E[/venues directory = remote venue_partners ∪ local published/]
  D -.signed edit link 45 min.-> F[/venues/submit/edit/]
  F -->|typo-size fix to description/address/state| D
  F -->|any other change| P[(pending_changes + proposed revision)]
  P -->|admin approve| D
  P -->|admin reject| D
  F -->|contact details only| D
  D --> R[(venue_revisions — restore any applied version)]
  F -->|Unlock AI onboarding| G[/venues/ai-onboarding?token= — ₹2,359 / US$30 one-time/]
  G -->|create-order (409 if paid · re-use unfinished)| H[(ai_onboarding_orders)]
  H -->|status poll / HMAC webhook → authoritative re-read| I[(ai_onboarding_entitlements by venue id)]
  I --> J[AI website import → owner review → saved as pending (AI-tagged)]
  I --> K[Admin confirms Google place → Google photos/reviews on venue page]
```

### 2.3 Retreat
```mermaid
flowchart TD
  A[/retreats/host/] --> B{Signed in?}
  B -->|no| L[/login/]
  B -->|yes| C[remote /retreats/host-eligibility]
  C -->|ineligible| X[BFF 403]
  C -->|eligible| D[/app/teacher/retreats/new — 9-step wizard/]
  D --> E[Venue picker = 5 remote venue_partners only ⚠ local listings not bindable]
  E --> E2[name/city/state locked from venue · seats ≤ venue capacity]
  D --> F[Cover upload — host only, JPG/PNG/WebP ≤5 MB]
  D -->|Publish| G[/bff/teacher/retreats/create — validates, re-checks venue id + capacity/]
  G --> H[remote POST /retreats/create (documents venue required)]
  H --> I[(retreat)]
  I --> J[/retreats list + detail + sitemap — QA/duplicate filter/]
```

---

## 3. Rule-by-rule verification

| # | Rule | Result | Evidence |
|---|---|---|---|
| A1 | Registered / verified / Council-empanelled are distinct | ✅ web model · ⚠ two engines | C `lib/teacher-status.ts` (3 attributes). V: teacher.demo now `host_type=teacher_guru` (L3) and eligible; local Council `EMPANELLED` still never reaches remote (TVR-10). `/auth/me` exposes no status fields, so the web relies on separate reads (TVR-09) |
| A2 | Only authorised personnel approve verification/empanelment | ✅ web + local · ❌ live reads | V: 5 admin KYC/empanelment reads → **200 for learner, teacher, guru and HR** (401 anon, 200 admin) — 20 xfail tests (TVR-01). V: all local venue moderation/AI-admin routes → 403 for teacher/guru/employee/hr (40 tests) |
| A3 | Profile visibility respects publication & privacy rules | ⚠ | V: 39 public profiles; 24 neither verified nor empanelled (Hybrid policy, TVR-12); 4 demo/test handles public (`demo-user-india`, `yoga-shikshak-demo`, `test11`, `riya-admin-m`). Privacy ✅: no email/phone/KYC/bank keys in the public payload, no contact emails in `/teachers` HTML (tests) |
| A4 | City & specialisation filters match records | ⚠ | V: **27 of 39** public teachers have city "India"/blank → missing from every city filter (TVR-11). Specialisations mix styles and single asanas; no specialisation filter |
| A5 | Failed uploads & incomplete onboarding | ✅ mostly | V: cover upload → 401 anon, 403 non-host, 400 for no image / wrong type / unreadable / >5 MB. ❌ non-image bytes labelled JPEG accepted (TVR-15). C: onboarding guard uses `profile_complete` |
| B1 | Basic venue listing is free | ✅ | V `test_free_listing_is_reviewed_then_published_with_audit_trail` — no order, published after admin review |
| B2 | Creating a retreat is free | ✅ | C: no creation fee path; V: platform fee 15 % on seats for all eligible hosts |
| B3 | AI onboarding ₹1,999 + GST (India) / US$30 (intl) | ✅ amount · ⚠ config | V: server pricing IN 1999+18 % = 2359 INR, INTL 30 USD; client "amount" ignored (C; order-creating test sandbox-only). UI shows a hard-coded copy; `/api/ai-onboarding/pricing` unused (TVR-08) |
| B4 | No recurring subscription | ✅ | V: pricing has no interval/recurring fields; C: one-time Cashfree order, permanent entitlement |
| B5 | Basic listing never auto-fetches Google Places | ✅ **fixed** | V: free venue pages show no Google photos/reviews; hero/media proxies 404 for non-eligible place ids and name lookups; grandfathered page keeps Google content |
| B6 | AI intelligence versioned, never overwrites manual data | ✅ **fixed** | V: AI-suggested edits always go to review, tagged `ai`; admin AI edits tagged; restore works; proposals not restorable. ⚠ typo rule can flip meaning (TVR-21) |
| B7 | Payment verification, access, duplicates, approval, audit | ✅ core · ⚠ edges | V: no signature 400, bad signature 401, correctly-signed forged "PAID" → nothing granted; 402 before payment; 409 when paid; duplicate listing deduped; full history + versions. Open: stale webhooks (TVR-17), gateway outage 500 (TVR-23), race (TVR-24), closed listing upgradeable (TVR-25), closed listing revivable via edit link (TVR-19), no unique index (TVR-22) |
| C1 | Authenticated access | ✅ | V: `/app/teacher/retreats/new` → 307 login; BFF create 401/403 anon, 403 learner, 403 without CSRF |
| C2 | Details & dates | ⚠ | V: bad format and end < start rejected. ❌ past start dates accepted by wizard + BFF; PATCH has no date checks (TVR-13; not executed — it would create live data) |
| C3 | Capacity & pricing | ✅ capacity · ⚠ pricing | V: seats 3/500 → 400; seats > listed venue capacity → 400 on create and edit (UI blocks too). ₹500 floor exists only in web; live backend accepts ₹50 (verified in an earlier fork) |
| C4 | Real venue id, validated server-side | ✅ web · ⚠ backend/legacy | V: missing, forged and free-local ids → 400; edit can't clear/forge a venue. Live OpenAPI says the backend enforces it (C). V: all 6 live-public retreats and 63/68 demo-host retreats have no venue id (legacy) |
| C5 | Eligibility & publication | ✅ | V: learner/HR/admin not eligible; teacher/guru eligible (15 %). ⚠ no Level-1 test account exists (TVR-09) |
| C6 | Image upload & errors | ✅ (see A5) | V |
| C7 | Public pages, no duplicates/test artifacts | ✅ web · ❌ backend data | V: hidden ids 404, sitemap clean. **New: `/retreats` now shows 0 retreats**: every live-public retreat is QA or a duplicate (TVR-28) |

---

## 4. Defect register

**Still open from v1**

| ID | Sev | Finding | Owner |
|---|---|---|---|
| **TVR-01** | **P0** | Live `/admin/kyc/*` and `/admin/empanelment/*` readable by any signed-in user — now also confirmed for **HR** and **learner** (V) | Backend team |
| TVR-02 | P1 | Live backend still publishes 4 QA + 2 duplicate retreats; teacher.demo hosts 37 (33 QA-like), guru.demo 31 (all QA-like). Website hides them | Backend team (`LIVE_BACKEND_QA_CLEANUP.md`) |
| TVR-04 | P1 | Only the 5 seeded remote venue partners can host a retreat; the 7 admin-published free listings are rejected by the BFF (V) | Web + backend |
| TVR-08 (rest) | P3 | Refund never revokes the upgrade; UI price is a hard-coded copy of backend pricing | Local |
| TVR-09 | P1 | `canOperate` (web) vs `host-eligibility` (backend) can disagree; no L1 test account (QA L1 is an eligible L2) | Owner + backend |
| TVR-10 | P1 | Local Council decisions not synced to remote empanelment | Owner + backend |
| TVR-11 | P2 | 27/39 public teachers have city "India"/blank; no specialisation filter | Web + backend data |
| TVR-12 | P2 | Hybrid vs "empanelled only" policy undecided; 4 demo/test profiles public | Owner |
| TVR-13 (rest) | P2 | Past start dates accepted (wizard step 1 + BFF create); PATCH skips date checks; ₹500 floor web-only; no idempotency key | Web + backend |
| TVR-14 | P2 | Local `/api/verification/payment/confirm` takes `teacher_id` from the body (C, `verification.py` ~L2577) | Local |
| TVR-15 | P3 | Upload type trusted from declared MIME (V xfail) | Web |
| TVR-16 | P3 | `centers/mine`, `centers/{id}`, `my-venue-status` trust an `owner_id` query param (C) | Local |
| TVR-17 | P3 | AI-onboarding webhook accepts 30-day-old timestamps (V xfail) | Local |

**New in v2**

| ID | Sev | Finding (evidence) | Source | Recommended fix |
|---|---|---|---|---|
| **TVR-26** | **P1** | Preview uses **live** Cashfree credentials; QA in this fork created real (unpaid) orders (C/V) | `backend/.env` `CASHFREE_API_BASE` | Sandbox keys for preview; production keys only in the deployed app; show the gateway mode in the admin AI panel |
| TVR-27 | P2 | All 7 published local listings were admin-added with **no owner email**, so no owner can request an edit link or buy AI onboarding; no "claim this listing" flow (V) | `venue_submissions` data; `request_submission_edit` | Admin "assign owner email" + owner claim/verification flow |
| TVR-28 | P2 | Public retreat directory shows **0 retreats**: all live-public retreats are QA or duplicates (V) | live data; `lib/server/retreats.ts` | Publish real retreats (or show a "first retreats coming soon" state + host CTA) before launch |
| TVR-19 | ✅ FIXED (2026-06) | A still-valid edit link could return a rejected / hidden / archived / duplicate venue to review. Owner edits and the AI import now return 409 "This listing is closed" (V, 4 statuses + website BFF) | `venues.py` `edit_public_submission`, `import_draft` | — |
| TVR-23 | P2 | A gateway network failure raises an unhandled 500 on checkout (V xfail, simulated) | `ai_onboarding.py` `create_order` | Catch `httpx` errors → 502 "Payment service unavailable" |
| TVR-21 | P3 | Typo-sized edits that flip meaning ("No alcohol…" → "Alcohol…") auto-publish (V xfail) | `_is_minor_edit` | Exclude negation/number changes, or limit auto-approve to spelling-only diffs |
| TVR-20 | P3 | Venue capacity has no bounds (−5 stored) (V xfail) | `PublicSubmissionIn`, `PublicEditIn`, `EditIn` | `Field(ge=1, le=1000)` |
| TVR-22 | P3 | No unique index on `dedupe_key`; concurrent submits can duplicate (V xfail) | `venue_submissions` | Unique (partial) index + handle duplicate-key |
| TVR-24 | P3 | Two simultaneous checkouts can create two orders (sandbox-only test) | `create_order` | Atomic "pending order" upsert per venue |
| TVR-25 | ✅ FIXED (2026-06) | Closed listings could be sold the upgrade. The venue-link lookup now refuses them (409) before any order can exist, and the purchase page explains why (V) | `ai_onboarding.py` `_venue_for_token` | — |
| TVR-29 | P3 | Wizard has two capacity ideas: listed venue capacity (enforced) and host-entered "operational capacity" (UI-only, overridable checkbox) (C) | `HostRetreatWizard.tsx` ~L620 | Merge into one, or make the planner advisory text only |
| TVR-30 | P3 | Approving an owner proposal can silently overwrite an admin edit made to the same field after it was proposed (C) | `decide_pending_changes` | Show "live changed since proposal" conflict before approve |

---

## 5. Test artifacts & duplicates (current, nothing deleted)

- **Live backend (needs backend team):** the public 6 (`rt_8d568a7a58`, `rt_f27d935937`, `rt_ec33638e2e`, `rt_79636c03d3`,
  duplicates `rt_c7c3865f34` / `rt_41f614da0e`); ~64 QA-like demo-host retreats; 4 public demo/test teacher profiles. Steps in
  `/app/memory/LIVE_BACKEND_QA_CLEANUP.md`.
- **Real unpaid Cashfree orders from the 2026-06 QA runs (TVR-26):** these expire on their own; the local order records were removed when
  the QA fixture was cleaned up. Nothing to refund.
- **Local preview DB:** clean. The suite leaves 0 fixtures, 0 orders, 0 entitlements, 0 versions (verified after the run).
- QA retreat `rt_67e770b5c5` is unchanged (seats 10, venue `vp_dharamkot_himachal`). The capacity tests were rejected before
  reaching the backend.

---

## 6. Missing API / schema changes

**Live backend:** (1) admin-role enforcement on every `/admin/*` route (TVR-01); (2) reject past start dates and validate dates
on PATCH; add an idempotency key on create (TVR-13); (3) bulk archive of QA retreats (TVR-02); (4) accept or promote local published
venues as bindable venue partners (TVR-04); (5) expose verification/empanelment/level on one "me" endpoint + one operate rule
(TVR-09/10).

**Local (this repo):** ~~status guard on owner edit and AI checkout (TVR-19/25)~~ done; `capacity` bounds (TVR-20); unique index on
`dedupe_key` (TVR-22); per-venue atomic pending order (TVR-24); webhook timestamp window (TVR-17); gateway error handling (TVR-23);
`refunded` state on entitlements; UI price from `/api/ai-onboarding/pricing`; owner email/claim fields for admin-added listings
(TVR-27); sandbox credentials for preview (TVR-26).

---

## 7. Section D — automated tests (created and run)

**Location:** `/app/backend/tests/workflow/` · **Run:** `cd /app/backend/tests/workflow && python -m pytest -q`
(skip browser tests: `-m "not ui"`). The safety contract is in `_wf.py`: local writes only; live backend gets only reads and rejected requests; no order
unless the gateway is the sandbox. Known defects are `xfail(strict)`, so a fix turns the suite red until the marker is removed.

**Last run (after the badge and closed-venue follow-up): 187 passed · 32 xfailed (known defects) · 6 skipped · 0 failed (133 s).**

| File | Covers | Result |
|---|---|---|
| `test_wf_venue_listing.py` | free listing → publish + audit trail; secret/captcha (wrong, expired, reused)/spam/schema/honeypot; dedupe; IP & email rate limits; 40-case admin-only matrix; tampered/expired links; no email enumeration | 64 ✓ · 5 xfail (TVR-19×3, 20, 22) |
| `test_wf_venue_live_edits.py` | typo auto-approve; pending; reject; approve + duplicate decision 409; restore / proposal not restorable; withdraw on revert (interrupted); supersede; private contact edits; AI tagging; non-live → queue; photos kept | 12 ✓ · 1 xfail (TVR-21) |
| `test_wf_ai_onboarding.py` | pricing; free vs paid gate (402); link → venue; wrong email 403; 409 when paid; bad/unknown order; webhook signature; forged PAID; paid unlocks import + place; place validation; SSRF + unreachable site; gateway outage (simulated) | 13 ✓ · 2 xfail (TVR-17, 23) · 5 skipped (create real orders) |
| `test_wf_live_backend_readonly.py` | admin-read matrix (anon/admin/4 roles); eligibility by persona; rejected/duplicate sign-ups; wrong password; directory privacy; city data; demo profiles; venue partners; venue id on retreats; QA/duplicate retreats | 24 ✓ · 26 xfail (TVR-01×20, 02, 03, 09, 11, 12, NST-017) |
| `test_wf_web_bff.py` | CSRF cookie on all write pages; sign-in redirect; BFF register/login rejections; directory HTML privacy; 11 retreat-create validation cases; edit capacity/venue guards; cover upload errors; hidden retreats 404 + sitemap; Google gating; AI purchase page states + checkout guards; owner edit via website | 62 ✓ · 1 xfail (TVR-15) · 1 skipped (past-date create would hit live) |
| `test_wf_web_ui.py` (Playwright) | owner edits live venue → pending notice; AI onboarding page states; wizard locks venue fields + blocks seats over capacity | 3 ✓ |

**Coverage by category:** success ✅ · invalid inputs ✅ · unauthorised ✅ · duplicates ✅ (race: sandbox-only) · interrupted
(abandoned checkout, withdrawn proposal, expired link) ✅ · failed integrations (gateway outage simulated, unreachable website, SSRF,
unknown order) ✅.
**Not testable without staging or sandbox:** real retreat creation (past dates, double-click publish), successful payment, refund, KYC/Didit
provider outages, live admin write endpoints. Each is listed as a skip with the reason.
Earlier scripts kept: `/app/scripts/qa_venue_pending_flow.py` (now skips order creation on the live gateway),
`/app/scripts/qa_seed_live_venue.py`, `/app/scripts/audit_live_readonly.py`.

---

## 8. Prioritised recommendations

1. 🔴 **P0 TVR-01**: backend team adds admin-role checks to all `/admin/*` routes (the 20 xfail tests are the acceptance test).
2. 🔴 **P1 TVR-26**: put sandbox Cashfree keys in the preview environment before any more payment QA.
3. 🟠 **P1 TVR-02 / TVR-28**: clean QA retreats on the live backend and publish real ones; the public retreat directory is currently empty.
4. 🟠 **P1 TVR-04 + TVR-27**: let published free listings host retreats, and give admin-added listings an owner (claim flow).
5. 🟠 **P1 TVR-09 / 10**: one operate rule and one empanelment source; create a real L1 test account on staging.
6. 🟡 **P2 TVR-13, 23, 11, 12, 14** (TVR-19 and TVR-25 fixed): past-date checks, closed-venue guard, gateway errors, city data, profile policy, payment-confirm identity.
7. 🟢 **P3 TVR-15, 16, 17, 20, 21, 22, 24, 25, 29, 30, 08-rest**: hardening.

---

## 9. Source files referenced

Backend: `backend/venues.py` (listing, moderation, pending changes L279–361 / L988–1073 / L1581–1707, AI import L1956+),
`backend/ai_onboarding.py`, `backend/verification.py` (L2567 payment confirm), `backend/.env` (gateway).
Web: `frontend/app/bff/teacher/retreats/create/route.ts`, `…/[id]/route.ts`, `…/retreat-cover/route.ts`,
`frontend/lib/server/venue-binding.ts`, `frontend/lib/server/venues.ts` (`getBindableVenues`), `frontend/lib/server/retreats.ts`,
`frontend/lib/server/ai-assisted-venues.ts`, `frontend/components/venues/VenueProfile.tsx`, `PublicSubmitForm.tsx`,
`AiOnboardingPurchase.tsx`, `frontend/components/app/teacher/HostRetreatWizard.tsx`, `VenuePicker.tsx`, `frontend/proxy.ts`,
`frontend/lib/teacher-status.ts`, `frontend/lib/server/teacher.ts`.

---

## 10. Follow-up shipped after v2 (2026-06)
- **Block closed venues** (TVR-19, TVR-25): see the register. Tests un-xfailed and extended (`test_edit_link_cannot_revive_a_closed_venue` ×4,
  `test_closed_listing_cannot_be_upgraded` ×4, website BFF + purchase-page tests).
- **"Enhanced Listing" badge**: on the venue page hero and on directory cards (`/venues`, `/venues/in/[city]`) for venues
  with paid AI-assisted onboarding and the grandfathered venues (`googleAccess().allowed`). Tooltip explains the upgrade. Free venues never
  show it. Files: `components/venues/EnhancedBadge.tsx`, `VenueCard.tsx` (`enhanced` prop), `VenueExplorer.tsx` (`enhancedIds`),
  `VenueProfile.tsx`, `lib/server/ai-assisted-venues.ts` (`enhancedVenueIds`). A newly paid venue shows it within about 60 s (paid-list cache).
