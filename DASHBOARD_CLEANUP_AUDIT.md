# Teacher Dashboard — Accessibility, Responsive & Cleanup Audit (Prompts 17 & 19)

Scope: the teacher-facing **"Your NOSTOPS Access"** experience — `TeacherAccessCard`,
`TeacherNextStep`, and the `TeacherHome` dashboard that hosts them. Backend untouched.

---

## Prompt 17 — Accessibility & Responsive pass

Changes applied to `TeacherAccessCard.tsx` + `TeacherNextStep.tsx`:

- **State is never colour-only.** Every status pill/chip carries a text label from the
  shared `FEATURE_STATE_LABEL` map (Unlocked / Completed / Pending / Action required /
  Locked). The Next Step title is prefixed with an `sr-only` status word
  ("Action needed" / "In progress" / "Complete").
- **Landmarks & headings.** The access card is `aria-labelledby` its `<h2>`; the Next
  Step is `role="region"` with an `aria-label` that includes the current directive.
- **Decorative glyphs hidden.** All emoji/`✓`/`🔒`/`›` icons are `aria-hidden="true"`,
  so screen readers read the meaning, not the ornament. Journey chips expose one
  `aria-label` ("Verification: Completed") and hide the duplicated inner text.
- **Current level semantics.** The active level card gets `aria-current="step"`.
- **Contrast (WCAG AA) fixes:**
  - Locked pill text `slate-500 → slate-600` on `slate-100`.
  - Locked level card text `slate-400 → slate-500`; removed the `opacity-70` dim that
    dragged text/icon below AA.
  - Status-pill text `emerald/amber/orange-700 → -800`; ring shades bumped for the
    amber/orange pills.
  - "Earning tools active" pill `emerald-700 → -800`.
- **Focus visibility.** The Next Step CTA gains a `focus-visible` outline ring.
- **Responsive.** The journey strip stacks vertically below `sm` (with the `›`
  separators hidden), the level grid stays a 3-up grid, and matrix rows wrap the reason
  text to its own line. Verified live at **390 px** (phone) — no overflow/clipping.

## Prompt 19 — Dashboard cleanup (no redundant / contradictory prompts)

**Consistency bug found & fixed (the headline item).** `teacher.demo` is *admin-verified*
and *empanelled* but the recorded InstaKYC ₹799 payment is missing, so the strict operate
gate is off. The dashboard simultaneously showed **"Verification: Completed"** /
**"Empanelment: Completed"** *and* a Next Step titled **"Complete Verification"** — a direct
contradiction. `computeNextStep` was rewritten to be **authoritative-status-first**: it no
longer keys off raw KYC. When a teacher is already verified + empanelled but not yet
operating, it now says **"Activate your earning tools · Complete InstaKYC ₹799"** instead of
"Complete Verification". All three surfaces (Next Step, the KYC/operate rows, the journey
chips) now agree.

**Redundant onboarding cards removed from the dashboard** (their info lives on the Access
Card + Next Step, or the dedicated pages):

| Removed from dashboard | Why | Where the info still lives |
|---|---|---|
| `OnboardingChecklist` (Next steps · Teacher protocol) | Duplicated the Next Step + Profile Completeness + Access Card rows (profile / video / KYC / empanelment). | Next Step (one directive) + Profile Completeness (per-section) + Access Card. |
| `EmpanelmentPath` ("Path to empanelment" + empanelled celebratory card) | Its "apply for empanelment" CTA duplicated the Next Step; the empanelled celebratory card duplicated the identity pill. | Full empanelment tracker at `/app/teacher/empanelment` (reached via the Next Step CTA + the Access Card empanelment row). |
| `OnboardingRoadmap` ("Your journey to going live" stepper) | The 5-stage stepper duplicated the Access Card journey strip (Level → Verification → Empanelment → Features). | Access Card journey strip. |

The component file `components/app/teacher/OnboardingRoadmap.tsx` is now orphaned (no
imports) and can be deleted; left in place as a reversible choice.

**No stray "Verify Now" / "Empanel" prompts bleed through.** Once InstaKYC is complete the
KYC CTA/row/sidebar item disappear; once empanelled the empanelment CTA/row/sidebar item
disappear; the "Get Verified" sidebar section drops entirely when both are done (unchanged,
re-confirmed). The one-time Unlock Celebration only renders for fully-verified teachers.

**Dashboard surfaces after cleanup (in order):** header → Access Card → Next Step →
Profile Completeness (hides at 100%) → Unlock Celebration (verified only) → identity →
My Widgets → stats → earnings → progression path → level teaser/timeline/guide → upcoming
sessions → recent reviews.

## Known backend/seed inconsistencies (NOT changed — read-only backend)

- `teacher.demo` header/identity badge reads **"Yoga Pracharak"** (from `badgePrimary`)
  while the level derives to **L3 Yoga Guru** (from `tier`). Conflicting seed fields; the
  Access Card uses the level derivation. Flagged for the backend team.

## Verification
- `yarn test:display` → **11/11** (9 core + 2 real-world edges).
- `yarn test:access` → **8 states × 14 features** all pass (no regression).
- ESLint clean on all touched files; live login screenshot (teacher.demo, 390 px) confirms
  the consistent "Activate your earning tools" directive and no contradictory prompts.
