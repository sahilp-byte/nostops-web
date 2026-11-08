# Live backend clean-up guide — test & duplicate retreats

**For:** the backend team that owns `pro-learn-connect-1.emergent.host` (the live business backend).
**Why:** the website now HIDES these retreats everywhere (listings, city pages, detail pages → 404, sitemap,
search, OG images) via `isPublicRetreatRecord()` in `frontend/lib/server/retreats.ts`. The records themselves
still exist on the live backend and are still returned by `GET /api/retreats`, `/api/retreats/{id}`,
`/api/seo/retreat/{id}` and the mobile app. Only the backend can remove them for good.
**Nothing was deleted by the web team.** All lookups below were read-only (`GET /api/retreats/my-hosted` as the two
demo accounts, June 2026).

---

## 1. What to remove

### A. Duplicates (owner decision: hide BOTH 2 Nov copies, keep the original)
| Retreat | Title | Dates | Status | Seats filled | Action |
|---|---|---|---|---|---|
| `rt_c7c3865f34` | Ganesh Baug Farm Stay and Yoga Retreat (Long Weekend – Leadership Retreat for SunPharma) | 2 Nov 2026 | published | 0 | **Archive / delete** |
| `rt_41f614da0e` | same title | 2 Nov 2026 | published | 0 | **Archive / delete** |
| `rt_d51f52ae3e` | same title | 18–20 Sep 2026 | filling | 17 | **KEEP** (real bookings) |

### B. QA / test retreats — host `teacher.demo@nostops.com` (32)
`rt_67e770b5c5` WEBQA RaiseCapacity · `rt_805c274684` QA Venue Partner Link Final (**2 seats filled**) ·
`rt_79636c03d3` WEBQA Verify Coords · `rt_b62cffe0b7` Rich Venue Fields Test · `rt_b275521c63` WEBQA_Automated_Test_Retreat_Iter18 ·
`rt_f27d935937` WEBQA MinCohort (**5 filled**) · `rt_8d568a7a58` In-band Hindi Retreat (**15 filled**) ·
TEST_iter65 Group Wallet ×14: `rt_65e9980707`, `rt_ae6bb667d7`, `rt_fe8acda62a`, `rt_da9ddbeebd`, `rt_726ded6a08`, `rt_1facc08d19`,
`rt_76b60c2a8b`, `rt_0d00ff8cfa`, `rt_da5109768b`, `rt_744c9c3ac9`, `rt_57ef5e881c`, `rt_beb1d778ef`, `rt_65f3e6af2a`, `rt_aef4fb746d`,
`rt_33f03d0926`, `rt_2fcdee7a7c` ·
TEST_Iter61 Edit-Lock ×4: `rt_690eed3d4f`, `rt_c738cf78ca`, `rt_f8bbf59c2e`, `rt_906072dd78` ·
TEST_Iter62 Revert Regression ×2: `rt_b1d24d2327` (**9 filled**), `rt_e67adfbe45` ·
TEST_Retreat Level2 Pracharak ×3: `rt_2851c54c69`, `rt_48f4163457`, `rt_7f84b0c724` ·
`rt_81756996e2` UI TEST Retreat Silent Immersion 2026.
Also from earlier QA notes (may already be gone): `rt_1cf46fdf0f` QA L2 host allowed check, `rt_d96a28cb70` QA Wizard Full-Field Retreat.

### C. QA / test retreats — host `guru.demo@nostops.com` (31, all QA)
Retreat Image Test ×18: `rt_4cd7f71864`, `rt_99fde27ccc`, `rt_787a7923a4`, `rt_756fbe0db1`, `rt_1c1d7452b6`, `rt_763cdb7e4a`, `rt_3ae4561123`,
`rt_53afd36aae`, `rt_9dc52df87a`, `rt_8d83373762`, `rt_dbfe5ce10f`, `rt_39134fac94`, `rt_b9d9577136`, `rt_300869e032`, `rt_0fc205f1b8`,
`rt_4fa4614ad5`, `rt_5b7576c68c`, `rt_22f12c10b2` ·
`rt_29d988265a` QA Partnership Probe · `rt_ec33638e2e` WEBQA Guru Curated (**1 filled**) · `rt_076c73615b` QA Itinerary & Pricing Timeline (**1 filled**) ·
`rt_5c3bcbf3f7` Group Booking Test Retreat (**10 filled**) ·
TEST_Session2 Pranayama ×3: `rt_265277c1e7` (**10 filled**), `rt_f6bab03a4e` (**2 filled**), `rt_f017012886` ·
TEST_S5 ×6: `rt_d950dfdc46`, `rt_44182b3cf6`, `rt_cf79a7f0ce`, `rt_5412119208`, `rt_5698aa70ff`, `rt_20ff5d2aa6`.

### D. Related QA records (optional, same clean-up)
- Owner listing `rt_a21fdf87eec7` "WEBQA Owner Listing" + centre `ctr_5caf980c9e50`; centre `ctr_0c01674df73d` "QA Guru Center (delete me)".
- Reservation `rs_3482291683` (on `rt_e8715c9ed0`), waitlist entry `wl_fdf63b619eea48` (on `rt_1a7b25b9bd`), invite `rin_2ff7f4c13c` (on `rt_67e770b5c5`).

**Keep:** `rt_d51f52ae3e` (Ganesh Baug, Sep 2026) and `rt_1a7b25b9bd` (Sunrise Hatha Immersion at Mulshi) — neither is a test record.

---

## 2. Step-by-step (run on a backup first)

1. **Back up** the affected documents before touching anything, e.g.
   `mongoexport --collection=retreats --query='{"retreat_id":{"$in":[<ids above>]}}' --out=qa_retreats_backup.json`
   plus the matching `reservations`, `payments`/`orders`, `waitlist`, `invites` and `cohort` documents.
2. **Check money first.** Several QA retreats show *seats filled* (marked **bold** above). For each, list its reservations and
   payments. These were made by QA/demo accounts, but confirm no real learner paid — if anyone did, refund before archiving.
   Any wallet / escrow / commission ledger entries created for these reservations must be reversed together with them.
3. **Archive rather than hard-delete** (recommended): set `status = "archived"` (or your equivalent) and
   `hidden_from_public = true` so the records drop out of `GET /api/retreats`, `/api/seo/sitemap.xml`, search and the app,
   while staying auditable. The owner-scoped `POST /api/retreats/listings/{id}/unpublish` exists, but an **admin**
   archive/bulk endpoint is needed for this volume.
4. If you prefer deletion: delete the child records first (reservations, waitlist, invites, cohort, venue-enrichment snapshot,
   SEO cache), then the retreat document.
5. **Purge caches:** the SEO sitemap (`/api/seo/sitemap.xml`), any retreat listing cache, and CDN caches for
   `/retreats/{id}` pages.
6. **Verify:** `GET /api/retreats` no longer returns any id above; `GET /api/retreats/{id}` returns 404 (or an archived
   status) for each; the sitemap contains none of them; `rt_d51f52ae3e` and `rt_1a7b25b9bd` are unchanged.
7. Tell the web team when done — the website's hidden-ID list in `frontend/lib/server/retreats.ts` can then be left
   as a harmless safety net (no action needed) or trimmed.

## 3. Preventing it happening again (backend)
- Run automated tests against a **staging** backend, never production (the preview app writes into live data today).
- Add an idempotency key / duplicate guard on `POST /retreats/create` (same host + title + dates → reject) — this is how the
  three Ganesh Baug copies happened.
- Add an admin archive/unpublish endpoint for any retreat.
