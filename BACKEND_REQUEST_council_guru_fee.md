# Backend Fix Request — Council Guru retreat platform fee returns 0% (should be 15%)

## STATUS UPDATE (2026-06, re-verified live)
- ✅ `GET /api/retreats/host-eligibility` now returns `platform_fee_pct: 15` for `guru.demo` (council_guru) — **fixed**.
- ⚠️ **Still pending**: per-retreat values are NOT backfilled. `GET /api/retreats/my-hosted` and
  `GET /api/retreats/{id}` still return `platform_fee_pct: 0` (23 of 31 guru retreats) or `null` (8) for
  existing council-guru retreats. Settlement computed from these stored values would still use 0%.
  **Action needed:** backfill `platform_fee_pct = 15` on existing council_guru retreats (and ensure new
  guru retreats persist 15 at create time), so `my-hosted` / detail / settlement all agree with eligibility.
  (The web app defensively coerces a returned `0`→`15` in teacher economics, but the backend settlement
  remains authoritative, so the stored value must be corrected.)

---



**Environment:** `https://pro-learn-connect-1.emergent.host` (live FastAPI backend)
**Repro account:** `guru.demo@nostops.com` (host_type = `council_guru`, Council Guru / L3)
**Severity:** P2 — causes incorrect financial payouts (platform fee, venue settlement, teacher-net all compute off this value)

## Problem
For hosts with `host_type = "council_guru"`, the retreat/venue endpoints return `platform_fee_pct: 0`.
Per the NOSTOPS business rule, the retreat hosting platform fee for Council Gurus is **15%** (same as
empanelled L2 Pracharaks — verified via `teacher.demo`, which correctly returns `platform_fee_pct: 15`).
A 0% fee means the platform collects nothing and the settlement ledger over-credits the host.

## Where it's returned (all read by the web frontend)
The `platform_fee_pct` field is wrong (0 instead of 15) on these endpoints when the caller is a `council_guru`:

1. `GET /api/retreats/host-eligibility` → `platform_fee_pct`
2. `GET /api/retreats/my-hosted` → each retreat's `platform_fee_pct`
3. `GET /api/retreats/{retreat_id}` → `platform_fee_pct`
4. Any settlement/payout computation that derives platform fee from `host_type`
   (retreat reservation `host_net_inr`, venue `payouts/mine`, escrow/settled)

## Expected behaviour
- `platform_fee_pct` for `host_type == "council_guru"` must be **15** everywhere it is emitted or used in money math.
- `teacher_pracharak` already returns 15 — align `council_guru` to the same value.
- Recompute derived monetary fields (`host_net_inr`, venue payable, settlement/escrow) using 15% for Council
  Gurus so existing and future reservations settle correctly.

## Likely root cause to check
The fee-resolution logic (probably a `host_type → platform_fee_pct` map or a branch in the eligibility/pricing
service) has `council_guru` mapped to `0` or missing a case and defaulting to `0`. Set/add `council_guru: 15`.

## Verification after fix
```
GET /api/retreats/host-eligibility   (as guru.demo)  ->  platform_fee_pct == 15
GET /api/retreats/my-hosted          (as guru.demo)  ->  platform_fee_pct == 15 on each retreat
GET /api/retreats/{id}               (guru-owned)    ->  platform_fee_pct == 15
```
Reservation `host_net_inr` for a guru-hosted retreat should equal
`participant_amount − 15% platform fee − venue cost`.

## Note for backend team
Do **not** change the frontend — it correctly reads `platform_fee_pct` from the backend and treats the backend
as the source of truth for all money movement. Some frontend surfaces defensively coerce a returned `0` to `15`,
but the **settlement ledger, venue payouts, and teacher-net must be authoritative on the backend**, so the fix
has to live server-side.
