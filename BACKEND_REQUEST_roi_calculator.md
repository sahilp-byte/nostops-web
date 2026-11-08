# Backend Change Request — Organisation ROI Calculator: new 18-batch / layered-discount / teacher-first model

**Endpoint:** `GET /api/corporate/roi-calculator?employees={n}&months={3|6|12}`
**Environment:** `https://pro-learn-connect-1.emergent.host` (live FastAPI backend)
**Consumers (read-only, frontend):**
- In-app calculator — `components/app/org/RoiCalculator.tsx` (via BFF `GET /bff/org/roi`)
- Public org landings — `components/public/OrgLanding.tsx` (`/for-companies`, `/for-educational-institutions`, `/for-startup-networks`)
**Severity:** P2 — marketing pages + in-app calculator advertise a model the backend does not yet compute (numbers disagree).

---

## 1. Why this change

The **frontend is the current source of truth** for the intended business model (it hard-codes the numbers below because the backend does not yet return them). The backend `/corporate/roi-calculator` still returns the **old** model:

| Field | Backend returns TODAY | Should return (NEW model) |
|---|---|---|
| `program_structure.batch_size` | **40** | **18** |
| `investment.per_member_monthly` | ₹5,000 | ₹3,667 (list, pre-discount) |
| `investment.per_session` | ₹417 | ₹306 (list) → discounted per tier |
| `investment.per_member_total` (3-mo) | ₹30,000 | ₹11,000 (list) → discounted per tier |
| `revenue_sharing.model` | flat **"60-40"** | **term-based 70 / 80 / 90** (see §4) |
| Group discounts | **none** | **layered by group size × commitment** (see §3) |

**Goal:** make the endpoint compute and return the 18-person-batch, layered-discount, teacher-first model so the calculator and all three org landings agree with one authoritative source.

---

## 2. Base unit economics (list price, before any discount)

Fixed constants (confirmed from the frontend source of truth — `OrgLanding.tsx` lines 44–49):

```
BATCH_SIZE                 = 18      # people per batch  → this is the "18-batch" model
SESSIONS_PER_WEEK          = 3
SESSIONS_PER_MONTH         = 12      # 3/week × 4 weeks
SESSION_DURATION           = "60 min"
LIST_PRICE_PER_MEMBER_MONTH = 3667   # ₹ / person / month (list, pre-discount)
```

Derived (list, pre-discount) — must reconcile to these rounded targets:

```
list_per_session          = LIST_PRICE_PER_MEMBER_MONTH / SESSIONS_PER_MONTH   = 3667/12  ≈ ₹306
list_per_member_total     = LIST_PRICE_PER_MEMBER_MONTH × months               = 3667×3   ≈ ₹11,000  (3-mo)
list_batch_total_3m       = LIST_PRICE_PER_MEMBER_MONTH × BATCH_SIZE × 3        = 3667×18×3 ≈ ₹198,000
total_sessions            = SESSIONS_PER_MONTH × months                        = 12×months
num_batches               = ceil(employees / BATCH_SIZE)
```

Rounding: round every rupee output to the nearest whole ₹ (`round()`), never below 0.

---

## 3. Layered group-discount matrix (the core new logic)

Discount is a function of **total enrolled group size** (`employees`) **and** the **commitment term** (`months`). Bigger group **and** longer commitment ⇒ deeper discount. (Frontend `GROUP_DISCOUNT_TIERS`, `OrgLanding.tsx` lines 28–31.)

| Tier | Group size (employees) | 3-month | 6-month | 12-month |
|---|---|---|---|---|
| — (Pilot minimum) | < 18 | 0% | 0% | 0% |
| **Tier 1** | 18 – 28 | **10%** | **12.5%** | **15%** |
| **Tier 2** | 29 – 40 | **20%** | **25%** | **30%** |
| **Tier 3 (enterprise)** | 41+ | ⚠️ **NOT YET DEFINED — see Open Questions** | | |

- The discount is applied to the **participant/list price** BEFORE the revenue split.
- `discount_pct` = value from the matrix for `(tier(employees), months)`.
- `discounted_per_member_total = round(list_per_member_total × (1 − discount_pct))`
- `discounted_per_member_month = round(discounted_per_member_total / months)`
- `discounted_per_session      = round(discounted_per_member_total / total_sessions)`
- `total_investment (collected) = round(discounted_per_member_total × employees)`
- `savings_total = list_per_member_total × employees − total_investment`

**Worked example (must match the public page, `OrgLanding.tsx` lines 180–187):** a **40-person group, 3 months** → Tier 2, 20% off → per-person 3-mo drops ₹11,000 → **₹8,800**, per-session ₹306 → **₹244.8**. Extending to 6 months deepens to 25%.

---

## 4. Teacher-first revenue share (term-based, protected)

Teacher share **percentage** grows with commitment and is **never reduced to fund a group discount** (frontend `REVENUE`, `OrgLanding.tsx` lines 20–24, and the "Teacher-first by design" note lines 191–200):

| Commitment | Teacher % | Platform & ops % | `model` string |
|---|---|---|---|
| 3-month pilot | **70** | 30 | `"70-30"` |
| 6-month engagement | **80** | 20 | `"80-20"` |
| 12-month partnership | **85** | 15 | `"85-15"` |

- Split is computed on the **collected (discounted) revenue**, i.e. `total_investment` from §3:
  - `teacher_share_total  = round(total_investment × teacher_pct/100)`
  - `platform_share_total = total_investment − teacher_share_total`
- **Teacher-first guardrail:** the group discount reduces the **platform's** proportional take, never the teacher's percentage. The teacher's % only ever *increases* with term (70 → 80 → 85). The platform absorbs the discount out of its shrinking 30/20/15% share. (Do not let any discount logic lower `teacher_pct` below the term value above.)

---

## 5. Requested response schema

Extend the existing shape (keep all current keys so `RoiCalculator.tsx` keeps working; add the new discount keys). Example for `employees=40&months=6`:

```jsonc
{
  "program_structure": {
    "phase": "Phase I: Structured Programme",
    "batch_size": 18,                       // CHANGED 40 → 18
    "sessions_per_week": 3,
    "sessions_per_month": 12,
    "session_duration": "60 min",
    "total_sessions": 72,                   // 12 × months
    "includes": [ /* unchanged list */ ]
  },
  "investment": {
    "employees": 40,
    "num_batches": 3,                       // ceil(40/18)
    "duration_months": 6,

    // list (pre-discount)
    "list_per_member_monthly": 3667,
    "list_per_member_total": 22000,         // 3667 × 6 (rounded)
    "list_total_investment": 880000,        // 22000 × 40

    // discount
    "discount_tier": "Tier 2",
    "discount_pct": 25.0,

    // discounted (what the org actually pays / what we collect)
    "per_member_monthly": 2750,             // 16500 / 6
    "per_session": 229,                     // 16500 / 72
    "per_member_total": 16500,              // 22000 × 0.75
    "total_investment": 660000,             // 16500 × 40
    "total_monthly_cost": 110000,           // 660000 / 6
    "savings_total": 220000                 // 880000 − 660000
  },
  "revenue_sharing": {
    "model": "80-20",                       // term-based, CHANGED from flat 60-40
    "teacher_pct": 80.0,
    "platform_pct": 20.0,
    "teacher_share_total": 528000,          // 660000 × 0.80
    "platform_share_total": 132000
  }
}
```

Note: the frontend currently reads `investment.num_batches`, `per_member_monthly`, `per_session`, `per_member_total`, `total_investment`, `total_monthly_cost` and `revenue_sharing.{model,teacher_share_total,platform_share_total}`. Returning the **discounted** values in those existing keys (and adding `list_*` + `discount_*` + `savings_total`) is fully backward compatible — no frontend change is required to see correct numbers, and we will additionally surface the savings/tier once these are present.

---

## 6. Verification cases (post-fix)

```
GET /corporate/roi-calculator?employees=18&months=3
  → batch_size=18, num_batches=1, discount_tier="Tier 1", discount_pct=10
  → per_member_total=9900, per_session=275, total_investment=178200, savings_total=19800
  → model="70-30", teacher_share_total=124740, platform_share_total=53460

GET /corporate/roi-calculator?employees=40&months=3
  → discount_tier="Tier 2", discount_pct=20
  → per_member_total=8800, per_session≈245   (public "worked example" ₹8,800 / ₹244.8)

GET /corporate/roi-calculator?employees=40&months=6
  → discount_tier="Tier 2", discount_pct=25
  → per_member_total=16500, per_session=229, total_investment=660000, savings_total=220000
  → model="80-20", teacher_share_total=528000, platform_share_total=132000

GET /corporate/roi-calculator?employees=100&months=12
  → num_batches=ceil(100/18)=6, term=12mo teacher 85% / platform 15%
  → (Tier 3 discount pending — see Open Questions)
```

Guardrail assertions:
- `batch_size == 18` on every response.
- `teacher_pct ∈ {70, 80, 85}` by term and never lower than the term value regardless of discount.
- `list_total_investment ≥ total_investment` and `savings_total == list_total_investment − total_investment`.
- All rupee fields are non-negative integers.

---

## 7. Open questions (need business owner confirmation before coding Tier 3)

1. **Tier 3 (41+ employees):** the frontend only defines Tiers 1–2 (up to 40). What are the 41+ discounts for 3 / 6 / 12 months? (Suggest ≥ Tier 2 so larger groups never pay a higher per-head rate — e.g. 25% / 30% / 35% — **please confirm**, do not ship a guessed number.) Until confirmed, cap at Tier 2's rates for 41+ and flag `discount_tier: "Tier 2 (capped — enterprise pricing on request)"`.
2. **Discount granularity:** confirm discount is on the **participant list price** (as modelled here), not on the teacher payout. (Frontend worked example confirms participant price.)
3. **Rounding:** confirm round-to-nearest-rupee (vs floor). Frontend targets (₹11,000 / ₹306 / ₹198,000) are consistent with nearest-rupee rounding of ₹3,667/mo.
4. **`num_batches` vs discount:** confirm the discount keys on **total enrolled `employees`** (group size), independent of internal batch count. (This spec assumes yes.)

---

## 8. Note for the backend team
Do **not** change the frontend to "fix" the numbers — the frontend already renders the intended model and treats the backend as authoritative for money math. The correction must live in the `/corporate/roi-calculator` service so the calculator, all org landing pages, and any downstream invoicing/settlement all derive from one source.
