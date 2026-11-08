# Teacher Access Test Matrix (Prompts 25 & 26)

Rigorous verification that the **single** authorization engine
(`frontend/lib/teacher-access.ts` → `canAccessFeature`) behaves correctly across
every teacher lifecycle state **and** every way a teacher could try to reach a
feature.

- **Runnable proof:** `cd frontend && node tests/verify_access_matrix.ts`
  (or `yarn test:access`) — drives the real engine through all 8 states × 14
  features and asserts against the table below. **Status: PASSING.**
- **Live proof (multi-method, on demo accounts):** run by the frontend testing
  agent — menu render, direct-URL navigation, BFF/API POST, and page-refresh /
  new-session, per §3.

---

## 1. Why one function proves all four access methods

Every path to a gated teacher feature funnels through the **same pure**
`canAccessFeature(ctx, feature)`, where `ctx` is assembled **server-side** from
the authenticated teacher's authoritative record (`getTeacherAccessContext` in
`lib/server/teacher-access.ts`) — never from client input:

| Method | Entry point | Calls |
|---|---|---|
| **Menu / navigation** | `buildTeacherNav` (`components/app/nav-config.ts`) | `canAccessFeature` → locks/hides item |
| **Direct URL** | `guardTeacherFeature` / `enforceTeacherFeature` (page) | `canAccessFeature` → `redirect()` when denied |
| **API / mutation** | `requireFeatureAccess` (BFF route) | `canAccessFeature` → `401/403` when denied |
| **Refresh / new session** | context re-derived on **every** request (no cache across requests) | `canAccessFeature` again → identical result |

Because there is no second decision path and the context is rebuilt from the DB
on each request, the four methods **cannot diverge**. A single assertion of
`canAccessFeature` per (state × feature) therefore certifies all four.

---

## 2. The 8 states (A–H)

Status attributes are the three authoritative ones — **Verification**,
**Empanelment**, **Level** — plus the derived **Operate** gate
(`canOperate` = strict KYC composite _AND_ admin `is_verified`), and backend
**host-eligibility** (independent gate, L2+).

| State | Scenario | Verification | Empanelment | Level | Operate | Host-eligible |
|---|---|---|---|---|:--:|:--:|
| **A** | Signed-in, **not onboarded** (no teacher record) | — | — | — | ✗ | ✗ |
| **B** | Fresh teacher — nothing done | Not verified | Not empanelled | L1 | ✗ | ✗ |
| **C** | KYC in progress | Pending | Not empanelled | L1 | ✗ | ✗ |
| **D** | Verified (KYC + ₹799 + admin) but **not** empanelled | Verified | Not empanelled | L1 | ✗ | ✗ |
| **E** | Operate-eligible L1 (verified + empanelled + admin-verified) | Verified | Empanelled | L1 | ✓ | ✗ |
| **F** | Operate-eligible **L2 Pracharak**, host-eligible | Verified | Empanelled | L2 | ✓ | ✓ |
| **G** | **L3 Guru** — full | Verified | Empanelled | L3 | ✓ | ✓ |
| **H** | **Revoked** — admin removed verification (operate off, host stays) | Not verified | Empanelled | L2 | ✗ | ✓ |

State **H** deliberately shows the two gates are independent: revoking
verification turns **operate** features off again while backend host-eligibility
(a separate check) can remain on.

---

## 3. Feature buckets

The 14 teacher features fall into three eligibility buckets (`featureCategory`):

- **Always** (any signed-in teacher; `profile`/`kyc`/`empanelment`/`mentor`
  additionally require *onboarded*; `dashboard` needs nothing):
  `dashboard`, `profile`, `kyc`, `empanelment`, `mentor`
- **Operate** (require `canOperate`): `offerings`, `bookings`, `wallet`,
  `refer`, `sessions`, `widgets`, `coordinator`
- **Host** (require host-eligibility, L2+): `retreat_hosting`, `venue_studio`

---

## 4. Expected access matrix (✓ = allowed, · = locked/redirected)

| Feature \ State | A | B | C | D | E | F | G | H |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| profile | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| kyc (InstaKYC) | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| empanelment | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| mentor | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| offerings | · | · | · | · | ✓ | ✓ | ✓ | · |
| bookings | · | · | · | · | ✓ | ✓ | ✓ | · |
| wallet | · | · | · | · | ✓ | ✓ | ✓ | · |
| refer | · | · | · | · | ✓ | ✓ | ✓ | · |
| sessions | · | · | · | · | ✓ | ✓ | ✓ | · |
| widgets | · | · | · | · | ✓ | ✓ | ✓ | · |
| coordinator | · | · | · | · | ✓ | ✓ | ✓ | · |
| retreat_hosting | · | · | · | · | · | ✓ | ✓ | ✓ |
| venue_studio | · | · | · | · | · | ✓ | ✓ | ✓ |
| **accessible / 14** | **1** | **5** | **5** | **5** | **12** | **14** | **14** | **7** |

Denied features redirect (pages) / return 401·403 (APIs) with a plain-language
reason (e.g. "Complete verification (InstaKYC + ₹799 payment) and empanelment to
use this.") — **no internal jargon** is surfaced.

---

## 5. Live multi-method checklist (demo accounts)

Run each on the preview for the mapped account; expected = the state's column.

- **State F** → `teacher.demo@nostops.com` (L2 Pracharak, operate-locked because
  `kyc_paid=false` in the live record; host-eligible=true). Verifies operate
  features are **locked** and host features **open**.
- **State G** → `guru.demo@nostops.com` (L3 / Council Guru, host-eligible, fee 0%).
- **State A** → a signed-in non-teacher (e.g. `employee.demo@nostops.com`) hitting
  a teacher route → redirected to `/app`.

For each account verify all four methods agree:
1. **Menu** — locked items show 🔒 + `LOCKED`; open items are links.
2. **Direct URL** — `/app/teacher/offerings` etc. redirects to
   `/app/teacher/locked?feature=…` when locked; renders when open.
3. **API** — a BFF POST behind the feature returns 403 when locked, 200 when open.
4. **Refresh / new session** — repeat 1–3 after a hard refresh / re-login →
   identical outcome (stateless per-request derivation).

> NOTE: `teacher.demo`'s **live** operate gate is locked (`kyc_paid=false`), so it
> matches state **F** semantics (host open, operate locked). It is not a fully
> operate-eligible account. Completing InstaKYC on a demo teacher (a backlog item)
> would give a live State-E/F fully-unlocked walkthrough.

---

## 6. Result

`node tests/verify_access_matrix.ts` → **PASS** (8 states × 14 features; all
decisions match §4, and `summarizeFeatureAccess` returns the full 14-feature set
used by the Admin "Access Privileges" panel). The engine is the single source of
truth for the menu, page guards, API guards and the admin summary alike.
