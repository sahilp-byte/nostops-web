# Stage 6A — Website Legacy Teacher Inventory (READ-ONLY export)

**RESTRICTED — contains normalized teacher email addresses for backend reconciliation only. Do not share outside the reconciliation review.**

Generated 2026-11-07 · Preview website project · read-only. No profile, account, token, invitation, message or migration was created or changed.

## 1. Where the website's legacy teacher data comes from (key finding)
- The website database (`nostops_web`) stores **no copy** of the YogaYukt legacy teacher profiles. It has no website-local teacher IDs for them, and no `legacy_teacher_id` / `legacy_yogayukt_id` fields exist in any website collection.
- The website shows teachers by reading the **main backend's LIVE (production) server** (`BACKEND_URL = https://pro-learn-connect-1.emergent.host`), not the main backend's Preview server (`https://pro-learn-connect-1.preview.emergentagent.com`, used only by the Stage 5C claim flow).
- Therefore the "website inventory of 32" is the **main backend LIVE** roster as the website reads it. The **Teacher ID** column below is the main-backend LIVE `teacher_id` exactly as served to the website. It is **not** a website-local ID, and no website-local ID exists. It must not be assumed identical to any main-backend **Preview** ID; compare it by email and legacy ID too.
- Sources (GET only, website admin session): `GET /api/admin/people/teachers?limit=200` (roster: email, account link, active flags), `GET /api/admin/people/teachers/{id}` (legacy IDs, handle, visibility), `GET /api/teachers/directory` (public listing). The main backend Preview public directory was also read (no auth) to mark Preview presence.
- Selection rule: roster profiles whose `teacher_id` starts with `yoga_yk_` (YogaYukt import) or `yoga_kyc_` (legacy KYC import). The 49 `yoga_native_` profiles are website/app sign-ups, not legacy, and are excluded.

## 2. Summary (emails masked)
- Legacy profiles on the main backend LIVE roster: **32** (`yoga_yk_` 30, `yoga_kyc_` 2). Roster total 90.
- With legacy YogaYukt teacher ID: **30**; without: 2.
- Listed in LIVE public directory: **32**. Public profile visible flag true: 32.
- Linked to an account (`user_id` present): **0**.
- Present in main backend **Preview** public directory by the same `teacher_id`: **29**; not present: 3.
- Not present by `teacher_id` in the Preview public directory (candidates for the backend's missing records; the Preview directory shows listed profiles only, so an unlisted Preview record would also appear here):
  - `yoga_kyc_5d62a8cf01` · a***@example.com · legacy ID — · handle `arjun-raghavan`
  - `yoga_kyc_8a565e8b41` · m***@example.com · legacy ID — · handle `meera-iyer`
  - `yoga_yk_7b0a9186b3de` · a***@gmail.com · legacy ID yogayukt_2807 · handle `ajaykumarshastri75`
- Email/contact flags (for review, no action taken): `yoga_kyc_5d62a8cf01`: email looks like a placeholder; `yoga_kyc_8a565e8b41`: email looks like a placeholder; `yoga_yk_259b9f3d85cd`: email shared by 2 roster profiles; `yoga_yk_60bd3ab0444e`: email looks like a placeholder

- Legacy IDs: the LIVE profiles carry the YogaYukt ID in `legacy_teacher_id` (30 records, `yogayukt_NNNN`); `legacy_yogayukt_id` is present but empty on all 32. The 2 `yoga_kyc_` records have no legacy ID.

## 3. Restricted reconciliation inventory (all records)
Columns: **Teacher ID** = main-backend LIVE `teacher_id` as served to the website (no website-local ID exists) · **Email** = normalized (trimmed, lower-case) · **Legacy teacher ID / Legacy YogaYukt ID** = as stored on the LIVE profile · **Public URL** = website path, for reference only · **Status / Active / Public / Listed** = LIVE profile status, roster `is_active`, `public_profile_visible`, present in LIVE public directory · **Account** = LIVE `user_id` · **In backend Preview** = same `teacher_id` in Preview public directory · **Website-local refs** = website collections that reference this ID (operational records only, not profile copies).

| # | Teacher ID (main-backend LIVE) | Normalized email | Legacy teacher ID | Legacy YogaYukt ID | Public URL (reference) | Status | Active | Public | Listed (LIVE) | Account (user_id) | In backend Preview | Website-local refs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `yoga_kyc_5d62a8cf01` | arjun.raghavan.kyc@example.com | — | — | /teachers/arjun-raghavan | active | yes | yes | yes | none | no | trust_review_cases |
| 2 | `yoga_kyc_8a565e8b41` | meera.iyer.kyc@example.com | — | — | /teachers/meera-iyer | active | yes | yes | yes | none | no | — |
| 3 | `yoga_yk_03db20200b11` | anandsneh1813@gmail.com | yogayukt_2801 | — | /teachers/anandsneh1813 | active | yes | yes | yes | none | yes | — |
| 4 | `yoga_yk_259b9f3d85cd` | himalayan.mohan@yahoo.com | yogayukt_2808 | — | /teachers/himalayan.mohan | active | yes | yes | yes | none | yes | trust_review_cases |
| 5 | `yoga_yk_34fc8fc140a3` | piparia.heer@gmail.com | yogayukt_4874 | — | /teachers/piparia.heer | active | yes | yes | yes | none | yes | — |
| 6 | `yoga_yk_454d188c2a3b` | geeta-c@hotmail.com | yogayukt_4871 | — | /teachers/geeta-c | active | yes | yes | yes | none | yes | — |
| 7 | `yoga_yk_4c4b06379503` | nirajsadhaka@gmail.com | yogayukt_4889 | — | /teachers/nirajsadhaka | active | yes | yes | yes | none | yes | — |
| 8 | `yoga_yk_4dc9ee4c79ce` | eshayzozmnm@gmail.com | yogayukt_4869 | — | /teachers/eshayzozmnm | active | yes | yes | yes | none | yes | — |
| 9 | `yoga_yk_5d21423f33b7` | bikashpurohityoga@gmail.com | yogayukt_2806 | — | /teachers/bikashpurohityoga | active | yes | yes | yes | none | yes | — |
| 10 | `yoga_yk_5ddc1d9cc6b6` | shiviyadav284@gmail.com | yogayukt_2802 | — | /teachers/shiviyadav284 | active | yes | yes | yes | none | yes | trust_review_cases |
| 11 | `yoga_yk_60bd3ab0444e` | test11@gmail.com | yogayukt_4872 | — | /teachers/test11 | active | yes | yes | yes | none | yes | — |
| 12 | `yoga_yk_6b6df99c6c77` | hqrishyoga@gmail.com | yogayukt_2805 | — | /teachers/hqrishyoga | active | yes | yes | yes | none | yes | — |
| 13 | `yoga_yk_7010260b6167` | joshi@email.com | yogayukt_2653 | — | /teachers/joshi | active | yes | yes | yes | none | yes | — |
| 14 | `yoga_yk_723112510235` | prakashchandna73@gmail.com | yogayukt_4870 | — | /teachers/prakashchandna73 | active | yes | yes | yes | none | yes | — |
| 15 | `yoga_yk_7b0a9186b3de` | ajaykumarshastri75@gmail.com | yogayukt_2807 | — | /teachers/ajaykumarshastri75 | active | yes | yes | yes | none | no | — |
| 16 | `yoga_yk_7e591e38a475` | hello.mentorify@gmail.com | yogayukt_2792 | — | /teachers/hello.mentorify | active | yes | yes | yes | none | yes | — |
| 17 | `yoga_yk_899c47884d10` | racharajani1992@gmail.com | yogayukt_2684 | — | /teachers/racharajani1992 | active | yes | yes | yes | none | yes | — |
| 18 | `yoga_yk_8ec27446790a` | harishyoga@gmail.com | yogayukt_2810 | — | /teachers/harishyoga | active | yes | yes | yes | none | yes | — |
| 19 | `yoga_yk_90ebebe88ba7` | name1@email.com | yogayukt_2654 | — | /teachers/name1 | active | yes | yes | yes | none | yes | — |
| 20 | `yoga_yk_931041483213` | bisht@email.com | yogayukt_2657 | — | /teachers/bisht | active | yes | yes | yes | none | yes | — |
| 21 | `yoga_yk_99ce4cca32ab` | dsinchekar@yahoo.com | yogayukt_4868 | — | /teachers/dsinchekar | active | yes | yes | yes | none | yes | — |
| 22 | `yoga_yk_9b08245de697` | nancyaws7888036@gmail.com | yogayukt_2669 | — | /teachers/nancyaws7888036 | active | yes | yes | yes | none | yes | trust_review_cases |
| 23 | `yoga_yk_9f23272dfe8a` | rajanikdham@gmail.com | yogayukt_4866 | — | /teachers/rajanikdham | active | yes | yes | yes | none | yes | trust_review_cases |
| 24 | `yoga_yk_a7c4ce7edabe` | minimadhur@gmail.com | yogayukt_4875 | — | /teachers/minimadhur | active | yes | yes | yes | none | yes | — |
| 25 | `yoga_yk_b78334cd0180` | debasish.sarkar@tm.org | yogayukt_2788 | — | /teachers/debasish.sarkar | active | yes | yes | yes | none | yes | — |
| 26 | `yoga_yk_bd1f62e57a18` | dhekanebhslchandra@gmail.com | yogayukt_2809 | — | /teachers/dhekanebhslchandra | active | yes | yes | yes | none | yes | — |
| 27 | `yoga_yk_cd89193058c0` | drjasminejshah@gmail.com | yogayukt_4873 | — | /teachers/drjasminejshah | active | yes | yes | yes | none | yes | — |
| 28 | `yoga_yk_cfd47de7da87` | infoyoga21@gmail.com | yogayukt_4876 | — | /teachers/infoyoga21 | active | yes | yes | yes | none | yes | — |
| 29 | `yoga_yk_f15bc3ab4de9` | shashtri@email.com | yogayukt_2656 | — | /teachers/shashtri | active | yes | yes | yes | none | yes | — |
| 30 | `yoga_yk_f5244089147d` | kapooranu101@gmail.com | yogayukt_2790 | — | /teachers/kapooranu101 | active | yes | yes | yes | none | yes | — |
| 31 | `yoga_yk_f983520b59f4` | akshit007chauhan@gmail.com | yogayukt_2672 | — | /teachers/akshit007chauhan | active | yes | yes | yes | none | yes | — |
| 32 | `yoga_yk_fb91a23b0a21` | soulbuzzfitnessyoga@gmail.com | yogayukt_4888 | — | /teachers/soulbuzzfitnessyoga | active | yes | yes | yes | none | yes | — |

## 4. Rules observed
- No matching by name or handle; reconciliation keys are `teacher_id`, normalized email and legacy IDs only.
- IDs reproduced exactly as served; no IDs generated; no mapping table or second source of truth created (this file is a review export only).
- Read-only: one admin sign-in to the main backend LIVE server to read the roster (the same access the website admin pages use), then GET requests only. No profile, account, token, invitation, SMS/email/WhatsApp or migration.
