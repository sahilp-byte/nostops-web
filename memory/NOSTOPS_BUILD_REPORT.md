# NOSTOPS — Build Report (for prompt authoring)
Status as of June 2026. Everything below runs on the **Preview** environment and has **not been published** to production.

## 1. Platform and stack
- **Website:** Next.js App Router (`/app/frontend`). It also serves as the BFF (server routes under `/bff/*`).
- **Backend:** FastAPI (`/app/backend`).
  - Proxies business logic to the existing live NOSTOPS backend.
  - Also hosts local engines for venues, Spaces, nominations and similar features.
- **Database:** MongoDB.
- **Preview isolation:** in Preview, writes to the live business backend are refused (HTTP 423). Writes to the local engines (Venues ownership, Spaces) do work in Preview.
- **Personas:**
  - Yoga Seeker (learner)
  - Yoga Teacher (L1/L2/L3)
  - Council of Gurus
  - Organisation (HR)
  - Admin
- **Two separate venue products:**
  - **Global Venues:** destinations, retreats and international listings (`/venues/*`). Live.
  - **NOSTOPS Spaces:** India-only, PIN-code-based neighbourhood spaces (`/spaces/*`). Spaces rules never apply to Global Venues.

## 2. Phase status (NOSTOPS Spaces 9-phase plan)
| Phase | Scope | Status |
|---|---|---|
| 0 | Architecture audit | ✅ Done |
| 1 | Global Venue ownership: claim → admin approval → owner editing | ✅ Done |
| 1b | Remove revenue-share / payout fields from Spaces flows | ⬜ Not started |
| 2 | India PIN code + locality dataset and validation | ✅ Done |
| 3 | Space listing, owner onboarding, admin verification, PIN search | ✅ Done |
| 4 | Teacher → Space enquiry + private mutual agreement (no money) | ⬜ Not started |
| 5 | Programmes bound to Spaces (MIND / BODY / SPECIAL NEEDS) | ⬜ Not started |
| 6 | Participant registration and checkout (Community = free; Cashfree) | ⬜ Not started |
| 7 | Community Partner Network | ⬜ Not started |
| 8 | Admin Localities / Spaces / Impact reporting | ⬜ Not started |
| 9 | End-to-end, security and SEO regression, release | ⬜ Not started |

Other deferred items:
- International (USD) prices
- PayPal / Cashfree live checkout activation
- Google search rules (controlled search release)
- Payouts and billing
- Tax and legal wording

## 3. Phase 1 — Global Venue ownership (done)
**Who can claim and manage venues:** only empanelled teachers (L2/L3), Council Gurus and admins. Yoga Seekers and non-empanelled teachers see a "not eligible" screen.

**Screens**
| Screen | Route | What it does |
|---|---|---|
| Venue directory / city / venue profile | `/venues`, `/venues/in/[city]/[venue]` | Public listing. Claim button on the profile. |
| List your Venue + Review & Submit | `/venues/submit` | Public form with a final review step. |
| Claim this venue | `/app/venue/claim/[id]` | Shows the claim form, the status of an existing claim, or "not eligible". |
| Venue Listing Dashboard (My Venues) | `/app/venue` | Counts, filters, venue cards, and "Add another venue" (list a new one or claim an existing one). |
| Venue Profile Dashboard | `/app/venue/owned/[id]` | Profile, ownership, contact and preferences, with Save / Discard / Preview. |
| Review & Submit (owner changes) | inside the Venue Profile Dashboard | Sensitive changes are sent for admin review. |
| Public Venue Listing Preview | `/app/venue/owned/[id]/preview` | Shows how the venue looks publicly. |
| Admin Venue Claims | `/app/admin/venue-claims` | Approve / reject / dispute claims. A Conflict badge marks competing claims. |
| Admin Venue Review | `/app/admin/venue-review/[id]` | Pending changes, owner, claims and versions. |

**Rules**
- **Low-risk fields** go live as soon as they are saved: contact, website, amenities, open months, getting there, things to carry, open to partnerships.
- **Sensitive fields** need admin approval: name, location, capacity, description, photos, venue type, best for.
- **Competing claims:** only one can be approved. Others get a conflict response.
- **Simultaneous edits:** saves are protected against overwriting each other.

## 4. Phase 2 — India PIN code + locality foundation (done)
- **Dataset:** India Post all-India PIN directory (data.gov.in).
  - 19,097 PIN codes, 154,746 localities, 36 states/UTs.
  - Ladakh and the merged Dadra and Nagar Haveli and Daman and Diu UT are corrected.
- **Behaviour:** the user types a 6-digit PIN code. The district and state fill in automatically, and the user picks the locality from the PIN's list.
- **Validation:** applies to Spaces only. These are rejected:
  - PIN codes not in the 6-digit format
  - PIN codes not in the dataset
  - countries other than India
  - a locality that doesn't belong to the PIN

  The country is always stored as India.

**Screens**
| Screen | Route |
|---|---|
| PIN + locality picker (reusable component) | used in the Space listing wizard |
| Admin Spaces Localities (dataset totals + PIN lookup tester) | `/app/admin/spaces-localities` |

## 5. Phase 3 — NOSTOPS Spaces listing and verification (done)
**Owner decisions applied**
- **Who can list:** anyone with a NOSTOPS account can list a Space.
- **Required private documents** (only admins can open them):
  - proof of ownership or permission letter
  - society or building NOC
  - government photo ID
  - address proof
- **Models:** Commercial / Subsidised / Community are recorded only. No price or fee fields exist yet. Fees are decided in Phase 6, using the "group booking prices formula per participant".
- **Verification:** NOSTOPS admins verify each Space, with an optional site-visit checklist.

**Screens**
| Screen | Route | What it does |
|---|---|---|
| List a Space (6-step wizard) | `/app/spaces/new`, `/app/spaces/[id]` | 1 Location (PIN, locality, street address, landmark) · 2 Details (name, type, capacity, area, description, availability, contact) · 3 Model · 4 Facilities & photos (up to 5) · 5 Documents (4 required) · 6 Review & submit (lists anything missing). Each step saves the draft. |
| My Spaces | `/app/spaces` | The owner's Spaces with status, any note from NOSTOPS, and history. |
| Admin Spaces Verification queue | `/app/admin/spaces` | Tabs: Under review / Changes requested / Approved / Not approved / Draft / All. |
| Admin Space review | `/app/admin/spaces/[id]` | Details, photos, private documents, site-visit checklist (address matches, space matches photos, capacity confirmed, safe and clean, washroom and water, documents match the owner, plus visit date and notes), and the decision: approve, ask for changes, or reject. Asking for changes and rejecting need a note. |
| Spaces near me (public) | `/spaces?pin=XXXXXX` | Spaces at that PIN, more Spaces in the same district, and NOSTOPS teachers nearby (matched by the teacher's city against the PIN's district and areas). |
| Space detail (public) | `/spaces/[id]` | Approved Spaces only. Shows no owner identity, contact details or documents. |

**Statuses:** Draft → Under review → Approved · Live / Changes requested / Not approved.
- An owner can edit a Space that is in Draft, Changes requested or Not approved.
- A Space that is under review or approved is locked.

**Notifications:** the owner is emailed on each admin decision.

**Current behaviour to note:**
- Public Spaces pages are hidden from search engines until the Google search rules are set.
- Approved Spaces can't be edited by the owner and can't be unpublished by admins.

**Menu entries:**
- Seeker: "Spaces near me" and "My Spaces".
- Teacher and Guru: "My Spaces".
- Admin: "Spaces Verification" and "Spaces Localities".

## 6. Test accounts (Preview)
| Persona | Email | Password |
|---|---|---|
| Yoga Seeker | employee.demo@nostops.com | <demo-password> |
| Yoga Teacher (L2 empanelled) | teacher.demo@nostops.com | <demo-password> |
| Council Guru | guru.demo@nostops.com | <demo-password> |
| Organisation (HR) | hr.demo@nostops.com | <demo-password> |
| Admin | admin.demo@nostops.com | <demo-password> |

Login: `/login` → Email / Password tab.

## 7. Integrations in use
- Cloudflare R2 / Emergent Object Storage (photos)
- Emergent email
- Cashfree (venue checkout only)
- PayPal (keys collected, live checkout deferred)
- Twilio (OTP)
- Emergent LLM key (AI features)

## 8. Living tracker
`/app/ARCHITECTURE.md` holds the phase plan, the rules in force and the screen inventory. It is updated at the end of every phase.
