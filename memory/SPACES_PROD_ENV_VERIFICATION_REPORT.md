# NOSTOPS Spaces — Final Production Environment Verification (read-only)
Date: 2026-06 · Nothing published, deployed, built, or changed in production. No settings or secrets changed.
Legend: [V] verified with evidence · [U] unverified · [B] needs separate backend-project authorization

## 1. Website production URL
- `WEB_APP_BASE_URL` (backend): secrets manager shows **separate test/live slots** [V]. Preview (test) value = `https://nostops-spaces--0fieag2d.preview.emergentagent.com` [V]. **Live value cannot be read by the agent** [U]. Read-only deployer diagnosis requested.
- `NEXT_PUBLIC_SITE_URL` = `https://www.nostops.org`, single shared slot → same in production [V].
- `CASHFREE_CHECKOUT_ORIGIN`, `DIDIT_CALLBACK_URL`: separate slots; live values not readable [U] (should also point at www.nostops.org).
- Main backend `CLAIM_PUBLIC_BASE_URL` not touched or inspected (separate project).

## 2. Production database separation — BLOCKER NOT RESOLVED
- Preview: `MONGO_URL=mongodb://localhost:27017`, `DB_NAME=nostops_web` (pod-local) [V].
- `MONGO_URL`/`DB_NAME` are **platform system keys, single shared slot**; production value is injected by the Emergent deploy and is not visible [U].
- Indirect only: production www.nostops.org serves an older build (`/` 200, `/spaces` 404) with different data. Not accepted as proof.
- App startup on any deploy runs: India PIN dataset load (idempotent), Knowledge Graph bootstrap (first run), demo ecosystem seed (idempotent, keyed), 3 Special Needs examples (idempotent), and background loops (monthly venue email, claim reminders — both off on preview pods, **on in production**) [V from code]. No Spaces/coverage/TEST_ seeding [V].
- Whether the publish pipeline copies/imports Preview DB records: [U].
- Asked Emergent to confirm (read-only deployer diagnosis sent; reply pending): (a) production Mongo host/cluster + DB name, (b) that it differs from the pod-local Preview DB, (c) that publish never copies/migrates/restores Preview data into production, (d) snapshot/backup mechanism.

## 3. Teacher Claim backend connection — MISCONFIGURED FOR PRODUCTION
- `TEACHER_CLAIM_API_BASE` is a **single shared slot** [V] → production would receive the Preview value `https://pro-learn-connect-1.preview.emergentagent.com/api` [V]. **Production would point at Preview. Not acceptable.**
- Read-only probe (bogus token, GET, non-consuming):
  - `pro-learn-connect-1.preview.emergentagent.com/api/teachers/claim/<invalid>` → 404 "page not found" (Preview host not serving right now).
  - `pro-learn-connect-1.emergent.host/api/teachers/claim/<invalid>` → 410 "Invalid or expired claim link" (route exists on the live backend host; same host as website `BACKEND_ORIGIN`/`BACKEND_URL`).
- This is a probe, **not** authoritative configuration. The production claim API base must be confirmed from the Main NOSTOPS Backend project's own production config [B].
- Required change (not made): make `TEACHER_CLAIM_API_BASE` a separate-slot key — test = Main Backend Preview `/api`; live = the confirmed Main Backend Production `/api` URL. Main backend: confirm its production URL and that its `CLAIM_PUBLIC_BASE_URL` live value is `https://www.nostops.org` [B].

## 4. Invitation hold — in force
No claim tokens, invitations, email, WhatsApp, SMS, account linking or migration were created or sent. Probe used an invalid token only.

## 5. Deployment checklist (do not execute until authorized)
1. DB snapshot: Emergent support export/snapshot of production DB; record ID.
2. Current build: record current production deployment ID/timestamp as rollback target.
3. Env: confirm live `WEB_APP_BASE_URL`, `CASHFREE_CHECKOUT_ORIGIN`, `DIDIT_CALLBACK_URL` = www.nostops.org; split `TEACHER_CLAIM_API_BASE` to separate slots with confirmed production value.
4. API connectivity: `GET https://pro-learn-connect-1.emergent.host/api/health` = 200 [V today]; claim route reachable [V today].
5. Storage/services: `EMERGENT_LLM_KEY` (object storage) balance; R2 keys present (shared); Didit, Google Maps keys present per secrets list.
6. Email safety: `EMERGENT_EMAIL_KEY` shared → production Spaces approve/reject emails and the production-only monthly venue + claim-reminder loops **will really send**. Confirm acceptable; legacy invitation hold unaffected.
7. Migration/seed safety: only idempotent startup seeds listed in §2; no production migration scripts run.
8. Smoke test: `/`, `/spaces`, `/spaces/[approved-id]`, district + locality pages, share card image, sitemap/robots, owner login + Share Kit, admin coverage dashboard, private routes noindex/403.
9. Rollback: redeploy recorded previous build; restore DB snapshot only if data was altered.

## 6. Results
1. Verified: Preview values, slot structure of all keys, `NEXT_PUBLIC_SITE_URL`, startup seed behaviour, live backend host reachability.
2. Unverified: live `WEB_APP_BASE_URL`, production DB target, publish data-copy behaviour, current build ID, snapshot.
3. Backend-project authorization needed: production claim API base URL + its `CLAIM_PUBLIC_BASE_URL`.
4. Production DB blocker: **NOT resolved** (awaiting Emergent confirmation).
5. Production Teacher Claim connectivity: **NOT correctly configured** (shared slot → Preview).
6. Ready for deployment authorization: **No** — not until items 4 and 5 are resolved.

## 7. Emergent deployer diagnosis result (read-only)
- All deployment tools failed with `deployment_not_found` for job `d41a47d4-aa76-4065-8fc5-f1fd127157a9`. Production DB target, live secrets, build ID and run history could NOT be inspected.
- Deployer note (general platform behaviour, not verified for this job): **Preview→production DB data copy happens only on the very first deploy's Mongo step**; later deploys skip it if the production DB connection already works. If www.nostops.org was deployed from a different job/deployment record, the first publish from this job could copy Preview data (including TEST_ records). Must be ruled out.
- Needed from Emergent support: (a) which deployment/job ID serves www.nostops.org; (b) whether publishing from this job is a first deploy, i.e. whether it would run the Mongo copy step; (c) production DB target and confirmation it is separate from Preview; (d) current build ID + DB snapshot.
