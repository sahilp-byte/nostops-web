# NOSTOPS Teacher Discovery — Claim Journey & Two-Tier Profiles

Turn the teachers discovered from public Google listings into a clear, respectful claim journey: a search-hidden
"we found you" page they can claim, one findable "Claim your profile" hub, and a visible graduation from an
understated provisional look to the full verified NOSTOPS profile once they onboard and are empanelled.

## Who it's for
- **Discovered teachers** — people found via public listings who land on a provisional page, recognise it's
  them, and claim it to build a real profile.
- **NOSTOPS admins & city coordinators** — who review discovered teachers, share claim links, and help teachers
  get onboarded.

## How it works today (so the changes make sense)
- The platform already has **two kinds of profile pages**: verified public profiles at `/teachers/{name}`
  (search-visible, rich, full NOSTOPS brand hero + Empanelled/Verified badge), and **provisional claim pages**
  at `/teachers/in/{city}/{name}` (deliberately search-hidden, understated, "We found you" + claim + a Google
  attribution line).
- Provisional pages carry only **name + area** from the public listing — no phone, photos or reviews. That is a
  deliberate cost and terms-of-use choice and will stay that way.
- The confusion reported earlier comes from **duplicate city campaigns** (empty duplicates hide the real
  candidates) and from **"invite" not actually sending anything** — addressed below.

## Core features and experience (Phase 1)
1. **Three clearly different profile "tiers", by look:**
   - **Provisional (from a public listing)** — an understated, neutral hero (clearly *not* the brand hero),
     an "Unclaimed · from a public listing" label, the Google attribution line, and a prominent **Claim** call.
   - **Claimed, profile in progress** — a subtle "in progress" hero that signals ownership without implying
     verification.
   - **Verified & empanelled** — the full NOSTOPS brand hero with the Empanelled/Verified badge (as today). Once
     a claimed teacher's real profile is live, the provisional link **redirects** to their verified profile, so
     there is only ever one public home.
2. **One findable "Claim your teaching profile" hub (search-visible).** A single, generic page a teacher can
   reach from search or a shared link, where they **search their name/city**, find their provisional entry, and
   start the claim. The individual scraped pages stay **search-hidden**; only this hub and the claim funnel are
   indexed — protecting privacy, staying within Google's terms, and keeping the domain clean.
3. **"City coordinators near you" on the hub hero.** Top-right of the claim hub's hero, a short list of the
   coordinator(s) for/near the teacher's city, each contactable for help and more information — so a hesitant
   teacher always has a human to reach. Shows however many coordinators are available; if none are listed yet,
   it falls back to a simple "Talk to the NOSTOPS team" option.
4. **One campaign per city.** Existing duplicates are cleaned up (keeping the campaign that holds the real
   candidates); creating another campaign for a city reuses the existing one instead of duplicating it.
5. **Reliable, self-explaining candidate lists** for admins — Relevant / Rejected / All counts and plain-English
   empty states, plus **Open claim page** and **Copy claim link** on every teacher, and **invite tracking** with
   per-city invited/claimed progress. A short "How Discovery works" note explains the whole flow.

Not in Phase 1: automated or bulk emailing of discovered teachers, and page-level indexing of scraped profiles
(see Assumptions).

## User flow
- A discovered teacher hears about NOSTOPS (a shared link, a coordinator, or the indexable claim hub) →
  lands on the hub → **searches their name/city** → finds their provisional entry.
- Opens it → the understated **provisional page** ("We found you", name + area, Google attribution) → taps
  **Claim** → signs in or creates a free account → confirms it's them → the profile becomes theirs.
- They complete onboarding → KYC → Council empanelment → their page **graduates** to the full verified
  NOSTOPS profile, and the old provisional link now redirects there.
- Anywhere they hesitate, the **"coordinators near you"** block lets them contact a real person first.
- Admin side: open Teacher Discovery → one card per city → a city's candidates (clear counts) → **Open/Copy
  claim link** to view or share, and **mark invited** to track outreach as claims come in.

## UI/UX feel
Calm, dignified and honest. The provisional look is intentionally plainer than the brand hero so no one mistakes
an unclaimed listing for a verified NOSTOPS teacher; verification visibly "earns" the full brand treatment. Clear
labels, one obvious action per screen, no dead-ends, and a human (the coordinator) always within reach.

## Implementation phases
**Phase 1 — built now (the MVP):** the three-tier profile looks + graduation/redirect; the indexable "Claim your
profile" hub with name/city search; the "coordinators near you" block on the hub; one-campaign-per-city cleanup
and prevention; reliable candidate lists with Open/Copy claim link and invite tracking; the how-it-works note.

**Phase 2 — later:** a **consented, one-at-a-time email invite** (only for a teacher whose email + explicit
consent to be contacted are recorded — never bulk, never cold); a per-city outreach view (invited/claimed/
completed over time); assigning candidates to specific coordinators; richer coordinator contact (in-platform
messaging) instead of a simple contact action.

**Phase 3 — later:** smarter review (auto-hide obvious non-teachers, quick bulk approve/reject); onboarding
nudges for teachers who claimed but haven't finished; full funnel reporting/export; revisit whether any
page-level indexing is ever worthwhile once the network has a base of consented, verified profiles.

## Assumptions
- **Discovery entry point:** scraped provisional pages stay **search-hidden**; one **indexable claim hub** plus
  shareable links and coordinator outreach are the ways teachers find themselves. Page-level indexing of the
  Google-sourced pages is intentionally **not** built (consent, Google terms, and thin-content SEO risk).
- **Provisional data:** only **name + area** are shown; teachers add everything real (photo, lineage, styles,
  experience, contact) during claim/onboarding. No phone/website/photos are pulled from the listing.
- **Graduation:** provisional and verified profiles remain separate records; once the verified profile is
  published/empanelled, the provisional URL **redirects** to it (rather than one page literally changing).
- **Coordinators block:** shows the coordinator(s) available for the city from existing coordinator data; the
  contact action routes through NOSTOPS (personal phone/email are **not** exposed publicly). If no coordinator
  is listed for a city yet, a generic "Talk to the NOSTOPS team" option shows instead.
- **Invites:** delivered in Phase 1 as **copy/share link** + tracking; automated emailing of non-consenting
  discovered teachers is not built (cold outreach from a shared verified domain).
- The environment in use (production) has its own data separate from preview, which is why counts differ.
- No changes to discovery cost controls (request caps, auto-pause) or the Google search behaviour.
