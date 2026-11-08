# BACKEND REQUEST (P47 / Product Principle #4) — Remove the ₹500 minimum retreat price

**Severity:** P1 — directly violates a stated core product principle.
**Environment:** `https://pro-learn-connect-1.emergent.host`

## Finding (verified live, 2026-06)
`POST /api/retreats/create` rejects any `price_per_seat_inr < 500`:
```
POST /api/retreats/create  { ... "price_per_seat_inr": 100 }
→ 422 {"type":"greater_than_equal","loc":["body","price_per_seat_inr"],
       "msg":"Input should be greater than or equal to 500","ctx":{"ge":500}}
```
(Same for price = 1.)

## Why this must change
PROMPT 47's critical assertion and **Product Principle #4** state:
> "There is no NOSTOPS-imposed minimum retreat price."
> "NOSTOPS does not impose a minimum retreat price."

The `ge: 500` Pydantic constraint on `price_per_seat_inr` (create, and likely edit/PATCH) is exactly such an
imposed minimum. The Teacher must be free to set any price they choose (including donation-based / very low).

## Fix
- Remove the `ge=500` (and any equivalent `>= 500` service check) on `price_per_seat_inr` in the retreat
  create **and** edit/PATCH schemas.
- Keep only a sane floor of `>= 0` (or `>= 1` if a positive integer is required). Do **not** enforce any
  platform minimum above that.
- If a payment-provider technical minimum exists (e.g. gateway rejects < ₹1), handle it at the payment step,
  not as a NOSTOPS price rule, and surface it as a gateway limitation — not a NOSTOPS minimum.

## Verify after fix
```
POST /api/retreats/create { ..., price_per_seat_inr: 1 }   → 200 (created)
PATCH /api/retreats/{id}  { price_per_seat_inr: 50 }        → 200
```

## Frontend status
The web app already surfaces the backend's rejection gracefully and imposes **no** minimum of its own; once the
backend floor is removed, low prices will flow through end-to-end with no frontend change.
