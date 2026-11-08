# NOSTOPS: Product Roadmap Discovery and Implementation Plan (READ-ONLY)

**Scope:** Initiative A (Yoga Guru nominations), Initiative B (footer navigation), Initiative C (dynamic SEO architecture),
Initiative D (robots and indexing policy).
**Type:** read-only discovery. **No source code, API, database, schema, permission, route or settings change was made.**
The only files written are this report, one evidence folder (`test_reports/p0/discovery/`) and a short note in `PRD.md`.
Nothing was deployed or published, and no mobile build was made. No call was made to the live main backend. No financial
operation was run.

**Status:** waiting for founder review. Implementation has **not** started.

**How to read the labels:**
- **[V] Verified.** Confirmed in this session from source code, the stored main-backend OpenAPI snapshot or a command
  that was run.
- **[A] Assumption.** An inference that has not been confirmed.
- **[R] Recommendation.** A proposal. Nothing has been implemented.
- **[NV] Not verified.** Could not be checked from here. Usually it needs the live main backend, a live sign-in or
  production.

**Evidence source for main-backend behaviour:** `backend/tests/fixtures/main_backend_openapi_2026-10.json`. This is a
stored OpenAPI snapshot: 648 paths, title "NOSTOPS Community API" 0.1.0. It describes the **declared** contract only.
The live responses, authorisation and side effects were **not** checked.

---

## 1. Stage 1 closure and current platform state

### 1.1 Closure evidence
- **[V]** The Stage 1 closure report exists: `memory/PHASE_1B_STAGE1_CLOSURE_REPORT.md`.
  - 39 of 39 approved strings are present, and 0 of 32 replaced strings remain.
  - The changes are limited to 18 display-copy files.
  - There is no logic change.
- **[V]** The git HEAD is still `02ee5768`, the Stage 1 closure checkpoint. Since then, only two kinds of tracked files
  differ in the working tree:
  - `frontend/yarn.lock`, a change from before Stage 1 (25 Oct);
  - `.pyc` bytecode caches.
  - **So no source file has changed since Stage 1 closed.**
- **[V]** The website money lock is **ON** (fail-closed):
  - `FINANCIAL_ACTIONS_UNLOCKED` appears 0 times in `backend/.env` and 0 times in `frontend/.env`.
  - It is also absent from the environment of all 6 running backend and preview processes checked (0 hits each).
- **[V]** `MONEY_OPS_FROZEN` appears in **no** website code (grep of `frontend/app`, `frontend/lib`,
  `frontend/components` and `backend/*.py`).
  - **[NV]** It is a main-backend setting and remains **unverified and unchanged**. This report does **not** claim it
    was verified.

### 1.2 Test results
| Check | Result | When |
|---|---|---|
| Money-lock in-process suites, 6 files: `test_p0_freeze_gateway`, `test_p0_razorpay_callback`, `test_p0_encoded_delimiter_bypass`, `test_b51_admin_gate`, `test_cashfree_sandbox_guard`, `test_p0_cashfree_diag` | **553 passed, 12 skipped, 0 failed** (2.01 s). The upstream is a mocked transport and no startup seeding runs (no `with TestClient`). Log and JUnit: `test_reports/p0/discovery/discovery_lock_pytest.{log,xml}` | **Re-run this session [V]** |
| Same suites at Stage 1 closure | 553 passed, 12 skipped, 0 failed | Closure report [V, document] |
| TypeScript `tsc --noEmit` | 0 errors | Closure only. Not re-run because no source changed, and `tsc` would rewrite `tsconfig.tsbuildinfo` |
| ESLint on the 18 Stage 1 files | clean | Closure only |
| Offline compile build | exit 0 | Closure only |
| Full production build | 287 of 287 pages, exit 0 (byte-identical sources) | Earlier Stage 1 run [document] |
| Public `robots.txt` from the local preview server (no backend call) | 200, 19 `User-agent` groups, `Sitemap: https://www.nostops.org/sitemap.xml` | **Run this session [V]** |

### 1.3 Skipped or unrun tests
- **[V]** 12 tests skip in `test_p0_freeze_gateway`. These are the reviewed non-money routes, the same as at closure.
- **Not run, by design:**
  - **`test_p0_inbound_payments`:** writes rows to the preview database.
  - **Live suites:** `test_p0_live_gateway_iter`, `test_t1_b51_admin_gateway_live`, `test_b511_signin_live` and
    `p0_diag_live_check`. They call the live gateway or backend.
  - **Frontend site checks:** `verify_site`, `verify_seo_feeds`, `verify_access_matrix` and the others. They request the
    running site, and the site reads live main-backend data.
  - **Browser rendering of preview pages:** every page loads live data.
- **[V, document]** The last recorded run of the frontend checks (B2.3 audit) had failures that existed before
  Stage 1:
  - `verify_seo_feeds` 21/4 (sitemap lastmod count, `/gurukul-retreats`);
  - `verify_venue_binding` 82/2;
  - `verify_tier2_preview` 16/2;
  - `verify_lyv_landing` crashes.
  - **[NV]** Their current state is unknown. They are relevant to Phases 3 and 4.

### 1.4 Remaining wording issues (unchanged, on hold)
- **New concerns raised at closure:**
  - N-1: "Withdrawn · ₹X";
  - N-2: "withdrawable";
  - N-3: "Prefer UPI / bank transfer?";
  - N-4: verified badge vs the "subject to review" line;
  - N-5: the WithdrawFlow panel wording. That panel is hidden while the lock is ON.
- **Stage 2 (legal, fee, tax, refund):** L-1, L-4, L-5, L-9, T-4, C-2, W-25, T-5, W-10, W-21, W-23, M-1, L-7, L-8 and
  M-11.
- **Stage 3 (admin payout wording):** T-3, D-3, D-4 and the "Payouts" menu label.
- **Stage 4 (text sent by the main backend):** C-1 (the escrow note) and W-26.
- **Pending native-speaker review:** the InstaKYC message in hi/mr/bn/ta/te.
- **All of the above remain ON HOLD** as instructed.

### 1.5 Verification limitations
- **[NV]**
  - main-backend settings (`MONEY_OPS_FROZEN`) and live responses;
  - signed-in screens (admin, council, teacher);
  - production headers and production `sitemap.xml`;
  - whether preview URLs are indexed by search engines.

**Files inspected (§1):**
- `memory/PHASE_1B_STAGE1_CLOSURE_REPORT.md`, `memory/PRD.md` (tail), `memory/B2_3_ACCEPTANCE_AUDIT_R2.md`;
- `backend/.env` and `frontend/.env` (key names only, values redacted);
- the 6 test files listed above.

**Checks run (§1):**
- `git rev-parse`, `git diff --name-only`;
- env-key grep and process-environment grep;
- the pytest re-run;
- `curl http://localhost:3000/robots.txt`.

---

## 2. Initiative A: Yoga Guru nominations

### 2.1 There are three different "Guru" concepts in the platform [V]
| Concept | Where the data lives | Public pages | Admin / editor surface |
|---|---|---|---|
| **Council of Yoga Gurus** (living members) | Main backend | `/council`, `/council/[slug]`, from `GET /api/seo/council` (JSON-LD `Organization.member`) | `/app/admin/council-roster`; the `council` user role with its `/app/council/*` workspace |
| **Gurus of Yoga** (historical ācāryas) | Local knowledge graph in local Mongo: `kg_gurus`, `kg_guru_lineage`, `kg_parampara_guru` (`backend/knowledge.py`, `knowledge_data.py`) | `/gurus`, `/gurus/[slug]` | `/app/admin/knowledge`. Writes use `/api/knowledge/admin/*` (internal secret plus admin role) |
| **Ask AI Guru / GuruAI** | Local assistant (`backend/guru/*`) | Floating launcher | — (not related to nominations) |

- **[A]** "Yoga Guru nominations" means nominating a **living** Guru to the **Council of Yoga Gurus**. That is the only
  concept with a nomination pipeline.
  - **Decision F-A1 confirms this.**

### 2.2 Existing profile data and schemas
- **Council member, as the website reads it from the admin roster** [V] (`lib/server/admin-council-roster.ts`):
  - `handle`, `name`, `title`, `lineage`, `decades`, `city`;
  - `specialty_focus[]`, `languages[]`, `bio`, `notable_mentees`;
  - `signature_works[]`, `photo_url`, `status` / `is_active`.
- **Council member, as the public pages show it** [V] (`council/page.tsx`, `council/[slug]/page.tsx`): name, jobTitle,
  description, image, address (city and country), alumniOf (shown as "Lineage").
  - The public description is overridden with claim-free text (NST-008).
- **Historical Guru, in the knowledge graph** [V] (`knowledge_data.py` `G()`):
  - `id`, `slug`, `canonical_name`, `alternate_names[]`, `period`, `tradition`;
  - `geographical_association`, `biography`, `verification_status`, `confidence_level`, `source_ids[]`.
- **Nomination input, `NominationIn`** [V, OpenAPI snapshot]:
  - **Required:**
    - `nominee_name` (2–120);
    - `nominator_name` (2–120);
    - `nominator_email` (5–160);
    - `citation` (30–1200, "Why does this Guru belong on the Council?").
  - **Optional:**
    - `nominee_lineage` (≤200), `nominee_city` (≤100), `nominee_decades` (integer 1–10);
    - **`nominee_email`** (≤160), **`nominee_phone`** (≤20), `nominee_phd` (≤200);
    - **`nominator_phone`** (≤20), `relationship` (≤140);
    - `references` (≤600, "Books, public talks, ashrams, notable students").
- **Review inputs** [V, OpenAPI]:
  - `NomReviewIn`: `note` (≤600, "private"), plus `create_draft_member` (bool, default false, "On approve, also create a
    draft Council member record");
  - `InfoRequestIn`: `question` (5–1200, required).

### 2.3 APIs (main backend, declared contract) [V, OpenAPI]
| Stage | Endpoint | Declared purpose |
|---|---|---|
| Submit | `POST /api/council/nominate` | "PUBLIC — submit a Guru nomination". **No security scheme declared** |
| L1 admin | `GET /api/admin/council/nominations?status&limit` | Admin-only list. Default `pending_admin_review`; `status=all` returns everything |
| L1 admin | `POST /api/admin/council/nominations/{id}/advance-to-guru` | Admin approval: "NO invitation is dispatched here" |
| L1 admin | `POST …/{id}/reject`, `POST …/{id}/request-info`, `DELETE …/{id}` | Reject, request more information, delete |
| L2 Council | `GET /api/guru/council/nominations?status&limit` | Council list |
| L2 Council | `POST /api/guru/council/nominations/{id}/approve` | Final approval. **"Dispatches the pre-crafted invitation to the nominated Guru across email + WhatsApp + SMS"** |
| L2 Council | `POST /api/guru/council/nominations/{id}/reject` | Council rejection |
| Roster | `GET/POST /api/admin/council-roster`, `PATCH/DELETE /api/admin/council-roster/{handle}`, `POST …/{handle}/reactivate` | Roster management. The POST body is a free-form object |
| Roster | `/api/admin/people/council/{guru_id}` (GET, PATCH, DELETE, `/suspend`, `/reinstate`) | People-manager actions |
| Public | `GET /api/council/members`, `GET /api/council/members/{handle}`, `GET /api/seo/council`, `GET /api/lineage/vouches/council/directory` | Public reads |
| Self | `GET/PATCH /api/council/profile/me` | A Council member edits their own profile |
| Dev | `POST /api/council/seed-placeholders` | No security scheme declared (NST-020, already flagged) |

### 2.4 Permissions [V unless marked]
- **L1 admin queue page:** `/app/admin/nominations` uses `requireAdminUser()`.
  - It redirects non-admins and sends signed-out visitors to `/login`.
  - It is `noindex`.
- **BFF (the website's own server-side API layer):** `/bff/admin/nominations/[id]/[action]` and
  `/bff/admin/nominations/[id]` (DELETE) use `requireAdmin(req)`.
  - They check the request origin (CSRF) and the server-side session role.
  - Only `advance-to-guru`, `reject` and `request-info` are allowed.
- **Gateway:** `admin_gate.is_admin_path` covers `/api/admin/*`, so the admin role is enforced server-side before
  anything is forwarded (B5.1).
- **Not protected at the gateway:** `/api/council/nominate` and `/api/guru/council/*` are **not** admin paths. They are
  forwarded with the caller's own credentials.
  - **[NV]** Whether the main backend restricts `/guru/council/*` to the `council` role, and rate-limits or
    spam-protects `/council/nominate`, is not verified.
- **Public privacy filter:** `public_privacy` strips contact fields from **public** council reads (`council/members…`,
  `seo/*`).
  - Admin reads are not stripped, as intended.
- **No step-up or audit on the website:**
  - The website writes no audit row for nomination decisions. The admin audit log is read from the main backend.
    **[NV]** Whether that backend records these decisions is not verified.
  - There is no TOTP step-up for nomination decisions. The TOTP routes only handle setup and verify.

### 2.5 Admin review capabilities today [V]
- **Queue page:** three numbers (Open, Pending review, Advanced) and one card per nomination.
- **Card actions:** **Advance to Guru** (optional note, plus "Create a draft council member record" ticked by default),
  **Reject**, **Request info** and **Remove** (DELETE).
- **The card shows only:** nominee name, nominated-by, status, date, and a "reason" field.

### 2.6 Workflow gaps and defects found (website side, from code reading)
| # | Finding | Type |
|---|---|---|
| A-G1 | There is **no public nomination form**. Nothing on the website calls `POST /council/nominate`. | [V] gap |
| A-G2 | There is **no L2 Council voting screen**. Nothing on the website calls `/guru/council/nominations`, and the council menu has no Nominations item. Advanced nominations therefore cannot be finished on the website. | [V] gap |
| A-G3 | The list is requested without `status`, so it shows only `pending_admin_review` items. There is no history or filter (advanced, rejected, info requested). | [V] code / [NV] live effect |
| A-G4 | The pending count falls back to `status === 'pending'`, but the backend status is `pending_admin_review`. The fallback would show 0 if the backend omits `pending_count`. | [V] code / [NV] live |
| A-G5 | The card reads `reason`, `rationale` or `note`, **not `citation`**, which is the backend's required field. The citation may not display. Lineage, city, decades, PhD, references and relationship are never shown, which limits the quality of review. | [V] code / [NV] response shape |
| A-G6 | `request-info`: the BFF accepts 3 or more characters but the backend requires 5 or more, so 3–4 characters would fail. The BFF also truncates at 600 characters, against the backend's 1200. | [V] |
| A-G7 | **Reject** mode shows the "Create a draft council member record" checkbox, ticked by default, and sends `create_draft_member: true` on reject. The backend describes the flag as "On approve". | [V] code / [NV] backend effect |
| A-G8 | **Remove** is a one-click hard delete with no confirmation and no reason captured. | [V] UI / [NV] reversibility |
| A-G9 | The page text says "Review **teachers** nominated…". The backend models nominees as external Gurus with their own contact details, and `nominee_handle` may not exist. | [V] copy / [A] model |
| A-G10 | L2 approval sends **real email, WhatsApp and SMS** to a third party. It is irreversible, and there is no known sandbox in preview. | [V] declared / [NV] environment gating |
| A-G11 | Third-party personal data (nominee email and phone) can be collected without the nominee's consent. Privacy-policy coverage is a **Stage 2 legal item, on hold**. | [V] schema / [A] legal impact |
| A-G12 | The route from "draft member" to the public `/council` roster is unknown. Public council profiles are **indexable and auto-added to the sitemap** via `/seo/council`, so an unconsented or placeholder profile could be indexed. | [V] sitemap code / [NV] backend promotion rule |

### 2.7 Required profile fields [R]
| Field | Public? | Note |
|---|---|---|
| Display name, honorific or title | Public | From the nominee's acceptance, not from the nominator's text |
| Lineage / paramparā | Public | Link to `/yoga-parampara/{slug}` when it matches the knowledge graph |
| City, country | Public | |
| Decades of practice | Public, as declared | Label it "as stated by the Guru". It is not a verified claim |
| Bio | Public, after editorial review | Claim-free checks, the same rule as NST-008 |
| Photo | Public | Only with recorded consent and a licence |
| Languages, specialty focus, signature works / references | Public | References act as evidence sources |
| Nominee email and phone | **Private** | Never public; restricted to admins |
| Nominator name, email, phone, relationship | **Private** | |
| Citation, reviewer notes, Council votes | **Private** | |
| Consent record (date, channel, version of the text accepted) | **Private**, required before publication | |
| Publication state and indexable flag | Internal | Drives `/council` visibility and the sitemap (§5) |

### 2.8 Approval states [R]
- **Recommended order:**
  1. `submitted`
  2. `pending_admin_review` (the backend default) ⇄ `info_requested`
  3. `advanced_to_council` (L1)
  4. `council_approved` (L2, invitation sent)
  5. `invitation_accepted` (consent recorded)
  6. `profile_draft`
  7. `profile_published` (public and indexable)
- **End states:** `rejected_admin`, `rejected_council`, `withdrawn`, `removed`.
- **[NV]** The backend's actual status strings beyond `pending_admin_review` are not verified. The website must map
  them, not invent them.

### 2.9 Founder decisions (Initiative A)
See §10, decisions F-A1 to F-A8.

**Files inspected (§2):**
- `app/app/admin/nominations/page.tsx`;
- `app/bff/admin/nominations/[nominationId]/route.ts` and `[nominationId]/[action]/route.ts`;
- `components/app/admin/NominationsQueue.tsx`;
- `lib/server/admin-nominations.ts`, `lib/server/admin-council-roster.ts`, `lib/server/admin-guard.ts`;
- `components/app/nav-config.ts`;
- `app/(public)/council/page.tsx`, `council/[slug]/page.tsx`;
- `app/app/council/vouch/page.tsx`, `app/(public)/gurus/page.tsx`, `gurus/[slug]/page.tsx`;
- `lib/server/knowledge.ts`, `lib/server/guru.ts` (grep);
- `backend/server.py`, `admin_gate.py`, `public_privacy.py`, `knowledge.py` (routes), `knowledge_data.py` (`G()`);
- OpenAPI fixture;
- `memory/LAUNCH_READINESS_AUDIT.md` (NST-008, NST-020).

**Checks run (§2):**
- grep for "nominat" across the backend and frontend;
- OpenAPI extraction: paths, schemas, descriptions.

**Not verified (§2):**
- live list response shape and status values;
- backend authorisation on `/council/nominate` and `/guru/council/*`;
- whether messages are sent in preview;
- what `create_draft_member` does;
- whether DELETE can be undone;
- whether placeholder Council members exist today.

---

## 3. Initiative B: Footer navigation

### 3.1 Shared footer components [V]
- **The one shared footer** is `components/SiteFooter.tsx`. It is an async server component.
  - **It is used by** `app/(public)/layout.tsx` (all 74 public pages, **including the home page**) and
    `app/participant/layout.tsx`.
  - **Its link labels** come from a local `GROUPS` array, plus `ORG_COHORTS` from `lib/site-nav.ts` (shared with the
    header).
  - **City links** are live: `getCities()` returns the top 6, then "View all cities →" (`/yoga-teachers`). The list is
    revalidated hourly.
- **Other footers:**
  - `(auth)` layout: its own one-line footer ("Honouring the Teacher · Preserving the Tradition"), with no links;
  - `/app/*`: AppShell, with no footer and no link back to the public website (NAV_IA_AUDIT, still open);
  - `booking-invite`: no layout chrome;
  - **404 pages:** the root `not-found.tsx` renders **without** the header and footer, because `(public)` has no
    `not-found` file.

### 3.2 Current route coverage (columns in display order) [V]
| Column | Links |
|---|---|
| Explore (12) | Teacher Directory `/teachers`; **Retreats `/retreats/host`**; Venues; List your Venue; Council of Gurus; Paramparas; Yoga's Living Traditions `/yoga-parampara`; Gurus of Yoga; Yoga Scriptures; NOSTOPS Voices; Guides; Teacher Pulse |
| Find Teachers | Find a Teacher `/teachers`; 6 live cities `/yoga-teachers/{slug}`; View all cities |
| Teachers | Claim your profile; Become a Teacher; Become a City Coordinator; Log in `/login`; Join as a Teacher `/join` |
| For Organisations | Overview; For Companies; For Educational Institutions; For Startup & Networking Groups; Request a proposal `/for-organisations#enquire` |
| Company | About; Teacher-First Philosophy; How it works; Trust & Verification; Contact; Help & Support; FAQ |
| Legal | Privacy; Terms; Refund & Cancellation `/refunds` |

- **[V]** All 33 distinct footer destinations resolve to an existing page file (static route check).
  - 31 of them are in the `(public)` group. `/login` and `/join` are `(auth)` pages, which are `noindex`.
  - The live HTTP status of each link was **not** checked [NV].
- **[V] Earlier audit items now fixed in the code:**
  - City Coordinator added;
  - Philosophy added;
  - `/refunds` exists and is linked;
  - the teacher column now uses `/join` rather than the seeker `/register`;
  - the label is "Log in".
- **[V] Earlier audit items still open:**
  - "Retreats" still points to the **host** page `/retreats/host`, so the discovery page `/retreats` is not in the
    footer (NAV_IA #7, NST-025);
  - `/teachers` is linked twice ("Teacher Directory" and "Find a Teacher") (NAV_IA #17);
  - the column order is positional: `GROUPS[0..4]`, with "List your Venue" spliced in by code.

### 3.3 Relevant public links not in the footer [V]
- `/retreats`, the retreat discovery page;
- `/programmes`;
- `/levels`;
- `/find-your-tradition`;
- `/venues/all`;
- `/for-organisations/impact` and `/for-organisations/resources`;
- `/voices/api`, the developer page, which is also not linked elsewhere (NAV_IA #23).
- **[R]** A "Nominate a Guru" link only after Initiative A launches.

### 3.4 Home-page exception
- **[V]** **No home-page exception exists in the code today.**
  - The home page is in the `(public)` group, so it renders the same `SiteHeader`, `SiteFooter` and
    `ListVenueStickyCta` as every public page.
  - `SiteFooter` has no pathname logic.
  - The only pathname-based exceptions in the public chrome are in `ListVenueStickyCta`. It is hidden on
    `/list-your-venue*`, `/venues/submit*` and `/for-organisations*`, **not** on the home page.
- **[V, document]** PRD records that the venues/retreats mock-ups showed a single-row compact footer. That was declined
  as a "global preservation decision".
- **[A]** "Home-page exception" means one of these:
  - (a) the home page should use a different, compact footer;
  - (b) the home page should hide some footer columns;
  - (c) the home page should keep the full footer while other pages change.
  - **Decision F-B1 settles which.**
- **[R]** Keep a single component. Implement any exception as a prop (for example `variant="compact"`) passed from a
  layout, not by duplicating the footer.

### 3.5 Mobile and desktop considerations [V code / R]
- **Current layout [V]:**
  - the brand block plus a link grid: `grid-cols-2`, then `sm:grid-cols-3`, then `lg:grid-cols-6`;
  - on phones, 6 columns fold into 3 rows of 2, and Explore alone has 12 links, so the footer is long on phones;
  - `pb-24` on phones keeps the Ask AI Guru launcher clear.
- **Accessibility [V]:**
  - column headings are `<h4>` with no `<h2>`/`<h3>` level before them inside the footer;
  - the link groups are not inside a `<nav aria-label="Footer">` landmark;
  - link text has a hover colour, and **[NV]** the focus ring and colour contrast were not measured.
- **[R]**
  - Use a `<nav aria-label="Footer">` landmark and fix the heading levels.
  - Consider collapsible column groups on phones, keeping the links in the HTML for crawlers.
  - Keep touch targets at 44 px or more.
  - Show only website (desktop) screenshots in reviews, per the stated founder preference. Still test phone widths
    internally.

**Files inspected (§3):**
- `components/SiteFooter.tsx`, `SiteHeader.tsx`, `MobileNav.tsx`, `HeaderAuthCta.tsx`, `ListVenueStickyCta.tsx`;
- `lib/site-nav.ts`;
- `app/(public)/layout.tsx`, `app/(auth)/layout.tsx`, `app/app/layout.tsx`, `app/participant/layout.tsx`;
- `app/not-found.tsx`, `app/(public)/page.tsx` (sections);
- `memory/NAV_IA_AUDIT.md`, `memory/LAUNCH_READINESS_AUDIT.md` §3, `memory/PRD.md` (footer history).

**Checks run (§3):**
- a static resolver mapping each footer href to a page file and to the sitemap code;
- grep for pathname-based logic.

**Not verified (§3):**
- live 200s;
- rendered layout and focus/contrast;
- the founder's intended home-page exception.

---

## 4. Initiative C: Dynamic SEO architecture

### 4.1 Rendering architecture [V]
- **Stack:** Next.js **16.3.3** App Router, React 19, Tailwind 4.
- **Data sources:**
  - Pages read the main backend server-side (`lib/api.ts` `apiGet`, with `revalidate`).
  - The local FastAPI serves only the isolated features: knowledge graph, voices, institutional, venues fallback and
    others.
- **`metadataBase`** is set in the root `app/layout.tsx` from `SITE_URL`:
  - it uses `NEXT_PUBLIC_SITE_URL`, falling back to `https://www.nostops.org`;
  - `canonical()` and `toWww()` in `lib/site.ts` force the www origin.
- **Title template:** `'%s · NOSTOPS'`. Most pages use `title.absolute`.
- **`(public)` layout defaults:**
  - `alternates.canonical: '/'`;
  - site Open Graph and Twitter cards with `/brand/og-card.png`;
  - `robots index, follow` with `max-image-preview: large`.
  - **[V] Risk:** any public page without its own canonical inherits the **home-page canonical**.
- **Rendering modes, from a static scan of the 74 public pages:**
  - **ISR (pages regenerated on a timer, 60 s to 24 h):** most hubs and legal pages.
  - **`force-dynamic` (rendered on every request):**
    - the home page, `/programmes`, `/voices`, `/voices/[slug]`, `/events/*`;
    - `/gurus/[slug]`, `/scriptures/[slug]`, `/yoga-parampara/[slug]`;
    - `/retreats/in/*` and the three org cohort pages.
  - **`generateStaticParams` (pages pre-built at build time):** teachers, council, guides, paramparas, venues and
    yoga-teachers.
- **Backend SEO bridge:** `lib/seo.ts` `metaToMetadata()` maps the backend `/seo/*` meta (teacher, council) to Next
  metadata. `normalizeJsonLd()` rewrites only the URL keys to www.

### 4.2 Dynamic routes and their metadata [V]
| Route | Metadata source | Indexing rule |
|---|---|---|
| `/teachers/[handle]` | backend `/seo/teacher/{handle}`, backend og image dropped | Indexable only when the handle passes the eligibility gate (visible, active, not suspended, not blocked); otherwise `noindex` + 404 |
| `/teachers/in/[city]/[teacher]` | — | Always `noindex`; 308 to `/teachers/{handle}` once verified |
| `/council/[slug]` | the `/seo/council` member record | Inherits index; 404 if the slug is not in the roster |
| `/gurus/[slug]`, `/scriptures/[slug]`, `/yoga-parampara/[slug]` | local knowledge graph | `index` when found; `noindex, follow` when missing |
| `/events/[slug]` | `lib/event-seo.ts` | `index` and canonical **only** when `indexable` (public, published, verified organisation); otherwise `noindex` and no canonical |
| `/retreats/in/[city]/[retreat]` | retreat record plus `lib/retreat-jsonld.ts` | `index` when found; bare `/retreats/{id}` URLs 308 to here |
| `/venues/in/[city]/[venue]`, `/venues/[venue_id]` | `buildVenueMetadata()` | Index, with canonical set to the slug URL |
| `/yoga-teachers/[city]`, `/[city]/[segment]`, `/become-a-teacher/[city]` | live directory | `index` when the city or segment exists |
| `/voices/[slug]`, `/guides/[slug]`, `/paramparas/[slug]` | local records / static catalogue | `index` when found |

### 4.3 Titles, descriptions and canonicals [V]
- **Most pages set their own canonical.** Every page in the static scan sets its own canonical, except these:
  - **noindex pages:** `/saved`, `/venues/saved`, `/venues/compare`, `/venues/submit/edit`, `/events/[slug]/register`,
    `/teacher-pulse/t/[id]`, `/teacher-pulse/join/[token]`, `/verify/[code]`, `/cashfree-return`;
  - **redirect stubs:** `/cities/[city]`, `/retreats/[retreat_id]`;
  - **`/venues/ai-onboarding/result`:** a client page with **no metadata at all**. It inherits index and the
    home-page canonical. **[V] defect.**
- **The 404 page** clears the canonical and sets `noindex`. **[NV]** When a dynamic page calls `notFound()` after
  `generateMetadata` returned only a title and canonical (venue pages), the merged result is not verified.
- **Council:** the backend description is replaced with claim-free text (NST-008).
- **Teacher titles and descriptions** come from the backend; the website has fallbacks.

### 4.4 Open Graph metadata and images [V]
- **There are 35 `opengraph-image.tsx` and 23 `twitter-image.tsx` files.** They are file-based Next image routes
  drawn by the renderers in `lib/server/*-og.tsx`.
  - **Renderers exist for:** teacher, council, venue, retreat, event, city, parampara, knowledge, voices, claim and the
    site default.
  - **Shareable cards** are also served at `/share-card/{teacher,retreat,event}/…`.
- **Next replaces, rather than merges, a child page's `openGraph`.**
  - `lib/seo.ts` `ogImages()` exists to re-supply images for that reason.
  - **[V]** `/venues/all` declares `openGraph` with **no image** and has no image file, so it ships without an
    og:image.
- **The home page** uses `/brand/og-home.png`. The site default is `/brand/og-card.png`.

### 4.5 Structured data [V]
- **`components/JsonLd.tsx`** escapes `< > &` and U+2028/2029, so free text cannot break out of the script tag.
- **Types in use (reference counts in code):**
  - BreadcrumbList (30), WebSite (26), ItemList (19);
  - WebPage (16), CollectionPage (16), Person (15);
  - FAQPage (11), Organization (9), EducationEvent (5);
  - LodgingBusiness, Article, HowTo, Course/CourseInstance, VideoObject, AboutPage and ContactPage.
  - The home page has a SearchAction.
- **Council member pages** emit `Person` plus `memberOf` the Council `Organization`.
- **Historical Gurus** emit `Person`.
  - **[A]** Some carry `verification_status: "Requires Scholarly Verification"`, and the page shows them as
    "debated".

### 4.6 Sitemap generation [V]
- **One hand-built route handler:** `app/(public)/sitemap.xml/route.ts` (`force-dynamic`). Steps:
  1. **Read and normalise:** it proxies the backend `/seo/sitemap.xml` (revalidated hourly) and rewrites every
     `<loc>` to www.
  2. **Drop:**
     - teacher URLs that fail the eligibility gate;
     - `/gurukul-retreats`;
     - bare `/retreats/{id}` URLs.
  3. **Append:**
     - web pages, guides;
     - cities and segments;
     - venues (**`getVenues({limit:100})`**, although the comment says "uncapped");
     - yoga-parampara, gurus and scriptures;
     - council members (from `/seo/council`);
     - voices, retreats, institutional events (verified organisations only).
  4. **Clean up:** it removes duplicates by `<loc>`.
- **Fail-open:**
  - If the backend is down, the sitemap still serves the static appended pages, so it is partial.
  - Each data source is skipped silently on error.
- **Gaps [V, code]:**
  - **No `<lastmod>` on appended URLs.** Only `changefreq`/`priority` are set, which Google ignores.
  - **The venue cap of 100** silently omits venues beyond 100 [A: count today unknown].
  - **Eligible teacher profiles are only *filtered*, never *appended*.** Profiles missing from the backend sitemap stay
    missing (NAV_IA #21: earlier, 28 public profiles vs 8 in the sitemap).
  - **`/refunds`** (footer Legal) is not in the appended list. **[NV]** The backend sitemap may already list it.
  - **Indexable but not in the sitemap:** `/venues/submit` and `/venues/ai-onboarding`.
  - **A single sitemap with no index file.** That is fine below 50,000 URLs [A].
- **[R]** Move to a typed manifest. Each route family declares its own indexability once. The sitemap, the robots
  metadata and the canonical all read that one declaration. See §9, Phase 3.

**Files inspected (§4):**
- `app/layout.tsx`, `app/(public)/layout.tsx`, `app/not-found.tsx`;
- `lib/seo.ts`, `lib/site.ts`, `lib/seo-feeds.ts`, `lib/event-seo.ts` (excerpt), `lib/server/venues.ts` (excerpt);
- `app/(public)/sitemap.xml/route.ts`, `robots.txt/route.ts`;
- `council/*`, `teachers/[handle]` (metadata), `events/[slug]`, `gurus/[slug]`, `venues/*`;
- `components/JsonLd.tsx`, `next.config.mjs`, `package.json`.

**Checks run (§4):**
- a scripted static scan of all 74 public `page.tsx` files: metadata type, canonical, noindex, JSON-LD, OG source,
  rendering mode;
- an OG-without-image scan;
- a JSON-LD type count;
- conditional-robots grep.

**Not verified (§4):**
- rendered HTML heads in production;
- the contents of the backend `/seo/sitemap.xml`;
- whether the OG image routes render;
- the live venue and teacher counts.

---

## 5. Initiative D: Robots and indexing policy

### 5.1 Existing directives [V]
- **`robots.txt`** is built by the website (`lib/seo-feeds.ts` `buildRobotsTxt`) and ignores the backend robots file.
  - It has **19 user-agent groups**: `*`; Googlebot, Googlebot-Image, Bingbot, DuckDuckBot, Applebot; and AI agents
    OAI-SearchBot, ChatGPT-User, **GPTBot**, PerplexityBot, Perplexity-User, ClaudeBot, Claude-User, Claude-SearchBot,
    **Google-Extended**, **Applebot-Extended**, Amazonbot, **Bytespider**, **CCBot**.
  - Each group has `Allow: /` and `Disallow: /api/ /bff/ /app/ /admin/`.
  - It ends with one `Sitemap: https://www.nostops.org/sitemap.xml` line.
  - So **AI-training crawlers are explicitly welcome.** That is a policy choice for the founder (F-D2).
- **The same allow-all file is served on every host.** This was confirmed on the local preview server.
  - **[A]** Preview hosts (`*.preview.emergentagent.com`) therefore invite crawling.
  - The canonicals point to www, which limits duplicate content but does not stop preview pages being indexed.
- **Notes on the Disallow list:**
  - `/admin/` matches no route (admin lives at `/app/admin`). It is harmless.
  - `/participant/` and `/booking-invite/` are not disallowed. They rely on `noindex`, which works because crawlers can
    read it.
- **Metadata robots:**
  - the `(public)` layout sets index, follow;
  - the `(auth)` layout, the `/app` layout, the participant layout and many pages set `noindex`.
- **Header:** the proxy adds `X-Robots-Tag: noindex, nofollow` on `/app/*`.
- **Login gate:** the proxy sends signed-out `/app/*` visitors to `/login`.

### 5.2 Route matrix
Indexability is evaluated from code [V]. Where it depends on live data, the column says so [NV].

**A. Public and indexable**

| Route(s) | Condition | In sitemap code |
|---|---|---|
| `/`, `/about`, `/how-it-works`, `/philosophy`, `/trust`, `/faq`, `/support`, `/contact` | always | yes (home via backend [NV]) |
| `/privacy`, `/terms` | always | yes |
| `/refunds` | always | **no** (backend list [NV]) |
| `/teachers`, `/claim`, `/become-a-teacher`, `/city-coordinator`, `/levels`, `/programmes` | always | yes |
| `/teachers/[handle]` | eligible handle [NV live] | backend list, filtered |
| `/yoga-teachers`, `/[city]`, `/[city]/[segment]`, `/become-a-teacher/[city]` | city or segment exists [NV] | yes (appended) |
| `/retreats`, `/retreats/host`, `/retreats/in/[city]`, `/retreats/in/[city]/[retreat]` | the record exists [NV] | yes |
| `/venues`, `/venues/all`, `/venues/in/[city]`, `/venues/in/[city]/[venue]` | the record exists; cap 100 | yes |
| `/list-your-venue` | always | yes |
| `/for-organisations` and its 5 sub-pages | always | yes |
| `/events/[slug]` | `indexable` (public, published, verified organisation) [NV] | yes |
| `/council`, `/council/[slug]` | the member is in `/seo/council` [NV] | yes |
| `/gurus`, `/gurus/[slug]`, `/scriptures`, `/scriptures/[slug]` | the record exists | yes |
| `/paramparas`, `/paramparas/[slug]`, `/yoga-parampara`, `/yoga-parampara/[slug]`, `/find-your-tradition` | the record exists | yes |
| `/voices`, `/voices/[slug]`, `/guides`, `/guides/[slug]` | published or found | yes |
| `/voices/api`, `/teacher-pulse` | always | yes |

**B. Public and indexable today, but needing a policy decision**

| Route | Why | Proposal |
|---|---|---|
| `/venues/submit` | A form page; indexable, not in the sitemap | `noindex, follow` [R] (NAV_IA #22) |
| `/venues/ai-onboarding` | A paid-service landing; indexable, not in the sitemap | Decide index plus add to the sitemap, or `noindex` (F-D4) |
| `/venues/ai-onboarding/result` | **No metadata; inherits index and the home-page canonical** | `noindex, nofollow` [R] |
| `/venues/[venue_id]` (legacy id URL) | Renders as a duplicate, with canonical set to the slug URL | 308 to the slug URL [R] |
| `/council/[slug]` | Living people; consent and placeholder status not verified | Index only with recorded consent (F-A6) |
| `/gurus/[slug]` marked "Requires Scholarly Verification" | Disputed history | Keep indexed with a visible "debated" label, or `noindex` (F-D5) |
| `/voices/api` | A developer page linked from nowhere | Link it from `/voices` or drop it from the sitemap |

**C. Public and not indexable**

| Route | Current rule |
|---|---|
| `/search`, `/saved` (layout), `/venues/saved`, `/venues/compare`, `/venues/submit/edit` | `noindex` |
| `/list-your-venue/enquire`, `/retreats/[retreat_id]/group` | `noindex, follow` |
| `/events/[slug]` (not indexable), `/events/[slug]/register` | `noindex` |
| `/teachers/in/[city]/[teacher]` | `noindex`, or 308 |
| `/teacher-pulse/t/[id]`, `/teacher-pulse/join/[token]`, `/verify/[code]`, `/cashfree-return` | `noindex` |
| Redirects: `/cities/[city]`, `/retreats/[id]`, `/for-companies`, `/for-educational-institutions`, `/for-startup-networks` | 308 |
| All 404 pages | `noindex`, no canonical |

**D. Private or signed-in**

| Route | Controls |
|---|---|
| `/app/**` (120 pages, including `/app/admin/**` and `/app/council/**`) | robots `Disallow`, `X-Robots-Tag`, metadata `noindex`, proxy login redirect, a layout session check, and role checks on each page and BFF route |
| `(auth)`: `/login`, `/register`, `/signup`, `/join`, `/choose-role`, `/verify-otp`, `/reset-password`, `/emergent-callback` | layout `noindex, nofollow` |
| `/participant/**`, `/participant/payment/return`, `/booking-invite/[token]` | `noindex`; links carry a token or need a session |
| `/bff/**`, `/api/**` | robots `Disallow`; server-side guards |

**E. Not HTML, or not verified**

| Route | Note |
|---|---|
| `/robots.txt`, `/sitemap.xml` | Website-owned feeds |
| `/teacher-pulse/feed.xml`, `/teacher-pulse/c/[slug]/feed.xml`, `/voices/embed.js`, `/venues/[venue_id]/availability`, `/share-card/*`, `/participant/verify` | Route handlers. **[NV]** Their response headers and content were not checked |
| Backend-only sitemap URLs | **[NV]**: whatever `/seo/sitemap.xml` lists beyond the filters |

**Files inspected (§5):**
- `lib/seo-feeds.ts`, `app/(public)/robots.txt/route.ts`, `proxy.ts`;
- all layouts;
- every public `page.tsx` (scripted scan, plus a conditional-robots grep on 16 dynamic pages);
- `next.config.mjs` (redirects, headers).

**Checks run (§5):**
- `curl localhost:3000/robots.txt` (19 groups);
- the route scan;
- metadata grep.

**Not verified (§5):**
- production robots and headers;
- whether search engines have indexed preview hosts;
- the backend sitemap contents.

---

## 6. Data, permissions, routes and dependencies

### 6.1 Relevant existing components
| Area | Components / modules | Data and APIs | Access control |
|---|---|---|---|
| Nominations (L1) | `app/app/admin/nominations/page.tsx`, `NominationsQueue.tsx`, `lib/server/admin-nominations.ts`, two BFF routes | main `council_nominations` (named in the OpenAPI text) via `/admin/council/nominations*` | `requireAdminUser`, `requireAdmin` plus CSRF, gateway `admin_gate` |
| Council roster | `app/app/admin/council-roster`, `lib/server/admin-council-roster.ts`, `components/app/council/*` | `/admin/council-roster*`, `/admin/people/council/*`, `/council/profile/me` | admin, or the `council` role |
| Public Council | `app/(public)/council/*`, `lib/server/council-og.tsx`, sitemap `appendCouncilMemberUrls` | `/seo/council` (ISR 1 h, fetch 24 h) | public, with `public_privacy` stripping |
| Historical Gurus | `app/(public)/gurus/*`, `lib/server/knowledge.ts`, `backend/knowledge.py` | local `kg_*` | public reads; writes need the internal secret plus admin |
| Footer / header | `SiteFooter`, `SiteHeader`, `MobileNav`, `lib/site-nav.ts`, `lib/server/cities.ts` | `/teachers/directory` (cities) | public |
| SEO core | `lib/site.ts`, `lib/seo.ts`, `lib/seo-feeds.ts`, `lib/event-seo.ts`, `lib/retreat-jsonld.ts`, `components/JsonLd.tsx`, `BreadcrumbJsonLd.tsx`, `lib/server/*-og.tsx` | `/seo/*`, local feeds | public |
| Money lock (must not change) | `backend/financial_lock.py`, `frontend/lib/financial-lock-rules.ts`, `payment_guard.py`, `admin_gate.py`, `server.py` proxy order | — | fail-closed; `FINANCIAL_ACTIONS_UNLOCKED` unset |

### 6.2 Dependencies between initiatives [V structure / R order]
- **A → C:** new or changed Council profiles need correct titles, claim-free descriptions, `Person` JSON-LD and OG
  cards. The renderers exist (`council-og.tsx`).
- **A → D:** a nominated Guru must **never** become indexable before consent and publication. Today the sitemap and
  robots follow whatever `/seo/council` returns, so a website-side "published and consented" gate is needed first, or a
  backend guarantee.
- **B → D:** footer links should point at canonical, indexable pages, or deliberately at `noindex` sign-in pages. The
  "Retreats" target and the duplicate `/teachers` link affect internal-link signals.
- **B → A:** a "Nominate a Guru" footer link only after A's public form exists and its privacy wording is approved.
  - That wording is a **Stage 2 legal item, on hold**.
- **C → D:** one declaration of indexability should drive the robots metadata, the canonical and the sitemap. Today
  they are maintained in three places (page metadata, `appendWebPages`, the robots builder).
- **All initiatives → financial lock:**
  - No initiative needs any change to payment, wallet, payout, KYC-fee or lock files.
  - Every phase re-runs the 6 money-lock suites.
  - Phase A's public form must not reuse any payment route.
  - `/council/nominate` does not match the lock's money patterns [A, from the regex in `server.py`; confirm by test in
    Phase 1].

**Files inspected (§6):** as in §2 to §5, plus `backend/server.py` (proxy order and the `_PAYMENT_WRITE` regex).

**Not verified (§6):** main-backend storage and side effects for council records.

---

## 7. Risk register

**Likelihood (L) and Impact (I):** H high, M medium, L low.

| ID | Risk | L | I | Existing control [V] | Mitigation [R] | Gate |
|---|---|---|---|---|---|---|
| R1 | **Privacy exposure.** Nominee and nominator email and phone leak to the public, through a public council read or a draft-to-public promotion | M | H | `public_privacy` strips contact keys on public `council/*` and `seo/*` reads | Never send contact fields to public components. Add a test that the public council JSON contains no `nominee_*` or `nominator_*` keys. Get the legal wording approved (Stage 2) | F-A4, F-A5 |
| R2 | **Third-party data without consent.** The nominee never agreed to be nominated | H | H | none | Collect the minimum; contact fields optional or admin-only; consent captured when the nominee accepts; a retention and delete rule | F-A4 |
| R3 | **Unauthorised approvals at L1** | L | H | page, BFF and gateway admin checks; CSRF | Keep all three. Add a role test for each action. Consider TOTP step-up for advance and delete | F-A7 |
| R4 | **Unauthorised approvals at L2** (`/guru/council/*` is not gateway-guarded) | M [NV] | H | backend only [NV] | Confirm the backend role check. Optionally add a gateway or BFF `council` role gate. Add tests with non-council roles | F-A3 |
| R5 | **Irreversible outbound messages.** L2 approval sends email, WhatsApp and SMS, including from preview or in tests | M | H | none known | Never call L2 approve in preview or tests. Ask the backend for a dry-run or sandbox flag. Show a confirmation step that names the channels | F-A3 |
| R6 | **Spam or abuse of the public nominate endpoint** (no declared auth) | H | M | none known [NV] | BFF rate limit, honeypot or captcha, length checks matching the backend, server-side email-format check | F-A2 |
| R7 | **Accidental indexing of unconsented, placeholder or draft Guru profiles** | M | H | the sitemap only adds `/seo/council` members | Index only with a "published and consented" flag; check for placeholders (NST-020) | F-A6 |
| R8 | **Accidental indexing of preview hosts** (allow-all robots on every host) | M | M | canonical set to www | Host-aware robots: `Disallow: /` plus `noindex` off the production host | F-D1 |
| R9 | **Metadata or canonical errors.** Pages inherit the home-page canonical (`/venues/ai-onboarding/result`); child `openGraph` drops the image (`/venues/all`) | H [V] | M | the `ogImages()` helper; the not-found override | A typed SEO helper that requires a canonical and an image; a static test that every public page declares both | Phase 3 |
| R10 | **Stale or incomplete sitemap.** No lastmod; venue cap of 100; teachers not appended; `/refunds` possibly missing; fail-open partial output | H [V] | M | dedupe; eligibility filter | A manifest-driven sitemap with lastmod; a count-based check; alert when a data source is skipped | Phase 3/4 |
| R11 | **Broken or misleading footer links** ("Retreats" goes to the host page; duplicate `/teachers`; future links to unlaunched pages) | M | L | the static route check (§3) | A link test in CI covering every footer href | Phase 2 |
| R12 | **Financial-system regression** from shared files (`server.py` proxy order, BFF helpers, layouts) | L | H | 6 money-lock suites (553 passed) | No edits to the lock, payment or wallet files; re-run the suites each phase; diff review that excludes money paths | every phase |
| R13 | **Defects in the existing L1 queue** (A-G3 to A-G8) cause wrong decisions: hidden citation, draft member created on reject, one-click delete | M | M | none | Fix in Phase 1 before any public intake | Phase 1 |
| R14 | **Claims risk.** Bios, decades and "Guru" titles shown publicly as facts | M | M | claim-free council description (NST-008) | Editorial review; "as stated" labels; no aggregate numbers | F-A5 |
| R15 | **Policy on AI crawlers** (training bots allowed) | — | M | explicit allow-list | Founder decision; change per agent | F-D2 |

---

## 8. Dependencies and acceptance criteria [R]

### Initiative A (Guru nominations)
- **Prerequisites:**
  - founder decisions F-A1 to F-A8;
  - written confirmation from the main-backend owner of:
    - (a) the list response shape and status values;
    - (b) the role check on `/guru/council/*`;
    - (c) rate limiting on `/council/nominate`;
    - (d) a messaging dry-run in preview;
    - (e) what `create_draft_member` does and whether delete can be undone;
  - approved privacy wording (Stage 2, on hold).
- **Acceptance criteria:**
  - The queue shows citation, lineage, city, decades, references and relationship; contact details only to admins.
  - A status filter covers pending, info requested, advanced, rejected and all.
  - Counts match the backend.
  - Reject never sends `create_draft_member`.
  - Remove asks for confirmation and a reason.
  - `request-info` limits match the backend (5–1200).
  - The public form validates exactly as `NominationIn` does. Its success screen makes no promise of selection.
  - A nominee never appears on `/council` or in the sitemap until published and consented.
- **Security checks:**
  - role tests on every action (admin, council, teacher, signed out);
  - CSRF origin test;
  - rate-limit test;
  - public-read test showing no contact keys;
  - no `/guru/council/*/approve` call in any automated test.
- **Accessibility:**
  - form labels and error text tied to fields;
  - keyboard operation;
  - focus moves to the confirmation;
  - 44 px targets.
- **Regression:**
  - the 6 money-lock suites;
  - `verify_access_matrix`;
  - council page rendering with sample data.
- **Release:**
  - preview sign-off by the founder;
  - backend confirmation that messaging is disabled in preview;
  - a separate publication authorisation.

### Initiative B (footer)
- **Prerequisites:** F-B1 to F-B3.
- **Acceptance criteria:**
  - every footer href resolves to a 200 or a deliberate redirect;
  - no duplicate destinations unless approved;
  - the agreed home-page variant;
  - labels shared with the header (`lib/site-nav.ts`);
  - city links still live.
- **Security checks:** no links into `/app` or `/bff` other than the sign-in entry points.
- **Accessibility:**
  - a `<nav aria-label="Footer">` landmark;
  - correct heading levels;
  - visible focus;
  - AA contrast;
  - no overlap with the Ask AI Guru or sticky call-to-action buttons at 320–1440 px.
- **Regression:** header unchanged; sitemap entries for footer pages; the money-lock suites.
- **Release:** desktop screenshots for founder review; phone widths checked internally.

### Initiative C (SEO architecture)
- **Prerequisites:** F-C1 and F-C2; Phase 4 policy draft agreed.
- **Acceptance criteria:**
  - every indexable public page has a unique title, a description of 50–160 characters, a self-referencing www
    canonical, og:image and twitter:image (1200×630), and valid JSON-LD for its type;
  - noindex pages carry no misleading canonical;
  - the sitemap is generated from one manifest, with lastmod where data exists;
  - no cap below the real count;
  - every indexable family is listed;
  - nothing `noindex` is listed.
- **Security checks:**
  - JSON-LD escaping kept;
  - no private fields in metadata or OG renderers;
  - the OG image fetcher limited to the allowed image hosts (SEC-001).
- **Accessibility:** OG images carry alt text.
- **Regression:**
  - `verify_seo_feeds` fixed and green;
  - a static metadata test across all public routes;
  - build page count unchanged;
  - the money-lock suites.
- **Release:** a crawl of the preview build (read-only GETs) compared with the route matrix in §5.

### Initiative D (indexing policy)
- **Prerequisites:** F-D1 to F-D5; C's manifest in place.
- **Acceptance criteria:**
  - robots behaviour by host (production allow, non-production disallow);
  - the AI-agent policy as decided;
  - every route in the §5 matrix behaves as its column says;
  - `/venues/ai-onboarding/result` and `/venues/submit` are fixed.
- **Security checks:** private and token routes stay `noindex`; no sitemap entry for any `/app`, `/participant` or
  token route.
- **Regression:** `verify_seo_feeds`, the access matrix and the money-lock suites.
- **Release:**
  - controlled rollout;
  - submit the sitemap in Search Console after publication;
  - watch coverage for 2–4 weeks;
  - a rollback plan (robots and sitemap are single files).

---

## 9. Four-phase implementation roadmap [R]

| Phase | Content | Depends on | Notes |
|---|---|---|---|
| **1. Guru nominations** | **1a:** fix and enrich the existing L1 admin queue (A-G3 to A-G8). Website only; no backend change needed. **1b:** public "Nominate a Guru" form through a new rate-limited BFF route to `POST /council/nominate`. **1c:** an L2 Council voting screen, **only** after the backend confirms role checks and a messaging dry-run. **1d:** a publication gate so only consented, published members reach `/council` and the sitemap | F-A1 to F-A8, backend confirmations, Stage 2 privacy wording (on hold) | 1a can start as soon as it is approved. 1b and 1c are blocked by the legal hold and the backend answers |
| **2. Footer navigation** | Regroup the columns per F-B2; fix the "Retreats" target and the duplicate `/teachers`; shared labels; the home-page variant per F-B1; landmark and heading fixes; collapsible groups on phones | F-B1 to F-B3 | Low risk and independent |
| **3. SEO architecture** | One typed SEO helper (canonical and image required); a route manifest; a manifest-driven sitemap with lastmod and no caps; fix the inherited canonical, the missing OG image and the venue cap; council and Guru profile metadata ready for Phase 1d | Phase 4 policy draft (F-D*), F-C1, F-C2 | Fix `verify_seo_feeds` first |
| **4. Indexing policy and controlled SEO release** | Host-aware robots, the AI-agent policy, `noindex` fixes from §5 table B, Search Console submission, monitoring | Phase 3 | Publication needs separate authorisation |

### Justified sequencing options (for founder choice; the default order is kept)
1. **Run Phase 2 alongside Phase 1.** Phase 1b and 1c may wait on the legal hold and backend answers. The footer has
   no dependency on them, so the time is not lost.
2. **Bring forward two safety items from Phase 4 as small, separate fixes:**
   - non-production robots (R8);
   - `noindex` on `/venues/ai-onboarding/result` (R9).
   - They lower the risk now, are one-file changes, and do not change the production policy.
3. **Do not publish any new public Guru profile until Phase 3's gate (1d) is in place.** The sitemap currently follows
   the backend roster automatically.

---

## 10. Founder decisions and approval gates

### 10.1 Decisions required before implementation
| ID | Decision |
|---|---|
| F-A1 | Confirm that "Yoga Guru nominations" means nominations to the **Council of Yoga Gurus** (living), not the historical `/gurus` knowledge pages. |
| F-A2 | Who may nominate? Anyone (public form, with spam protection) or signed-in members only, such as teachers and the Council. |
| F-A3 | Is the website's L2 Council voting screen in scope? Approval sends real email, WhatsApp and SMS. Who signs off on the invitation wording? |
| F-A4 | Which nominee personal details are collected (email and phone optional or excluded)? How long are they kept, and how are they deleted? This needs the privacy wording (Stage 2, on hold). |
| F-A5 | Public profile fields and the editorial rules: "as stated" labels, photo consent, no aggregate numbers. |
| F-A6 | When does a Guru become public and indexable? Recommended: only after accepting the invitation, with a consent record, editor approval and a publish flag. |
| F-A7 | Should advance, reject and delete require TOTP step-up? Should delete be replaced by "archive"? |
| F-A8 | Fix the L1 queue defects (A-G3 to A-G8) as Phase 1a before any public intake? |
| F-B1 | Define the "home-page exception": (a) a compact footer on home only, (b) home hides certain columns, or (c) home keeps the full footer while other pages change. **Today there is no exception in the code.** |
| F-B2 | The target column structure: Discover, Participate, About, Trust & Legal (the earlier IA brief), or keep the current 6 columns. Should "Retreats" point to `/retreats` (discovery) or `/retreats/host`? |
| F-B3 | Which extra links to add or remove (programmes, levels, impact/resources, voices/api; "Nominate a Guru" after A launches)? |
| F-C1 | Title and description conventions: brand suffix, length, Hindi/English mix on the home page. |
| F-C2 | Sitemap scope: include every eligible teacher profile and every venue (no cap)? |
| F-D1 | Block crawling on all non-production hosts (preview)? |
| F-D2 | AI-crawler policy: keep allowing the training bots (GPTBot, CCBot, Google-Extended, Applebot-Extended, Bytespider), or allow only search and citation agents? |
| F-D3 | `/venues/submit`, `/claim`, `/teacher-pulse`, `/voices/api`: index or `noindex`? |
| F-D4 | `/venues/ai-onboarding`: index and add to the sitemap, or `noindex`? |
| F-D5 | Historical Guru pages marked "Requires Scholarly Verification": index them with a visible label, or `noindex`? |

### 10.2 Technical questions for the main-backend owner (unresolved)
1. The actual status values and response shape of `GET /admin/council/nominations`, including `citation`,
   `pending_count` and `advanced_count`.
2. The role check and audit logging on `/guru/council/nominations/*`, and on `/admin/council/nominations/*` decisions.
3. Rate limiting, captcha and validation on `POST /council/nominate`. Does it send any email to the nominee or
   nominator?
4. Is there a dry-run, sandbox or non-production switch for the L2 invitation messages?
5. What does `create_draft_member` create? Is that record ever public? How does a draft become a public `/seo/council`
   member?
6. Can a nomination delete be undone? Is the data kept?
7. Has `/council/seed-placeholders` been used? Are any current `/council` members placeholders (NST-020)?
8. Does `/seo/sitemap.xml` include `/refunds`, and every eligible teacher profile?

### 10.3 Approval gates
- **Gate 0:** founder review of this report.
- **Gate 1:** founder answers to §10.1, plus backend answers to §10.2 (for 1b, 1c and 1d).
- **Gate 2:** approval to start each phase separately (preview only).
- **Gate 3:** founder sign-off on the preview result for each phase.
- **Gate 4:** separate publication authorisation. SEO release (Phase 4) also needs the Search Console steps.

### 10.4 Items that must remain on hold
- **B4.9** (payouts and billing) and **B5.2**: BLOCKED until explicit authorisation and the existing decisions.
- **Stage 2:** legal, fee, tax, refund and financial wording. This includes any privacy-policy change needed for
  nominations.
- **Stage 3:** admin payout wording.
- **Stage 4:** text sent by the main backend.
- **InstaKYC translations:** pending native-speaker review.
- **The money lock:**
  - the website lock stays ON;
  - `MONEY_OPS_FROZEN` is unchanged and not verified;
  - the ₹1,062 discrepancy is not corrected;
  - the ₹13,600 stale holds are not reversed;
  - `led_6693375254d1` and `led_a28204971867` are untouched.
- **No deployment, publication or mobile build** without separate authorisation.

---

## Appendix: complete list of checks run this session (all read-only)
1. Directory listings of `memory/`, `frontend/app` and `frontend/lib`, plus a `find` for every page, layout and route
   file.
2. `git rev-parse --short HEAD` gave `02ee5768`. `git diff --name-only` showed only `frontend/yarn.lock` and `.pyc`
   files.
3. A grep for `FINANCIAL_ACTIONS_UNLOCKED` in both `.env` files (0, 0) and in 6 process environments (0 each).
4. A grep for `MONEY_OPS_FROZEN` in the website code (0 files).
5. The pytest re-run of the 6 money-lock suites: 553 passed, 12 skipped, 0 failed. Evidence:
   `test_reports/p0/discovery/`.
6. `curl http://localhost:3000/robots.txt` (website-owned, no backend call).
7. A Python static scan of the 74 public pages: metadata, canonical, robots, JSON-LD, OG source, rendering mode.
8. A Python OG-without-image scan, and a static footer-href resolver (`/tmp/footer_check.py`, outside the repo).
9. Extraction of paths, schemas and descriptions for council, nominations and gurus from the OpenAPI snapshot.
10. Targeted greps: nominations, council, TOTP and audit use in BFF routes, pathname logic, robots conditions, lastmod,
    `getVenues` caps.

**Not run:**
- live-backend calls;
- signed-in or browser sessions;
- the database-writing suite (`test_p0_inbound_payments`);
- the frontend site checks (they request live data);
- `tsc`, ESLint and the build (no source change since closure);
- any production request.
