# NOSTOPS Teacher Pulse — Phase 1 Discovery & Recommendation

A temporary (~3 month), invite-driven, moderated discussion space for yoga teachers on
nostops.org. Goal: **listen to teachers**, surface issues/trends/opportunities, grow via
peer invitation, and decide after 3 months whether to keep it. Build for LEARNING first.

This document compares the options and recommends the lowest-complexity solution that meets
the requirements. **No implementation has started. Awaiting approval.**

---

## 0. Environment reality (grounds every option)

- The **remote** backend (`pro-learn-connect-1.emergent.host`) owns ALL NOSTOPS business logic
  and is **read-only / must not be modified**. It has **no forum/discussion endpoints**.
- The Next.js web app is a **presentation + BFF auth layer**: httpOnly `nostops_session` cookie,
  double-submit CSRF, server-side `backendFetch` (bearer never reaches the browser), a working
  **Admin Console** with a centralised `admin-guard.ts` (rejects non-admins at the BFF before any
  backend call), an existing **Audit Trail**, and an **invite-link pattern** already shipped for referrals.
- A **local MongoDB is provisioned and reachable** (`DB_NAME=nostops_web`) and is **currently unused**.
  The local `/app/backend` is a thin proxy that forwards `/api/*` to the remote backend.
- `EMERGENT_LLM_KEY` and an Emergent email proxy are already wired (future theme-analysis + invites).

**Implication:** we already own ~90% of the primitives a small forum needs (auth, CSRF, admin
authz, audit, invites, design system, an empty database, an LLM key). There is **no verified
Emergent integration for Circle or Skool** — the only community-adjacent verified Emergent
integrations are chat apps (Discord / Slack / Telegram), which are a poor fit for an *embedded,
branded, NOSTOPS-moderated* teacher forum.

---

## A. Existing Emergent community integrations (Option A)

| Verified Emergent integration | Fit for Teacher Pulse |
|---|---|
| **Discord** | Separate app, off-brand, not embeddable (read-only widget only), data lives in Discord, moderation happens in Discord (not our Admin Console), teacher identity not tied to NOSTOPS accounts, weak export. ❌ |
| **Slack** | Workspace tool, not a public website community, no branded embed, invite/seat limits. ❌ |
| **Telegram** | Chat group, no threaded categories, no website embed, no admin-console moderation, weak accountability. ❌ |

**Verdict:** No verified Emergent integration provides an embedded, branded, account-linked,
admin-console-moderated forum. Option A does not meet the core requirements.

## B. Circle.so (external platform)

- **Real API:** yes — Headless Member API (JWT), Admin API v2 (static server token), custom-OAuth
  **SSO**, iframe embedding via cookie injection. Data export via Admin API / firehose.
- **Cost:** the Headless/API + SSO features require Circle's **Business plan (~$$$, hundreds/mo)** — heavy for a 3-month experiment.
- **Complexity:** HIGH — you must build & maintain a server-side JWT bridge, refresh-token handling,
  SSO mapping, and iframe cookie injection; **moderation lives in Circle's admin**, so the "moderate
  from the NOSTOPS Admin Console" requirement means additionally building admin views on top of Admin API v2.
- **Data ownership/exit:** data lives in Circle; exportable via API but not natively ours; migration back into NOSTOPS = extra work.
- **Verdict:** Capable but **over-built and over-priced for a 3-month listening experiment**; more integration
  effort than a minimal native board, with worse data ownership. Not recommended for Phase 1.

## C. Skool (external platform)

- **Official API:** **none** (no developer portal / OAuth). Only an **unofficial, reverse-engineered
  Apify actor** exists (cookie session rotates ~every 3.5 days → frequent 403s, ~25–30 writes/min,
  pay-per-call, ToS-risk).
- **Moderation/SSO/export:** only via that fragile unofficial layer; not production-safe for admin actions.
- **Verdict:** ❌ Not suitable — no reliable API, poor accountability, brittle. Reject.

## D. Other suitable options

- **Discourse (self-host/managed):** best-in-class moderation, DiscourseConnect SSO, REST/Write API,
  full data ownership if self-hosted. **But** it is a separate Rails app needing its own infra +
  subdomain + SSO bridge — not part of this Next.js/FastAPI/Mongo stack. Heavy ops for a 3-month test. ➖
- **NodeBB / Flarum:** same "separate app + separate DB + SSO bridge" overhead. ➖

## E. Minimal native NOSTOPS discussion board (Option C — recommended)

Build a deliberately small forum **inside the existing stack**, reusing everything we already have.

- **Auth:** reuse the NOSTOPS session (httpOnly cookie + CSRF). Only signed-in teachers can post/reply/invite;
  identity = their real NOSTOPS name/handle (accountability). Zero new auth system.
- **Data store:** the already-provisioned **local MongoDB (`nostops_web`)**, exposed through a small,
  isolated `/api/pulse/*` router added to the **LOCAL** `/app/backend` (mounted before the catch-all
  proxy). **The remote business-logic backend stays 100% untouched.**
- **Moderation:** reuse the **existing Admin Console + `admin-guard.ts`** (server-side authz, not
  frontend hiding) and the existing **Audit Trail**.
- **Invitations:** reuse the existing invite-link pattern (copy / WhatsApp / email / native share).
- **Branding:** existing NOSTOPS design system → perfect visual fit, "teachers speaking with teachers."
- **Data ownership / exit:** 100% ours in our own DB → export as CSV/JSON any time; nothing to migrate
  out of a third party; if Pulse becomes permanent it already lives in our stack. Clean 3-month archive
  = a status flag, no data loss.
- **Future AI:** data is ours → theme/sentiment analysis later via `EMERGENT_LLM_KEY` (NOT Phase 1).
- **Scope is genuinely small** because the required feature set is minimal CRUD (categories, threads,
  replies, search, sort, pin/lock/hide/report, suspend, stats) — explicitly **no** reactions, DMs,
  gamification, followers, ranking, or monetisation.

---

## F. Cost / complexity comparison

| Criterion | A: Emergent chat (Discord) | B: Circle | C: Skool | Discourse | **Native (recommended)** |
|---|---|---|---|---|---|
| Setup effort | Low | High | Med (fragile) | High | **Low–Med** |
| Recurring $ cost | Free tier | High (Business plan) | ~$99/mo | Hosting $ | **₹0 (own Mongo)** |
| Emergent credits (build) | Low | High | High | High | **Low–Med** |
| Embedded & on-brand | ❌ | ⚠️ iframe | ❌ | ⚠️ subdomain | **✅ native** |
| NOSTOPS account SSO | ❌ | ⚠️ build bridge | ❌ | ⚠️ build bridge | **✅ reuse session** |
| Moderate from our Admin Console | ❌ | ⚠️ build on Admin API | ❌ | ⚠️ | **✅ reuse Admin Console** |
| Flag/report, lock, hide, suspend | partial | ✅ (in Circle) | fragile | ✅ | **✅** |
| Audit trail | ❌ | ⚠️ | ❌ | ⚠️ | **✅ reuse existing** |
| Data ownership | ❌ | ⚠️ in Circle | ❌ | ✅ if self-host | **✅ our DB** |
| Export insights | weak | ✅ API | fragile | ✅ | **✅ trivial** |
| 3-month clean exit | ➖ | ➖ | ➖ | ➖ | **✅ status flag** |
| Future AI on our data | ❌ | ⚠️ | ❌ | ⚠️ | **✅** |

## G. Authentication approach (recommended)
Reuse NOSTOPS session. **Post/reply/invite ⇒ signed-in teacher only** (real identity for accountability).
Reading: **signed-in teachers** (keeps it a safe peer space); the public site shows only a Teacher Pulse
*landing + invite CTA*, not the live threads. Invited non-members go through the existing lightweight
`/join` teacher signup, then land in Pulse linked to their inviter. *(Open question Q2 below.)*

## H. Teacher invitation flow
Participating teacher → "Invite a fellow teacher" → generate invite link (token) → Copy / WhatsApp /
Email / native Share → invitee opens → already a NOSTOPS teacher = one-tap join; else `/join` → auto-enrolled
& linked to inviter → inviter sees status (Sent / Accepted). **No monetary rewards / referral economics.**

## I. Moderation architecture
States: `ACTIVE · FLAGGED · UNDER_REVIEW · HIDDEN · LOCKED · DELETED` + member `SUSPENDED`.
Any member can report (reason captured) → admin **Reports queue** (shows reporter + reason). Every admin
action (pin/lock/hide/delete/suspend/reinstate/dismiss-report) writes an **audit entry**. Enforced
**server-side** on the `/api/pulse/*` router + BFF `admin-guard` — never frontend-only.

## J. Admin Console integration plan
New nav group **ADMIN → COMMUNITY → TEACHER PULSE** with: Discussions (search/filter by category, pin,
lock, hide, delete), Discussion detail (replies + moderate), Reports queue, Members (suspend/reinstate),
**Insights** (participation stats), **Settings/Lifecycle** (status + launch/close dates), **Export** (CSV/JSON).
Reuses the existing admin auth + guard — no separate admin login.

## K. Data ownership / export plan
All data in our own `nostops_web` Mongo → we own it fully; one-click CSV/JSON export of discussions,
replies, members, metadata at any time; archive without data loss; if Pulse becomes permanent, no migration needed.

## L. Three-month lifecycle plan
Admin-set status: `PRE_LAUNCH` (teaser) → `ACTIVE` → `CLOSING_SOON` (banner, optionally stop new threads)
→ `ARCHIVED` (read-only, content preserved). Configurable launch/close dates. Extend = flip the flag.
**No auto-deletion.** Export before/after archive.

## M. Recommended solution
**Option C — a minimal native NOSTOPS Teacher Pulse board**, built on the existing NOSTOPS stack
(session auth + CSRF + Admin Console + Audit Trail + invite pattern + design system) with data in the
already-provisioned local MongoDB, and a small isolated `/api/pulse/*` router on the LOCAL thin backend.
It is the **lowest total complexity for THIS environment**, the **best fit** (embedded, branded,
account-linked, admin-moderated), gives **full data ownership + a clean 3-month exit**, has **no recurring
SaaS cost**, and keeps the **remote business backend untouched**. Circle is capable but over-built/over-priced
for a 3-month listening experiment; Skool has no reliable API; Discord/Slack/Telegram fail the embed +
account-link + admin-console-moderation requirements.

**One decision needed before Phase 2:** the native build requires (1) adding an **isolated new** `/api/pulse/*`
router to the **local** `/app/backend` and (2) using the **local Mongo** for Teacher Pulse data only. The
**remote** business-logic backend is NOT touched. Need explicit OK for this, since the handoff marked the
backend "do not modify" (that rule targets the remote business backend; this adds a new, isolated feature store).

---
**STOP — awaiting approval to proceed to Phase 2 (implementation).**
