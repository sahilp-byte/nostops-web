# NOSTOPS — Navigation, Routes & IA Audit (findings only, no changes made)

Method: automated crawl of the live dev build (`scripts/nav_audit_crawl.py` → 453 routes, 24,943 links,
redirects NOT auto-followed so chains are recorded) + source review of SiteHeader / HeaderNav /
HeaderOrgMenu / MobileNav / SiteFooter / AppShell / nav-config / auth + checkout components +
Playwright checks (desktop 1280px keyboard/hover, mobile 390px drawer, logged-in teacher session).

## Headline results
- 442 / 453 crawled routes return 200; 11 return 404 (all linked from live pages).
- Sitemap: 336 URLs, every one 200, none redirect, none noindex. ✅
- Header and footer are identical on all 387 public-template pages (one shared component each). ✅
- Breadcrumbs: 34 distinct targets, all 200. ✅
- Canonicals: correct on every indexable page; 5 noindex pages inherit canonical "/" from the public layout.

## Link table
Severity: 🔴 High · 🟠 Medium · 🟡 Low · ✅ OK

| # | Link / label | Location | Destination | Status | Sev | Recommended correction |
|---|---|---|---|---|---|---|
| 1 | "Book a session →" (8 links) | /become-a-teacher/{bangalore,pune,mumbai,navi-mumbai,mangalore} – featured teacher cards (`TeacherCard` given a public href) | /teachers/{handle}/book | 404 | 🔴 | Point to existing booking route `/app/teachers/{handle}/book` (TeacherCard builds `${href}/book`; pass a separate bookHref) |
| 2 | Teacher chips "Demo User India", "Test Seeker2 De34084e · Delhi" | /gurus/bks-iyengar, /gurus/pattabhi-jois, /scriptures/hatha-pradipika, /scriptures/light-on-yoga-text (`TraditionExplorer`) | /teachers/demo-user-india, /teachers/test-seeker2-de34084e | 404 | 🔴 | Link by public handle, not `teacher_id`; filter to publicly-listed teachers (also removes demo/test names) |
| 3 | City chip "Delhi · 1" | /find-your-tradition?focus=* (5 variants), /yoga-parampara/hatha-yoga | /yoga-teachers/delhi | 404 | 🟠 | Only show cities that have a public city page (same getCities() gate as footer) |
| 4 | "Model your exact ROI →" | /for-companies, /for-educational-institutions, /for-startup-networks (`OrgLanding`) | /choose-role?role=corporate&mode=register → 307 /join ("Join as a Yoga Teacher") | Redirect to WRONG audience | 🔴 | Send organisations to the org flow (`/app/org/roi` or `/for-organisations` contact) |
| 5 | "Join as a teacher", "Become a NOSTOPS teacher…", "Already teaching with us? Sign in" (≈15 CTAs) | /teachers, /levels, /become-a-teacher/{city} ×6 | /choose-role?role=teacher&mode=register / mode=login → 307 /join | Redirect chain | 🟠 | Link `/join` (register) and `/login` (sign in) directly; "Sign in" currently lands on the join page |
| 6 | Legacy org pages (full duplicate content, self-canonical, in sitemap) | linked from 20+ pages: /programmes, /venues, /contact, /yoga-teachers/{city}, /become-a-teacher/{city}, /for-organisations/resources, guides, app learner nav "Bring Yoga to my Workplace", teacher widgets | /for-companies, /for-educational-institutions, /for-startup-networks | 200 (duplicates of /for-organisations/companies etc.) | 🟠 | Decide one canonical set. Recommend: 308 legacy → /for-organisations/{cohort}, update all internal links, drop legacy from sitemap |
| 7 | Header "Host your Retreat"; footer "Retreats" | Global header + footer | /retreats/host (host-side page) | 200 | 🟠 | Intended IA = "Retreats". Browse page /retreats is in NO global nav. Recommend header "Retreats" → /retreats (host page reachable from it), footer Discover → /retreats, Participate → /retreats/host |
| 8 | Become a City Coordinator | — (missing) | /city-coordinator (exists, 200, in sitemap) | Missing from header & footer | 🟠 | Add to header (per intended IA) and footer "Participate" |
| 9 | About | Global header (6th item) | /about | 200 | 🟡 | Not in intended header list; recommend move to footer "About" if header space is needed for City Coordinator |
| 10 | Teacher-First philosophy | — (missing from footer) | /philosophy (exists) | Linked from only 2 pages | 🟡 | Add to footer "About" |
| 11 | Payment / refund & cancellation policy | Footer Legal + every checkout | — | Page does not exist (/refunds 404) | 🔴 | Create policy page (content needs owner/legal approval; placeholders for entity/address/grievance officer) and link from footer + checkouts |
| 12 | Terms / Privacy links at checkout | 1:1 booking (BookingForm/PayNow), InstaKYC (InstaKycFlow), Fast-Track (FastTrackApply), AI onboarding (AiOnboardingPurchase), Wallet top-up, Event pay step (only /trust) | — | No legal links | 🔴 | Add "By paying you agree to Terms · Refund policy · Privacy" line to each pay step (shared component). Retreat reserve already shows inline CancellationPolicy ✅ |
| 13 | Legal identity on /terms & /privacy | /terms, /privacy | — | No legal entity, address or grievance officer | 🟠 | Add "[to be confirmed]" placeholders — do not invent |
| 14 | Verification policy | Footer "Company" column | /trust ("Trust & Verification") | 200 | 🟡 | Exists; regroup under "Trust & Legal" (label "Verification policy" or keep) |
| 15 | Footer "Create Account" | Footer Teachers column | /register (Yoga-Seeker-only form) | 200 | 🟠 | Under a "Teachers" heading this is the wrong flow; use /join for teachers or /signup (role chooser) — header "Sign up" already uses /signup |
| 16 | Footer "Teacher Sign In" | Footer Teachers column | /login (generic, all roles) | 200 | 🟡 | Label vs header "Log in" vs login page "Sign in" vs app "Sign out" — standardise to "Log in / Log out" (or "Sign in / Sign out") |
| 17 | Duplicate /teachers links | Footer: "Teacher Directory" (Explore) + "Find a Teacher" (Find Teachers) + header "Teachers Network" | /teachers | 200 | 🟡 | One label site-wide ("Teachers Network"); one footer link |
| 18 | Label drift | Header "List your Venue" vs footer "List Your Venue"; header "Startup & Networking Groups" vs footer "For Startup Networking Groups" | /list-your-venue, /for-organisations/startup-networking-groups | 200 | 🟡 | Single shared label source |
| 19 | Org sub-nav "How it works" | /for-organisations/* sub-nav | /for-organisations#how-it-works | 200 | ✅ | — |
| 20 | Noindex pages with canonical "/" (inherited from public layout) | /venues/saved, /venues/compare, /venues/submit/edit, /events/{slug}/register, /saved | canonical → https://www.nostops.org | Mixed signal | 🟡 | Give each its own canonical (or none). /saved (retreat wishlist) is also **indexable** and orphaned — add noindex |
| 21 | Teacher profiles missing from sitemap | 28 public, indexable /teachers/{handle} pages linked from directory | sitemap lists only 8 profiles | 200 | 🟠 | Align sitemap with directory gate. Note: /teachers/test11 and /teachers/name1 look like test accounts and are public |
| 22 | /venues/submit, /venues/ai-onboarding | Linked from /venues, /list-your-venue | 200, indexable, not in sitemap | 🟡 | /venues/submit is a form → noindex; ai-onboarding → add to sitemap or noindex (decide) |
| 23 | /voices/api | In sitemap, linked from nowhere | 200 | 🟡 | Developer page — link from /voices or drop from sitemap |
| 24 | Auth-gated links on public pages | "Create a Programme" (22), "Host a retreat" /app/teacher/retreats/new (23), public profile "Book 1:1" | /app/... → 307 /login?next=… | Works | ✅ | Expected; optional: send new visitors to /signup instead of /login |
| 25 | Legacy redirects | /cities/{city} → 308 /yoga-teachers/{city}; /teachers/in/{c}/{t} → 308 /teachers/{handle}; /retreats/{id} → 308 canonical | single hop | ✅ | No internal links point at them |

## Behaviour checks
| Check | Result | Sev | Recommendation |
|---|---|---|---|
| Desktop dropdown – hover | Opens, 3 cohorts with descriptions | ✅ | — |
| Desktop dropdown – keyboard | Opens on focus, items tabbable, Escape closes | ✅ | — |
| Dropdown closes when focus leaves | **Stays open** after tabbing on to About/Search/Sign up | 🟡 | Close on focus-out |
| ARIA | `role="menu"/"menuitem"` without arrow-key support | 🟡 | Use disclosure pattern (button + list) or add arrow keys |
| Visible focus states | ring-2 on nav items, outline on icons/CTAs | ✅ | — |
| Skip link | No "Skip to main content" | 🟠 | Add skip link + `id` on `<main>` |
| Mobile drawer | Same 6 items + expandable cohorts, 44px targets, Escape/route-change close | ✅ | — |
| Mobile drawer focus | Focus not trapped; after Escape focus drops to `<body>`; page scroll not locked | 🟡 | Return focus to menu button; lock body scroll |
| Mobile CTA visibility | "Ask AI Guru" auto-popup covers the drawer's Log in / Sign up buttons and overlaps the sticky "List your Venue — Free" pill | 🔴 | Suppress the auto-popup while the menu is open, and raise drawer above it / offset sticky CTA |
| Header CTAs on phone | Logo, Search, Saved, Sign up, Menu visible; Log in in drawer | ✅ | — |
| Login → dashboard | /login → /app ✅; public header swaps to "Dashboard" ✅ | ✅ | — |
| Logged-in user on /login, /signup | Not redirected to /app | 🟡 | Redirect authenticated users |
| Logout | AccountMenu → POST /bff/auth/logout → /login; /app then → /login?next=/app | ✅ | — |
| App shell → public site | Logo goes to /app; **no route back to the public website** | 🟠 | Add "NOSTOPS website" link in account menu/sidebar |
| App nav dead item | Teacher "Help & Support" shown as "Soon" although /support exists | 🟡 | Link to /support |
| Auth pages chrome | Logo → home only; no Terms/Privacy links on sign-up | 🟡 | Add Terms/Privacy line to sign-up forms |

## Intended IA vs current
Header (intended → current): Teachers Network ✅ · Retreats ⚠ ("Host your Retreat" → /retreats/host) · Venues ✅ ·
List Your Venue ✅ · For Organisations ▸ Companies / Educational Institutions / Startup & Networking Groups ✅ ·
Become a City Coordinator ❌ missing · (extra: About).
Spelling: site consistently uses British "Organisations"; brief says "Organizations" — owner decision.

Footer (intended → current):
- Discover (teachers, retreats, venues, cities) ← split across "Explore" (12 links incl. knowledge pages) + "Find Teachers" (cities). Retreats points to the host page.
- Participate (join as teacher, list venue, organisations, coordinators) ← split across "Teachers", "Explore", "For Organisations"; coordinator missing.
- About (mission, Teacher-First philosophy, how it works, contact) ← "Company"; philosophy missing; also holds support/FAQ/trust.
- Trust & Legal (privacy, terms, payment/refund policy, verification policy) ← "Legal" has privacy + terms only; refund policy missing; verification (/trust) sits in Company.

## Dependencies to respect before changing anything
- `SiteHeader` NAV array feeds both HeaderNav and MobileNav; `isOrgActive` also highlights /for-organisations/*.
- `SiteFooter` GROUPS indexes are positional (GROUPS[0..4]) and List-Your-Venue is spliced in after /venues.
- Legacy /for-* pages are referenced by sitemap, guru context (`components/guru/context.ts`), learner nav, widgets page, WellnessJourney and ~12 public pages.
- /choose-role is a redirect stub; OrgLanding builds `/choose-role?role=…` for all three legacy pages.
- Public layout sets `alternates.canonical: '/'` — any page without its own canonical inherits the homepage.
