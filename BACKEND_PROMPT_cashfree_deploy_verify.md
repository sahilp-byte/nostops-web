# Backend prompt — deploy + verify Cashfree changes on the host the web app uses

Paste to your backend agent/team.

---

The NOSTOPS **web frontend talks to this exact backend host**:
`https://pro-learn-connect-1.emergent.host`

The 4 Cashfree tasks were reported "done", but on THIS host they are **not live / not behaving**.
Evidence (tested just now against `https://pro-learn-connect-1.emergent.host`):
- `POST /api/payments/cashfree/orders` still returns `"mode":"mock"` (not production).
- **KYC bridge NOT firing:** created a Cashfree order `{order_type:"instakyc", amount:799,
  customer_id:<teacher_id>, reference_id:<teacher_id>}`, completed it → `POST /api/kyc/sandbox/verify-payment`
  still returns `paid:false`.
- **Wallet top-up NOT firing:** `{order_type:"wallet_topup", amount:500, customer_id:<teacher_id>}`
  completed → `GET /api/teacher-wallet/balance` unchanged.
- **Booking create missing:** there is no `POST /api/one-on-one/bookings` in the OpenAPI.
- **Return URL:** `OrderCreateReq` has no `return_url` field, and `web_return_url` still uses the API host.

**Please make sure the 4 tasks are committed AND deployed to `https://pro-learn-connect-1.emergent.host`
(the exact host above — not a different/staging backend), then run the verification below and reply
with the results + the create-booking contract.**

## How to verify on the correct host (replace TOKEN with a teacher session bearer)
```bash
B=https://pro-learn-connect-1.emergent.host
T="<teacher bearer token>"

# 0) Env / return url
curl -s $B/openapi.json | python3 -c "import sys,json;d=json.load(sys.stdin);print('return_url field:', 'return_url' in d['components']['schemas']['OrderCreateReq']['properties'])"
curl -s -H "Authorization: Bearer $T" -X POST $B/api/payments/cashfree/orders -H 'Content-Type: application/json' \
  -d '{"amount":1,"order_type":"generic","customer_id":"X","customer_phone":"9999999999"}' | python3 -c "import sys,json;print('mode=',json.load(sys.stdin).get('mode'))"

# 1) KYC bridge  -> expect paid:true after completing an instakyc order
# 2) Wallet top-up -> expect balance_inr to increase by the amount after completing a wallet_topup order
# 3) Booking create -> expect this route to exist:
curl -s $B/openapi.json | python3 -c "import sys,json;d=json.load(sys.stdin);print('POST /api/one-on-one/bookings' , '/api/one-on-one/bookings' in d['paths'])"
```

## Acceptance to report back
1. `POST /api/payments/cashfree/orders` returns `mode:"production"` (or clearly non-mock) on this host.
2. A PAID Cashfree order with `order_type=instakyc` flips KYC `paid:true`
   (`/api/kyc/sandbox/verify-payment`).
3. A PAID Cashfree order with `order_type=wallet_topup` increases `/api/teacher-wallet/balance`
   and adds a `wallet_topup` transaction.
4. `POST /api/one-on-one/bookings` exists — reply with its **exact request/response**
   (fields, and how it links to `POST /api/v1/payments/orders` via `booking_id`), and confirm a PAID
   booking order flips the booking to CONFIRMED in `/api/one-on-one/my-bookings`.
5. `web_return_url` points to the WEB app origin (via `WEB_APP_BASE_URL`) OR create-order accepts an
   optional `return_url`.

Reply with: the 5 results above + the create-booking payload. Once confirmed on
`https://pro-learn-connect-1.emergent.host`, the web team will wire the pay buttons (a few lines per flow).
