# Public Teacher Profile Audit (Prompt 30)

Goal: every public status indicator on public teacher pages is derived from
**authoritative** backend data; no private administrative information is exposed.

## Scope audited
- `/teachers` — directory (`app/(public)/teachers/page.tsx`)
- `/teachers/[handle]` — individual profile (`app/(public)/teachers/[handle]/page.tsx`)
- Related public surfaces: home hero, `/discover`, booking-invite mini-cards, JSON-LD.

## Policy (single source of truth)
Centralized in `lib/public-teacher.ts`:
- `isTeacherActivePublic` — has handle, `public_profile_visible !== false`,
  `is_active !== false`, not `suspended_at`.
- `isVerifiedAndEmpanelled` — `is_empanelled === true` AND
  (`is_verified === true` OR empanelled) — Empanelled ⇒ Verified (foundational rule).
- `isPubliclyListable` = both of the above.

Both the directory and the profile page now import this one gate, so a card can
never link to a page that 404s, and a public "Verified"/"Empanelled" claim always
corresponds to the authoritative record.

## Findings & fixes

### 1. Directory listed non-empanelled teachers (FIXED)
- **Before:** `/teachers` filtered only on active/visible/not-suspended, so it could
  list teachers who were not Verified + Empanelled — while `/teachers/[handle]`
  404s for exactly those teachers. Result: cards linking to 404s and a public
  "Verified" badge shown for a teacher whose profile isn't public.
- **After:** directory uses `isPubliclyListable` — identical to the profile gate.

### 2. Profile header badges were unconditional (HARDENED)
- **Before:** the `Empanelled` and `Verified` header pills were hardcoded (safe only
  because the page 404s for non-qualifying teachers).
- **After:** each pill renders only when `p.isEmpanelled` / `p.isVerified`
  (authoritative), so the indicator is explicitly data-driven and cannot drift.

### 3. Authoritative sources confirmed (NO CHANGE NEEDED)
- `isVerified` ← `is_verified` (|| `is_empanelled`); `isEmpanelled` ← `is_empanelled`;
  `badges`/`badgePrimary` ← backend `badges`/`badge_primary`; `tier` ← backend `tier`.
- **Teacher Level policy:** the public profile intentionally does **not** surface the
  internal L1/L2/L3 number. Public recognition is expressed via the authoritative
  backend-issued badges (e.g. a "Council Guru" badge) and the Empanelled/Verified
  pills. `tier` is captured but not rendered as a raw "Level N" label — consistent
  with the intended public-profile policy of showing credibility, not internal rank.
- Rating/reviews render only when `> 0`; stats render only when present (no invented data).

### 5. Directory "Verified" pill inconsistent with profile (FIXED)
- **Before:** the directory derived `isVerified` from `is_verified` only, so an
  empanelled teacher with `is_verified=false` (e.g. "Demo User") showed **Empanelled**
  but not **Verified** on the card — yet their profile page shows both (it applies
  Empanelled ⇒ Verified). Inconsistent public claim across two pages.
- **After:** the directory derives `isVerified = is_verified || is_empanelled`,
  matching the profile page and the foundational rule; because every listed teacher
  is now empanelled, the Verified pill is authoritative and consistent everywhere.

### 4. No private/admin data exposed (VERIFIED)
`toPublicProfile` / `toPublicTeacher` project a public-safe shape and **drop**:
email, phone, whatsapp, KYC (`kyc_*`), PAN, bank/payout, `user_id`, geo, internal
verification reasons, `canOperate` and all admin flags. The empanelment certificate
(cert id, reviewer/co-signer names, issue date) is intended public credibility
information, not private admin data.

## Result
Public status indicators are authoritative and consistent across the directory and
profile pages; the directory ↔ profile gate can no longer diverge; no private
administrative information is exposed.
