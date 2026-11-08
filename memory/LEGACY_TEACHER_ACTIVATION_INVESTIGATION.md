# Legacy Teacher Account Activation — Investigation (read-only)
Preview · main project. No accounts, tokens, invitations, profiles or records were created or changed.
The only calls made were GETs to the main backend's admin roster, public directory and OpenAPI. Personal contact data was analysed in memory only.
**[V]** = verified · **[U]** = must be confirmed with the main backend team.

## 1. The 32 legacy profiles [V]
- All 32 are main-backend teacher profiles with teacher ids `yoga_…`, imported from YOGAYUKT (`/api/admin/yogayukt/sync`, `migrate-from-yogayukt`). 30 carry `legacy_teacher_id` / `legacy_yogayukt_id`.
- All 32 have status `active` and all 32 are **listed** in the public directory (`/api/teachers/directory`).
- 0 are empanelled; 1 shows `kyc_verified`. None have `user_id`, so none have a login.

| Class | Count | Basis |
|---|---|---|
| Existing profile with usable registered contact details | **28** | unique, well-formed email on the profile, not shared with any other profile (phone mostly absent) |
| Requires contact verification | **2** | email looks like a placeholder, but a phone is present → verify via the existing phone OTP |
| Missing usable contact information | **1** | placeholder email and no phone (also shares a handle/name with another profile) |
| Potential duplicate teacher profile | **2** | the 1 above, plus 1 whose email **and** phone equal those of an account-linked teacher profile |
| Existing account found through another identifier | **1** | the same record: its contact details belong to an existing account-holder's **separate** teacher profile |
| Requires manual administrative review | **2** | the two potential duplicates |

**Answers to the required counts**
1. **Linkable automatically today using authoritative account information: 0.** No legacy profile has an account id. The single contact match points to a *different* teacher profile, so linking it would be a merge decision, not an automatic link.
2. **Require a profile claim: 30** (28 straight away; 2 after contact verification).
3. **Require manual verification: 2** (the potential duplicates; one also lacks contact details).

## 2. Existing mechanisms that can be reused [V from main OpenAPI + code]
- **Main-backend legacy claim flow (already built for exactly this case):**
  - `POST /api/admin/teachers/invite-yogayukt`: **dry-run by default**. With `?send=true` it creates single-use claim tokens and sends email + WhatsApp. Params: `source`, `limit`. "Eligible = teachers of source with no linked user account and not already claimed."
  - `GET /api/teachers/claim/{raw_token}`: validates the token and returns the pre-filled profile for review.
  - `POST /api/teachers/claim/{raw_token}` `{password}`: consumes the token, **creates the account, links the existing records** (existing teacher id kept) and returns a login session.
- **Accounts today:** `/api/auth/register`, `signup-by-role`, phone OTP (`/auth/otp/lookup|start|verify`; lookup returns only "exists + masked name hint"), password reset, personas. The website BFF wraps these (`app/bff/auth/{register,login,otp-start,otp-verify,reset-*}`).
- **Onboarding:** `POST /api/teachers/native-register` is an idempotent upsert ("already has a profile → UPDATE in place, never a duplicate") and keeps the teacher's handle. Teacher dashboard reads `/teachers/me/native-profile`, which returns `teacher_id` + `user_id`.
- **Not the same thing:** the website's `/claim` hub and `backend/discovery.py` (`/api/discovery/claim/{city}/{teacher}`) handle *scraped provisional* profiles, not these main-backend `yoga_` profiles.
- **Gap:** the website has **no page for `/teachers/claim/{token}`**, so an invitation link would currently have nowhere to land. **[U]** the exact link format the invite email/WhatsApp uses.
- **[U]** What `POST /teachers/claim/{token}` does when an account with the same email or phone already exists (link to that account, refuse, or create a second account). This must be confirmed before any invitation is sent.

## 3. Proposed activation lifecycle
`LEGACY_PROFILE → CLAIM_INVITATION → IDENTITY_VERIFICATION → ACCOUNT_LINKED → TEACHER_DASHBOARD_ENABLED → ACTIVE_PARTICIPATING_TEACHER`
- **LEGACY_PROFILE:** listed per its existing publication status; no login.
- **CLAIM_INVITATION:** an admin sends a single-use token via the main backend, to the profile's own registered contact only (in batches with `limit`, after a dry-run review).
- **IDENTITY_VERIFICATION:** holding the token proves control of the registered email/WhatsApp. For the 2 placeholder-email profiles, add a phone OTP step using the existing OTP endpoints. Duplicate/conflict cases are held for admin review and receive no token.
- **ACCOUNT_LINKED:** the main backend's claim endpoint creates the account and links `user_id` to the **existing** `teacher_id`. No new teacher record is created.
- **TEACHER_DASHBOARD_ENABLED:** first sign-in → the existing dashboard. Native-register upserts in place if they complete onboarding.
- **ACTIVE_PARTICIPATING_TEACHER:** the teacher has completed onboarding and accepted the participation terms. **Empanelment, ID verification and Verified-Teacher eligibility remain separate**: they are granted only by the existing empanelment and KYC workflows, and an account never implies them.

## 4. Directory states (kept distinct)
| State | Source of truth |
|---|---|
| Listed | main `teachers/directory` publication flags (unchanged) |
| Claimed | main profile has a linked `user_id` (claim consumed) |
| Authenticated | the teacher has signed in with that account |
| Active participating | onboarding complete + `is_active` + not suspended |
| Empanelled | main empanelment record |
| ID-verified | main KYC (`kyc_verified` / native-profile) |
| Verified Teacher eligible | `_match_eligible`: active + main status + empanelled + ID-verified (local mirror, refreshed from native-profile) |

## 5. Required changes (proposal)
- **Main backend [U, owned by the main backend team]:**
  - confirm the claim behaviour for existing accounts;
  - add a "hold" (no invite) for flagged duplicates;
  - make the dry-run report the duplicate/contact classification;
  - expose claim status (claimed or not, and when) on `/admin/people/teachers`.
- **Website (this project):**
  - new public page `/teachers/claim/[token]` plus BFF `GET/POST /bff/teachers/claim/[token]`, proxying the main endpoints: review the pre-filled profile, set a password, receive the session cookie, go to the dashboard;
  - an optional phone-OTP step reusing the existing OTP BFF;
  - admin page `/app/admin/legacy-teachers`: read-only classification, dry-run preview, and a send action with an explicit `limit` + confirmation;
  - preview isolation must remain: no sends from Preview.
- **Local mirror:** no change. Once claimed, the teacher's account id appears on the roster and the 8B.1.8 resolver (user_id → teacher_id) links them automatically.

## 6. Security and duplicate prevention
- Tokens are single-use, held by the main backend, and sent only to the profile's own registered contact. Never shown in admin UIs or logs.
- No invitation for profiles flagged as duplicate, conflicting or missing contact (manual review first).
- The claim never creates a second teacher record: the existing `teacher_id` is kept and the account is linked to it.
- If an account already exists with the same contact: link only after that account proves ownership (sign in or OTP), never automatically.
- No automatic empanelment, KYC or eligibility. Reviews, ratings, lineage, profile URLs and handles stay unchanged.
- Sends happen only in production, after explicit approval, in small batches. Preview never sends.
- Audit: invite sent, claim consumed and review decisions are logged by the main backend.

## 7. Roadmap (separately reviewable)
1. **L1:** main-backend confirmations (claim behaviour for existing accounts, the invite link format, hold flag). No code here.
2. **L2:** website claim landing page + BFF (Preview, tested with a main-backend sandbox token only, if available).
3. **L3:** admin legacy-teacher page: read-only classification + dry-run preview.
4. **L4:** manual review of the 2 duplicates and the 2 placeholder-email profiles (admin decisions).
5. **L5:** controlled invitations in production (batch of up to 5, then the rest), with monitoring of claims and support follow-up.
6. **L6:** onboarding completion nudges, then the normal empanelment/KYC path for those who want Verified Teacher status.
