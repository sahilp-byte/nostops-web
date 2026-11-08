# Legacy Teacher Activation — L1b: Backend Owner Confirmation
Status: **AWAITING THE BACKEND OWNER'S WRITTEN ANSWERS.** I cannot contact the owner or read the main backend's source code. The main backend is a separate, frozen service (`pro-learn-connect-1.emergent.host`) whose code is not in this workspace.

I re-checked every available source:
- the live OpenAPI spec, including all claim, invite and OTP schemas and a full-text search for expiry, 409, duplicate, claim URL and base-URL settings;
- the two OpenAPI snapshots in this repo;
- the project memory and PRD;
- the single non-consuming invalid-token GET.

No accounts, tokens, invitations or record changes were made.

Legend: **CONFIRMED** = stated in the published spec or observed · **PENDING** = needs the owner's written answer · **REQUIRED CHANGE** = needed if the answer is not as required.

## 1. Existing-account conflict
| Question | Answer |
|---|---|
| Does the claim reject the claim if the email or mobile belongs to another account? | **PENDING.** The spec says only "create the teacher's account, link their records". No 409 or conflict response is documented for `POST /api/teachers/claim/{raw_token}`; the only documented codes are 200 and 422 |
| Can an existing account be linked after its owner authenticates? | **PENDING.** No documented endpoint links a claim to an already signed-in account. `CompleteClaimReq` has only `password`, and the claim endpoint takes no bearer token |
| Can a second account be created? | **PENDING (risk).** Nothing in the spec rules it out |
| What response is returned? | **PENDING.** The 200 body is undocumented and there is no conflict code |

**REQUIRED CHANGE, if the owner confirms the current behaviour differs:**
- Before creating an account, `POST /teachers/claim/{token}` must check whether the profile's email or phone already belongs to an existing user.
- If it does, return **409** `{detail:{code:"account_exists", login_hint:"masked"}}` without consuming the token.
- Provide an authenticated `POST /teachers/claim/{token}/link` (bearer of that existing account) that links only if the signed-in account's verified email or phone matches the profile.
- No silent linking and no second account.
- **Authorisation:** the main backend owner (the owner of the frozen main NOSTOPS FastAPI / `pro-learn-connect-1` deployment), plus your sign-off as product owner.

## 2. Invitation URL
| Question | Answer |
|---|---|
| Can the generator produce `https://www.nostops.org/teachers/claim/{token}`? | **PENDING.** The link template and base-URL setting are not exposed in the spec. The only confirmed fact is that the API takes the token as a path segment (`/api/teachers/claim/{raw_token}`) |
| Where does it point today? | **PENDING** |

**REQUIRED CHANGE, if it points elsewhere:** set the invite link base to `https://www.nostops.org` and the path to `/teachers/claim/{token}`. This is a configuration setting or a small template change in `invite-yogayukt`. **Authorisation:** the main backend owner.

## 3. Additional confirmations
| Item | Status |
|---|---|
| Token expiry duration | **PENDING.** Expiry exists (an unknown token returns **410 "Invalid or expired claim link"**, CONFIRMED live), but the duration is not published |
| Invalidated after a successful claim | **CONFIRMED by the spec text** ("consume the (single-use) claim token"). The response on reuse (410 expected) is **PENDING** |
| Contact details used for email and WhatsApp | **PENDING.** The spec says "dispatch email + WhatsApp" without naming the source fields |
| Phone verification for placeholder-email profiles | **PENDING.** The claim flow has no OTP step in the spec. General OTP endpoints exist (`/auth/otp/lookup|start|verify`), but nothing ties them to a claim. **REQUIRED CHANGE (if wanted):** claim-time OTP for profiles flagged `placeholder_email`, or hold those profiles for manual review |
| Original teacher ID preserved | **PENDING** ("link their records" suggests it, but it is not stated) |
| Public profile URL, handle, credentials, reviews, ratings, lineage unchanged | **PENDING** |
| Exact 200 response for `GET` / `POST /teachers/claim/{token}` | **PENDING.** Both are undocumented in the spec; GET returns "the pre-filled profile" and POST returns "a login session" |
| Website session handling | **PENDING** the POST response shape. Expected: a session token in the body, which the website BFF stores in the existing httpOnly `nostops_session` cookie exactly as `bff/auth/login` does. To confirm: the field name, expiry, and whether a `Set-Cookie` is also sent |
| Invitation preview sends nothing | **CONFIRMED by the spec text** (`send=false` default) |
| Already-claimed or account-linked profiles are not re-invited | **CONFIRMED by the spec text** |

## 4. Questions to send to the backend owner (copy as-is)
1. When `POST /api/teachers/claim/{token}` runs and the profile's email or phone already belongs to another user: does it reject, link, or create a second account? What status code and body does it return? Is the token kept or consumed?
2. Is there, or can there be, an authenticated way for that existing account to link the profile after signing in (ownership proven), with no silent linking?
3. What exact link does `invite-yogayukt?send=true` put in the email and WhatsApp? Can it be set to `https://www.nostops.org/teachers/claim/{token}`, and is that a config setting or a code change?
4. What is the token expiry, its length and character set, and what is returned when a used token is reused?
5. Which profile fields supply the email address and WhatsApp number?
6. Is claim-time phone OTP supported? If not, will you add it, or should placeholder-email profiles be held?
7. After a claim, are `teacher_id`, handle, profile URL, credentials, empanelment, KYC, reviews, ratings and lineage unchanged?
8. What are the exact 200 JSON bodies of the GET and POST claim endpoints, including how the session is returned (body field vs Set-Cookie) and its lifetime?
9. Can a "hold / do-not-invite" flag be set per teacher so the 2 suspected duplicates are skipped by `invite-yogayukt`?

## 5. Gate
- **L2 (claim page) should not start** until answers 1, 3 and 8 are received in writing.
- **L3 (admin dry-run page)** depends only on the preview mode, which is confirmed. It could proceed independently if you approve it.
