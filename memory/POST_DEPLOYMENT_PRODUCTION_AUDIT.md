# NOSTOPS — Post-Deployment Production Verification (read-only)

**When:** 26 Oct 2026, 04:11–04:30 UTC (container clock).

**What was tested:**
- Website and gateway: `https://www.nostops.org` (this project, deployed).
- Main backend: `https://pro-learn-connect-1.emergent.host` (external team).
- The preview website was used **only for comparison**.

**What was not done:**
- No deploy, no code or config change, no secret read.
- No payment, refund, payout, withdrawal, heal or balance change.
- No webhook was sent.
- The ₹1,062 correction and the two synthetic ledger rows were not touched.
- The money lock (website) and FS-00 (main backend) stay **ON**.

**Tools:** `scripts/prod_postdeploy_audit.py`, `prod_freeze_bypass_probe.py` and `prod_role_pages.py`. Results are in
`test_reports/prod_audit/` (`results.json`, `freeze_bypass.json`, `role_pages.json`, `error_monitor.json`,
`wallet_evidence.json`).

**What this audit itself wrote to production.** Nothing financial was written, but there were three side effects:
- **Demo sign-ins** created normal sign-in session records for five demo accounts (teacher, admin, learner, HR, guru).
- **Error Monitor counters went up.** Ten GET requests to `/retreats/in/*` hit the production 500 described in D-3.
  That raised the counts on existing Error Monitor entries.
- **Probably one alert email.** One new entry was created (`/retreats/in/dharamkot`), which most likely emailed an
  alert to the team inbox.

---

## 1. Production release and environment
| Item | Finding | Status |
|---|---|---|
| Website build (Next.js) | Production **build id `vBGdQaLyJtuMawvwu6Pih`**, a production build (preview runs a development build). Home page 200, `x-powered-by: Next.js`, behind Cloudflare. | Observed |
| Website gateway | `/api/health` → `healthy`, proxying to `pro-learn-connect-1.emergent.host` | PASS |
| Deployed git commit / deployment id / timestamp | **Not available.** The deployment health tool returned no deployment metadata or logs for this web app, and the site exposes no commit. | NOT TESTED (not accessible) |
| Matches the reviewed release candidate? | **Yes, by fingerprint.** Production shows behaviour that exists only from the last app-code commit `4e7e8ece` (25 Oct 12:44 UTC; later commits are docs and scripts only). Specifically: all 20 gateway money rules refuse with the exact rule ids, the website money routes refuse first, and the admin Payouts page shows the lock notice. Nothing older or unreviewed was seen. | PASS (by fingerprint) |
| Failed or incomplete build | None visible: 26/26 key pages, 202/205 crawled links and 115/120 sampled sitemap URLs answered 200 (see §4). Build logs were not accessible. | PASS (visible behaviour only) |
| Main backend | Healthy. API list v0.1.0 has **648 routes**, against 646 on 25 Oct. New: `/admin/wallet/anomalies`, `/v1/stats/segments`. Changed: 7 routes. New behaviour: FS-00 money freeze, referrals off, v1 retreat creation retired, financial fields in teacher stats limited to the teacher and admins. | Observed: **a main-backend release we have not code-reviewed** |
| Preview isolation | Preview **uses the same live main backend** as production, so it is not isolated from production data | Note |

## 2. Test results
### 2a. Financial freeze
| # | Test | Result | Evidence |
|---|---|---|---|
| F1 | Website gateway refuses money actions before forwarding them | **PASS** (20/20) | Signed-out calls got 423 `financial_lock: true` with the matching rule. Covered: withdraw ×5 kinds, v1 withdraw and bank account, payout approve/reject, payout list and sweep (GET), heal (GET), refund, v1 referral credit, wallet top-up, 1:1 complete, and the mock-card ×3 and mock-checkout routes. |
| F2 | Website BFF money routes refuse first | **PASS** (3/3) | `/bff/teacher/wallet/withdraw` and `setup-pin`, `/bff/admin/payouts/approve` → 423 |
| F3 | Admin Payouts page loads nothing and shows the lock | **PASS** | Admin sees "Payouts" plus "Money actions are paused…" |
| F4 | Website lock setting | **PASS (fails closed by code)** | The lock is off only when `FINANCIAL_ACTIONS_UNLOCKED` is exactly `true`. Production behaviour shows it is not. The value itself was not read. |
| F5 | Main backend FS-00 freeze on direct calls (no website) | **PASS on 9 routes** | 423 `FS00_MONEY_FROZEN`: wallet withdraw, payout request, admin approve, admin reject, Cashfree refund, retreat cancel-with-refund, retreat mark-paid, batch mark-paid, Fast-Track decide |
| F6 | Main backend freeze on the other money routes | **UNKNOWN** | These answered "not found" for unknown ids instead of 423, so the freeze is not checked first: 1:1 complete, 1:1 reassign, 1:1 student cancel, complete-pilot, v1 booking complete, and the mock-card routes (Fast-Track pay, premium book, batch pay). Whether the freeze stops the final write is not visible. Tested only with ids that don't exist. |
| F7 | `MONEY_OPS_FROZEN` configured value and fail-closed default | **UNKNOWN** | No access to the main-backend environment. Only the runtime code `FS00_MONEY_FROZEN` is visible. Verifying fail-closed would need a config change, which is not allowed. |
| F8 | Background jobs, retries, webhooks | Website gateway: **PASS**. Main backend: **NOT TESTED** | The website gateway has no money jobs; its startup only seeds the knowledge graph and demo programmes. The Cashfree webhook was not called, because even a rejected webhook may write an event record. Main-backend jobs and retries are not visible. |
| F9 | No production payout or payment capability enabled by mistake | **PASS for payouts** | All money-out routes tested are refused at both layers. Payments in: see S8. |
| F10 | Mock checkout | **PASS** | "Mock checkout disabled" on the main backend; refused always by the website |

### 2b. Security and authorisation
| # | Test | Result | Evidence |
|---|---|---|---|
| S1 | Signed-out access to protected data | **PASS** | Wallet balance, transactions, summary, v1 wallet, segments, anomalies and reconcile → 401. Orders → 403. Direct and through the gateway alike. |
| S2 | Non-admins can't read admin cohort data | **PASS** | Teacher, learner and HR → 403 "Admin only" on `/v1/stats/segments` (direct and through the gateway), and on anomalies, reconcile and orders |
| S3 | Admin cohort response holds no individual financial data | **PASS** | Only counts and percentages by segment. No wallet, payout, commission or earnings field. The response itself says "cohort_type never affects commission, wallet or payout". |
| S4 | Money-out blocked by the freeze | **PASS** | F1, F2 and F5 |
| S5 | Teacher-to-teacher referrals off; normal earnings unaffected | **PASS** | Referral dashboard, redeem, track, leaderboard, withdraw and v1 summary → 410 `REFERRAL_OFF`. The demo teacher's wallet is unchanged: ₹91,743 available, ₹2,81,457 held, ₹1,071 lifetime earned, the same 37 ledger rows as on 25 Oct. The wallet summary still shows the referral history (₹2,650 earned and withdrawn). |
| S6 | Retired v1 retreat creation can't create bookings | **PASS** | `POST /v1/bookings/retreat` → 410 "retired… use /api/retreats", signed out and as teacher, direct and through the gateway |
| S7 | Wallet and history views need sign-in | **PASS** | S1. A signed-in teacher reads them (200). The website wallet page sends unverified teachers to the "locked" page. |
| S8 | Cashfree diagnostics leak no secrets and don't fake live mode | **PASS on secrets, FAIL on access** | No secret returned. Mode `production`, `is_sandbox: false`. But `/payments/cashfree/diag` is **public (no sign-in)**: it reveals the environment, the last 4 of the client id, the key prefix and the backend URL, and it runs a live Cashfree check on every request. That check reports **`creds_valid: false`, HTTP 401 "authentication Failed"** (D-1). |
| S9 | Teacher stats hide money from others | **PASS** | `/v1/stats/teacher/{id}`: anonymous and another user get no financial fields; the teacher themselves does |
| S10 | Admin pages refuse non-admins | **PASS** | Teacher, learner and HR on `/app/admin` and `/app/admin/payouts` → sent back to `/app`. Signed-out `/app/*` → 307 to `/login?next=…`. |
| S11 | Error handling | **PASS** | Unknown page, teacher, event or venue → 404 "Page not found". Sign-in without the CSRF token → 403. Wrong password → 401 "Invalid email or password". Unknown API → 404. |

### 2c. Public website
| # | Test | Result |
|---|---|---|
| W1 | Home page and navigation | **PASS**: 200; 48 links in the header and footer. No page errors in the browser on 6 key pages. The only failed requests were cancelled page prefetches and Google Analytics, which is normal. |
| W2 | Teacher directory and profile | **PASS**: `/teachers`, `/teachers/arjun-raghavan`, `/yoga-teachers`, `/yoga-teachers/pune`, `/gurus` all 200 |
| W3 | Organisation onboarding and landing pages | **PASS**: `/for-organisations` and its Companies, Education, Startups, Impact and Resources pages all 200. Create a Programme → sign-in for signed-out visitors; HR sees "Create a Programme". |
| W4 | MIND / BODY / SPECIAL NEEDS | **PASS**: `/programmes` has the three sections (`#mind`, `#body`, `#special-needs`) and the "Mind, Body & Special Needs" hero |
| W5 | Retreat listing | **PASS (empty)**: "New experiences are on their way…", the same as preview. No public retreats are listed. |
| W6 | Canonical retreat creation path | **PASS (page only)**: every "Host a retreat" link → `/app/teacher/retreats/new`. Signed out → sign-in. Teacher → "Create your retreat". The wizard posts to the canonical `/retreats/create` (checked in code). It was **not submitted**, because that would create a retreat. |
| W7 | Venues and Host a Retreat entry points | **PASS**: `/venues`, `/list-your-venue`, `/retreats/host` all 200 |
| W8 | Retreat city and detail pages | **FAIL**: `/retreats/in/{city}` and `/retreats/in/{city}/{retreat}` → **HTTP 500 in production** (404 in preview). See D-3. |
| W9 | Admin Cohort Segments dashboard | **NOT PRESENT**: the website has no page for it. Only the main-backend API exists (admin-only, works through the gateway). See D-5. |
| W10 | Broken links | **PASS**: 205 crawled links, 0 broken (3 sign-in redirects, as expected). Sitemap sample: 115/120 at 200; 5 returned 502 once and 200 on retry (D-6). |
| W11 | Admin pages render | **PASS**: 14 admin pages, no error screens |
| W12 | Verified-teacher referral and wallet pages | **NOT TESTED**: no verified-teacher demo account (teacher.demo is unverified, guru.demo is not a teacher) |

## 3. Evidence for the freeze
- **Website** (both layers, production):
  - 23/23 money routes refuse with 423 before anything is sent, with the message "Money actions are paused while NOSTOPS
    completes a financial safety audit. Nothing was sent and nothing changed."
  - Rule ids match the reviewed code: `withdraw`, `v1-money`, `payout-decision`, `payout-sweep-read`, `wallet-heal`,
    `refund`, `wallet-topup`, `release`, `mock-card`, `mock-checkout`.
- **Main backend** (direct, bypassing the website):
  - `{"error":"money_operations_frozen","code":"FS00_MONEY_FROZEN"}` (423) on 9 money routes.
  - Every probe used an amount below the minimum or an id that doesn't exist, so even a non-frozen backend could not
    have written anything.
- **Not verifiable from outside:** the `MONEY_OPS_FROZEN` value, its default if unset, and whether 6 other money routes
  (F6) check the freeze before writing.
- **Ledger:** unchanged by the deployment or this audit. The backend's report-only reconcile now shows **−₹1,062** (it
  sets aside the wrong-sign ₹575 row as an anomaly). The new anomalies report lists exactly 1 exception
  (`wl_7d013798d0564c9a`, wrong sign). It does **not** flag the two synthetic rows (`wl_f9f4f0e5d8e54b4b`,
  `wl_090d507cf3c14a4a`). Nothing was corrected.

## 4. Logs and operational health
- **Deployment and runtime logs** (website and main backend): **not accessible** to us (NOT TESTED).
- **Production Error Monitor** (read as admin; the website's own error store):
  - 18 open issues: 10 page, 8 server, **0 payment, 0 email**; 7 in the last 24 h.
  - Retreat detail pages (`/retreats/in/[city]/[retreat]`): **71 server errors since 22 Oct**, the last at 00:06 UTC
    before this audit.
  - Retreat city pages: 15 "static to dynamic at runtime" errors.
  - 7 × HTTP 502 from the main backend in one burst (24 Oct 12:02: public reviews and SEO pages).
  - 6 × "stream closed early" (visitors leaving mid-load; harmless).
  - 1 × React hydration error on `/app/admin/venue-monitor` (22 Oct).
- **Health:** the database is reachable (directory, teacher and admin pages render live data) and both services are
  healthy. No sign of money actions being forwarded. Sign-in failures are handled correctly (401). No unusual bursts
  could be checked, because there was no log access.

## 5. Preview vs production
| | Preview | Production |
|---|---|---|
| Build | Development | Production build `vBGdQaLyJtuMawvwu6Pih` |
| 26 key pages | 200, same titles | 200, same titles |
| `/retreats/in/*` | 404 | **500** |
| Money lock (gateway and website) | ON, 23/23 | ON, 23/23 |
| Main backend | Same live backend | Same live backend |

## 6. Defects, by severity
| ID | Severity | Defect | Owner | Next step |
|---|---|---|---|---|
| D-1 | 🔴 High | **Cashfree production credentials fail** (`creds_valid:false`, 401). Paid checkouts (InstaKYC, 1:1, retreat, programme) will most likely fail. A checkout was not tried, because it would create an order. | Founder / main backend (keys) | Check the production Cashfree app id and secret pair, then re-run the diag |
| D-2 | 🔴 High | **Main-backend mock-card routes still run** (Fast-Track pay, premium booking with no sign-in, batch pay), and the freeze isn't checked first. The website blocks them, but the mobile app or direct callers reach them (FIN-03 not done). | Main backend | Remove or 410 them; apply FS-00 first on all money routes (F6) |
| D-3 | 🟠 Medium | `/retreats/in/{city}` and `/{retreat}` → **500 in production**. These pages are cached but call `teacher-status-override-bulk` uncached. Fails only in production builds. | Website (us) | Approve a small fix: allow that call to be cached, or render these pages live; unknown cities then return 404 |
| D-4 | 🟠 Medium | **Public Cashfree diag:** no sign-in, discloses configuration, and runs a live Cashfree check per request | Main backend | Admin-only, rate-limited |
| D-5 | 🟠 Medium | **Admin Cohort Segments** shows all zeros (0 organisations, 0 group bookings, all time) although organisations and batches exist. No website dashboard. | Main backend (data), website (UI) | Confirm the source collection; decide whether the website needs the dashboard |
| D-6 | 🟡 Low | Occasional 502s (5/120 sampled pages once, 7 upstream on 24 Oct) | Hosting / main backend | Monitor; retry was fine |
| D-7 | 🟡 Low | Ledger issues remain by design: −₹1,062 drift, wrong-sign row, two synthetic rows not flagged, 85% "withdrawable" display | Main backend + founder | Founder-approved repair later; frozen meanwhile |
| D-8 | 🟡 Low | Teacher role sees `/app/org/dashboard` ("Programme Dashboard") | Website | Confirm it is intended |
| D-9 | ⚪ Info | One hydration error on the admin venue monitor (22 Oct) | Website | Watch |

## 7. GO / NO-GO for continued website operation
**🟢 GO, with conditions.**
- The public site, directory, organisation pages, taxonomy and venues work. Sign-in and access controls are correct.
- Money-out is blocked at two layers. No payment or email errors are logged.
- **Conditions:**
  - treat **paid checkouts as unavailable** until D-1 is fixed;
  - approve the D-3 fix (retreat city pages);
  - keep both freezes ON.

## 8. Financial readiness
**🔴 NOT READY. Keep `MONEY_OPS_FROZEN` and the website lock ON.**
- Freeze: ON at runtime (website: 23 routes; main backend: 9 routes). Configured value and fail-closed default:
  **UNKNOWN**. Coverage of 6 money routes and the mock-card routes: **UNKNOWN**.
- Blocking items:
  - D-1 (Cashfree credentials invalid);
  - D-2 / FIN-03 (mock-card routes still live on the main backend);
  - FIN-02 (OTP not enforced), FIN-04 (₹1,062 owed, wrong-sign row, synthetic rows), FIN-05 (85% display) and
    FIN-10 (withdrawals never paid out), none of which was re-verified as fixed;
  - webhooks and background jobs not verifiable;
  - no deployment metadata or logs.

**Stopped here. Waiting for your decision.**
