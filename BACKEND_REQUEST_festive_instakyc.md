# BACKEND REQUEST — Festive Complimentary InstaKYC: settle the KYC fee at ₹0

**Campaign:** NOSTOPS_FESTIVE_INSTA_KYC_2026 (1 Nov 2026 00:00 IST – 31 Dec 2026 23:59:59 IST)
**Owner:** main NOSTOPS app (pro-learn-connect-1). The website cannot change this code.

## Why this is needed
The website's backend (`backend/festive_kyc.py`) now decides eligibility, records the one-time claim
(₹0, audit trail) and blocks every InstaKYC Cashfree order for eligible or claimed teachers.
But the main app refuses verification until **its own** `kyc_paid` flag is true:

```
POST /api/kyc/sandbox/aadhaar/otp  →  400 "KYC payment required. Please complete the ₹1 InstaKYC fee before starting verification."
```

So a claimed teacher cannot start Aadhaar/PAN/Bank verification until the main app accepts the waiver.

## The one change requested (smallest possible)
`POST /api/kyc/promo-waiver`. The caller is the website server only and must send the `X-Pulse-Secret` header (the same shared secret).

Request body:
```json
{ "user_id": "user_…", "teacher_id": "tn_…", "campaign_id": "NOSTOPS_FESTIVE_INSTA_KYC_2026", "claim_id": "KYCW-…" }
```

Behaviour:
1. Sets these fields on the teacher/KYC record:
   - `kyc_paid = true`
   - `kyc_paid_at = now`
   - `kyc_payment_id = "promo:<claim_id>"`
   - `kyc_paid_amount_inr = 0`
   - `kyc_promo_campaign_id = <campaign_id>`
2. Must not touch `kyc_verified`, admin review, approve/reject, or any document requirement. The fee is waived, not the verification.
3. Idempotent: the same `claim_id` gives the same result, and it is a no-op if the teacher is already paid.
4. Creates no payment order and calls no gateway (Cashfree, Razorpay, PayPal).
5. Responds with `{ "ok": true, "kyc_paid": true, "kyc_payment_id": "promo:KYCW-…" }`.

Optional: `GET /api/kyc/pricing?user_id=…` could return `amount_inr: 0` for promo-paid users. The website already shows ₹0 from its own engine.

## Once shipped (website side, ~1 small change)
After a successful claim, the website calls `/api/kyc/promo-waiver` and sets `main_app_fee_settled=true` on the claim record (field already exists).
EOF