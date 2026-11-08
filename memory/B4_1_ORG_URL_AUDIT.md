# NOSTOPS Phase B4.1 — OEA-12/16: Canonical Organisation URLs & Navigation Audit (read-only)

Read-only. No code, data, redirects or production settings were changed. Evidence comes from code inspection plus live GET
requests to https://www.nostops.org (B2.3 is live: new demo slugs 200 + noindex, old slugs 308).

## 1. Route inventory and proposed mapping

| Route | Live status | Canonical tag | Robots | In sitemap | Internal links | Journeys using it | Verdict |
|---|---|---|---|---|---|---|---|
| /for-organisations | 200 | self (www) | index,follow | yes | header, mobile menu, footer, OrgSubNav, /programmes, /venues, wizard, showcase, Guru CTA, enquiry email | gateway | **Canonical** |
| /for-organisations/companies | 200 | self | index,follow | yes | header dropdown, mobile group, footer, gateway cards, guides, wizard customise link | showcase + pricing + enquiry (`?customise=1&interest=&cohort=`) | **Canonical** |
| /for-organisations/educational-institutions | 200 | self | index,follow | yes | same | same | **Canonical** |
| /for-organisations/startup-networking-groups | 200 | self | index,follow | yes | same | same | **Canonical** |
| /for-organisations/impact, /resources | 200 | self | index,follow | yes | OrgSubNav | sub-pages of the gateway, not duplicates | **Keep (not duplicates)** |
| /for-companies | 200 | **self** | index,follow | **yes** | 10 code locations (below) | signup "I'm an Organisation", learner nav "Bring Yoga to my Workplace", NBA "Suggested for you" card, city pages | Legacy → **/for-organisations/companies** |
| /for-educational-institutions | 200 | **self** | index,follow | **yes** | guide + resources + NBA map | — | Legacy → **/for-organisations/educational-institutions** |
| /for-startup-networks | 200 | **self** | index,follow | **yes** | guide + resources + NBA map | — | Legacy → **/for-organisations/startup-networking-groups** |

Not duplicates, so leave alone: /programmes, /events/*, /app/org/* (behind auth, noindex), /booking-invite/* (noindex),
/guides/corporate-yoga-programmes, /guides/yoga-for-educational-institutions, /guides/yoga-for-startups-and-networking-groups
(editorial guides; their slugs contain "for-educational-institutions" / "networking-groups" but they are distinct content).
/for-organizations (US spelling), /For-Companies and /for-organisations/Companies all return 404 (no case-variant duplicates).

Legacy-route references in code (all must move to canonical):
- `app/(public)/sitemap.xml/route.ts:43-45` (3 sitemap entries)
- `app/(public)/for-organisations/resources/page.tsx:52-54` (cards; descriptions are stale: "Founder resilience and high-performance habits")
- `lib/guides.ts:202, 256, 304` (each guide links BOTH the legacy page and the canonical page as "related")
- `components/auth/SignupRoleChooser.tsx:30` (signup → "I'm an Organisation")
- `components/app/nav-config.ts:34` (learner dashboard "Bring Yoga to my Workplace")
- `lib/server/learner.ts:123-129` (backend next-best-action routes `/bring-yoga-to-*` → legacy pages; also the default fallback)
- `app/(public)/yoga-teachers/[city]/page.tsx:332`, `become-a-teacher/[city]/page.tsx:375`, `components/city/CityCoordinatorSpotlight.tsx:71`,
  `app/(public)/venues/page.tsx:285`, `app/app/teacher/widgets/page.tsx:184`, `components/app/learner/WellnessJourney.tsx:107`
- `components/guru/context.ts:66, 94-96` (detects both URL families; harmless, keep)
- Legacy page files: `app/(public)/for-companies|for-educational-institutions|for-startup-networks/{page,opengraph-image,twitter-image}.tsx`,
  `lib/server/org-og.tsx`, `components/public/OrgLanding.tsx` (used only by the 3 legacy pages)
- Tests: `backend/tests/b23_wording_check.py` checks the 3 legacy pages and their OG images.

Backend: no Python references to legacy routes (the enquiry email links /for-organisations; Guru CTA → /for-organisations).
Preview DB: 0 documents in any collection contain a legacy route string. The production DB was not inspected (read-only brief).

## 2. Evidence of duplicate / competing URLs
- Each cohort has TWO indexable, self-canonical pages, both in the sitemap, both with pricing, an enquiry form and a
  "Create a Programme" CTA, targeting the same intent:
  - /for-companies — title "Corporate Yoga & Workplace Wellness for Companies — NOSTOPS · NOSTOPS", H1 "Authentic yoga for your workplace"
  - /for-organisations/companies — title "NOSTOPS for Companies — Council-Curated Yoga Programmes at Work · NOSTOPS", H1 "Work Better. Live Better."
  - The same pattern holds for educational institutions and startup networks.
- A live web search for site:nostops.org returns /for-companies as a source next to the canonical pages, and quotes stale
  wording ("exam readiness", "high-performance habits"). The legacy pages are being crawled and are competing.
- Guides pass link equity to both versions; /resources links only the legacy versions; the header and footer link only the
  canonical versions.
- Content unique to the legacy pages, which would be lost by a plain redirect: the "Built for…" audience cards, the phased-programme
  cards, the 5-question FAQ (venue, group size, group pricing incl. nearest-band text, dashboard, who teaches), the 100-organisation
  mission bar and Service JSON-LD. The canonical pages already have: how it works, demo showcase, pricing (CohortPricing +
  estimator), enquiry form and related guides — but no FAQ.
- Enquiries record `source_page`: legacy pages send "/for-companies" etc. and canonical pages send their own paths (shown in admin).

## 3. Navigation map and duplicate journeys
Public:
- Desktop header: "For Organisations" (/for-organisations) dropdown → the 3 canonical cohort pages (`lib/site-nav.ts`).
- Mobile menu: same config; label link + expandable cohort group → canonical.
- Footer: Overview, For Companies / Educational Institutions / Startup & Networking Groups (canonical), "Request a proposal" (/for-organisations#enquire).
- Gateway: cohort cards → `/app/org/events/new?cohort=…` + "See examples" → canonical cohort pages; OrgSubNav (Overview, How it works, Impact, Resources).
- Cohort pages: Create a Programme (`?cohort=`), Explore Programmes, #enquire, demo event cards → /events/{slug}.
- Event pages: breadcrumb Home › Programmes; register → /events/{slug}/register; no cohort-page links. Demo pages noindex; old demo slugs 308.
Auth:
- /signup chooser: Organisation → **/for-companies (legacy)**. /choose-role → /join (teacher-only beta). /register creates seeker accounts.
- Login: `next` is sanitised (`safeNextPath`), default /app; /app routes by role (corporate → OrgHome).
- **Logged-out "Create a Programme" drops the cohort:** `proxy.ts` sets `next` = pathname only, so
  `/app/org/events/new?cohort=COMPANY` → `/login?next=%2Fapp%2Forg%2Fevents%2Fnew` (verified live). Users return to the wizard without their cohort chosen.
Dashboard (corporate): Overview (/app → OrgHome: KPIs, legacy "Your batches", Create a Programme), Programme Dashboard
(/app/org/dashboard), Create a Programme (/app/org/events/new), Programme Events (/app/org/events), Analytics (Soon), Billing (Soon).
Learner dashboard: "Bring Yoga to my Workplace" → **/for-companies (legacy)**.

"New Batch" vs "Create a Programme" — materially different, not duplicates:
- New Batch (/app/org/bookings/new): the older group-booking batch model on the remote backend (/bookings): fixed 18–40 capacity,
  session-date list, invite token, /booking-invite/{token} (register + Cashfree PayNow), managed at /app/org/bookings/{id}
  (corporate only), listed on OrgHome "Your batches". **Already retired for creation:** hidden from menus, the page shows a notice
  linking to the wizard, and the BFF POST returns 410. Existing batches still rely on /app/org/bookings/[id], /booking-invite/[token],
  /bff/booking-invite/*, /bff/org/bookings/[id]/close, BatchShare and the OrgHome batch list.
- Create a Programme (/app/org/events/new): the institutional engine — Council programme, cohort, visibility, sessions, participant fee,
  teacher matching, public /events/{slug}.
- Recommendation: no removal or redirect needed. Keep /app/org/bookings/new as the notice page (noindex, behind auth) so old bookmarks still work.
- ROI Calculator: hidden by `ROI_CALCULATOR_ENABLED=false` (nav + OrgHome links gated; /app/org/roi → /app). Not a duplicate; leave as is.
- Two dashboard "homes" (Overview vs Programme Dashboard) remain because existing batches live only on Overview. Merging them is out of scope.
- Note: /app/org/events(/new) only require a login (no corporate role check). A seeker can create a programme but has no org menu
  items. Flagged for awareness, not in scope.

## 4. SEO and redirect risks
1. Duplicate content (above): 3 pairs of competing indexable pages, plus sitemap and internal links to both.
2. **Bare host not consolidated:** https://nostops.org/* serves 200 (no redirect to www; only http→https 301 at Cloudflare). Canonical tags point to www, which
   mitigates it, but this is a duplicate host. Fix at the domain/Cloudflare level (owner/hosting setting, out of code scope).
3. Redirect chains: the trailing-slash 308 (relative Location) is followed by the new 308, so http://nostops.org/for-companies/ would take
   up to 3 hops (301 → 308 → 308, and it still ends on the bare host). Acceptable, but best avoided once the host redirect exists.
4. Query strings: canonical tags already strip params (utm-safe). Next.js `redirects()` preserves the query string, and browsers keep #fragments;
   both are required (wizard customise link uses `?customise=1&interest=&cohort=`; CTAs use #enquire).
5. Case: uppercase variants 404. Keep it that way; don't add case-folding redirects.
6. Titles repeat the brand: the template "%s · NOSTOPS" plus "— NOSTOPS" gives "… — NOSTOPS · NOSTOPS" (legacy pages) and
   "NOSTOPS for Companies — … · NOSTOPS" (canonical). Minor; fix with `title.absolute` or by dropping the suffix.
7. Must NOT change: canonical cohort pages stay `index, follow` (verified live). Demo event pages stay `noindex, nofollow` and out of the
   sitemap (0 /events/ URLs listed live). Date-free old demo slugs keep 308 (verified live). Verified-org public events stay indexable.
8. Removing the legacy pages without moving their FAQ loses unique copy, including the B2.3 pricing FAQ.
9. 308 vs 301: Next `permanent: true` emits 308, which search engines treat as permanent. Fine.
10. Unknown: legacy URLs used outside the site (emails, ads, partner links, the mobile app's backend NBA routes). Redirects keep them working.

## 5. Smallest safe implementation plan (for approval — not implemented)
Step 1 (content parity, optional but recommended before redirecting): render the 5 legacy FAQs per cohort on the canonical cohort pages (CohortShowcase).
Step 2 (redirects): add 3 permanent exact-path redirects in `next.config.mjs` `redirects()`:
`/for-companies` → `/for-organisations/companies`, `/for-educational-institutions` → `/for-organisations/educational-institutions`,
`/for-startup-networks` → `/for-organisations/startup-networking-groups`. Exact paths only, with no `:path*` and no other
"organisation" routes.
Step 3 (links): repoint the 10 internal link locations + NBA map + signup chooser + learner nav to the canonical paths. Remove the legacy entry
from each guide's "related" list (it would duplicate the canonical one). Update /resources cards and their stale descriptions.
Step 4 (sitemap): delete the 3 legacy `<loc>` entries.
Step 5 (cleanup, same or later release): delete the 3 legacy page/OG/twitter files, `lib/server/org-og.tsx`, `OrgLanding.tsx`;
update `b23_wording_check.py` to assert the 308s.
Step 6 (small, separate): keep the query in the login `next` (`proxy.ts`: pathname + search) so the cohort survives sign-in.
Step 7 (separate decision): bare-host → www redirect at Cloudflare/domain level; title brand de-duplication.
No changes to: event pages, demo restrictions, /app routes, New Batch notice page, ROI flag, existing batches or booking-invite routes.

## 6. Test plan
Redirects/SEO (curl, live + preview): each legacy URL → single 308 to its canonical (Location exact), with query preserved
(`?utm_source=x`), trailing-slash variant (≤2 hops), http and bare-host variants, uppercase still 404. Canonical pages 200, self-canonical,
`index, follow`, one H1, title/description unchanged. Sitemap: gateway + 3 cohort + impact + resources present, 0 legacy entries,
0 /events/ demo entries, no duplicates. robots.txt unchanged. Demo event pages noindex; old demo slugs 308 → new slugs.
Desktop: header dropdown (hover, click, keyboard, Escape), footer links, gateway cards, cohort CTAs, wizard customise link opens the canonical
page with the enquiry form prefilled (`customise=1`, interest, cohort) and #enquire scroll.
Mobile (390px): menu open, "For Organisations" expand, each cohort link, footer, sticky OrgSubNav.
Existing links: signup "I'm an Organisation", learner nav item, NBA card, city/become-a-teacher/coordinator CTAs, /venues card, teacher
widgets link, Wellness Journey link, 3 guides' related links, /resources cards — all land on canonical without a redirect hop.
Auth: logged-out Create a Programme from each cohort → login → wizard with the cohort preselected (if step 6 is done).
Dashboard (hr.demo): Overview batch list, Manage batch (/app/org/bookings/{id}), Preview invite (/booking-invite/{token}),
/app/org/bookings/new notice, ROI hidden, Programme Dashboard/Events, existing events and participants pages unchanged.
Enquiries: submit from a canonical page → `source_page` = canonical path; Guru cohort context still detected.
Regression: tsc, eslint, next build, verify_site, verify_seo_feeds (same pre-existing failures only), updated b23_wording_check,
test_phase_a_oea (demo restrictions + slug redirects), pathways tests.
Post-deploy: Search Console URL inspection of the 3 legacy and 3 canonical URLs, sitemap resubmission, and watching "Page with redirect" coverage.

## Limitations
No Search Console access, so index status is inferred from a web search. Production DB and remote-backend batch counts were not inspected.
External backlinks are unknown.

## 7. Implementation (owner-approved, preview only — not published)
Done: steps 1–5 + title de-duplication. Step 6 (keep cohort through login) not requested. Step 7 bare-host redirect REJECTED by the owner
("keep as is"; do not disturb existing SEO/AISO) — nostops.org is left exactly as before.
- FAQs (same wording) moved to the cohort pages: lib/org/cohort-copy.ts `faqs` + CohortShowcase section (data-testid cohort-faq, #faq).
- next.config.mjs redirects(): the 3 exact legacy paths → canonical (308, query kept). Next matches redirect paths case-insensitively,
  so case variants of these 3 paths also fold into the canonical page; all other routes are untouched.
- Deleted: the 3 legacy page/OG/twitter files, components/public/OrgLanding.tsx, lib/server/org-og.tsx. Sitemap drops the 3 legacy URLs.
- Links repointed: signup chooser, learner nav, NBA map, city/become-a-teacher/coordinator CTAs, /venues card, teacher widgets,
  Wellness Journey, /resources cards, guide related lists (duplicate legacy link removed). Guru context now matches /for-organisations/* only.
- Titles: the 6 org pages use `title.absolute`, so <title> shows NOSTOPS once. og:title, twitter titles and JSON-LD names are unchanged.
- Tests: backend/tests/b41_org_urls_check.py (85/85), b23_wording_check (0 fails), testing_agent iteration_164 (9/9).
Not changed (outside scope; for the owner): /programmes <title> also doubles NOSTOPS; AI Guru popup can cover the wizard's first button
at 1280×900; floating "List your Venue" button overlaps FAQ text on mobile; OrgSubNav highlights "Overview" on cohort pages.

## 8. Phase B4.2 implementation report (preview only, not published)
- Navigation: corporate app menu reordered → Overview, ✨ Create a Programme, Programme Dashboard, Programme Events,
  Analytics (Soon), Billing (Soon). Create a Programme is also the primary button on Overview, Programme Dashboard and Programme Events.
- New Batch: unchanged (hidden from menus; /app/org/bookings/new is a notice → wizard; BFF POST 410). Existing batches (hr.demo: 49)
  stay on Overview with Manage / Preview invite links; legacy code not deleted.
- ROI Calculator: unchanged, hidden by ROI_CALCULATOR_ENABLED=false (B2.2 owner decision; not a booking flow).
- Redirects / canonical / sitemap / titles / FAQs / links: as §7 (B4.1). Bare host untouched (owner decision).
- Known, not changed: logged-out Create a Programme loses ?cohort through login (proxy.ts keeps the path only).
- Tests: tsc 0, eslint 0, b41_org_urls_check 85/85, b23 wording 0 fails, verify_site 15/0, verify_no_nearby 35/0, verify_seo_feeds same 4
  pre-existing fails, verify_phase_a / access / display / instakyc pass, pytest 59 pass 1 skip, testing_agent iteration_165 8/8 at 1280/360/390.
