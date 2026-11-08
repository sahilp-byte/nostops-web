> ✅ REBUILT (owner approved, 2026-06 fork — NST-003): the full §4 implementation incl. the extras (pricing block, MIND/BODY/SPECIAL NEEDS one-liners, onsite-only copy, UTM capture). Team inbox: nostops.org@gmail.com (env ORG_ENQUIRY_TEAM_EMAIL). Reply SLA: "within 2 working days". See PRD.md "ORG ENQUIRY REBUILT".

# NOSTOPS — Organisation Acquisition & Enquiry Workflow Audit (findings only, no changes made)

Scope traced: /for-organisations → cohort pages (/for-organisations/{companies,educational-institutions,
startup-networking-groups}) → legacy cohort pages (/for-companies, /for-educational-institutions,
/for-startup-networks) → /programmes → /contact → sign-up → /app/org/events/new → backend → admin.

## 1. Current workflow (as built)
| Step | What a visiting organisation can do today | Code |
|---|---|---|
| Hub | /for-organisations: 3 cohort cards, 4-step "How it works", trust strip, CTAs **Create a Programme** (→ /app/org/events/new, login-gated) · Explore Programmes · **Request Assistance** (→ /contact) | `app/(public)/for-organisations/page.tsx` |
| Cohort pages | Hero + 4 steps + "Illustrative example" demo orgs/events. CTAs: Create a Programme (login) · Explore Programmes. **No pricing, no durations, no enquiry option** | `components/org/CohortShowcase.tsx`, `lib/org/cohort-copy.ts` |
| Legacy cohort pages | Pricing (₹1,98,000 per 18-person batch / 3 months, ₹3,667/person/month), 3/6/12-month phases, group-discount tiers, revenue share, FAQs. CTAs: Create a Programme (login) · **"Model your exact ROI →" goes to the TEACHER join page** · Request Assistance | `components/public/OrgLanding.tsx` |
| Programmes | Catalogue grouped MIND / BODY / SPECIAL NEEDS (labels only), "Council-Curated" badge, group size / frequency / duration. CTA "Create a Programme" → /for-companies (company page for every cohort) | `app/(public)/programmes/page.tsx` |
| Contact | mailto:nostops.org@gmail.com + "Ask AI Guru". No form | `app/(public)/contact/page.tsx` |
| Account | /signup offers only **Yoga Seeker** or **Yoga Teacher**; its "Organisation" card loops back to /for-companies; /choose-role redirects everyone to the teacher join page. A new organisation has **no sign-up route**. (Any logged-in account can self-create an organisation inside the event wizard, but nothing tells the visitor this.) | `components/auth/SignupRoleChooser.tsx`, `app/(auth)/choose-role/page.tsx`, `backend/institutional.py POST /organisations` |
| Backend persistence | **No organisation enquiry / lead record exists.** The only capture path is an AI Guru "Support Request" (category "Organisation"), stored in `guru_support_requests` with support statuses OPEN → IN_PROGRESS → WAITING_FOR_USER → RESOLVED → CLOSED | `backend/guru/support.py`, `/app/admin/support` |
| Notifications | Support requests send a team email to `NOSTOPS_SUPPORT_EMAIL` (not set → defaults to care@nostops.org) via Emergent-managed email (`backend/email_util.py`; key present). No acknowledgement to the enquirer | `backend/guru/support.py` |
| Source / campaign | Not captured anywhere (no UTM, referrer or source-page capture; GA4 only) | — |
| Staff follow-up | Admin Support Queue (admin-only, server-gated). **No sales stages** (New → Contacted → Qualified → Proposal Sent → Negotiation → Won/Lost). No CRM integration exists, so there is nothing to duplicate | `app/app/admin/support/page.tsx` |

## 2. Can a visitor understand…
| Question | Status | Evidence |
|---|---|---|
| Who each programme is for | 🟡 Partial | Cohort intros + legacy "Built for…" cards; programme cards show group size only |
| What MIND / BODY / SPECIAL NEEDS mean | 🔴 No | Category names only, no definitions on any public page |
| Delivered onsite by NOSTOPS-provided instructors | 🟠 Inconsistent | Companies copy says "on-site by a NOSTOPS-verified teacher"; Education/Startup copy doesn't say onsite; legacy FAQ says "Both… office, over video, or a hybrid" |
| Role of senior gurus in curation | 🟡 Partial | "Council-curated" badge + per-programme council attribution; explained on /trust, not on the org pages |
| Durations, pricing, commercial terms | 🟠 Only on legacy pages | Primary-nav cohort pages show none; no GST / payment / cancellation terms anywhere (refund page missing — see nav audit) |
| How to request a discussion / proposal | 🔴 No | Only a mailto link and the chatbot |

## 3. Defects
| # | Defect | Sev |
|---|---|---|
| D1 | No organisation enquiry form, record, ID or confirmation — the core conversion step is missing | 🔴 |
| D2 | "Create a Programme" is the main CTA everywhere but needs an account that new organisations can't create (sign-up offers only Seeker/Teacher) — dead end for new leads | 🔴 |
| D3 | "Model your exact ROI →" (legacy pages) sends organisations to the teacher sign-up | 🔴 |
| D4 | No team notification or enquirer acknowledgement for org interest; notification inbox not configured (falls back to care@nostops.org) | 🟠 |
| D5 | No lead stages, owner, notes history or won/lost tracking | 🟠 |
| D6 | No source-page / UTM campaign capture | 🟠 |
| D7 | MIND / BODY / SPECIAL NEEDS not explained | 🟠 |
| D8 | Onsite-delivery message inconsistent (legacy FAQ offers online/hybrid) | 🟠 |
| D9 | Pricing & durations missing from the primary cohort pages | 🟡 |
| D10 | Legacy pages show "40 / 100 organisations" (backend landing-stats) while the approved public figure is 15 (platform-stats) — conflicting, unverifiable number | 🟠 |
| D11 | /programmes "Create a Programme" and /contact "Organisations" both point to the Companies-only legacy page | 🟡 |
| ✅ | Category vocabulary is clean: exactly MIND / BODY / SPECIAL NEEDS, "Specific Needs" never appears (backend enforces + tests), no "Other" category in org flows | — |
| ✅ | Demo organisations are labelled "Illustrative example"; no fake logos/testimonials found on org pages | — |

## 4. Proposed implementation (needs approval)
1. **Backend** (`backend/org_enquiries.py`, Mongo `org_enquiries`, served locally like the other modules, X-Pulse-Secret only):
   create (pydantic validation, ID `ENQ-XXXXXX`, duplicate rule: same email/phone + organisation within 24h returns the existing reference instead of a new lead),
   list / detail / update (stage, owner, note, stage history), notification status + "resend" endpoint.
2. **BFF** `POST /bff/org-enquiry`: origin check, hidden honeypot field, image CAPTCHA (reuse the existing venue CAPTCHA signer), 5 submissions / hour / IP, server-side validation & length caps, source page + first-touch UTM.
3. **Form** `OrgEnquiryForm` (8 fields): Organisation name · Contact name · Work email and/or phone (one required) · Cohort (3) · City · Approx. participants · Programme interests (MIND / BODY / SPECIAL NEEDS checkboxes) · Preferred duration (3-month pilot / 6 / 12 months / Not sure) + start month · Consent checkbox linking /privacy. Optional short message.
   Placed on /for-organisations (#enquire), each cohort page (cohort pre-selected), legacy cohort pages, /programmes, /contact.
4. **Confirmation**: "Thanks — your enquiry ENQ-XXXXXX has been received. The NOSTOPS team will reply within [owner-confirmed SLA]." + acknowledgement email; team email with a link to the admin record.
5. **Staff**: `/app/admin/org-enquiries` (admin-only): list + filters (stage, cohort, city), detail with stage change (New → Contacted → Qualified → Proposal Sent → Negotiation → Won / Lost), owner, notes, history, notification status/resend. Admin nav entry + badge.
6. **CTAs**: "Request a proposal" (→ #enquire) beside "Create a Programme" on all org pages; fix D3, D11.
7. **Content** (owner-approved copy only): one-line definitions of MIND / BODY / SPECIAL NEEDS; consistent onsite statement; pricing block on cohort pages reusing the existing legacy figures; replace "40 / 100" with the approved 15 or remove.

## 5. Acceptance tests (release criterion)
1. Anonymous visitor submits the form from each cohort page → 200, ENQ id shown, record in Mongo with cohort, source page and UTM.
2. Missing/invalid fields rejected client-side AND server-side (direct BFF POST) with field errors.
3. Honeypot filled → silently accepted, nothing stored; wrong/expired CAPTCHA → 400; 6th submission in an hour → 429.
4. Same enquiry resubmitted within 24h → same ENQ id, no duplicate row.
5. HTML/script in fields stored as text and escaped in email + admin UI.
6. Team email + acknowledgement queued; on email failure the lead is still saved and marked "notification failed", resend works.
7. Non-admin (teacher, seeker, anonymous) → 401/403 on every enquiry list/detail/update route (BFF and backend secret).
8. Admin moves lead New → Contacted → … → Won; history + notes persist; filters work.
9. Categories shown are exactly MIND / BODY / SPECIAL NEEDS; "Specific Needs" / "Other" never appear.
