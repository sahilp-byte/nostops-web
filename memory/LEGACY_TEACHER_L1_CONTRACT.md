# Legacy Teacher Activation — L1: Main Backend Contract Confirmation
Read-only. No accounts, tokens or invitations were created, and no records changed.
Sources:
- the live main-backend OpenAPI (`pro-learn-connect-1.emergent.host/openapi.json`), plus the repo snapshots `backend/tests/fixtures/main_backend_openapi_2026-10.json` and `test_reports/p0/main_backend_openapi_snapshot.json` (identical descriptions);
- one non-consuming GET with a deliberately invalid token.

The main backend's **source code is not in this workspace**: it is the remote, frozen FastAPI service (`PRD.md` l.1577: "Remote FastAPI frozen"). So anything the spec doesn't state is marked **PENDING CONFIRMATION**. Nothing has been assumed.

## 1. Confirmed API contract (exactly as published)
| # | Endpoint | Auth (spec) | Request | Response (spec) | Confirmed behaviour |
|---|---|---|---|---|---|
| 1 | `POST /api/admin/teachers/invite-yogayukt` | not declared in the spec. `/admin/*` is admin-guarded at the gateway (`backend/admin_gate.py`, B4.7: admin endpoints return 403 for non-admins) | query `send: bool = false`, `source: str = "yogayukt"`, `limit: int = 0`; no body | 200 schema **undocumented**; 422 validation error | Description: "DRY-RUN by default (lists eligible recipients, sends nothing). Pass `?send=true` to actually create tokens and dispatch email + WhatsApp. `limit` (>0) caps how many are processed. Eligible = teachers of `source` with no linked user account and not already claimed." |
| 2 | `GET /api/teachers/claim/{raw_token}` | public | path `raw_token` | 200 schema **undocumented** ("pre-filled profile"); 422; **observed: 410 `{"detail":"Invalid or expired claim link"}`** for an unknown token | "validate a claim token and return the pre-filled profile so the teacher can review it before setting a password" |
| 3 | `POST /api/teachers/claim/{raw_token}` | public | body `CompleteClaimReq {password: string}` (required) | 200 schema **undocumented** ("return a login session"); 422 | "consume the (single-use) claim token, create the teacher's account, link their records, and return a login session" |
| 4 | `POST /api/auth/otp/lookup` | public | `{phone}` | 200 undocumented | "only returns whether the phone exists + a partially-masked name hint, plus a flag indicating if persona attachment will be needed" |
| 5 | `POST /api/auth/otp/start` | public | `{phone (req), purpose, channel?}` | 200 undocumented | — |
| 6 | `POST /api/auth/otp/verify` | public | `{phone (req), code (req), purpose, name?, email?, role?, coordinator_type?}` | 200 undocumented | — |
| 7 | `POST /api/auth/login` | public | `{email, password}` | 200 undocumented | Used by the website BFF (`app/bff/auth/login`), which sets the httpOnly `nostops_session` cookie |
| 8 | `GET /api/auth/me`, `GET /api/teachers/me/native-profile` | bearer | — | `me`: user_id, role, teacher_handle…; native-profile: teacher_id, user_id, handle… **[V]** | Dashboard identity |
| 9 | `GET /api/admin/yogayukt/sync-status` | admin | — | undocumented | Latest sync log + YOGAYUKT teacher count |

There is **no separate endpoint** for generating tokens or delivering invitations. Both happen inside (1) with `send=true`. The claim flow has no OTP step; OTP is a separate, general auth flow.

## 2. Exact invitation URL format: **PENDING CONFIRMATION (B)**
- The spec does not state the link that the email/WhatsApp contains. The only confirmed fact is that the token is a **path parameter** of the API (`/api/teachers/claim/{raw_token}`).
- Which web host and path the message links to (e.g. `https://www.nostops.org/teachers/claim/{token}`, or a link to the old app) is not published.
- **Needed from the backend owner:** the exact template and the base URL setting, the token's length and character set, and whether a query string or fragment is used.

## 3. Account-conflict questions
- **A. Email or mobile already belongs to another account: PENDING CONFIRMATION.**
  - The spec says only "create the teacher's account, link their records".
  - It does not say whether an existing account is reused, the claim is refused (e.g. 409), or a second account is created.
  - It also doesn't say whether the profile's email becomes the login email.
  - Needed: behaviour and status code for (i) the email exists, (ii) the phone exists, (iii) both exist on different accounts.
- **B. Invitation URL format: PENDING CONFIRMATION** (see §2).

## 4. Safeguards: what is confirmed vs pending
| Safeguard | Status |
|---|---|
| Tokens single-use | **Confirmed by spec text** ("consume the (single-use) claim token") |
| Expiry enforced | **Partially:** an invalid token returns 410 "Invalid or expired claim link", so expiry exists. The expiry period is **pending** |
| No reuse after a successful claim | Implied by single-use. The response code on reuse (expected 410) is **pending** |
| Invitations sent only to the profile's own contacts | **Pending.** The spec says "dispatch email + WhatsApp" without naming the source of the address |
| Claim cannot create a duplicate teacher profile | **Pending.** "link their records" suggests the existing teacher_id is reused, but that isn't stated |
| Teacher ID and profile URL unchanged | **Pending** (expected, not stated) |
| Existing-account ownership proven before linking | **Pending** (part of question A) |
| Preview mode sends nothing | **Confirmed by spec text** (`send=false` is the default) |
| Re-invite of already-claimed profiles | Confirmed excluded ("not already claimed") |
| GET does not consume the token | **Confirmed by spec text** (GET = "validate … review"; POST = "consume") |

## 5. Reusable without modification
- Endpoints (1)–(3) for the whole invite → review → claim → session cycle, and (7)/(8) for session and dashboard.
- Website session handling: `lib/server/session.ts` and `lib/session-cookie.ts` (httpOnly `nostops_session`, CSRF double-submit `nostops_csrf` / `x-csrf-token`), `lib/server/bff.ts` `forward()` / `badOrigin()`, `preview-isolation.ts` (Preview never POSTs to the live backend).
- The existing teacher dashboard (`/app/teacher…`) and onboarding (`native-register` upsert).

## 6. Website components to develop (L2/L3; none built yet)
1. **Page `/teachers/claim/[token]`** (server component, `dynamic = 'force-dynamic'`):
   - calls the BFF read on the server, so the token never reaches client-side analytics;
   - shows the pre-filled profile read-only, plus a password + confirm form, terms acknowledgement and a submit button;
   - states for invalid/expired (410), already claimed, pending, and unavailable.
2. **BFF `GET /bff/teachers/claim/[token]`** → main GET (2). Read-only, never consumes the token, response `Cache-Control: no-store`.
3. **BFF `POST /bff/teachers/claim/[token]`:**
   - CSRF-protected (`badOrigin`) and rate-limited;
   - forwards only `{password}` to main POST (3);
   - on 200 sets the session cookie the same way as `bff/auth/login` and redirects to `/app/teacher`.
4. **Admin page `/app/admin/legacy-teachers` (L3):** read-only classification of the 32, plus a **dry-run preview** via (1) with `send=false`. The send action stays disabled until separately approved, and is always blocked in Preview.
5. The website must **not** create accounts or teacher profiles itself; it only proxies (2)/(3).

## 7. Backend changes genuinely required
- **None for the basic flow**, as far as the spec shows.
- Possibly required, **depending on the answers to A and B**:
  - **(a)** a refusal or ownership-proof path when an account already exists (if today it creates a second account);
  - **(b)** an invitation link pointing to the website path in §6.1;
  - **(c)** a "hold" flag so the 2 duplicate-suspect profiles are skipped by `invite-yogayukt`;
  - **(d)** a documented 200 response schema for (2) and (3).
- The main backend is frozen, so any of these needs its owner.

## 8. Security and error handling (website)
- **Token protection:**
  - pages and BFF send `Cache-Control: no-store, private` and `Referrer-Policy: no-referrer` (route-level header);
  - no GA or third-party script runs on `/teachers/claim/*` (skip analytics on that route), and the page is `noindex`;
  - the token is never logged: BFF errors log only the route, not the path; the error monitor scrubs `/teachers/claim/<token>` to `/teachers/claim/[redacted]`;
  - the token is never put in query strings, links or client-side storage.
- **GET never consumes:** the page render and BFF GET only call main GET (2). Consumption happens only through the CSRF-protected POST after an explicit submit, and the button is disabled while the request is in flight.
- **Errors:**
  - 410 → "This claim link is invalid or has expired. Ask NOSTOPS support for a new one."
  - 422 → password guidance.
  - 409 (if confirmed) → "An account already uses these details. Sign in to link your profile."
  - 5xx or timeout → "Try again", with nothing consumed on the website side.
- **Preview:** POSTs are blocked by preview isolation, so a real claim cannot happen from Preview. L2 testing uses an invalid token (410 path) plus a stubbed backend.
- **Status:** an account never implies empanelment, KYC or eligibility. Those still come only from the main backend's existing workflows.

## 9. Proposed sequence
- **L1b (owner action):** get written answers to A and B, the token expiry period, the GET/POST 200 response fields, and the delivery-address source. Decide on backend changes (a)–(d).
- **L2:**
  - claim page + BFF GET/POST + token-hygiene headers + analytics exclusion + error states;
  - tests: GET-never-consumes (mock), CSRF refusal, no-store/referrer headers, 410/422/409/5xx mapping, no token in logs or analytics, Preview blocks POST.
- **L3:** admin legacy-teacher page with read-only classification + dry-run preview (`send=false` only). Sending stays out of scope until a separate production approval.
