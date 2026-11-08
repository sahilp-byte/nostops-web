# NOSTOPS Spaces — Isolated Production Launch: STOPPED at the database and deployment blocker
Date: 2026-11-07 · **Not published, not deployed, no mobile builds.** No production database, setting or data was touched.

## Blocker (mandatory stop condition, §5 of the authorization)
| Requirement | Result |
|---|---|
| Which deployment serves www.nostops.org | **Unverified.** Emergent's deployer diagnosis found **no deployment for this job** (`d41a47d4-…`, "v3 deployment not found"). www.nostops.org is served by a different deployment record, not visible from here. |
| New deployment vs update of the existing one | **Unverified.** Per Emergent support, publishing a job without a deployment normally **creates a new deployment**. Updating or replacing the existing slot is possible, but what happens to the live database is undocumented. |
| Production DB identity / separation | **Unverified** (platform system keys, not readable). |
| Can publishing copy Preview records | **Unverified, and a real risk.** The deployer reported that the platform copies Preview data to production on a job's **first** deploy. Support could not confirm or deny this, and no setting to skip it is documented. This job has never been deployed. |
| Production DB backup | **Not available** from the agent; support must take it. |
| Current production build / rollback | Not inspectable from this job. |

Publishing now could copy Preview test data into production (Baroda House and Bengali Market localities, TEST_ Spaces, withdrawn drafts, audit history, QA/demo records). It could also replace the whole live website with this build, or leave www.nostops.org on the old deployment. **I did not publish.**

### What Emergent support (support@emergent.sh) must confirm in writing
1. The deployment/job ID currently serving www.nostops.org.
2. Whether publishing from job `d41a47d4-aa76-4065-8fc5-f1fd127157a9` creates a new deployment or updates that one, and what happens to its database.
3. Whether the first deploy copies Preview MongoDB data, and how to disable that so production keeps its existing data.
4. A production database backup taken before deploy, with its ID.
5. How www.nostops.org will route to the new build, and the rollback target build ID.

## Prepared in Preview (ready for when the blocker is cleared)
- **`/spaces/12345`**: new static route (`app/(public)/spaces/12345/page.tsx`) rendering the full Spaces discovery experience.
  - Canonical `https://www.nostops.org/spaces/12345`, `index, follow`, added to the sitemap. Verified 200 in Preview.
  - Static segment, so it does not affect `/spaces/[id]` detail URLs.
- **Teacher Claim safety**: `lib/server/teacher-claim.ts` now refuses any `*.preview.emergentagent.com` claim base in a production build.
  - Production claim is therefore **disabled** (shows "unavailable") until a verified Main Backend production URL is set as a separate setting. Preview is unchanged.
  - Tests: `verify_teacher_claim_5c` 47/47 (2 new checks), `verify_teacher_claim_shell` 34/34.
- **Email safety**: the venue monthly email and claim-reminder background loops now start only if `AUTO_EMAIL_LOOPS_ENABLED=TRUE`. It is not set, so deployment and startup send no automated emails.
  - Note: once deployed, this also pauses the monthly venue emails and claim reminders that the current live build may be sending, until you set the flag.
  - Admin-triggered Spaces approve/reject/change emails are unchanged.
- **No changes** to the homepage, header, menus, footer, teacher pages, /venues pages or existing SEO entries. No Spaces navigation links were added.
- **Checks**: backend Spaces suites 34/34; TypeScript 0 source errors.

## Still open apart from the blocker
- Live values of `WEB_APP_BASE_URL`, `CASHFREE_CHECKOUT_ORIGIN` and `DIDIT_CALLBACK_URL` still need confirming as www.nostops.org (Secrets card, live slot).
- The production claim URL must come from the Main NOSTOPS Backend project.
- Because the live site serves an older build, deploying this build ships **all** accepted Preview code changes since then, not only Spaces. The homepage links compared identical today; only the data-driven programme cards differ.
- Invitation hold remains in force.

## Rollback (once a deployment exists)
Redeploy the recorded previous build from the deployment's history. Restore the production DB only from the support-taken backup, and only if data was altered.
