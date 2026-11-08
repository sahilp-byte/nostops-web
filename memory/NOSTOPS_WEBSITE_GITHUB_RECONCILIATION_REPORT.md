# NOSTOPS Website — GitHub Inventory & Reconciliation Report
Date: 2026-11-07 · Status: **STOPPED at stop condition — no reconciliation commit, push or tag created.**
Nothing was published, deployed or built for mobile. No production database, setting or data was touched. No Git history was rewritten.

## 0. Stop conditions triggered
1. **Remote repository cannot be accessed or verified.** The workspace Git repo has **no remote configured** (`git remote -v` empty, no `refs/remotes`, no credentials/SSH/`gh`). In Emergent, GitHub pushes are made by the platform's "Save to GitHub" action, outside this workspace. I cannot read the GitHub repository name/URL, account, default branch, remote HEAD, remote branches or tags, so the GitHub-vs-Preview comparison (Phase A-C) cannot be done from here.
2. **Database record exports are tracked in Git** (see §7). If any earlier "Save to GitHub" pushed the tracked tree, these files are already on GitHub.

## 1. Repository and branch (local only)
- Remote URL / account / default branch / remote HEAD: **unknown, not accessible** [U].
- Local branch: `main` (only branch; no upstream tracking). Tags: **none**.
- Local HEAD: `5f11ca8a32c41de958bfc5c7517d37f6301a8a6b` (2026-11-07 13:32 UTC). 1,447 commits; first `95c89960` (2026-04-09).
- Commits are created automatically by the platform after each agent turn (author `emergent-agent-e1`). `packed-refs` keeps an older main ref `5abea653`; `ORIG_HEAD` dated Nov 6 shows an earlier platform reset/rollback event. Not modified.

## 2. Initial workspace state
- Staged: 0. Modified tracked: 15. Untracked: 289. Deleted: 0.
- Modified tracked: `.emergent/cron/webhook-crons`, `frontend/yarn.lock`, and 13 `backend/**/__pycache__/*.pyc`.
- Untracked: `.emergent/testing/.runtime/`, `frontend/package-lock.json`, about 270 `test_reports/**/*.log`, new `__pycache__/*.pyc`.
- All accepted source files are **tracked and committed locally** (§4). The only uncommitted changes are generated files.

## 3. File-level GitHub vs Preview differences
**Cannot be produced**: no remote access. To produce it, I need the remote URL plus read access (or the owner adding a read-only remote/token). Then `git fetch` → `git diff --stat main origin/<branch>` without merge or reset.

## 4. Accepted functionality present in the working source (all tracked)
- **Spaces**
  - Public pages: `/spaces` with PIN/locality search, `/spaces/[id]`, `/spaces/community-partners`, `/spaces/district/[state]/[district]`, `/spaces/locality/[lid]`.
  - Owner and admin flows: listing wizard, My Spaces, withdraw (`bff/spaces/mine/[id]/withdraw`), duplicate check (`.../duplicates`), admin approve/reject/unlist.
  - Share and SEO: share card (`lib/server/space-og.tsx`, `/share-card`), poster (`/space-poster`), Owner Share Kit, sitemap/robots (`app/(public)/sitemap.xml`, `robots.txt`).
- **Backend:** `spaces.py`, `spaces_localities.py` (India Post), `spaces_locality_coverage.py` (coverage + audit), `community_partners.py`, `space_enquiries.py`, `space_registrations.py`, `space_programmes.py`. Reference data `data/in_pincodes.csv.gz`.
- **Admin Localities Dashboard + Locality Intelligence:** `bff/admin/spaces-coverage`, `components/app/admin/coverage/*`.
- **Teacher Claim (Stage 5A-5C):** `app/(claim)/teachers/claim/[token]`, `bff/teachers/claim/[token]/[action]`, `lib/server/teacher-claim.ts`.
- **Global Venues:** `/venues` routes and `venues.py`, `venue_ownership.py`, `venue_growth*.py` are present and unchanged by this task.

## 5. Reconciliation plan (not executed; needs your approval)
| Cat | Item | GitHub | Preview | Proposed resolution | Risk | Approval |
|---|---|---|---|---|---|---|
| 1 | All committed source | unknown | committed at 5f11ca8a | Push via platform "Save to GitHub" to the existing branch, after Cat 5 is resolved | Med | Yes |
| 3 | Divergence | unknown | local only | Fetch and compare first; stop if diverged | Unknown | Yes |
| 4 | `__pycache__/*.pyc` (21 tracked), `.emergent/testing/.runtime/`, `frontend/package-lock.json` (yarn project), `test_reports/**/*.log` | some tracked | generated | Add to `.gitignore`; untrack `.pyc` with `git rm --cached` (files stay on disk) | Low | Yes |
| 5 | `memory/backups/*` (9 files) | tracked in history | DB record exports | Untrack + `.gitignore`. Removing them from **history** needs a rewrite, which is forbidden without your authorization | **High** | **Yes** |
| 5 | `memory/test_credentials.md` (demo/QA account passwords) | tracked | needed by test agents | Untrack + ignore, or keep (demo-only accounts) | Med | Yes |
| 6 | Docs and tests | tracked | present | No action | Low | No |

## 6. Conflicts found
None detectable locally (single linear branch). The remote comparison is not possible.

## 7. Sensitive-data findings (values not printed)
- `memory/backups/` is tracked (committed 2026-10-21 to 2026-10-28). It holds Preview DB exports:
  - removed QA teacher records (names, cities, specialisations; email field present but empty)
  - QA teacher-assignment records
  - `inst_events` cleanup snapshots
  - AI-onboarding webhook events (order IDs, payment status)
  - local QA venue artifacts (`owner_id`, address)
  - a baseline patch
- These are Preview/QA data, not production, but they are **database records**. Committing them is prohibited by your rules.
- `memory/test_credentials.md` is tracked. It contains 4 password entries for demo/QA accounts.
- Secret pattern scan of tracked files: only key **prefix mentions** (`cfsk_ma_prod…`, 12–16 chars; documentation and tests). No full API keys, private keys or `.env` files tracked. `.gitignore` already excludes `.env`, `*.env`, `*.pem`, `*.key`, `credentials.json`.
- No `TEST_` Spaces or locality records are in tracked files.

## 8. Database and schema inventory (code inspection only)
- **Database:** MongoDB via `MONGO_URL`/`DB_NAME` (platform system keys, single shared slot). Preview: pod-local `localhost:27017/nostops_web`. Production target: not documented or visible.
- **Collections:** about 150, defined implicitly in code (no schema files). Main groups:
  - Spaces: `spaces`, `space_*`, `spaces_locality_coverage(_audit)`, `community_partners`, `cp_*`
  - Localities: `in_pincodes(_meta)`, `teacher_service_localities`
  - Venues: `venue_*`
  - Institutional: `inst_*`
  - Verification: `verification_*`
  - Knowledge graph: `kg_*`
  - Pulse: `pulse_*`
  - Payments: `ai_onboarding_*`, `paypal_webhook_events`, `payment_routing_decisions`
- **Indexes** are created in code by: `claim_reminders`, `community_partners`, `discovery`, `festive_kyc`, `institutional`, `intro_videos`, `knowledge_migrate`, `space_registrations`, `spaces_localities`, `spaces_locality_coverage`, `venue_growth_partners`, `venues`, `verification`.
- **Startup jobs (all idempotent):**
  - Data loads and seeds: India PIN dataset load, Knowledge Graph bootstrap, `seed_demo_ecosystem`, `seed_special_needs_examples`.
  - Background loops: monthly venue email and claim reminders (both off on preview pods).
- **Scripts:** `scripts/build_in_pincodes.py`, `scripts/cleanup_preview_test_data.py`, `scripts/gen_org_gateway_images.py`. No migration framework.
- **External owner of most data:** Main NOSTOPS Backend (`BACKEND_ORIGIN`/`BACKEND_URL` = `pro-learn-connect-1.emergent.host`).

## 9. Environment variable inventory (values redacted)
| Variable | File | Slots | Class |
|---|---|---|---|
| NEXT_PUBLIC_SITE_URL | FE | shared | public build-time (www.nostops.org) |
| NEXT_PUBLIC_GA_ID | FE | shared | public build-time |
| WEB_APP_BASE_URL | BE | separate | preview/production URL (live value unverified) |
| CASHFREE_CHECKOUT_ORIGIN | BE | separate | Cashfree return URL (live value unverified) |
| DIDIT_CALLBACK_URL | BE | separate | Didit return URL (live value unverified) |
| **TEACHER_CLAIM_API_BASE** | FE | **shared** | **⚠ shared setting; needs a separately authorized Preview/Production split** |
| BACKEND_URL (FE shared), BACKEND_ORIGIN (BE separate) | FE/BE | — | main backend API |
| PULSE_API_URL | FE | shared | internal sidecar |
| MONGO_URL, DB_NAME | BE | system | database |
| EMERGENT_EMAIL_KEY, EMAIL_FROM_NAME | FE/BE | shared, managed | email (secret) |
| EMERGENT_LLM_KEY | BE | managed | object storage / AI (secret) |
| R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY | BE | shared | storage (secret) |
| R2_BUCKET_NAME | BE | separate | storage config |
| CASHFREE_CLIENT_ID, CASHFREE_CLIENT_SECRET, CASHFREE_API_BASE, CASHFREE_API_VERSION | BE | separate | payments (secret + config) |
| PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_API_BASE | BE | separate | payments (secret + config) |
| DIDIT_API_KEY, DIDIT_WEBHOOK_SECRET, DIDIT_WORKFLOW_ID, DIDIT_BASE | BE | separate | verification (secret + config) |
| GOOGLE_MAPS_API_KEY (BE separate), GOOGLE_MAPS_PLATFORM_API_KEY (FE shared) | — | — | external service (secret) |
| PULSE_SHARED_SECRET (FE shared), WEBHOOK_CRON_SECRET (BE separate) | — | — | internal auth secrets |
| FINANCIAL_UNLOCKED_FLOWS, VENUE_CHECKOUT_ENABLED, VENUE_TIER2_PREVIEW (FE shared); INSTITUTIONAL_ENGINE_ENABLED, PARTICIPANT_MAGIC_DEBUG (BE separate) | — | — | feature flags |

- **Intended claim routing:** Website Preview → Main Backend Preview; Website Production → Main Backend Production.
- The production backend address must be confirmed by the Main Backend project. It was not invented or substituted.

## 10–13. Checks run (read-only)
- **Backend:** Spaces suites (`test_spaces_coverage_8b17`, `test_spaces_intelligence_8b3`, `test_spaces_predeploy_iter235`): **34 passed**.
- **TypeScript:** **0 source errors**. 3 errors come only from stale generated `.next/types` files.
- **ESLint:** not re-run (0 errors at the last pre-deploy check).
- **Production build:** not re-run, because no new commit was created (last clean build: exit 0, see SPACES_PREDEPLOY_CORRECTIONS_REPORT.md).

## 14–16. Final commit, tag, sync status
- **Final commit:** no reconciliation commit created. Local HEAD is unchanged at `5f11ca8a…` (plus this report, auto-committed by the platform).
- **Tag:** `nostops-spaces-predeployment-baseline-2026-11` was NOT created, so the checkpoint is not verified.
- **Remote/local sync:** **unverified**.

## 17. Decisions needed from the owner
1. **GitHub access:** provide the repository URL and branch, and choose either:
   - (a) use Emergent's "Save to GitHub" to push this workspace to that branch, or
   - (b) grant read access so I can fetch and compare before any push.
2. **Database exports in history:** approve untracking `memory/backups/*` and adding them to `.gitignore`. Also decide whether you will authorize a separate history clean-up for repository copies that may already contain them. That is a destructive rewrite and is not done without explicit authorization.
3. **`memory/test_credentials.md`:** keep tracked (demo accounts only) or untrack?
4. **Generated files:** approve the `.gitignore` additions and untracking the tracked `.pyc` files.
- Still open from earlier: the production DB separation blocker and the `TEACHER_CLAIM_API_BASE` split.

## 18. Confirmation
No production deployment, mobile build, production database operation, DB copy/export/import, production setting change or production data change occurred. No force-push, reset, branch/tag deletion or history rewrite. No tokens, invitations, emails, WhatsApp or SMS were sent.
