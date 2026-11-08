# Stage 5 — Legacy Teacher Claim Page: Integration Gap Report (STOPPED BEFORE IMPLEMENTATION)
Main NOSTOPS website project · Preview. No code, routes or records were changed. No accounts, tokens, invitations or OTPs were created or sent.

The stage's instruction was: "If Stage 4 has not yet been completed or reviewed, or if the exact Stage 1–3 API contracts are unavailable, prepare an integration gap report and stop before implementing the affected integration." Every pathway depends on at least one contract that is unavailable, so implementation is stopped.

## 1. Audit performed (read-only)
- **Live main-backend OpenAPI** (`pro-learn-connect-1.emergent.host/openapi.json`, re-fetched today): 657 paths, compared with the repo snapshot `test_reports/p0/main_backend_openapi_snapshot.json` (648 paths).
  - The 9 new paths are unrelated: deferred-effects, onboarding-analytics, refund-reconcile and onboarding-draft.
- **Teacher-claim paths that exist:** only `GET` and `POST /api/teachers/claim/{raw_token}`. Their descriptions are unchanged from L1.
- **Website:**
  - auth and session: `lib/server/session.ts`, `lib/session-cookie.ts`, `app/bff/auth/{login,register,otp-start,otp-verify,…}`;
  - BFF pattern: `lib/server/bff.ts` `forward`/`badOrigin`, `preview-isolation.ts`;
  - public `/claim` is the Teacher Discovery provisional-profile hub (`backend/discovery.py`) and is unrelated;
  - there is **no** existing `/teachers/claim` route or component.
- **Project memory:** no Stage 1–4 backend contract documents exist here. Only L1 and L1b exist, and L1b is still awaiting the owner's answers.

## 2. Contract availability by stage
| Stage | Required for | Status in the live backend | Blocking? |
|---|---|---|---|
| **Stage 1:** non-consuming validation + new-account claim | page load, Pathway A | Endpoints **exist** (`GET`/`POST /api/teachers/claim/{raw_token}`, POST body `{password}`). **The 200 responses of both are undocumented** ("pre-filled profile", "login session"). Conflict behaviour (existing email/phone) is undocumented; only 422 is listed. 410 "Invalid or expired claim link" was observed | **Yes.** Rendering the profile, mapping already-used vs already-claimed states, and storing the session would all require guessing field names |
| **Stage 2:** authenticated linking of an existing account | Pathway B | **No endpoint exists** (no claim/link path accepting a bearer token) | **Yes** |
| **Stage 3:** claim-scoped phone OTP (masked phone, request, verify, single-use authorisation) | Pathway C, and Pathway A for placeholder emails | **No claim-scoped OTP endpoint exists.** General `/api/auth/otp/{lookup,start,verify}` take a **user-supplied** phone. Using them would violate "never allow the user to replace the stored phone number" and "display only the masked phone returned by the backend" | **Yes** |
| **Stage 4:** canonical invitation URL `https://www.nostops.org/teachers/claim/{token}` | the page must match the link that teachers receive | **Unconfirmed.** The link template isn't published; L1b questions are still open | **Yes**, for go-live (the page could exist, but no confirmed link would reach it) |

## 3. Exact information needed from the backend owner before implementation
1. **Stage 1 GET 200 body:** exact JSON fields (display name, photo URL, lineage, public credentials, public bio, claim state, any masked contact hints), plus how already-used and already-claimed are signalled (status code + `detail` code).
2. **Stage 1 POST:**
   - the exact 200 body, including the session field name, its type (bearer token like `/auth/login`?), expiry, and whether a `Set-Cookie` is also sent;
   - password policy and its error format;
   - the conflict response when the email or phone belongs to another account, with confirmation that the token is **not** consumed in that case.
3. **Stage 2:** the endpoint path and method, auth (bearer of the existing account), request body, response, ownership rule (verified email or phone must match), and errors.
4. **Stage 3:**
   - claim-scoped OTP request and verify endpoints that use the phone **stored on the profile**;
   - the response with the masked phone;
   - expiry and rate-limit error codes;
   - the single-use verification grant, and how it is passed to Stage 1 POST or Stage 2;
   - the manual-review response for missing, shared or ambiguous phones.
5. **Stage 4:** the confirmed link template and base URL.

## 4. What can be built without guessing (only if you approve; not done)
These parts are independent of the unknown response fields:
- **Route shell `/teachers/claim/[token]`:**
  - `noindex, nofollow`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store, private`;
  - analytics/GA excluded on this route; token scrubbed from error monitoring (`/teachers/claim/[redacted]`); `dynamic = 'force-dynamic'`; no prefetch of the route;
  - NOSTOPS-branded layout with the progress indicator.
- **Server-side GET validation** through a BFF that calls only `GET /api/teachers/claim/{raw_token}`, showing only:
  - the confirmed **invalid/expired (410)** state;
  - a **"service temporarily unavailable"** state for 5xx or timeouts, never "not found";
  - a neutral "Your invitation is valid. Claiming will open shortly." placeholder for 200, **without rendering any profile fields** until the schema is confirmed.
- **Tests:** GET-never-consumes (only GET is ever called on load or refresh), headers present, no analytics script, the token absent from logs, 410 and 5xx states, and `/claim`, login and registration unaffected.

The Pathway A submit, Pathway B linking and Pathway C OTP would be added only after section 3 is answered.

## 5. Confirmations
- No backend code, secrets or configuration were touched. No teacher records, accounts, tokens, invitations or OTPs were created, changed or sent.
- The existing `/claim`, login, registration and teacher dashboard are untouched. No deployment.

## 6. Readiness assessment
**Not ready to implement Stage 5.** Stage 2 and Stage 3 endpoints do not exist in the live backend. Stage 1's success responses and conflict behaviour are undocumented, and Stage 4 is unconfirmed. Implementation can begin as soon as the owner supplies the items in section 3. The section 4 shell could be built earlier with your approval.
