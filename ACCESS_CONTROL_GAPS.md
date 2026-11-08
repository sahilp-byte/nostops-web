# PROMPT 3 — Access-Control Gap Analysis (teacher model)

> Discrepancies between the INTENDED NOSTOPS teacher access model and the CURRENT implementation.
> Read-only analysis; NO rules changed. Backend is read-only. Grounded in live code + live backend reads
> (`teacher.demo`). Where an eligibility rule is ambiguous/contradictory it is flagged **PRODUCT DECISION REQUIRED**
> instead of assuming. Companion to `TEACHER_FEATURE_INVENTORY.md`.

## Positive baseline (verified, NOT a gap)
- **No administrative self-assign via profile write.** `/bff/teacher/profile` PATCH whitelists only
  name/bio/city/phone/parampara/root_guru*/lineage/styles/specializations/languages/dimensions/experience_years/is_available.
  It does **not** accept `tier`, `is_verified`, `is_empanelled`, `kyc_*`, or `badges`. Teachers cannot self-promote here.
- **Verified-gated pages are server-guarded**, not UI-only: Offerings/Bookings/Wallet/Refer/Coordinator all
  `redirect('/app/teacher/locked')` server-side (not just a hidden nav item).

---

## D1 — The web "verified" gate is enforced only at page + nav layers, not at the BFF/API layer
- **Feature:** Offerings, Bookings, Wallet, Refer & Earn, City Coordinator (the verified-gated set).
- **Current implementation:** page guards + nav 🔒 use the web composite `verified = kyc_verified && kyc_paid && is_empanelled`. The corresponding BFF write routes (`/bff/teacher/premium-config`, `/bff/teacher/wallet/[action]`, `/bff/coordinator/assign-me`, `/bff/one-on-one/bookings`) enforce **only CSRF** (`badOrigin`) and forward to the backend; they do **not** re-check the composite.
- **Expected behaviour:** a feature that is "locked until verified" should be denied consistently at UI **and** route/API, per one authoritative rule.
- **Frontend issue:** the gate lives in page render + nav only; no shared server-side status guard on the gated BFF routes.
- **Backend/API issue:** each backend endpoint applies its **own** rule, which does **not** match the web composite (see D2) — e.g. premium-config gates on profile + **empanelment** (not on KYC payment).
- **Route-access issue:** a valid session + CSRF token can POST/PUT the BFF route directly, bypassing the page redirect.
- **Potential bypass:** `teacher.demo` (empanelled, `is_verified=true`, but `kyc_paid=false`) is **locked in the UI** yet the backend would likely **accept** a direct premium-config enable / coordinator assign-me, because the backend only requires empanelment — the web rule is *stricter* than the backend, so the UI lock is not the real boundary.
- **Recommended correction:** adopt the authoritative status model (Prompt 4) and enforce it in a **shared BFF guard** for the gated routes so UI + route + backend agree. Requires resolving D2 first.

## D2 — Two contradictory definitions of "verified"
- **Feature:** all earning-feature gating.
- **Current implementation:** backend exposes `is_verified` (true for `teacher.demo`) AND the granular `kyc_verified`/`kyc_paid`/`is_empanelled`. The web **ignores** backend `is_verified` and computes its own strict composite → `teacher.demo` is "verified" to the backend but "not verified" to the web.
- **Expected behaviour:** a single authoritative definition of "verified".
- **Frontend issue:** invented a composite that overrides the backend's own `is_verified`.
- **Backend/API issue:** `is_verified` semantics (badge/directory) differ from "may operate/earn".
- **Route/bypass:** see D1.
- **PRODUCT DECISION REQUIRED:** Which is authoritative for unlocking earning features — backend `is_verified`, or the strict composite (KYC identity + ₹799 paid + empanelled)? (Everything else depends on this.)

## D3 — "No Level Assigned" is collapsed into Level 1
- **Feature:** Teacher level (badge, hosting catalogue, progression UI).
- **Current implementation:** `getTeacherLevel()` defaults unknown/absent `tier` → **Level 1 (Shikshak)**. The intended model has a distinct **"No Level Assigned"**.
- **Expected behaviour:** a teacher with no assigned tier should be distinguishable from an assigned Level 1.
- **Frontend issue:** default-to-L1 masks the "unassigned" state.
- **Backend/API issue:** unclear whether the backend always sets `tier` at onboarding or leaves it null (could not observe a null-tier teacher on the demo data).
- **Route/bypass:** none (display only).
- **PRODUCT DECISION REQUIRED:** Is a newly onboarded teacher with no `tier` → "No Level Assigned" or "Level 1 (Shikshak)"? And does the backend guarantee a `tier` at onboarding?

## D4 — Empanelment "Pending" state is not represented
- **Feature:** Empanelment status.
- **Current implementation:** web has only the boolean `is_empanelled`. A fast-track request that is submitted/paid but **awaiting a Council decision**, or a free-track teacher **in progress**, both render simply as "not empanelled".
- **Expected behaviour:** three states — Pending / Empanelled / Not Empanelled.
- **Frontend issue:** no Pending concept.
- **Backend/API issue:** there is **no explicit empanelment-status enum**; "pending" must be *derived* (fast-track `my-status.active` request undecided, and/or free-track progress `sessions_done < min`).
- **Route/bypass:** none.
- **PRODUCT DECISION REQUIRED:** Definition of "Pending empanelment" — only a fast-track request awaiting Council decision, only free-track merit-in-progress, or both?

## D5 — Verification "Pending" absent + KYC boolean/timestamp inconsistency
- **Feature:** Verification (KYC) status.
- **Current implementation:** web reads booleans `kyc_verified` / `kyc_paid`. Live `kyc/sandbox/status` for `teacher.demo` returns **contradictory** data: `verified:true`, `data.verified:true`, `kyc_paid_at` and `verified_at` present, yet `kyc_verified:false`, `kyc_paid:false`, `pan_verified:false`, `bank_verified:false`. No "Pending" concept.
- **Expected behaviour:** three states — Pending / Verified / Not Verified — from a trustworthy signal.
- **Frontend issue:** no Pending state; blindly trusts booleans that can disagree with timestamps.
- **Backend/API issue:** **data-integrity discrepancy** in `kyc/sandbox/status` (booleans vs timestamps/sub-object disagree) — motivates a single authoritative status field rather than several loosely-coupled booleans.
- **Route/bypass:** none.
- **PRODUCT DECISION REQUIRED:** Definition of "Pending verification" (e.g. payment made but identity checks incomplete), and which signal is authoritative when booleans and timestamps disagree.

## D6 — Two parallel "can host" notions: Level (L2+) vs backend host-eligibility
- **Feature:** Retreat hosting + Venue Studio.
- **Current implementation:** the runtime gate uses backend `GET /retreats/host-eligibility` (`eligible` + `host_type`); the level map separately states hosting = **L2+**. These are independent and can diverge (an L2 not yet eligible, or eligibility not tracking tier exactly).
- **Expected behaviour:** one authoritative "can host" rule; the level catalogue must not contradict the runtime gate.
- **Frontend issue:** two sources of truth for the same capability.
- **Backend/API issue:** host-eligibility criteria are backend-owned and not expressed in terms of the published level.
- **Route/bypass:** low — host pages redirect on `!eligible`; ownership enforced by `host_user_id`.
- **Recommended correction:** keep backend host-eligibility **authoritative** for the gate; make the level→privilege catalogue explicitly reference it (already noted in `lib/teacher-levels.ts`). Flag as **PRODUCT DECISION REQUIRED** only if Level and eligibility must be made to match exactly.

## D7 — Sessions & Widgets open to unverified teachers while sibling earning features are locked
- **Feature:** `/app/teacher/sessions`, `/app/teacher/widgets`.
- **Current implementation:** both require only `onboarded` (NOT verified); Bookings/Offerings require verified. Widgets exposes shareable booking/QR distribution that drives paid bookings.
- **Expected behaviour:** consistent treatment of earning-adjacent surfaces.
- **Frontend issue:** inconsistent gating across closely related features.
- **Backend/API issue:** none specific (data is the teacher's own).
- **Route/bypass:** none new.
- **PRODUCT DECISION REQUIRED:** Should Sessions and Widgets be verification-gated like Offerings/Bookings, or intentionally kept open?

## D8 — Coordinator verified-gate fires only when `role === 'teacher'`
- **Feature:** City Coordinator (hub/roster/agreement).
- **Current implementation:** redirect to `/locked` only when `role === 'teacher' && !verified`; genuine `coordinator`-role users skip it (correct). Edge: a teacher who also holds a coordinator record but whose active role still reads `teacher` is sent to the teacher gate.
- **Expected behaviour:** the gate should key off the authoritative coordinator record, not only the active role string.
- **Frontend issue:** role-string branch rather than record-based check.
- **Backend/API issue:** none.
- **Route/bypass:** none material.
- **Recommended correction:** minor — key the coordinator surfaces off the coordinator record; low priority. (Not a PRODUCT DECISION.)

---

## Summary of PRODUCT DECISIONS REQUIRED (blockers for Prompt 4)
1. **D2** — Authoritative "verified" rule: backend `is_verified` vs strict composite (KYC + ₹799 paid + empanelled)?
2. **D5** — "Pending verification" definition + which signal wins when booleans/timestamps disagree.
3. **D4** — "Pending empanelment" definition (fast-track awaiting decision / free-track in-progress / both).
4. **D3** — Default level for a no-`tier` onboarded teacher: "No Level Assigned" vs "Level 1".
5. **D7** — Are Sessions/Widgets meant to be verification-gated, or open?
6. **D1/D6** (implementation, not business): where to ENFORCE the authoritative rule (add a shared BFF-route guard; keep host-eligibility authoritative for hosting).
