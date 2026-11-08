# NOSTOPS Phase B2.1 — Read-Only Programme Accuracy Audit (2026-06)

I changed no product code, preview data or production data, and published nothing.
OEA-01, pricing, revenue shares, royalties, payments and teacher assignments are untouched.

## Method
- Authoritative source: `backend/institutional.py` `_SEED_PROGRAMMES` (SEED_VERSION inst-seed-v2) → `inst_council_programmes`
  + `inst_programme_versions`. I read the preview DB (10 programmes, NOSTOPS-PGM-2026-000001…000010, each with one v1.0 APPROVED
  version) and it matches the seed. Live www.nostops.org /programmes HTML shows the same values (16× "Weekly", 4× "2× per week").
- Renderings checked in code, and on the live HTML where marked (L): /programmes (L), /for-organisations, the 3 cohort showcase
  pages (L), the legacy /for-companies (L), /for-educational-institutions (L) and /for-startup-networks pages, /faq,
  /for-organisations/impact, /for-organisations/resources, the guides, the EventCreatorWizard, /events/[slug] (the 6 live demo
  events, L), the legacy New Batch / booking-invite / BatchShare flow, the in-app ROI calculator, the admin proposal templates
  and the AI Guru.
- AI Guru: the chat endpoint writes a usage counter (`guru_chat_stats`), so I didn't call it. I replayed the exact system prompt
  (build_system_prompt + assemble_knowledge_text + render_cta_catalog, claude-sonnet-4-6) offline from /tmp/guru_offline_probe.py,
  with no DB access and 8 questions. The outputs are in /tmp/guru_offline_probe.json. LLM output varies, so these are samples.
- Deployment health check (same session): PASS. Lint shows only 29 "rule definition @next/next/no-img-element not found" notices,
  a pre-existing linter-config gap, with no code errors.

## 1. Ten-programme audit matrix (all: content_status SEED_DEVELOPMENT, v1.0, "Curated by the NOSTOPS Council of Yoga Gurus",
guru_attribution null, approved_claims [], approved_delivery_structure null, level "All levels")

| # | ID | Programme · Pathway | Audience (record) | Objectives / activities | Duration · frequency · engagement length | Group size | Teacher requirements | Issues |
|---|----|----|----|----|----|----|----|----|
| 1 | PGM-000001 | Yoga for Focus & Attention · MIND | Working professionals, Students, Teams | Breath, posture, attention practices; support focus, clarity, settle a busy mind | 45–60 min (default 60) · Weekly · not defined | 15–30 | Empanelled + group-facilitation experience | Weekly vs 2×/wk rate card; Tier 2 to 40; EDU demo event cap 60 (07:00–20:30) titled "Exam Readiness & Emotional Balance"; COMPANY demo "Nervous System Resilience" |
| 2 | PGM-000002 | Yoga for Stress Resilience · MIND | Working professionals, Teams, Caregivers | Manage everyday stress, resilience, calm | 45–60 (60) · Weekly · not defined | 15–30 | + breath & relaxation experience | No Students (EDU fit); "Ease everyday stress" outcome-leaning; NETWORK demo cap 40, "Clear Decision Making" not an objective |
| 3 | PGM-000003 | Yoga for Better Sleep · MIND | Working professionals, Shift workers, Adults | Relaxation, wind down, "encourage restful sleep" | 30–45 (45) · Weekly · not defined | 12–25 | + restorative practice experience | Name/objective sleep-outcome framing; below 45–60 min phase copy; Guru said 40 can join one batch |
| 4 | PGM-000004 | Yoga for Emotional Wellbeing · MIND | Working professionals, Students, Community groups | Emotional balance, wellbeing, self-awareness | 45–60 (60) · Weekly · not defined | 12–25 | + mindful facilitation | Could be read as a mental-health offer (Council wording); Tier 2 above 25 |
| 5 | PGM-000005 | Yoga for Strength & Mobility · BODY | Working professionals, Active adults, Teams | Postural practices; strength, flexibility, mobility | 45–60 (60) · 2× per week · not defined | 15–30 | + postural practice | 2×/wk sold as one dated event; "Improve flexibility" outcome verb |
| 6 | PGM-000006 | Yoga for Posture & Back Care · BODY | Desk-based professionals, Adults | Healthy posture, "care for the back", ease stiffness | 30–45 (45) · Weekly · not defined | 12–25 | + posture/back-care practice | "Back care" vs the Guru's Special Needs examples (neck/back pain): unclear pathway boundary; EDU demo uses it for students, cap 50, 60 min |
| 7 | PGM-000007 | Yoga for Energy & Stamina · BODY | Working professionals, Active adults, Teams | Active practices; energy, stamina | 45 (45) · 2× per week · not defined | 15–30 | + active group practice | NETWORK demo cap 45, 60 min, titled "Mobility & High-Performance Habits" |
| 8 | PGM-000008 | Accessible Chair Yoga · SPECIAL NEEDS | Seated participants, Older adults, Workplaces | Seated, adaptable practice; gentle movement | 30–45 (45) · Weekly · not defined | 8–20 | + accessible/adaptive (hard verified gate in matching) | "Workplaces" is a setting, not an audience; mostly below the 15-person rate-card floor; illustrative examples only |
| 9 | PGM-000009 | Gentle Yoga for Limited Mobility · SPECIAL NEEDS | Participants with limited mobility, Older adults | Gentle movement adapted to ability; comfort | 30–45 (45) · Weekly · not defined | 8–20 | + adaptive/accessible (verified gate) | Older-adult framing fits EDU/Startup poorly; below the pricing floor |
| 10 | PGM-000010 | Calming Practices for Sensory Wellbeing · SPECIAL NEEDS | Sensory-sensitive participants, Support groups | Calm, predictable practice; sensory wellbeing | 30 (30) · Weekly · not defined | 6–15 | + calming/sensory-aware (verified gate) | Max 15 = the rate-card minimum (no published price for typical sizes); 30 min vs 45–60 phase copy; "Support groups" ambiguous |

Total engagement length is not defined on any record. Lengths (1/3/6/12 months) exist only in the pricing layer (lib/org/pricing.ts).

## 2. Verification of the six known issues
1. Multi-month 2×/week offers vs single-date wizard: CONFIRMED (Missing capability). pricing.ts SESSIONS_PER_WEEK=2, MONTH_STEPS 1/3/6/12.
   The wizard has one "Date *" field. EventCreate has a single event_date. `inst_event_sessions` is indexed but no code writes to it.
   "Create Again" (duplicate_event) copies one event at a time, so a 3-month 2×/wk plan would take 24 separate events, each matched
   and registered separately. The retired New Batch flow did have multiple session_dates.
2. "Weekly" vs two sessions/week: CONFIRMED. Of the 10 records, 8 say Weekly and 2 say 2× per week. Every pricing surface says 2/week
   (cohort pages, legacy pages, estimator, proposal emails, Guru KB, booking-invite). BatchShare says 3/week (12/month). The remote ROI
   calculator says 3/week. The legacy FAQ says "weekly cadence".
3. Group size vs pricing bands up to 40: CONFIRMED and wider than reported. No programme recommends more than 30. Tier 2 (29–40)
   and the estimator (15–40, all cohorts) exceed every programme's maximum. Special Needs programmes (6–15, 8–20) mostly fall below
   the 15-person floor. Only the legacy FAQ reconciles this ("batches of ~18 … run several batches in parallel"), and the cohort
   pages don't say that. The Guru told a user 40 people can join one Better Sleep (12–25) batch. Demo events run 40–60 capacity.
4. Audience fit for Educational Institutions / Startup & Networking Groups: PARTLY CONFIRMED. Only 2 of 10 records list Students;
   none mention founders or members. "Older adults", "Caregivers", "Shift workers", "Support groups" and "Workplaces" fit these
   cohorts poorly. The EDU scope itself is inconsistent: "Colleges and universities" (cohort copy) vs "from school students"
   (legacy FAQ) vs "Younger students — short, playful" (guide).
5. AI Guru vs authoritative content: CONFIRMED. The KB holds programme names only (knowledge.py CURRENT_PROGRAMME_EXAMPLES), so the
   Guru fills gaps with rate-card figures. Offline replay: (a) said the wizard supports a 3-month 2×/week booking ("Yes,
   absolutely"); (b) said frequency is chosen at event setup (no such field); (c) gave Focus & Attention as "2 sessions per week"
   (record: Weekly) and "15–40 participants" (record: 15–30); (d) said 40 can join one Better Sleep batch; (e) couldn't give Chair
   Yoga's duration (fell back to "not confirmed"); (f) called a SEED_DEVELOPMENT programme "designed and approved by the Council"
   (linked to OEA-01); (g) emitted a malformed "[[for_organisations]]" token that CTA_TOKEN doesn't strip, so it would show as
   literal text. Health-safety and "no outcome promise" answers were correct.
6. Benefits implying outcomes or delivery commitments: CONFIRMED in the marketing and legacy layers (see register). The programme
   records themselves are mostly modest "Support…" wording. A few verbs lean towards outcomes ("Improve flexibility", "Build
   functional strength", "Ease everyday stress/stiffness", "Encourage restful sleep"); that wording is a Council decision.

## 3. Page-by-page discrepancy register
Severity: Critical = a live commercial or delivery promise the product can't meet, or that the same page contradicts. High =
misleading to a buyer or participant. Medium = inconsistent or ambiguous. Low = minor.
Classes: CONTENT (content-only correction) · BEHAVIOUR (product behaviour mismatch) · CAPABILITY (missing capability) ·
POLICY (unresolved business-policy decision) · COUNCIL (Council editorial decision).

| ID | Sev | Surface | Issue | Evidence (source) | Class |
|---|---|---|---|---|---|
| B2-01 | Critical | Cohort pages + legacy pages + proposals vs wizard | Sold as 1–12-month, 2×/week engagements; wizard creates one dated session | lib/org/pricing.ts L12-17, L78-83; EventCreatorWizard.tsx L626 (single Date); institutional.py EventCreate L1381-1386; no writer for inst_event_sessions | CAPABILITY + POLICY |
| B2-02 | Critical | /for-educational-institutions (L) | FAQ promises Tier 1/2 discounts and "semester/year-long … save even more"; the same page's rate card says EDU is a flat rate, no discounts | for-educational-institutions/page.tsx L39 vs pricing.ts L22-27 | CONTENT |
| B2-03 | Critical | /app/org/roi (corporate nav + OrgHome) | Remote ROI shows 3/week, batch 40, 72 sessions, ₹5,000/member/mo, ₹417/session, "Revenue-share model · 60-40". Published: 2/week, ₹300/session (₹2,400/mo), 70/80/85% | components/app/org/RoiCalculator.tsx L86-131; live GET /api/corporate/roi-calculator | POLICY (no change without owner) |
| B2-04 | High | AI Guru | Says the wizard supports multi-month 2×/week booking and frequency selection | /tmp/guru_offline_probe.json Q3, Q6; knowledge.py L179-187, L192-211 | CONTENT (KB) |
| B2-05 | High | AI Guru | Answers programme frequency and group size from the rate card instead of the record; 40 in one Better Sleep batch | probe Q1, Q2; knowledge.py L22-42 (names only) | CONTENT (KB) |
| B2-06 | High | /programmes (L), wizard cards and preview, event pages | 8 of 10 "Weekly" vs 2×/week pricing everywhere | inst_council_programmes.recommended_frequency; programmes/page.tsx L80; EventCreatorWizard L547, L906; events/[slug] L208 | COUNCIL + POLICY |
| B2-07 | High | Pricing layer vs programme records | Tier 2 29–40 and estimator 15–40 exceed every programme maximum (≤30); no "parallel batches" explanation on cohort pages | pricing.ts L17, L47-50; PricingEstimator.tsx L69-84 | POLICY + COUNCIL |
| B2-08 | High | Special Needs pricing | SN programmes (6–15, 8–20) sit mostly below the 15-person rate-card floor, so the pathway has no published price for typical group sizes. Works against "three equal pathways" | records #8-10; pricing.ts PARTICIPANT_RANGE | POLICY |
| B2-09 | High | Legacy pages (L, in sitemap) | "What every programme includes": baseline assessment, workshop "Yoga for Performance & Posture" (not a Council programme), structured weekly curriculum, HR midpoint check-in (shown to EDU/Startup too), closing impact report, desk-yoga, executive 1:1s. None of these is supported | OrgLanding.tsx L25-30, L97-105 (remote program_structure.includes); live HTML | CONTENT (+ POLICY if any is really delivered) |
| B2-10 | High | /for-companies (L) | "batches of ~18 … weekly cadence"; "Pricing is per batch"; "Groups of 18–28 … Tier 1" (rate card: per participant, 15–28) | for-companies/page.tsx L37-38 | CONTENT |
| B2-11 | High | /for-startup-networks, /for-educational-institutions | Same "per batch of ~18" and "18–28" errors | for-startup-networks L39; for-educational-institutions L39 | CONTENT |
| B2-12 | High | Legacy pages + /faq (FAQPage JSON-LD) | "Every programme includes a baseline … midpoint check-in … closing impact summary"; "optional executive 1:1"; "optional 1:1 sessions for leadership" | for-companies L31, L33, L39; for-startup-networks L31; faq/page.tsx L52 | CONTENT (+ POLICY) |
| B2-13 | High | PHASES (cohort pages, legacy pages, proposal emails) | Phase II "habit-building curriculum and a mid-programme impact review"; Phase III "leadership 1:1s and an annual wellbeing report"; no feature or record supports these | pricing.ts L81-82; proposal-templates.ts L19-29 | CONTENT + POLICY |
| B2-14 | High | /for-educational-institutions | "The curriculum is tailored to your cohort — from school students to postgraduate". Council content can't be edited, and the cohort copy says colleges/universities | page.tsx L38; EventCreatorWizard L917; cohort-copy.ts L56 | CONTENT + POLICY (EDU scope / minors) |
| B2-15 | High | BatchShare WhatsApp message (OrgHome, existing batches) | "3 per week (12 per month)", "Dedicated Yoga Guru & Pracharak", "3 months", "Meditation & mindfulness" regardless of programme | BatchShare.tsx L31-35 | CONTENT |
| B2-16 | Medium | /booking-invite/[token] | "3-month corporate yoga program" for every cohort; fixed perks "2 sessions per week", "Guru & Pracharak", "Meditation & mindfulness included", "at your office", whatever the batch actually has | booking-invite/[token]/page.tsx L19-24, L103, L167 | CONTENT |
| B2-17 | Medium | Live demo events (6, L) | Capacities 60/50/40/45 exceed programme max (30/25/30/30); 60-min sessions on 45 and 30–45-min programmes; EDU-001 07:00–20:30; titles add themes no record supports (Nervous System Resilience, Exam Readiness & Emotional Balance, Clear Decision Making, High-Performance Habits, Mobility on Posture & Back Care) | seed_demo_ecosystem.py L135-283; live /events/* | CONTENT (demo data, needs approval) |
| B2-18 | Medium | Public event page | Single-date event shows the programme "🔁 Weekly/2× per week" chip, which suggests a recurrence the event doesn't have | events/[slug]/page.tsx L179-180, L208 | BEHAVIOUR |
| B2-19 | Medium | Wizard "Programme Economics" | "Frequency" row echoes the programme field as if it were an economics input; capacity has no max or warning against the programme's group size | EventCreatorWizard L646-648, L723-725 | BEHAVIOUR |
| B2-20 | Medium | Wizard vs pricing pages | Wizard: "free to attend (payments arrive in a later release)"; pricing pages sell paid per-participant plans; backend supports PAID + participant_fee. Who pays is unresolved | EventCreatorWizard L715; institutional.py L1400-1401 | POLICY |
| B2-21 | Medium | Wizard preview "Teacher needs" | "Experience with restorative / postural / … practice" isn't checked in matching (only the SN adaptive gate is enforced) | EventCreatorWizard L908-911; institutional.py _select_teacher L3233-3281 | BEHAVIOUR |
| B2-22 | Medium | Programme audiences | Only 2 of 10 list Students; none list founders or members; "Older adults", "Caregivers", "Shift workers", "Support groups", "Workplaces" fit EDU/Startup poorly | records | COUNCIL |
| B2-23 | Medium | /for-organisations hub | Cohort tags (Leadership, Team Cohesion, Focus & Productivity, Examination Support, Founder Resilience, Clarity & Decision Making, High-Performance Habits) not supported by any programme objective; H1 "Healthy Nervous System Intelligence"; "Calmer minds… Stronger organisations" | for-organisations/page.tsx L55, L68, L81, L122, L170 | CONTENT + COUNCIL |
| B2-24 | Medium | /for-organisations hub | "Explore demonstration organisations and real public programme events": the events are illustrative, not real | for-organisations/page.tsx L240 vs CohortShowcase.tsx L83 | CONTENT |
| B2-25 | Medium | Metadata and heroes (legacy + cohort) | "measurable outcomes", "ease exam stress, improve focus", "Beat burnout", "Reduce stress, improve posture", "exam readiness" | for-companies L10, L27; for-educational-institutions L10; for-startup-networks L10 + OG images; cohort-copy.ts L45, L56, L66 | CONTENT |
| B2-26 | Medium | /faq, guides | "on-site or online" / "online or hybrid": there's no online delivery mode (venues only; Offline JSON-LD); /faq omits the 1-month starter | faq L51; guides.ts L176, L200; events/[slug] L80 | CONTENT (or CAPABILITY) |
| B2-27 | Medium | Phase / starter copy | "45–60 min" for every plan; 6 programmes run 30–45, 45 or 30 min; same per-session price whatever the length | pricing.ts L79-80; records #3, 6-10 | POLICY + COUNCIL |
| B2-28 | Medium | /programmes | "Evidence-informed" claim, while approved_claims is empty for all records | programmes/page.tsx L16, L50 | COUNCIL |
| B2-29 | Medium | AI Guru KB (Special Needs) | Medical-condition examples (neck/back pain, cervical spondylosis, frozen shoulder) while BODY has "Posture & Back Care", so the pathway boundary for back/neck concerns is unclear | knowledge.py L158-169; record #6 | COUNCIL |
| B2-30 | Medium | /for-startup-networks | "A network can sponsor one programme spanning multiple portfolio teams". The data model has one organisation per event, with no portfolio sponsorship, reporting or billing | page.tsx L33, L36; EventCreate organisation_id | CAPABILITY |
| B2-31 | Low | Pricing teacher-share lines | No teacher share shown for the 1-month starter (70/80/85 cover 3/6/12) | pricing.ts L72-76 | POLICY (no change) |
| B2-32 | Low | /for-organisations/impact, /resources | "return across sessions" (actually across events); "choose a programme that matches that outcome" | impact L37; resources L70-71 | CONTENT |
| B2-33 | Low | Guides | "even 15–20 minutes", "Younger students — playful": no such programme | guides.ts L231, L253 | CONTENT |
| B2-34 | Low | AI Guru | Malformed CTA token rendered as literal text | probe Q4; router.py L40 | BEHAVIOUR |
| B2-35 | Low | Calming Practices record | "Support groups" audience is ambiguous (clinical connotation) | record #10 | COUNCIL |
| LINK | — | OEA-01 (left unchanged) | SEED_DEVELOPMENT + "not final Council-approved" disclaimer (wizard preview only) vs "✓ Council-Curated", "v1.0 · approved", APPROVED version; Guru repeats "approved" | institutional.py L1040, L1190-1202, L1224-1230 | Owner decision pending |

Verified OK: the three pathways are equal in the wizard (no cohort filter on programmes; all 9 combinations selectable). New Batch is
retired (moved notice, BFF 410). The SN hard verified-competence gate works in matching. The suitability note appears on every
pathway's event page. The illustrative SN examples are non-bookable and have no teacher. Guru health-safety and no-outcome answers
are correct. Special Needs programme names and audiences use person-first, non-stigmatising wording.

## 4. Recommended minimal correction plan (nothing implemented)
Owner / Council decisions needed first:
- D1 (Council): the frequency standard per programme (Weekly vs 2×/week). Any record change ships as a NEW ProgrammeVersion (v1.1) so the
  v1.0 snapshot, IDs and history stay intact.
- D2 (Owner): what the self-service wizard sells. Either a single session, with multi-month plans arranged only through "Request a
  proposal", or approve a separate build of multi-session events (B2-01). Wording must not imply the capability exists before it does.
- D3 (Owner + Council): whether the 15–28 / 29–40 tiers mean total enrolment across parallel batches capped at the programme maximum.
- D4 (Owner): Special Needs pricing for groups under 15.
- D5 (Owner): EDU scope (schools/minors or colleges only).
- D6 (Owner): whether baseline assessment, impact review, executive 1:1s or a wellbeing report are actually delivered. If not, remove them.
- D7 (Owner): the remote ROI calculator's 60-40 split, ₹5,000 and 3/week vs the published card (not changed in this phase).
- D8: OEA-01 stays as it is.

Phase 1, content only (low risk, no new capability):
1. Legacy /for-companies, /for-educational-institutions, /for-startup-networks: either 308-redirect them to the cohort showcase pages
   (smallest change: removes B2-02, 09, 10, 11, 12, 14 and part of 25 at once) or correct the FAQs and stop rendering the remote
   "includes" list. Fix the /faq organisation answers.
2. PHASES Phase II/III text: remove the unsupported deliverables (pending D6). The proposal emails inherit the fix.
3. BatchShare and booking-invite: neutral, cohort-agnostic copy with no fixed frequency, no two-teacher promise and no
   "meditation included".
4. Guru KB: add a programme-facts section generated from the programme records (one source of truth), plus explicit statements that
   one event is one dated session, frequency can't be chosen in the wizard, and multi-month plans go through a proposal. Also add a
   rule never to give a programme's frequency or group size other than the record values.
5. Hub copy: "illustrative" instead of "real" events (B2-24); align cohort tags and headlines with what the programme objectives
   actually support (B2-23, 25).
6. Demo seed (needs approval, since it changes demo data): event titles, capacities and durations within each programme's record.
Phase 2, small product guards: a capacity soft-warning above the programme maximum; a clear "This creates one session" line in the
wizard; label the event-page frequency chip "Programme guidance" or hide it on single-date events; label "Teacher needs" as Council
guidance unless it's enforced; fix the CTA token parsing.
Phase 3, separate approved build: multi-session events (start date, weekdays, end date or session count, using inst_event_sessions,
per-session attendance) and a decision on the payment model in the wizard (D2, B2-20).
